'use client'
import { useState } from 'react'
import { Bet } from '@/types/bet'
import { fmt, fmtPnL } from '@/utils/currency'
import { useBets } from '@/hooks/useBets'
import { useBankAccount } from '@/hooks/useBankAccount'
import Navbar from '@/components/Navbar'
import BankWidget from '@/components/BankWidget'
import StatsCards from '@/components/StatsCards'
import BankrollChart from '@/components/BankrollChart'
import WinLossDonut from '@/components/WinLossDonut'
import ROIByCompetitionChart from '@/components/ROIByCompetitionChart'
import ROIByBetTypeChart from '@/components/ROIByBetTypeChart'
import MonthlyPnLChart from '@/components/MonthlyPnLChart'
import PendingBets from '@/components/PendingBets'
import BetsTable from '@/components/BetsTable'
import AddBetModal from '@/components/AddBetModal'
import BalancesWidget from '@/components/BalancesWidget'
import BottomNav from '@/components/BottomNav'

function KPIStat({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ fontSize: 10, color: 'var(--color-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div className="num" style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', color: color ?? 'var(--color-text)', whiteSpace: 'nowrap' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

function KPIDivider() {
  return <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.07)', flexShrink: 0, margin: '0 4px' }} />
}

export default function Dashboard() {
  const {
    bets, addBet, deleteBet, updateBet, settleBet, loaded,
    stats, bankrollData, roiByCompetition, roiByBetType, monthlyPnL,
    bankrollStart, setBankrollStart,
  } = useBets()
  const { transactions, addTransaction, deleteTransaction, deleteGroup, total: bankTotal, pabloTotal, albertoTotal, loaded: bankLoaded } = useBankAccount()
  const [showModal, setShowModal] = useState(false)
  const [editingBet, setEditingBet] = useState<Bet | null>(null)

  if (!loaded || !bankLoaded) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--color-muted)', fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  const hitRate = (stats.wins + stats.losses) > 0
    ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(0) : '0'
  const pendingStake = bets.filter(b => b.result === 'pending').reduce((s, b) => s + b.stake, 0)

  const settledBets = bets.filter(b => b.result === 'win' || b.result === 'loss')
  const avgOdds = settledBets.length > 0
    ? (settledBets.reduce((s, b) => s + b.odds, 0) / settledBets.length).toFixed(2)
    : null

  const streakVal = stats.currentStreakType
    ? `${stats.currentStreakType === 'win' ? '🔥' : '🥶'} ${stats.currentStreak}`
    : '—'
  const streakColor = stats.currentStreakType === 'win'
    ? 'var(--color-win)'
    : stats.currentStreakType === 'loss'
    ? 'var(--color-loss)'
    : 'var(--color-muted)'

  // Bank-funded bets reduce the bank while pending, add profit on win, reduce stake on loss
  const bankFundedImpact = bets
    .filter(b => b.fundedBy === 'bank')
    .reduce((sum, b) => b.result === 'pending' ? sum - b.stake : sum + b.profit, 0)
  const adjustedBankTotal  = bankTotal  + bankFundedImpact
  const adjustedPabloTotal = pabloTotal + bankFundedImpact / 2
  const adjustedAlbertoTotal = albertoTotal + bankFundedImpact / 2

  const roiSign = stats.roi >= 0 ? '+' : ''
  const roiColor = stats.roi >= 0 ? 'var(--color-win)' : 'var(--color-loss)'

  return (
    <>
      <Navbar onAddBet={() => setShowModal(true)} />

      {/* KPI sticky band */}
      <div style={{
        position: 'sticky',
        top: 'calc(56px + env(safe-area-inset-top))',
        zIndex: 39,
        background: '#152030',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '10px 24px',
          display: 'flex', alignItems: 'center', gap: 20,
          overflowX: 'auto',
        }}>
          {/* Financial group */}
          <KPIStat
            label="Bank"
            value={fmt(adjustedBankTotal)}
            color={adjustedBankTotal >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}
          />
          <KPIStat
            label="Net P&L"
            value={fmtPnL(stats.netProfit)}
            color={stats.netProfit >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}
          />
          <KPIStat
            label="ROI"
            value={`${roiSign}${stats.roi.toFixed(1)}%`}
            color={roiColor}
          />

          <div className="kpi-secondary" style={{ display: 'contents' }}>
            <KPIDivider />
          </div>

          {/* Performance group */}
          <KPIStat
            label="Hit Rate"
            value={`${hitRate}%`}
            color={parseFloat(hitRate) >= 50 ? 'var(--color-win)' : 'var(--color-loss)'}
            sub={`${stats.wins}W · ${stats.losses}L`}
          />
          <div className="kpi-secondary" style={{ display: 'contents' }}>
            <KPIStat
              label="Streak"
              value={streakVal}
              color={streakColor}
            />
            <KPIStat
              label="Avg Odds"
              value={avgOdds ?? '—'}
            />
          </div>

          {/* Open exposure group — only when there are open bets */}
          {stats.pending > 0 && (
            <div className="kpi-secondary" style={{ display: 'contents' }}>
              <KPIDivider />
              <KPIStat
                label="Open"
                value={`${stats.pending} bet${stats.pending !== 1 ? 's' : ''}`}
                color="var(--color-pending)"
              />
              {pendingStake > 0 && (
                <KPIStat
                  label="Exposure"
                  value={fmt(pendingStake)}
                  color="var(--color-muted)"
                />
              )}
            </div>
          )}
        </div>
      </div>

      <main className="page-main" style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1200, margin: '0 auto',
        padding: '28px 24px 80px',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>

        {/* Row 1: Bank (wider) + Balances side by side */}
        <div className="grid-bank">
          <BankWidget
            transactions={transactions}
            total={adjustedBankTotal}
            pabloTotal={adjustedPabloTotal}
            albertoTotal={adjustedAlbertoTotal}
            onAdd={addTransaction}
            onDelete={deleteTransaction}
            onDeleteGroup={deleteGroup}
          />
          <BalancesWidget bets={bets} transactions={transactions} />
        </div>

        {/* Pablo vs Alberto head-to-head */}
        {(stats.pabloStats.wins + stats.pabloStats.losses > 0 || stats.albertoStats.wins + stats.albertoStats.losses > 0) && (
          <div className="grid-headtohead" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { name: 'Pablo', s: stats.pabloStats, icon: '👤' },
              { name: 'Alberto', s: stats.albertoStats, icon: '👥' },
            ].map(({ name, s, icon }) => {
              const roiColor = s.roi >= 0 ? 'var(--color-win)' : 'var(--color-loss)'
              const fmtStat = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1)
              const total = s.wins + s.losses
              const winRate = total > 0 ? ((s.wins / total) * 100).toFixed(0) : '0'
              return (
                <div key={name} className="glass-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 24 }}>{icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{fmtStat(s.wins)}W / {fmtStat(s.losses)}L · {winRate}% hit</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num" style={{ fontSize: 18, fontWeight: 800, color: roiColor, letterSpacing: '-0.02em' }}>
                      {s.roi >= 0 ? '+' : ''}{s.roi.toFixed(1)}%
                    </div>
                    <div className="num" style={{ fontSize: 12, color: roiColor, opacity: 0.8 }}>
                      {fmtPnL(s.profit)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <StatsCards stats={stats} />

        <div className="grid-bankroll" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
          <BankrollChart data={bankrollData} bankrollStart={bankrollStart} onBankrollStartChange={setBankrollStart} />
          <WinLossDonut stats={stats} />
        </div>

        <div className="grid-charts-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <ROIByCompetitionChart data={roiByCompetition} />
          <ROIByBetTypeChart data={roiByBetType} />
          <MonthlyPnLChart data={monthlyPnL} />
        </div>

        <PendingBets bets={bets} onSettle={settleBet} onUpdateBet={updateBet} />

        <BetsTable bets={bets} onDelete={deleteBet} onEdit={setEditingBet} onUpdateBet={updateBet} />
      </main>

      <button className="btn-primary hide-on-mobile" onClick={() => setShowModal(true)} style={{
        position: 'fixed', bottom: 24, right: 24, width: 52, height: 52,
        borderRadius: '50%', fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 24px rgba(245,166,35,0.4)', zIndex: 30,
      }} aria-label="Add bet">+</button>

      {showModal && <AddBetModal onClose={() => setShowModal(false)} onAdd={addBet} />}
      {editingBet && <AddBetModal onClose={() => setEditingBet(null)} onAdd={addBet} editBet={editingBet} onUpdate={updateBet} />}

      <BottomNav />
    </>
  )
}
