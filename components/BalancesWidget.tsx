'use client'
import { Bet } from '@/types/bet'
import { BankTransaction } from '@/types/bank'
import { fmt } from '@/utils/currency'
import { useState } from 'react'

interface Props {
  bets: Bet[]
  transactions: BankTransaction[]
  onSettle?: (amount: number, debtor: 'Pablo' | 'Alberto') => Promise<void>
}

function computeBalances(bets: Bet[], transactions: BankTransaction[]) {
  const bankTxs    = transactions.filter(t => t.type !== 'debt' && t.type !== 'settlement')
  const debts      = transactions.filter(t => t.type === 'debt')
  const settlements = transactions.filter(t => t.type === 'settlement')

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
  const albertoFrontedForPablo = inFlightBets.filter(b => b.fundedBy === 'alberto' && b.result !== 'win').reduce((s, b) => s + b.stake / 2, 0)
  const pabloFrontedForAlberto = inFlightBets.filter(b => b.fundedBy === 'pablo'   && b.result !== 'win').reduce((s, b) => s + b.stake / 2, 0)

  const pabloOwes   = debts.filter(t => t.person === 'Pablo').reduce((s, t) => s + t.amount, 0)
  const albertoOwes = debts.filter(t => t.person === 'Alberto').reduce((s, t) => s + t.amount, 0)

  // Raw net positions before accounting for past settlements
  const pabloNet_raw   = pabloBank   + betShare - pabloOwes   + albertoOwes - albertoFrontedForPablo + pabloFrontedForAlberto
  const albertoNet_raw = albertoBank + betShare - albertoOwes + pabloOwes   + albertoFrontedForPablo - pabloFrontedForAlberto

  // Past settlements: when person X settled an amount, their position improves and the other's decreases
  const pabloSettled   = settlements.filter(t => t.person === 'Pablo').reduce((s, t) => s + t.amount, 0)
  const albertoSettled = settlements.filter(t => t.person === 'Alberto').reduce((s, t) => s + t.amount, 0)

  const pabloNet   = pabloNet_raw   + pabloSettled   - albertoSettled
  const albertoNet = albertoNet_raw + albertoSettled - pabloSettled

  const diff       = pabloNet - albertoNet
  const settlement = Math.abs(diff) / 2
  const debtor     = Math.abs(diff) > 0.005 ? (diff > 0 ? 'Alberto' : 'Pablo')  : null
  const creditor   = Math.abs(diff) > 0.005 ? (diff > 0 ? 'Pablo'  : 'Alberto') : null

  return {
    pabloBank, albertoBank, betShare, totalBetPnL, pendingStake,
    pabloOwes, albertoOwes,
    albertoFrontedForPablo, pabloFrontedForAlberto,
    pabloNet, albertoNet, settlement, debtor, creditor,
    settlements,
  }
}

