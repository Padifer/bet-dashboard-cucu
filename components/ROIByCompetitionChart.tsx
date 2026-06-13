'use client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts'
import { CompetitionStat } from '@/types/bet'
import { fmtPnL } from '@/utils/currency'

interface Props { data: CompetitionStat[] }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CompetitionStat }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const color = d.roi >= 0 ? 'var(--color-win)' : 'var(--color-loss)'
  return (
    <div style={{ background: '#0e0e2a', border: '1px solid rgba(240,235,224,0.12)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.league}</div>
      <div style={{ color, fontWeight: 800 }}>ROI: {d.roi >= 0 ? '+' : ''}{d.roi.toFixed(1)}%</div>
      <div style={{ color: color, fontSize: 12 }}>Profit: {fmtPnL(d.profit)}</div>
      <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{d.wins}W / {d.bets - d.wins}L ({d.bets} bets)</div>
    </div>
  )
}

export default function ROIByCompetitionChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="glass-card" style={{ padding: 24, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--color-muted)' }}>No data yet</span>
      </div>
    )
  }

  // Shorten league names for display
  const shortened = data.map(d => ({
    ...d,
    shortLeague: d.league
      .replace('UEFA ', '')
      .replace('FIFA ', '')
      .replace('Premier League', 'Premier')
      .replace('Champions League', 'UCL')
      .replace('Europa League', 'UEL')
      .replace('Nations League', 'Nations')
      .replace('World Cup', 'WC'),
  }))

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
          ROI by Competition
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={220} minWidth={0}>
        <BarChart data={shortened} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,235,224,0.04)" vertical={false} />
          <XAxis dataKey="shortLeague" tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={44} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(240,235,224,0.04)' }} />
          <ReferenceLine y={0} stroke="rgba(240,235,224,0.14)" strokeDasharray="4 4" />
          <Bar dataKey="roi" radius={[6, 6, 0, 0]}>
            {shortened.map((entry, i) => (
              <Cell key={i} fill={entry.roi >= 0 ? '#34d399' : '#f87171'} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
