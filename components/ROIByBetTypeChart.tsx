'use client'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts'
import { BetTypeROI } from '@/types/bet'
import { fmtPnL } from '@/utils/currency'

interface Props { data: BetTypeROI[] }

const SHORT: Record<string, string> = {
  'Match Result (1X2)': '1X2',
  'Over/Under':         'O/U',
  'Mix Parlay':         'Parlay',
  'BTTS':               'BTTS',
  'Handicap':           'HDP',
  'Double Chance':      'DC',
  'First Goalscorer':   '1st Goal',
  'Correct Score':      'CS',
  'Cards':              'Cards',
  'Corners':            'Corners',
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: BetTypeROI }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const color = d.roi >= 0 ? 'var(--color-win)' : 'var(--color-loss)'
  return (
    <div style={{ background: '#0e0e2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.betType}</div>
      <div style={{ color, fontWeight: 800 }}>ROI: {d.roi >= 0 ? '+' : ''}{d.roi.toFixed(1)}%</div>
      <div style={{ color, fontSize: 12 }}>Profit: {fmtPnL(d.profit)}</div>
      <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{d.wins}W / {d.bets - d.wins}L ({d.bets} bets)</div>
    </div>
  )
}

export default function ROIByBetTypeChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="glass-card" style={{ padding: 24, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--color-muted)' }}>No data yet</span>
      </div>
    )
  }

  const shortened = data.map(d => ({ ...d, short: SHORT[d.betType] ?? d.betType }))

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
          ROI by Bet Type
        </h3>
      </div>
      <ResponsiveContainer width="100%" height={220} minWidth={0}>
        <BarChart data={shortened} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="short" tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={44} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
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
