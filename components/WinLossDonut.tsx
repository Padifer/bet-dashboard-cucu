'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { BetStats } from '@/types/bet'

interface WinLossDonutProps { stats: BetStats }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0e0e2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 14px', fontSize: 13 }}>
      <span style={{ color: payload[0].payload.color, fontWeight: 700 }}>{payload[0].name}: {payload[0].value}</span>
    </div>
  )
}

export default function WinLossDonut({ stats }: WinLossDonutProps) {
  const data = [
    { name: 'Win', value: stats.wins, color: '#00e676' },
    { name: 'Loss', value: stats.losses, color: '#ff3d71' },
    { name: 'Pending', value: stats.pending, color: '#ffd740' },
    { name: 'Void', value: stats.voids, color: '#78909c' },
  ].filter(d => d.value > 0)

  const winRate = (stats.wins + stats.losses) > 0
    ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(0) : '0'

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
          Distribution
        </h3>
      </div>

      <div style={{ position: 'relative', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={data.length ? data : [{ name: 'No data', value: 1, color: 'rgba(255,255,255,0.1)' }]}
              cx="50%" cy="50%"
              innerRadius={60} outerRadius={88}
              paddingAngle={3} dataKey="value" strokeWidth={0}
            >
              {(data.length ? data : [{ color: 'rgba(255,255,255,0.1)' }]).map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-win)', lineHeight: 1 }}>{winRate}%</div>
          <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 2, letterSpacing: '0.04em', textTransform: 'uppercase' }}>hit rate</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 12 }}>
        {[
          { label: 'Win', count: stats.wins, color: '#00e676' },
          { label: 'Loss', count: stats.losses, color: '#ff3d71' },
          { label: 'Pending', count: stats.pending, color: '#ffd740' },
          { label: 'Void', count: stats.voids, color: '#78909c' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--color-muted)' }}>{item.label}</span>
            <span style={{ fontWeight: 700, color: item.color }}>{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
