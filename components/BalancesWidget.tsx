'use client'
import { Bet } from '@/types/bet'
import { BankTransaction } from '@/types/bank'
import { fmt } from '@/utils/currency'

interface Props {
  bets: Bet[]
  transactions: BankTransaction[]
}

function computeBalances(bets: Bet[], transactions: BankTransaction[]) {
  const bankTxs = transactions.filter(t => t.type !== 'debt')
  const debts   = transactions.filter(t => t.type === 'debt')

  const sign = (t: BankTransaction) => t.type === 'deposit' ? 1 : -1
  const pabloBank   = bankTxs.filter(t => t.person === 'Pablo').reduce((s, t) => s + sign(t) * t.amount, 0)
  const albertoBank = bankTxs.filter(t => t.person === 'Alberto').reduce((s, t) => s + sign(t) * t.amount, 0)

  const settledBets = bets.filter(b => b.result !== 'pending' && b.result !== 'void')
  const betsForPnL  = settledBets.filter(b =>
    !(b.fundedBy === 'alberto' && b.result === 'loss') &&
    !(b.fundedBy === 'pablo'   && b.result === 'loss')
  )
  const totalBetPnL = betsForPnL.reduce((s, b) => s + b.profit, 0)
  const betShare    = totalBetPnL / 2

  const pendingStake = bets.filter(b => b.result === 'pending').reduce((s, b) => s + b.stake, 0)

  const inFlightBets = bets.filter(b => b.result !== 'void')
  const albertoFrontedForPablo  = inFlightBets.filter(b => b.fundedBy === 'alberto' && b.result !== 'win').reduce((s, b) => s + b.stake / 2, 0)
  const pabloFrontedForAlberto  = inFlightBets.filter(b => b.fundedBy === 'pablo'   && b.result !== 'win').reduce((s, b) => s + b.stake / 2, 0)

  const pabloOwes   = debts.filter(t => t.person === 'Pablo').reduce((s, t) => s + t.amount, 0)
  const albertoOwes = debts.filter(t => t.person === 'Alberto').reduce((s, t) => s + t.amount, 0)

  const pabloNet   = pabloBank   + betShare - pabloOwes   + albertoOwes - albertoFrontedForPablo + pabloFrontedForAlberto
  const albertoNet = albertoBank + betShare - albertoOwes + pabloOwes   + albertoFrontedForPablo - pabloFrontedForAlberto

  const diff       = pabloNet - albertoNet
  const settlement = Math.abs(diff) / 2
  const debtor     = Math.abs(diff) > 0.005 ? (diff > 0 ? 'Alberto' : 'Pablo')  : null
  const creditor   = Math.abs(diff) > 0.005 ? (diff > 0 ? 'Pablo'  : 'Alberto') : null

  return {
    pabloBank, albertoBank, betShare, totalBetPnL, pendingStake,
    pabloOwes, albertoOwes,
    albertoFrontedForPablo, pabloFrontedForAlberto,
    pabloNet, albertoNet, settlement, debtor, creditor,
  }
}

function LineItem({ label, value, accent }: { label: string; value: number; accent?: string }) {
  if (value === 0) return null
  const color = accent ?? (value > 0 ? '#6EC200' : '#E85C2A')
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0' }}>
      <span style={{ fontSize: 11, color: 'rgba(240,235,224,0.4)' }}>{label}</span>
      <span className="num" style={{ fontSize: 12, fontWeight: 700, color }}>
        {value > 0 ? '+' : ''}{fmt(value)}
      </span>
    </div>
  )
}

function LineItemLight({ label, value, accent }: { label: string; value: number; accent?: string }) {
  if (value === 0) return null
  const color = accent ?? (value > 0 ? '#1B6B1B' : '#B03020')
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0' }}>
      <span style={{ fontSize: 11, color: 'rgba(27,43,27,0.45)' }}>{label}</span>
      <span className="num" style={{ fontSize: 12, fontWeight: 700, color }}>
        {value > 0 ? '+' : ''}{fmt(value)}
      </span>
    </div>
  )
}

