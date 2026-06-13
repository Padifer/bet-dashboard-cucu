'use client'
import { PiggyBank, Trophy, TrendingUp, TrendingDown, Target } from 'lucide-react'
import { BetStats } from '@/types/bet'
import { fmt, fmtPnL } from '@/utils/currency'

interface StatsCardsProps { stats: BetStats }

function StatCard({ label, value, sub, color, icon }: {
  label: string
  value: string
  sub?: string
  color: string
  icon: React.ReactNode
}) {
  return (
    <div className="glass-card fade-up" style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <span style={{ fontSize: 10, color: 'var(--color-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
          {label}
        </span>
        <span style={{ color: 'var(--color-muted)', opacity: 0.5 }}>{icon}</span>
      </div>
      <div className="num" style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-muted)' }}>{sub}</div>}
    </div>
  )
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const roiColor    = stats.roi       >= 0 ? 'var(--color-win)' : 'var(--color-loss)'
  const profitColor = stats.netProfit >= 0 ? 'var(--color-win)' : 'var(--color-loss)'
  const roiSign     = stats.roi       >= 0 ? '+' : ''
  const winRate = (stats.wins + stats.losses) > 0
    ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(0) : '0'

  const streakLabel = stats.currentStreakType === 'win'
    ? `${stats.currentStreak}-win streak`
    : stats.currentStreakType === 'loss'
    ? `${stats.currentStreak}-loss streak`
    : null

  const iconProps = { size: 16, strokeWidth: 1.75 }

  return (
    <div>
      {streakLabel && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: stats.currentStreakType === 'win' ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
          border: `1px solid ${stats.currentStreakType === 'win' ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'}`,
          borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600,
          color: stats.currentStreakType === 'win' ? 'var(--color-win)' : 'var(--color-loss)',
          marginBottom: 14,
        }}>
          {stats.currentStreakType === 'win' ? '🔥' : '🥶'} {streakLabel}
        </div>
      )}
      <div className="grid-stats-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <StatCard
          label="Total Staked" value={fmt(stats.totalStake)}
          sub={`Each: ${fmt(stats.totalStake / 2)}`}
          color="var(--color-text)"
          icon={<PiggyBank {...iconProps} />}
        />
        <StatCard
          label="Total Returns" value={fmt(stats.totalReturns)}
          sub={`Each: ${fmt(stats.totalReturns / 2)}`}
          color={profitColor}
          icon={<Trophy {...iconProps} />}
        />
        <StatCard
          label="Net Profit" value={fmtPnL(stats.netProfit)}
          sub={`Each: ${fmtPnL(stats.netProfit / 2)}`}
          color={profitColor}
          icon={stats.netProfit >= 0 ? <TrendingUp {...iconProps} /> : <TrendingDown {...iconProps} />}
        />
        <StatCard
          label="ROI" value={`${roiSign}${stats.roi.toFixed(1)}%`}
          sub={`Hit rate: ${winRate}% · ${stats.wins}W / ${stats.losses}L`}
          color={roiColor}
          icon={<Target {...iconProps} />}
        />
      </div>
    </div>
  )
}
