'use client'
import React, { useState } from 'react'
import { Bet, LegResult, ParlayLeg } from '@/types/bet'
import { calcParlay, LEG_RESULT_META } from '@/utils/parlayCalc'
import { fmt, fmtPnL } from '@/utils/currency'

interface BetsTableProps {
  bets: Bet[]
  onDelete: (id: string) => void
  onEdit: (bet: Bet) => void
  onUpdateBet?: (id: string, updates: Partial<Bet>) => void
}

const RESULT_LABELS = { win: 'Win', loss: 'Loss', pending: 'Pending', void: 'Void' }
const RESULT_ICONS  = { win: '✅', loss: '❌', pending: '⏳', void: '↩️' }
const PICKER_LABELS = { pablo: '👤 Pablo', alberto: '👥 Alberto', both: '🤝 Both' }

const LEG_RESULT_ORDER: LegResult[] = ['win', 'half-win', 'half-loss', 'loss', 'void', 'pending']

function exportCSV(bets: Bet[]) {
  const headers = ['Date', 'Match', 'Competition', 'Bet Type', 'Pick', 'Odds', 'Stake', 'Result', 'Profit', 'Picker', 'Notes']
  const rows = bets.map(b => [
    b.date, `"${b.match}"`, `"${b.league}"`, `"${b.betType}"`, `"${b.prediction}"`,
    b.odds, b.stake, b.result, b.profit, b.picker ?? '', `"${b.notes ?? ''}"`
  ].join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `bets-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function BetsTable({ bets, onDelete, onEdit, onUpdateBet }: BetsTableProps) {
  const [filter, setFilter]       = useState<'all' | 'win' | 'loss' | 'pending'>('all')
  const [dateRange, setDateRange] = useState<'all' | '30d' | '90d'>('all')
  const [sortBy, setSortBy]       = useState<'date' | 'profit' | 'odds'>('date')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expanded, setExpanded]   = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => setExpanded(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n
  })

  const cutoff = dateRange === '30d'
    ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : dateRange === '90d'
    ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : null

  const filtered = bets
    .filter(b => filter === 'all' || b.result === filter)
    .filter(b => !cutoff || b.date >= cutoff)
    .sort((a, b) => {
      if (sortBy === 'date')   return b.date.localeCompare(a.date)
      if (sortBy === 'profit') return b.profit - a.profit
      if (sortBy === 'odds')   return b.odds - a.odds
      return 0
    })

  const handleDelete = (id: string) => {
    if (confirmDelete === id) { onDelete(id); setConfirmDelete(null) }
    else { setConfirmDelete(id); setTimeout(() => setConfirmDelete(null), 3000) }
  }

  // Settle one leg of a parlay and propagate to the overall bet
  const settleLeg = (bet: Bet, legIdx: number, legResult: LegResult) => {
    if (!bet.legs || !onUpdateBet) return

    const newLegs: ParlayLeg[] = bet.legs.map((leg, i) =>
      i === legIdx ? { ...leg, result: legResult } : leg
    )

    const settlement = calcParlay(newLegs, bet.stake)

    if (settlement.result !== 'pending') {
      // All legs settled (or full loss triggered)
      onUpdateBet(bet.id, {
        legs: newLegs,
        result: settlement.result,
        profit: settlement.profit,
      })
    } else {
      onUpdateBet(bet.id, { legs: newLegs })
    }
  }

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Bet History · {filtered.length} bet{filtered.length !== 1 ? 's' : ''}
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['all', 'win', 'loss', 'pending'] as const).map(f => {
            const labels = { all: 'All', win: '✅ Wins', loss: '❌ Losses', pending: '⏳ Pending' }
            const active = filter === f
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: active ? 'rgba(129,140,248,0.2)' : 'rgba(111,106,55,0.06)',
                border: active ? '1px solid rgba(129,140,248,0.4)' : '1px solid rgba(111,106,55,0.13)',
                color: active ? 'var(--color-accent)' : 'var(--color-muted)',
              }}>{labels[f]}</button>
            )
          })}

          {/* Date range */}
          <div style={{ width: 1, height: 16, background: 'rgba(111,106,55,0.15)' }} />
          {(['30d', '90d', 'all'] as const).map(r => {
            const labels = { '30d': '30d', '90d': '90d', all: 'All time' }
            const active = dateRange === r
            return (
              <button key={r} onClick={() => setDateRange(r)} style={{
                padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: active ? 'rgba(129,140,248,0.12)' : 'rgba(111,106,55,0.06)',
                border: active ? '1px solid rgba(129,140,248,0.3)' : '1px solid rgba(111,106,55,0.13)',
                color: active ? 'var(--color-accent)' : 'var(--color-muted)',
              }}>{labels[r]}</button>
            )
          })}

          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, background: 'rgba(111,106,55,0.06)', border: '1px solid rgba(111,106,55,0.13)', color: 'var(--color-muted)', cursor: 'pointer', outline: 'none' }}>
            <option value="date">↓ Date</option>
            <option value="profit">↓ Profit</option>
            <option value="odds">↓ Odds</option>
          </select>
          <button onClick={() => exportCSV(bets)} title="Download CSV" style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: 'rgba(111,106,55,0.06)', border: '1px solid rgba(111,106,55,0.13)',
            color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: 5,
          }}>📥 CSV</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-muted)' }}>
          No bets {filter !== 'all' ? 'in this category' : 'yet'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(111,106,55,0.12)' }}>
                {['Date', 'Match', 'Competition', 'Pick', 'Odds', 'Stake', 'Picker', 'Result', 'EV', 'Profit', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(bet => {
                const profitColor = bet.result === 'win' ? 'var(--color-win)' : bet.result === 'loss' ? 'var(--color-loss)' : bet.result === 'pending' ? 'var(--color-pending)' : 'var(--color-void)'
                const hasLegs    = bet.legs && bet.legs.length > 0
                const ev = bet.myProb != null ? (bet.myProb * bet.odds - 1) * 100 : null
                const isExpanded = expanded.has(bet.id)

                // Live parlay calc for expanded view
                const liveSettlement = hasLegs ? calcParlay(bet.legs!, bet.stake) : null

                return (
                  <React.Fragment key={bet.id}>
                    <tr className={`row-${bet.result}`} style={{ borderBottom: isExpanded ? 'none' : '1px solid rgba(111,106,55,0.06)', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(111,106,55,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px', fontSize: 13, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{bet.date.slice(5)}</td>
                      <td style={{ padding: '12px', fontSize: 13, fontWeight: 600, maxWidth: 180 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {hasLegs && (
                            <button onClick={() => toggleExpand(bet.id)} style={{
                              flexShrink: 0, background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)',
                              borderRadius: 5, color: 'var(--color-accent)', cursor: 'pointer',
                              fontSize: 10, fontWeight: 700, padding: '2px 5px', lineHeight: 1,
                            }}>
                              {isExpanded ? '▼' : '▶'} {bet.legs!.length}
                            </button>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bet.match}</span>
                              {bet.slipUrl && (
                                <a href={bet.slipUrl} target="_blank" rel="noreferrer" title="View slip" style={{ flexShrink: 0, fontSize: 12, opacity: 0.6, textDecoration: 'none', lineHeight: 1 }}>📎</a>
                              )}
                            </div>
                            {bet.bookmaker && <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 1 }}>{bet.bookmaker}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px', fontSize: 12, whiteSpace: 'nowrap' }}>
                        <span style={{ background: 'rgba(129,140,248,0.1)', color: 'var(--color-accent)', border: '1px solid rgba(129,140,248,0.2)', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                          {bet.league.replace('UEFA ', '').replace('FIFA ', '')}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: 13, color: 'var(--color-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bet.prediction}</td>
                      <td className="num" style={{ padding: '12px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        {bet.odds.toFixed(4).replace(/\.?0+$/, '')}
                        {bet.closingOdds != null && (
                          <div style={{ fontSize: 10, color: bet.odds >= bet.closingOdds ? 'var(--color-win)' : 'var(--color-loss)', marginTop: 1 }}>
                            {bet.odds >= bet.closingOdds ? '✓' : '↓'} close {bet.closingOdds.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="num" style={{ padding: '12px', fontSize: 13, whiteSpace: 'nowrap' }}>{fmt(bet.stake)}</td>
                      <td style={{ padding: '12px', fontSize: 12, whiteSpace: 'nowrap', color: 'var(--color-muted)' }}>
                        {bet.picker ? PICKER_LABELS[bet.picker] : '—'}
                      </td>
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                        <span className={`badge badge-${bet.result}`}>
                          {RESULT_ICONS[bet.result]} {RESULT_LABELS[bet.result]}
                        </span>
                        {bet.cashOut != null && (
                          <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, color: 'var(--color-pending)', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 4, padding: '1px 5px' }}>CO</span>
                        )}
                      </td>
                      <td className="num" style={{ padding: '12px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: ev == null ? 'var(--color-muted)' : ev >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                        {ev == null ? '—' : `${ev >= 0 ? '+' : ''}${ev.toFixed(1)}%`}
                      </td>
                      <td className="num" style={{ padding: '12px', fontSize: 14, fontWeight: 800, color: profitColor, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        {bet.result === 'pending' ? '—' : fmtPnL(bet.profit)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => onEdit(bet)} style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600,
                            background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)',
                            color: 'var(--color-accent)',
                          }}>✏️</button>
                          <button onClick={() => handleDelete(bet.id)} style={{
                            padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600,
                            background: confirmDelete === bet.id ? 'rgba(248,113,113,0.2)' : 'rgba(111,106,55,0.07)',
                            border: confirmDelete === bet.id ? '1px solid rgba(248,113,113,0.4)' : '1px solid rgba(111,106,55,0.13)',
                            color: confirmDelete === bet.id ? 'var(--color-loss)' : 'var(--color-muted)',
                          }}>{confirmDelete === bet.id ? 'Sure?' : '✕'}</button>
                        </div>
                      </td>
                    </tr>

                    {/* ── Expanded parlay legs ── */}
                    {hasLegs && isExpanded && (
                      <tr style={{ borderBottom: '1px solid rgba(111,106,55,0.06)' }}>
                        <td colSpan={10} style={{ padding: '0 12px 14px 36px' }}>
                          {/* Live settlement summary */}
                          {liveSettlement && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10, padding: '7px 12px', borderRadius: 8, background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.12)' }}>
                              <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Live · {liveSettlement.settledCount}/{liveSettlement.totalLegs} settled
                              </span>
                              <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                color: liveSettlement.profit > 0 ? 'var(--color-win)' : liveSettlement.profit < 0 ? 'var(--color-loss)' : 'var(--color-muted)' }}>
                                {liveSettlement.settledCount === 0
                                  ? `Max ${fmtPnL((bet.stake * bet.odds) - bet.stake)}`
                                  : fmtPnL(liveSettlement.profit)
                                }
                              </span>
                              {liveSettlement.settledCount > 0 && liveSettlement.settledCount < liveSettlement.totalLegs && (
                                <span style={{ fontSize: 11, color: 'var(--color-muted)', opacity: 0.7 }}>
                                  ({liveSettlement.totalLegs - liveSettlement.settledCount} running)
                                </span>
                              )}
                            </div>
                          )}

                          {/* Per-leg rows */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, borderLeft: '2px solid rgba(129,140,248,0.2)', paddingLeft: 12 }}>
                            {bet.legs!.map((leg, i) => {
                              const currentResult: LegResult = leg.result ?? 'pending'
                              const meta = LEG_RESULT_META[currentResult]
                              return (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(111,106,55,0.05)', border: `1px solid ${meta.border}` }}>
                                  {/* Leg info */}
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 10, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{leg.league}</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leg.match || '—'}</div>
                                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>
                                      <span style={{ background: 'rgba(111,106,55,0.09)', borderRadius: 4, padding: '1px 5px', marginRight: 5 }}>{leg.betType}</span>
                                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{leg.prediction}</span>
                                    </div>
                                  </div>

                                  {/* Individual odds */}
                                  {leg.odds > 0 && (
                                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-accent)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                      @{leg.odds.toFixed(2)}
                                    </span>
                                  )}

                                  {/* Result chips — only when bet is parlay and has updateBet */}
                                  {onUpdateBet && (
                                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                      {LEG_RESULT_ORDER.map(r => {
                                        const m = LEG_RESULT_META[r]
                                        const active = currentResult === r
                                        return (
                                          <button key={r} onClick={() => settleLeg(bet, i, r)}
                                            title={m.label}
                                            style={{
                                              padding: '3px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                                              background: active ? m.bg : 'rgba(111,106,55,0.06)',
                                              border: `1px solid ${active ? m.border : 'rgba(111,106,55,0.13)'}`,
                                              color: active ? m.color : 'var(--color-muted)',
                                              transition: 'all 0.15s',
                                            }}>
                                            {m.short}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {/* Settlement rules reminder */}
                          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--color-muted)', opacity: 0.55, lineHeight: 1.6 }}>
                            W = Full Win · ½W = Half Win (reduced odds) · ½L = Half Loss (×0.5) · L = Loss (parlay dead) · V = Void (×1 neutral)
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