export default function BalancesWidget({ bets, transactions }: Props) {
  const {
    pabloBank, albertoBank, betShare, totalBetPnL, pendingStake,
    pabloOwes, albertoOwes,
    albertoFrontedForPablo, pabloFrontedForAlberto,
    pabloNet, albertoNet, settlement, debtor, creditor,
  } = computeBalances(bets, transactions)

  const people = [
    {
      name: 'Pablo', light: true,
      bankVal: pabloBank, owes: pabloOwes, isOwed: albertoOwes,
      frontedByOther: albertoFrontedForPablo, frontedForOther: pabloFrontedForAlberto,
      otherName: 'Alberto', net: pabloNet,
    },
    {
      name: 'Alberto', light: false,
      bankVal: albertoBank, owes: albertoOwes, isOwed: pabloOwes,
      frontedByOther: pabloFrontedForAlberto, frontedForOther: albertoFrontedForPablo,
      otherName: 'Pablo', net: albertoNet,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Section label */}
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,235,224,0.35)', paddingLeft: 2 }}>
        Settlement
      </div>

      {/* Person cards — same alternating pattern as dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {people.map(p => {
          const bg     = p.light ? '#F0EBE0' : '#223022'
          const border = p.light ? 'rgba(27,43,27,0.1)' : 'rgba(240,235,224,0.07)'
          const label  = p.light ? 'rgba(27,43,27,0.4)' : 'rgba(240,235,224,0.4)'
          const sub    = p.light ? 'rgba(27,43,27,0.35)' : 'rgba(240,235,224,0.33)'
          const netColor = p.net > 0.005
            ? (p.light ? '#1B6B1B' : '#6EC200')
            : p.net < -0.005
              ? (p.light ? '#B03020' : '#E85C2A')
              : (p.light ? 'rgba(27,43,27,0.4)' : 'rgba(240,235,224,0.4)')

          return (
            <div key={p.name} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: label, marginBottom: 10 }}>
                {p.name}
              </div>
              <div className="num" style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: netColor }}>
                {Math.abs(p.net) < 0.005 ? '—' : (p.net > 0 ? '+' : '') + fmt(p.net)}
              </div>
              <div style={{ fontSize: 10, marginTop: 4, color: sub }}>net position · if settled now</div>

              {/* Breakdown */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${p.light ? 'rgba(27,43,27,0.08)' : 'rgba(240,235,224,0.07)'}` }}>
                {p.light ? (
                  <>
                    <LineItemLight label="Bank contributed" value={p.bankVal} />
                    <LineItemLight label={`Bets P&L share (50%)`} value={betShare} />
                    {p.frontedByOther  > 0 && <LineItemLight label={`Fronted by ${p.otherName}`}   value={-p.frontedByOther}  accent="#C06010" />}
                    {p.frontedForOther > 0 && <LineItemLight label={`Fronted for ${p.otherName}`}  value={p.frontedForOther}  accent="#1B6B1B" />}
                    {p.owes   > 0 && <LineItemLight label={`Owes ${p.otherName}`}        value={-p.owes}   accent="#B03020" />}
                    {p.isOwed > 0 && <LineItemLight label={`${p.otherName} owes`}        value={p.isOwed}  accent="#1B6B1B" />}
                  </>
                ) : (
                  <>
                    <LineItem label="Bank contributed" value={p.bankVal} />
                    <LineItem label={`Bets P&L share (50%)`} value={betShare} />
                    {p.frontedByOther  > 0 && <LineItem label={`Fronted by ${p.otherName}`}   value={-p.frontedByOther}  accent="#E85C2A" />}
                    {p.frontedForOther > 0 && <LineItem label={`Fronted for ${p.otherName}`}  value={p.frontedForOther}  accent="#6EC200" />}
                    {p.owes   > 0 && <LineItem label={`Owes ${p.otherName}`}        value={-p.owes}   accent="#E85C2A" />}
                    {p.isOwed > 0 && <LineItem label={`${p.otherName} owes`}        value={p.isOwed}  accent="#6EC200" />}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Settlement banner */}
      <div style={{
        background: !debtor ? 'rgba(110,194,0,0.08)' : 'rgba(245,200,66,0.07)',
        border: `1px solid ${!debtor ? 'rgba(110,194,0,0.2)' : 'rgba(245,200,66,0.2)'}`,
        borderRadius: 12, padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        {!debtor ? (
          <>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(110,194,0,0.7)', marginBottom: 3 }}>All square</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#6EC200' }}>No outstanding debts</div>
            </div>
            <div style={{ fontSize: 24 }}>✓</div>
          </>
        ) : (
          <>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,200,66,0.6)', marginBottom: 3 }}>To settle</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#F5C842' }}>{debtor} → {creditor}</div>
            </div>
            <div className="num" style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.03em', color: '#F5C842' }}>{fmt(settlement)}</div>
          </>
        )}
      </div>

      {pendingStake > 0 && (
        <div style={{ fontSize: 11, color: 'rgba(240,235,224,0.3)', paddingLeft: 2 }}>
          {fmt(pendingStake)} in open stakes — settlement updates when bets resolve.
        </div>
      )}
    </div>
  )
}
