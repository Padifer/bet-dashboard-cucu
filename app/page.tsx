'use client'
import { useState } from 'react'
import { Bet } from '@/types/bet'
import { fmt, fmtPnL } from '@/utils/currency'
import { useBets } from '@/hooks/useBets'
import Navbar from '@/components/Navbar'
import StatsCards from '@/components/StatsCards'
import BankrollChart from '@/components/BankrollChart'
import WinLossDonut from '@/components/WinLossDonut'
import PickerStatsCard from '@/components/PickerStatsCard'
import OddsBandChart from '@/components/OddsBandChart'
import DailyPnLChart from '@/components/DailyPnLChart'
import AddBetModal from '@/components/AddBetModal'
import BottomNav from '@/components/BottomNav'

function BigCard({
  label, value, sub, light = false, valueColor,
}: { label: string; value: string; sub?: string; light?: boolean; valueColor?: string }) {
  const bg = light ? '#F0EBE0' : '#223022'
  const border = light ? 'rgba(27,43,27,0.1)' : 'rgba(240,235,224,0.07)'
  const labelColor = light ? 'rgba(27,43,27,0.4)' : 'rgba(240,235,224,0.4)'
  const defaultValueColor = light ? '#1B2B1B' : '#F0EBE0'
  const subColor = light ? 'rgba(27,43,27,0.38)' : 'rgba(240,235,224,0.35)'
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '20px 22px', minHeight: 110 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: labelColor, marginBottom: 10 }}>{label}</div>
      <div className="num" style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: valueColor ?? defaultValueColor }}>{value}</div>
      {sub && <div style={{ fontSize: 11, marginTop: 8, color: subColor }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const {
    bets, addBet, updateBet, loaded,
    stats, bankrollData, monthlyPnL, oddsBandData, dailyPnL,
    bankrollStart, setBankrollStart,
  } = useBets()
  const [showModal, setShowModal] = useState(false)
  const [editingBet, setEditingBet] = useState<Bet | null>(null)

  if (!loaded) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1B2B1B' }}>
        <div style={{ color: 'rgba(240,235,224,0.4)', fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  const hitRate = (stats.wins + stats.losses) > 0
    ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(0) : '0'
  const pendingStake = bets.filter(b => b.result === 'pending').reduce((s, b) => s + b.stake, 0)
  const settledBets = bets.filter(b => b.result === 'win' || b.result === 'loss')
  const avgOdds = settledBets.length > 0
    ? (settledBets.reduce((s, b) => s + b.odds, 0) / settledBets.length).toFixed(2) : '—'
  const streakStr = stats.currentStreakType
    ? `${stats.currentStreakType === 'win' ? '↑' : '↓'} ${stats.currentStreak}` : '—'
  const roiStr = `${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`

  return (
    <>
      <Navbar onAddBet={() => setShowModal(true)} />

      <main className="page-main" style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '20px 20px 100px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>

        {/* ── Hero bento ──────────────────────────────────────────────────── */}
        <div className="grid-hero">
          <BigCard label="Net P&L" value={fmtPnL(stats.netProfit)} light
            valueColor={stats.netProfit >= 0 ? '#1B6B1B' : '#B03020'}
          />
          <BigCard label="ROI" value={roiStr} sub={`${stats.total} bets placed`}
            valueColor={stats.roi >= 0 ? '#6EC200' : '#E85C2A'}
          />
          <BigCard label="Hit Rate" value={`${hitRate}%`} sub={`${stats.wins}W · ${stats.losses}L`} light />
          <BigCard label="Avg Odds" value={avgOdds} sub={`${stats.pending} open · ${fmt(pendingStake)} at risk`} />
        </div>

        {/* ── Pablo vs Alberto ────────────────────────────────────────────── */}
        {(stats.pabloStats.wins + stats.pabloStats.losses > 0 || stats.albertoStats.wins + stats.albertoStats.losses > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { name: 'Pablo', s: stats.pabloStats, light: true },
              { name: 'Alberto', s: stats.albertoStats, light: false },
            ].map(({ name, s, light }) => {
              const total = s.wins + s.losses
              const wr = total > 0 ? ((s.wins / total) * 100).toFixed(0) : '0'
              const rColor = s.roi >= 0 ? '#6EC200' : '#E85C2A'
              return (
                <div key={name} style={{
                  background: light ? '#F0EBE0' : '#223022',
                  border: `1px solid ${light ? 'rgba(27,43,27,0.1)' : 'rgba(240,235,224,0.07)'}`,
                  borderRadius: 12, padding: '18px 18px',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6, color: light ? 'rgba(27,43,27,0.4)' : 'rgba(240,235,224,0.4)' }}>{name}</div>
                  <div className="num" style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1, color: rColor }}>{s.roi >= 0 ? '+' : ''}{s.roi.toFixed(1)}%</div>
                  <div style={{ fontSize: 11, marginTop: 4, color: light ? 'rgba(27,43,27,0.38)' : 'rgba(240,235,224,0.35)' }}>{s.wins}W / {s.losses}L · {wr}%</div>
                  <div className="num" style={{ fontSize: 16, fontWeight: 800, marginTop: 6, color: rColor }}>{fmtPnL(s.profit)}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Streak / open / at risk ─────────────────────────────────────── */}
        {(stats.currentStreakType || stats.pending > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <BigCard label="Streak" value={streakStr}
              valueColor={stats.currentStreakType === 'win' ? '#6EC200' : stats.currentStreakType === 'loss' ? '#E85C2A' : undefined}
            />
            <BigCard label="Open Bets" value={String(stats.pending)} light />
            <BigCard label="At Risk" value={fmt(pendingStake)} />
          </div>
        )}

        <StatsCards stats={stats} />

        <div className="grid-bankroll" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, alignItems: 'start' }}>
          <BankrollChart data={bankrollData} bankrollStart={bankrollStart} onBankrollStartChange={setBankrollStart} />
          <WinLossDonut stats={stats} />
        </div>

        <div className="grid-charts-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <PickerStatsCard stats={stats} />
          <OddsBandChart data={oddsBandData} />
          <DailyPnLChart data={dailyPnL} />
        </div>
      </main>

      <button className="btn-primary hide-on-mobile" onClick={() => setShowModal(true)} style={{
        position: 'fixed', bottom: 24, right: 24, width: 52, height: 52,
        borderRadius: '50%', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 24px rgba(232,92,42,0.45)', zIndex: 30,
      }} aria-label="Add bet">+</button>

      {showModal && <AddBetModal onClose={() => setShowModal(false)} onAdd={addBet} />}
      {editingBet && <AddBetModal onClose={() => setEditingBet(null)} onAdd={addBet} editBet={editingBet} onUpdate={updateBet} />}

      <BottomNav />
    </>
  )
}
