'use client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts'
import { MonthlyPnL } from '@/types/bet'
import { fmtPnL, fmtK } from '@/utils/currency'

interface Props { data: MonthlyPnL[] }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: MonthlyPnL }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const color = d.profit >= 0 ? 'var(--color-win)' : 'var(--color-loss)'
  return (
    <div style={{ background: '#0e0e2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.month}</div>
      <div style={{ color, fontWeight: 800, fontSize: 15 }}>{fmtPnL(d.profit)}</div>
      <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{d.bets} bet{d.bets !== 1 ? 's' : ''} settled</div>
    </div>
  )
}

export default function MonthlyPnLChart({ data }: Props) {
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
          Monthly P&amp;L
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={220} minWidth={0}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barSize={32}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtK(v)} width={56} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
          <Bar dataKey="profit" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.profit >= 0 ? '#00e676' : '#ff3d71'} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
