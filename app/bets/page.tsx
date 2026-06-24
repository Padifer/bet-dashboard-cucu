'use client'
import { useState } from 'react'
import { Bet } from '@/types/bet'
import { fmt, fmtPnL } from '@/utils/currency'
import { useBets } from '@/hooks/useBets'
import Navbar from '@/components/Navbar'
import AddBetModal from '@/components/AddBetModal'
import BottomNav from '@/components/BottomNav'

function MiniCard({ label, value, sub, light = false, valueColor }: {
  label: string; value: string | number; sub?: string; light?: boolean; valueColor?: string
}) {
  const bg = light ? '#F0EBE0' : '#223022'
  const border = light ? 'rgba(27,43,27,0.1)' : 'rgba(240,235,224,0.07)'
  const labelCol = light ? 'rgba(27,43,27,0.4)' : 'rgba(240,235,224,0.4)'
  const defaultVal = light ? '#1B2B1B' : '#F0EBE0'
  const subCol = light ? 'rgba(27,43,27,0.35)' : 'rgba(240,235,224,0.33)'
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: labelCol, marginBottom: 8 }}>{label}</div>
      <div className="num" style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: valueColor ?? defaultVal }}>{value}</div>
      {sub && <div style={{ fontSize: 11, marginTop: 6, color: subCol }}>{sub}</div>}
    </div>
  )
}

const RESULT_COLOR = {
  win:     'var(--color-win)',
  loss:    'var(--color-loss)',
  pending: 'var(--color-pending)',
  void:    'var(--color-void)',
}
const RESULT_BG = {
  win:     'rgba(52,211,153,0.08)',
  loss:    'rgba(248,113,113,0.08)',
  pending: 'rgba(251,191,36,0.08)',
  void:    'rgba(148,163,184,0.08)',
}
const RESULT_BORDER = {
  win:     'rgba(52,211,153,0.3)',
  loss:    'rgba(248,113,113,0.3)',
  pending: 'rgba(251,191,36,0.3)',
  void:    'rgba(148,163,184,0.2)',
}
const RESULT_LABEL = { win: 'Win', loss: 'Loss', pending: 'Pending', void: 'Void' }
const RESULT_ICON  = { win: '✅', loss: '❌', pending: '⏳', void: '↩️' }
const PICKER_LABEL: Record<string, string> = { pablo: '👤 Pablo', alberto: '👥 Alberto', both: '🤝 Both' }

