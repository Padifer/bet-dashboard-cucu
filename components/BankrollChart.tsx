'use client'
import { useState } from 'react'
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Area, AreaChart } from 'recharts'
import { fmt, fmtPnL, fmtK } from '@/utils/currency'

interface DataPoint { date: string; profit: number; match: string }

interface BankrollChartProps {
  data: DataPoint[]
  bankrollStart: number
  onBankrollStartChange: (v: number) => void
}

function CustomTooltip({ active, payload, bankrollStart }: { active?: boolean; payload?: Array<{ value: number; payload: DataPoint }>; bankrollStart: number }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const val = payload[0].value
  const delta = val - bankrollStart
  const color = delta >= 0 ? 'var(--color-win)' : 'var(--color-loss)'
  return (
    <div style={{ background: '#0e0e2a', border: '1px solid rgba(240,235,224,0.12)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ color: 'var(--color-muted)', marginBottom: 4 }}>{d.date}</div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(val)}</div>
      <div style={{ color, fontSize: 12, marginTop: 2 }}>{fmtPnL(delta)} P&L</div>
      {d.match && <div style={{ color: 'var(--color-muted)', marginTop: 2, maxWidth: 160, fontSize: 11 }}>{d.match}</div>}
    </div>
  )
}

export default function BankrollChart({ data, bankrollStart, onBankrollStartChange }: BankrollChartProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const handleEdit = () => { setDraft(String(bankrollStart || '')); setEditing(true) }
  const handleSave = () => {
    const v = parseFloat(draft)
    if (!isNaN(v) && v >= 0) onBankrollStartChange(v)
    setEditing(false)
  }

  const currentBankroll = data.length > 0 ? data[data.length - 1].profit : bankrollStart
  const isPositive = currentBankroll >= bankrollStart
  const lineColor = isPositive ? '#00e676' : '#ff3d71'

  const paddedData = bankrollStart > 0 || data.length > 0
    ? [{ date: '', profit: bankrollStart, match: '' }, ...data]
    : [{ date: '', profit: 0, match: '' }, ...data]

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
          Bankroll
        </h3>

        {/* Current bankroll */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Starting bankroll editable */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>start</span>
            {editing ? (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  autoFocus
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
                  style={{ width: 70, padding: '3px 8px', borderRadius: 6, background: 'rgba(240,235,224,0.08)', border: '1px solid rgba(79,142,247,0.5)', color: 'var(--color-text)', fontSize: 13, outline: 'none' }}
                />
                <button onClick={handleSave} style={{ background: 'rgba(0,230,118,0.2)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: 6, color: 'var(--color-win)', cursor: 'pointer', padding: '3px 8px', fontSize: 11 }}>✓</button>
              </div>
            ) : (
              <button onClick={handleEdit} style={{ background: 'rgba(240,235,224,0.04)', border: '1px solid rgba(240,235,224,0.1)', borderRadius: 6, color: 'var(--color-muted)', cursor: 'pointer', padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                {bankrollStart > 0 ? fmt(bankrollStart) : 'Set'} <span style={{ fontSize: 10 }}>✏️</span>
              </button>
            )}
          </div>

          {/* Current value */}
          {data.length > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>now</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: isPositive ? 'var(--color-win)' : 'var(--color-loss)' }}>
                {fmt(currentBankroll)}
              </div>
            </div>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>No settled bets yet</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240} minWidth={0}>
          <AreaChart data={paddedData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="bankrollGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lineColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={lineColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,235,224,0.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v ? v.slice(5) : ''} />
            <YAxis tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtK(v)} width={60} />
            <Tooltip content={<CustomTooltip bankrollStart={bankrollStart} />} />
            {bankrollStart > 0 && <ReferenceLine y={bankrollStart} stroke="rgba(240,235,224,0.17)" strokeDasharray="4 4" label={{ value: 'start', fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />}
            <Area type="monotone" dataKey="profit" stroke={lineColor} strokeWidth={2.5} fill="url(#bankrollGrad)"
              dot={{ fill: lineColor, r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: lineColor, strokeWidth: 2, stroke: 'rgba(255,255,255,0.3)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