// Row always renders — shows '—' for zero so both columns look symmetric
function Row({ label, value, dark }: { label: string; value: number; dark: boolean }) {
  const pos    = dark ? '#6EC200' : '#1B6B1B'
  const neg    = dark ? '#E85C2A' : '#B03020'
  const zero   = dark ? 'rgba(240,235,224,0.28)' : 'rgba(27,43,27,0.28)'
  const labelC = dark ? 'rgba(240,235,224,0.4)' : 'rgba(27,43,27,0.4)'
  const isZero = Math.abs(value) < 0.005
  const color  = isZero ? zero : value > 0 ? pos : neg
  const sign   = isZero ? '' : value > 0 ? '+' : '-'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0' }}>
      <span style={{ fontSize: 11, color: labelC }}>{label}</span>
      <span className="num" style={{ fontSize: 12, fontWeight: 700, color }}>
        {isZero ? '—' : sign + fmt(Math.abs(value))}
      </span>
    </div>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function BalancesWidget({ bets, transactions, onSettle }: Props) {
  const [settling, setSettling] = useState(false)

  const {
    pabloBank, albertoBank, betShare, pendingStake,
    pabloOwes, albertoOwes,
    albertoFrontedForPablo, pabloFrontedForAlberto,
    pabloNet, albertoNet, settlement, debtor, creditor,
    settlements,
  } = computeBalances(bets, transactions)

  const anyFronted = albertoFrontedForPablo > 0 || pabloFrontedForAlberto > 0
  const anyDebt    = pabloOwes > 0 || albertoOwes > 0

  const handleMarkSettled = async () => {
    if (!debtor || !onSettle || !creditor) return
    if (!window.confirm(`Confirm that ${debtor} has paid ${creditor} ${fmt(settlement)}?`)) return
    setSettling(true)
    try {
      await onSettle(settlement, debtor as 'Pablo' | 'Alberto')
    } finally {
      setSettling(false)
    }
  }

  // Pablo = dark (#223022), Alberto = light (#F0EBE0) — same as top cards
  const people = [
    {
      name: 'Pablo', dark: true,
      bankVal: pabloBank, owes: pabloOwes, isOwed: albertoOwes,
      frontedByOther: albertoFrontedForPablo, frontedForOther: pabloFrontedForAlberto,
      otherName: 'Alberto', net: pabloNet,
    },
    {
      name: 'Alberto', dark: false,
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

      {/* ── Settlement result — shown FIRST ── */}
      <div style={{
        background: !debtor ? 'rgba(110,194,0,0.08)' : 'rgba(245,200,66,0.07)',
        border: `1px solid ${!debtor ? 'rgba(110,194,0,0.2)' : 'rgba(245,200,66,0.2)'}`,
        borderRadius: 12, padding: '16px 20px',
      }}>
        {!debtor ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(110,194,0,0.7)', marginBottom: 4 }}>All square</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#6EC200', marginBottom: 3 }}>No money to exchange</div>
              <div style={{ fontSize: 11, color: 'rgba(240,235,224,0.4)', lineHeight: 1.4 }}>
                Bank contributions and bets are balanced between you both
              </div>
            </div>
            <div style={{ fontSize: 28, marginLeft: 16 }}>✓</div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,200,66,0.6)', marginBottom: 4 }}>To settle</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#F5C842', marginBottom: 4 }}>
                  {debtor} → {creditor}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(240,235,224,0.4)', lineHeight: 1.5 }}>
                  {debtor} pays {creditor} back their share of the cash deposited
                </div>
              </div>
              <div className="num" style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-0.03em', color: '#F5C842', flexShrink: 0 }}>
                {fmt(settlement)}
              </div>
            </div>

            {/* Mark as Settled button */}
            {onSettle && (
              <button
                onClick={handleMarkSettled}
                disabled={settling}
                style={{
                  marginTop: 14,
                  width: '100%',
                  padding: '10px 16px',
                  background: settling ? 'rgba(245,200,66,0.08)' : 'rgba(245,200,66,0.12)',
                  border: '1px solid rgba(245,200,66,0.3)',
                  borderRadius: 8,
                  color: '#F5C842',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: settling ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.02em',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!settling) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,200,66,0.2)' }}
                onMouseLeave={e => { if (!settling) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(245,200,66,0.12)' }}
              >
                {settling ? 'Recording…' : `✓ Mark as Settled — ${debtor} paid ${creditor} ${fmt(settlement)}`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Past settlements history ── */}
      {settlements.length > 0 && (
        <div style={{
          background: 'rgba(110,194,0,0.05)',
          border: '1px solid rgba(110,194,0,0.12)',
          borderRadius: 10, padding: '12px 16px',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(110,194,0,0.5)', marginBottom: 2 }}>
            Settlement history
          </div>
          {[...settlements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'rgba(240,235,224,0.5)' }}>
                {s.person} paid · {fmtDate(s.createdAt)}
              </span>
              <span className="num" style={{ fontSize: 13, fontWeight: 700, color: '#6EC200' }}>
                {fmt(s.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Why this number? Breakdown for each person ── */}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(240,235,224,0.25)', paddingLeft: 2, marginTop: 2 }}>
        How we got here
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {people.map(p => {
          const bg      = p.dark ? '#223022' : '#F0EBE0'
          const border  = p.dark ? 'rgba(240,235,224,0.07)' : 'rgba(27,43,27,0.1)'
          const labelC  = p.dark ? 'rgba(240,235,224,0.4)' : 'rgba(27,43,27,0.4)'
          const subC    = p.dark ? 'rgba(240,235,224,0.3)' : 'rgba(27,43,27,0.3)'
          const divider = p.dark ? 'rgba(240,235,224,0.07)' : 'rgba(27,43,27,0.08)'
          const netColor = p.net > 0.005
            ? (p.dark ? '#6EC200' : '#1B6B1B')
            : p.net < -0.005
              ? (p.dark ? '#E85C2A' : '#B03020')
              : (p.dark ? 'rgba(240,235,224,0.4)' : 'rgba(27,43,27,0.4)')
          const netSign = Math.abs(p.net) < 0.005 ? '' : p.net > 0 ? '+' : '-'

          return (
            <div key={p.name} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: labelC, marginBottom: 8 }}>
                {p.name}
              </div>

              <div className="num" style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: netColor }}>
                {Math.abs(p.net) < 0.005 ? '—' : netSign + fmt(Math.abs(p.net))}
              </div>
              <div style={{ fontSize: 10, marginTop: 3, marginBottom: 12, color: subC }}>
                owed back if you settled today
              </div>

              <div style={{ borderTop: `1px solid ${divider}`, paddingTop: 10 }}>
                <Row label="Cash deposited into bank" value={p.bankVal} dark={p.dark} />
                <Row label="Bets result (your 50%)" value={betShare} dark={p.dark} />
                {anyFronted && (
                  <Row
                    label={p.frontedByOther > 0 ? `Fronted by ${p.otherName} (you owe back)` : `You fronted ${p.otherName}'s bets`}
                    value={p.frontedByOther > 0 ? -p.frontedByOther : p.frontedForOther}
                    dark={p.dark}
                  />
                )}
                {anyDebt && (
                  <Row
                    label={p.owes > 0 ? `You owe ${p.otherName}` : `${p.otherName} owes you`}
                    value={p.owes > 0 ? -p.owes : p.isOwed}
                    dark={p.dark}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {pendingStake > 0 && (
        <div style={{ fontSize: 11, color: 'rgba(240,235,224,0.3)', paddingLeft: 2 }}>
          {fmt(pendingStake)} still at risk in open bets — settlement updates when they resolve.
        </div>
      )}
    </div>
  )
}