function BetCard({ bet, onEdit, onDelete, onSettle, onUndo }: {
  bet: Bet
  onEdit: (b: Bet) => void
  onDelete: (id: string) => void
  onSettle: (id: string, result: 'win' | 'loss' | 'void') => void
  onUndo: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [slipOpen, setSlipOpen] = useState(false)
  const c = RESULT_COLOR[bet.result]

  const handleDelete = () => {
    if (confirmDelete) { onDelete(bet.id) }
    else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000) }
  }

  return (
    <div style={{
      background: RESULT_BG[bet.result],
      border: `1px solid ${RESULT_BORDER[bet.result]}`,
      borderRadius: 16,
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Top row: match + result badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, marginBottom: 3 }}>{bet.match}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 600, color: 'var(--color-accent)',
              background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)',
              borderRadius: 5, padding: '2px 7px',
            }}>{bet.league.replace('UEFA ', '').replace('FIFA ', '')}</span>
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{bet.date.slice(5)}</span>
            {bet.bookmaker && <span style={{ fontSize: 11, color: 'var(--color-muted)', opacity: 0.7 }}>· {bet.bookmaker}</span>}
          </div>
        </div>
        <span className={`badge badge-${bet.result}`} style={{ flexShrink: 0, fontSize: 12, padding: '4px 10px' }}>
          {RESULT_ICON[bet.result]} {RESULT_LABEL[bet.result]}
        </span>
      </div>

      {/* Prediction row */}
      <div style={{ fontSize: 13, color: 'var(--color-muted)', padding: '8px 12px', background: 'rgba(240,235,224,0.03)', borderRadius: 8 }}>
        <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{bet.prediction}</span>
        <span style={{ marginLeft: 8, opacity: 0.6 }}>· {bet.betType}</span>
      </div>

      {/* Stats row */}
      {(() => {
        const totalReturn = bet.result === 'loss' ? 0
          : bet.result === 'void' ? bet.stake
          : parseFloat((bet.stake * bet.odds).toFixed(2))  // win or pending
        const pnl = bet.result === 'pending'
          ? parseFloat(((bet.stake * bet.odds) - bet.stake).toFixed(2))
          : bet.profit
        const totalLabel = bet.result === 'pending' ? 'Total if win'
          : bet.result === 'void' ? 'Returned'
          : 'Total return'
        const pnlLabel = bet.result === 'pending' ? 'Profit' : 'P&L'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--color-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Odds</div>
              <div className="num" style={{ fontSize: 16, fontWeight: 700 }}>{bet.odds.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--color-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stake</div>
              <div className="num" style={{ fontSize: 16, fontWeight: 700 }}>{fmt(bet.stake)}</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'flex-end' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--color-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{totalLabel}</div>
                <div className="num" style={{ fontSize: 16, fontWeight: 700 }}>{fmt(totalReturn)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--color-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{pnlLabel}</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 800, color: c, letterSpacing: '-0.02em' }}>{fmtPnL(pnl)}</div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Settle buttons (pending only) */}
      {bet.result === 'pending' && (
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          <button onClick={() => onSettle(bet.id, 'win')} style={{
            flex: 1, padding: '9px 6px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(110,194,0,0.12)', border: '1px solid rgba(110,194,0,0.35)', color: '#6EC200',
          }}>✓ Win</button>
          <button onClick={() => onSettle(bet.id, 'loss')} style={{
            flex: 1, padding: '9px 6px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(232,92,42,0.12)', border: '1px solid rgba(232,92,42,0.35)', color: '#E85C2A',
          }}>✗ Loss</button>
          <button onClick={() => onSettle(bet.id, 'void')} style={{
            flex: 1, padding: '9px 6px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(240,235,224,0.04)', border: '1px solid rgba(240,235,224,0.12)', color: 'var(--color-muted)',
          }}>Void</button>
        </div>
      )}

      {/* Fullscreen slip lightbox */}
      {bet.slipUrl && slipOpen && (
        <div
          onClick={() => setSlipOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.94)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <img src={bet.slipUrl} alt="Bet slip" style={{ maxWidth: '100%', maxHeight: '90dvh', objectFit: 'contain', borderRadius: 10 }} />
          <button onClick={e => { e.stopPropagation(); setSlipOpen(false) }} style={{
            position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(240,235,224,0.12)', border: '1px solid rgba(240,235,224,0.2)',
            color: '#F0EBE0', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>
      )}

      {/* Footer: picker + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid rgba(240,235,224,0.05)' }}>
        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
          {bet.picker ? PICKER_LABEL[bet.picker] : '—'}
          {bet.fundedBy && bet.fundedBy !== 'bank' && (
            <span style={{ marginLeft: 6, opacity: 0.6 }}>· funded by {bet.fundedBy}</span>
          )}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {bet.slipUrl && (
            <button onClick={() => setSlipOpen(true)} style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600,
              background: 'rgba(240,235,224,0.06)', border: '1px solid rgba(240,235,224,0.18)', color: 'var(--color-text)',
            }}>📎 Slip</button>
          )}
          {bet.result !== 'pending' && (
            <button onClick={() => onUndo(bet.id)} style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600,
              background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.3)', color: '#F5C842',
            }}>↩ Undo</button>
          )}
          <button onClick={() => onEdit(bet)} style={{
            padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600,
            background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)',
            color: 'var(--color-accent)',
          }}>Edit</button>
          <button onClick={handleDelete} style={{
            padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600,
            background: confirmDelete ? 'rgba(248,113,113,0.2)' : 'rgba(240,235,224,0.04)',
            border: confirmDelete ? '1px solid rgba(248,113,113,0.4)' : '1px solid rgba(240,235,224,0.08)',
            color: confirmDelete ? 'var(--color-loss)' : 'var(--color-muted)',
          }}>{confirmDelete ? 'Sure?' : '✕'}</button>
        </div>
      </div>
    </div>
  )
}

type FilterResult = 'all' | 'win' | 'loss' | 'pending'
type SortBy = 'date' | 'profit' | 'odds'
type ViewMode = 'cards' | 'table'

const RESULT_DOT: Record<string, string> = { win: '#6EC200', loss: '#E85C2A', pending: '#FBBA24', void: '#94A3B8' }

function BetsTableView({ bets, onEdit, onSettle, onUndo }: {
  bets: Bet[]
  onEdit: (b: Bet) => void
  onSettle: (id: string, r: 'win' | 'loss' | 'void') => void
  onUndo: (id: string) => void
}) {
  const TH: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'rgba(240,235,224,0.3)', padding: '7px 10px', whiteSpace: 'nowrap', textAlign: 'left',
  }
  return (
    <div style={{ background: '#223022', border: '1px solid rgba(240,235,224,0.07)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(240,235,224,0.07)' }}>
              <th style={{ ...TH }}>Date</th>
              <th style={{ ...TH }}>Match</th>
              <th style={{ ...TH }}>Pick</th>
              <th style={{ ...TH }}>Picker</th>
              <th style={{ ...TH, textAlign: 'right' }}>Odds</th>
              <th style={{ ...TH, textAlign: 'right' }}>Stake</th>
              <th style={{ ...TH, textAlign: 'right' }}>Return</th>
              <th style={{ ...TH, textAlign: 'right' }}>Profit</th>
              <th style={{ ...TH }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((bet, i) => {
              const totalReturn = bet.result === 'loss' ? 0
                : bet.result === 'void' ? bet.stake
                : parseFloat((bet.stake * bet.odds).toFixed(2))
              const profit = bet.result === 'pending'
                ? parseFloat(((bet.stake * bet.odds) - bet.stake).toFixed(2))
                : bet.profit
              const profitColor = bet.result === 'pending' ? 'rgba(240,235,224,0.35)' : bet.profit >= 0 ? '#6EC200' : '#E85C2A'
              const returnColor = bet.result === 'pending' ? 'rgba(240,235,224,0.35)' : bet.result === 'win' ? '#6EC200' : 'rgba(240,235,224,0.4)'
              const dot = RESULT_DOT[bet.result] ?? '#94A3B8'
              const pickerLabel = bet.picker === 'pablo' ? 'P' : bet.picker === 'alberto' ? 'A' : bet.picker === 'both' ? 'P+A' : '—'
              const pickerColor = bet.picker === 'pablo' ? '#F0EBE0' : bet.picker === 'alberto' ? '#6EC200' : 'rgba(240,235,224,0.4)'
              return (
                <tr key={bet.id} style={{ borderBottom: i < bets.length - 1 ? '1px solid rgba(240,235,224,0.04)' : 'none' }}>
                  <td style={{ padding: '8px 10px', color: 'rgba(240,235,224,0.4)', whiteSpace: 'nowrap', fontSize: 11 }}>
                    <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: dot, marginRight: 6, verticalAlign: 'middle', flexShrink: 0 }} />
                    {bet.date.slice(5)}
                  </td>
                  <td style={{ padding: '8px 10px', maxWidth: 180 }}>
                    <div style={{ fontWeight: 600, color: '#F0EBE0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{bet.match}</div>
                    <div style={{ fontSize: 10, color: 'rgba(240,235,224,0.32)', marginTop: 1 }}>{bet.league.replace('UEFA ', '').replace('FIFA ', '')}</div>
                  </td>
                  <td style={{ padding: '8px 10px', maxWidth: 160 }}>
                    <div style={{ color: 'rgba(240,235,224,0.75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{bet.prediction}</div>
                    <div style={{ fontSize: 10, color: 'rgba(240,235,224,0.3)', marginTop: 1 }}>{bet.betType}</div>
                  </td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: pickerColor }}>{pickerLabel}</span>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'rgba(240,235,224,0.6)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {bet.odds.toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'rgba(240,235,224,0.6)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {fmt(bet.stake)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    <span className="num" style={{ fontWeight: 600, color: returnColor }}>
                      {bet.result === 'pending' ? `${fmt(totalReturn)}?` : fmt(totalReturn)}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    <span className="num" style={{ fontWeight: 700, color: profitColor }}>
                      {bet.result === 'pending' ? `+${fmt(profit)}?` : fmtPnL(profit)}
                    </span>
                  </td>
                  <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                    {bet.result === 'pending' ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => onSettle(bet.id, 'win')} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(110,194,0,0.12)', border: '1px solid rgba(110,194,0,0.35)', color: '#6EC200' }}>W</button>
                        <button onClick={() => onSettle(bet.id, 'loss')} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'rgba(232,92,42,0.12)', border: '1px solid rgba(232,92,42,0.35)', color: '#E85C2A' }}>L</button>
                        <button onClick={() => onSettle(bet.id, 'void')} style={{ padding: '3px 7px', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: 'rgba(240,235,224,0.04)', border: '1px solid rgba(240,235,224,0.1)', color: 'rgba(240,235,224,0.4)' }}>V</button>
                        <button onClick={() => onEdit(bet)} style={{ padding: '3px 7px', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', color: 'var(--color-accent)' }}>✎</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => onUndo(bet.id)} style={{ padding: '3px 8px', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: 'rgba(245,200,66,0.1)', border: '1px solid rgba(245,200,66,0.25)', color: '#F5C842' }}>↩</button>
                        <button onClick={() => onEdit(bet)} style={{ padding: '3px 7px', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.2)', color: 'var(--color-accent)' }}>✎</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function BetsPage() {
  const { bets, addBet, deleteBet, updateBet, settleBet, loaded, stats } = useBets()
  const undo = (id: string) => updateBet(id, { result: 'pending', profit: 0 })
  const [showModal, setShowModal]   = useState(false)
  const [editingBet, setEditingBet] = useState<Bet | null>(null)
  const [filter, setFilter]         = useState<FilterResult>('all')
  const [sortBy, setSortBy]         = useState<SortBy>('date')
  const [dateRange, setDateRange]   = useState<'all' | '30d' | '90d'>('all')
  const [viewMode, setViewMode]     = useState<ViewMode>('table')

  if (!loaded) return (
    <>
      <Navbar onAddBet={() => setShowModal(true)} />
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)', fontSize: 14 }}>Loading…</div>
    </>
  )

  const cutoff = dateRange === '30d' ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : dateRange === '90d' ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : null

  const filtered = bets
    .filter(b => filter === 'all' || b.result === filter)
    .filter(b => !cutoff || b.date >= cutoff)
    .sort((a, b) => {
      if (a.result === 'pending' && b.result !== 'pending') return -1
      if (a.result !== 'pending' && b.result === 'pending') return 1
      if (sortBy === 'date')   return b.date.localeCompare(a.date)
      if (sortBy === 'profit') return b.profit - a.profit
      if (sortBy === 'odds')   return b.odds - a.odds
      return 0
    })

  const filterTabs: { key: FilterResult; label: string; count: number }[] = [
    { key: 'all',     label: 'All',     count: bets.length },
    { key: 'pending', label: '⏳',      count: stats.pending },
    { key: 'win',     label: '✅',      count: stats.wins },
    { key: 'loss',    label: '❌',      count: stats.losses },
  ]

  const roiStr = `${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`
  const pendingStake = bets.filter(b => b.result === 'pending').reduce((s, b) => s + b.stake, 0)

  return (
    <>
      <Navbar onAddBet={() => setShowModal(true)} />

      {/* Stats hero */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 16px 0' }}>
        <div className="grid-mini-4">
          <MiniCard label="Open" value={stats.pending} sub={`$${pendingStake.toFixed(0)} at risk`} light />
          <MiniCard label="Won" value={stats.wins} valueColor="#6EC200" />
          <MiniCard label="Lost" value={stats.losses} valueColor="#E85C2A" light />
          <MiniCard label="ROI" value={roiStr} sub={`${stats.total} bets`}
            valueColor={stats.roi >= 0 ? '#6EC200' : '#E85C2A'} />
        </div>
      </div>

      {/* Sticky filter bar */}
      <div style={{
        position: 'sticky',
        top: 'calc(56px + env(safe-area-inset-top))',
        zIndex: 39,
        background: 'rgba(27,43,27,0.97)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(240,235,224,0.07)',
      }}>
        <div style={{
          maxWidth: 700, margin: '0 auto',
          padding: '8px 16px',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {/* Row 1: result filters + sort */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {filterTabs.map(({ key, label, count }) => {
              const active = filter === key
              return (
                <button key={key} className="pill-btn" onClick={() => setFilter(key)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: active ? 'rgba(129,140,248,0.18)' : 'rgba(240,235,224,0.04)',
                  border: active ? '1px solid rgba(129,140,248,0.4)' : '1px solid rgba(240,235,224,0.08)',
                  color: active ? 'var(--color-accent)' : 'var(--color-muted)',
                }}>
                  {label} <span style={{ opacity: 0.7, fontSize: 11 }}>{count}</span>
                </button>
              )
            })}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
                style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, background: 'rgba(240,235,224,0.04)', border: '1px solid rgba(240,235,224,0.08)', color: 'var(--color-muted)', cursor: 'pointer', outline: 'none' }}>
                <option value="date">↓ Date</option>
                <option value="profit">↓ Profit</option>
                <option value="odds">↓ Odds</option>
              </select>
              <div style={{ display: 'flex', background: 'rgba(240,235,224,0.04)', border: '1px solid rgba(240,235,224,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                {(['table', 'cards'] as ViewMode[]).map(v => (
                  <button key={v} onClick={() => setViewMode(v)} style={{
                    padding: '5px 10px', fontSize: 13, cursor: 'pointer', border: 'none',
                    background: viewMode === v ? 'rgba(129,140,248,0.18)' : 'transparent',
                    color: viewMode === v ? 'var(--color-accent)' : 'var(--color-muted)',
                  }}>{v === 'table' ? '☰' : '⊞'}</button>
                ))}
              </div>
            </div>
          </div>
          {/* Row 2: date range filters */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {(['30d', '90d', 'all'] as const).map(r => {
              const active = dateRange === r
              return (
                <button key={r} className="pill-btn" onClick={() => setDateRange(r)} style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: active ? 'rgba(129,140,248,0.12)' : 'rgba(240,235,224,0.04)',
                  border: active ? '1px solid rgba(129,140,248,0.3)' : '1px solid rgba(240,235,224,0.08)',
                  color: active ? 'var(--color-accent)' : 'var(--color-muted)',
                }}>{r === 'all' ? 'All time' : r}</button>
              )
            })}
          </div>
        </div>
      </div>

      <main className="page-main" style={{
        maxWidth: viewMode === 'table' ? 1100 : 700, margin: '0 auto',
        padding: '16px 16px 100px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-muted)' }}>
            No bets {filter !== 'all' ? 'in this category' : 'yet — add your first one!'}
          </div>
        ) : viewMode === 'table' ? (
          <BetsTableView
            bets={filtered}
            onEdit={setEditingBet}
            onSettle={settleBet}
            onUndo={undo}
          />
        ) : (
          filtered.map(bet => (
            <BetCard
              key={bet.id}
              bet={bet}
              onEdit={setEditingBet}
              onDelete={deleteBet}
              onSettle={settleBet}
              onUndo={undo}
            />
          ))
        )}
      </main>

      {showModal  && <AddBetModal onClose={() => setShowModal(false)} onAdd={addBet} />}
      {editingBet && <AddBetModal onClose={() => setEditingBet(null)} onAdd={addBet} editBet={editingBet} onUpdate={updateBet} />}

      <BottomNav />
    </>
  )
}
