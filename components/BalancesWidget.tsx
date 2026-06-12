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
  const pabloBank  = bankTxs.filter(t => t.person === 'Pablo').reduce((s, t) => s + sign(t) * t.amount, 0)
  const thomasBank = bankTxs.filter(t => t.person === 'Thomas').reduce((s, t) => s + sign(t) * t.amount, 0)

  const settledBets = bets.filter(b => b.result !== 'pending' && b.result !== 'void')
  // Exclude personally-funded losses from betShare: the stake for those
  // is already captured in frontedForPablo/frontedForThomas below.
  // Wins are included (stake came back from bookie, only profit is shared).
  const betsForPnL = settledBets.filter(b =>
    !(b.fundedBy === 'thomas' && b.result === 'loss') &&
    !(b.fundedBy === 'pablo'  && b.result === 'loss')
  )
  const totalBetPnL = betsForPnL.reduce((s, b) => s + b.profit, 0)
  const betShare = totalBetPnL / 2

  const pendingStake = bets.filter(b => b.result === 'pending').reduce((s, b) => s + b.stake, 0)

  // Include pending bets (not void) in the fronted stake calculation:
  // cash for pending bets has already left the funder's pocket.
  // Void bets return the stake to the funder, so the obligation cancels.
  // Wins are excluded: the bookie returned the stake, so no fronting remains.
  const inFlightBets = bets.filter(b => b.result !== 'void')
  const thomasFrontedForPablo = inFlightBets
    .filter(b => b.fundedBy === 'thomas' && b.result !== 'win')
    .reduce((s, b) => s + b.stake / 2, 0)
  const pabloFrontedForThomas = inFlightBets
    .filter(b => b.fundedBy === 'pablo' && b.result !== 'win')
    .reduce((s, b) => s + b.stake / 2, 0)

  // Explicit debts (inter-person advances)
  const pabloOwes  = debts.filter(t => t.person === 'Pablo').reduce((s, t) => s + t.amount, 0)
  const thomasOwes = debts.filter(t => t.person === 'Thomas').reduce((s, t) => s + t.amount, 0)

  const pabloNet  = pabloBank  + betShare - pabloOwes  + thomasOwes - thomasFrontedForPablo + pabloFrontedForThomas
  const thomasNet = thomasBank + betShare - thomasOwes + pabloOwes  + thomasFrontedForPablo - pabloFrontedForThomas

  const diff = pabloNet - thomasNet
  const settlement = Math.abs(diff) / 2
  const debtor   = Math.abs(diff) > 0.005 ? (diff > 0 ? 'Thomas' : 'Pablo')  : null
  const creditor = Math.abs(diff) > 0.005 ? (diff > 0 ? 'Pablo'  : 'Thomas') : null

  return {
    pabloBank, thomasBank, betShare, totalBetPnL, pendingStake,
    pabloOwes, thomasOwes,
    thomasFrontedForPablo, pabloFrontedForThomas,
    pabloNet, thomasNet, settlement, debtor, creditor,
  }
}

function Line({ label, value, color, bold }: { label: string; value: number | null; color?: string; bold?: boolean }) {
  const isZero = value === 0
  const c = color ?? (isZero || value === null ? 'var(--color-muted)' : value > 0 ? 'var(--color-win)' : 'var(--color-loss)')
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{label}</span>
      <span style={{ fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500, color: c, fontVariantNumeric: 'tabular-nums' }}>
        {value === null || isZero ? '—' : (value > 0 ? '+' : '') + fmt(value)}
      </span>
    </div>
  )
}

export default function BalancesWidget({ bets, transactions }: Props) {
  const {
    pabloBank, thomasBank, betShare, totalBetPnL, pendingStake,
    pabloOwes, thomasOwes,
    thomasFrontedForPablo, pabloFrontedForThomas,
    pabloNet, thomasNet, settlement, debtor, creditor,
  } = computeBalances(bets, transactions)

  const people = [
    {
      name: 'Pablo',  icon: '👤', accent: '#818cf8',
      bankVal: pabloBank,  owes: pabloOwes,  isOwed: thomasOwes,
      frontedByOther: thomasFrontedForPablo,
      frontedForOther: pabloFrontedForThomas,
      otherName: 'Thomas',
      net: pabloNet,
    },
    {
      name: 'Thomas', icon: '👥', accent: '#a78bfa',
      bankVal: thomasBank, owes: thomasOwes, isOwed: pabloOwes,
      frontedByOther: pabloFrontedForThomas,
      frontedForOther: thomasFrontedForPablo,
      otherName: 'Pablo',
      net: thomasNet,
    },
  ]

  return (
    <div className="glass-card fade-up" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>💰</span>
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Balances & Settlement</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-muted)' }}>Bets split 50/50</span>
      </div>

      {/* Two-column ledger */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {people.map((p, idx) => (
          <div key={p.name} style={{
            padding: '16px 20px',
            borderRight: idx === 0 ? '1px solid rgba(255,255,255,0.07)' : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>{p.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: p.accent }}>{p.name}</span>
            </div>

            <Line label="Bank (net contributed)" value={p.bankVal} />
            <Line label={`Bets P&L (50% of ${totalBetPnL >= 0 ? '+' : ''}${fmt(totalBetPnL)})`} value={betShare} />
            {p.frontedByOther > 0 && (
              <Line
                label={`Stake fronted by ${p.otherName}`}
                value={-p.frontedByOther}
                color="#fb923c"
              />
            )}
            {p.frontedForOther > 0 && (
              <Line
                label={`Stake fronted for ${p.otherName}`}
                value={p.frontedForOther}
                color="#fb923c"
              />
            )}
            {p.owes   > 0 && <Line label={`Owes ${p.otherName}`}          value={-p.owes}  color="#fbbf24" />}
            {p.isOwed > 0 && <Line label={`${p.otherName} owes`}          value={p.isOwed} color="#fbbf24" />}

            {/* Net */}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Net position</span>
                  <div style={{ fontSize: 10, color: 'var(--color-muted)', opacity: 0.5, marginTop: 1 }}>if settled today</div>
                </div>
                <span style={{
                  fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
                  color: p.net > 0.005 ? 'var(--color-win)' : p.net < -0.005 ? 'var(--color-loss)' : 'var(--color-muted)',
                }}>
                  {Math.abs(p.net) < 0.005 ? '—' : (p.net > 0 ? '+' : '') + fmt(p.net)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Settlement banner */}
      <div style={{
        padding: '18px 24px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        background: !debtor ? 'rgba(52,211,153,0.04)' : 'rgba(251,191,36,0.04)',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 18 }}>{!debtor ? '✅' : '🤝'}</span>
        {!debtor ? (
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-win)' }}>All square — no outstanding debts</span>
        ) : (
          <>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#fbbf24' }}>
                {debtor} owes {creditor}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 8 }}>to settle the difference</span>
            </div>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(settlement)}
            </span>
          </>
        )}
      </div>

      {/* Pending footnote */}
      {pendingStake > 0 && (
        <div style={{ padding: '8px 20px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: 'var(--color-muted)', opacity: 0.6 }}>
          {fmt(pendingStake)} in pending stakes included — settlement will update when bets resolve.
        </div>
      )}
    </div>
  )
}
