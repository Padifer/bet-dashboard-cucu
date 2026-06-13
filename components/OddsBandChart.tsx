'use client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts'
import { OddsBand } from '@/hooks/useBets'
import { fmtPnL } from '@/utils/currency'

interface Props { data: OddsBand[] }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: OddsBand }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const color = d.roi >= 0 ? 'var(--color-win)' : 'var(--color-loss)'
  return (
    <div style={{ background: '#0e0e2a', border: '1px solid rgba(240,235,224,0.12)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Odds {d.label}</div>
      <div style={{ color, fontWeight: 800 }}>ROI: {d.roi >= 0 ? '+' : ''}{d.roi.toFixed(1)}%</div>
      <div style={{ color, fontSize: 12 }}>Profit: {fmtPnL(d.profit)}</div>
      <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{d.wins}W / {d.bets - d.wins}L · {((d.wins / d.bets) * 100).toFixed(0)}% hit</div>
    </div>
  )
}

export default function OddsBandChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="glass-card" style={{ padding: 24, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--color-muted)' }}>No data yet</span>
      </div>
    )
  }

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
          Performance by Odds
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={220} minWidth={0}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,235,224,0.04)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={44} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(240,235,224,0.04)' }} />
          <ReferenceLine y={0} stroke="rgba(240,235,224,0.14)" strokeDasharray="4 4" />
          <Bar dataKey="roi" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.roi >= 0 ? '#34d399' : '#f87171'} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
