'use client'
import { useState, useRef } from 'react'
import { Bet, BetResult, BetPicker, BetFunder } from '@/types/bet'
import { fmtPnL } from '@/utils/currency'
import { supabase } from '@/lib/supabase'

interface AddBetModalProps {
  onClose: () => void
  onAdd: (bet: Omit<Bet, 'id'>) => void
  editBet?: Bet
  onUpdate?: (id: string, updates: Partial<Bet>) => void
}

function calcProfit(odds: number, stake: number, result: BetResult): number {
  if (result === 'win')  return parseFloat(((stake * odds) - stake).toFixed(2))
  if (result === 'loss') return -stake
  return 0
}

async function uploadSlip(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${Date.now()}.${ext}`
  const { data, error } = await supabase.storage.from('bet-slips').upload(path, file, { contentType: file.type })
  if (error || !data) return null
  return supabase.storage.from('bet-slips').getPublicUrl(data.path).data.publicUrl
}

export default function AddBetModal({ onClose, onAdd, editBet, onUpdate }: AddBetModalProps) {
  const isEdit = !!editBet
  const [slipFile, setSlipFile]     = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(editBet?.slipUrl ?? null)
  const [uploading, setUploading]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    date:     editBet?.date    ?? new Date().toISOString().slice(0, 10),
    match:    editBet?.match   ?? '',
    league:   editBet?.league  ?? 'FIFA World Cup',
    betType:  editBet?.betType ?? 'Other',
    prediction: editBet?.prediction ?? '',
    odds:     editBet?.odds  != null ? String(editBet.odds)  : '',
    stake:    editBet?.stake != null ? String(editBet.stake) : '',
    result:   (editBet?.result  ?? 'pending') as BetResult,
    picker:   (editBet?.picker  ?? 'both')    as BetPicker,
    fundedBy: (editBet?.fundedBy ?? 'bank')   as BetFunder,
    notes:    editBet?.notes ?? '',
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const oddsNum  = parseFloat(form.odds)
  const stakeNum = parseFloat(form.stake)
  const valid    = !isNaN(oddsNum) && oddsNum > 1 && !isNaN(stakeNum) && stakeNum > 0
  const potentialWin = valid ? parseFloat(((stakeNum * oddsNum) - stakeNum).toFixed(2)) : null
  const preview      = valid ? calcProfit(oddsNum, stakeNum, form.result) : null

  const handleSlipChange = (file: File) => {
    setSlipFile(file)
    setSlipPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setUploading(true)
    let slipUrl = editBet?.slipUrl ?? undefined
    if (slipFile) {
      const uploaded = await uploadSlip(slipFile)
      if (uploaded) slipUrl = uploaded
    }
    const profit = calcProfit(oddsNum, stakeNum, form.result)
    const description = form.match.trim() || `Bet @ ${form.odds}`
    const payload = {
      ...form,
      match: description,
      odds: oddsNum,
      stake: stakeNum,
      profit,
      fundedBy: form.fundedBy as BetFunder,
      slipUrl,
    }
    if (isEdit && editBet && onUpdate) {
      onUpdate(editBet.id, payload)
    } else {
      onAdd(payload)
    }
    setUploading(false)
    onClose()
  }

  const resultOptions: { value: BetResult; label: string; color: string }[] = [
    { value: 'pending', label: 'Pending', color: 'var(--color-pending)' },
    { value: 'win',     label: '✓ Win',   color: 'var(--color-win)'     },
    { value: 'loss',    label: '✗ Loss',  color: 'var(--color-loss)'    },
    { value: 'void',    label: 'Void',    color: 'var(--color-void)'    },
  ]

  const pickerOptions: { value: BetPicker; label: string }[] = [
    { value: 'pablo',   label: 'Pablo'   },
    { value: 'alberto', label: 'Alberto' },
    { value: 'both',    label: 'Both'    },
  ]

  const funderOptions: { value: BetFunder; label: string }[] = [
    { value: 'bank',    label: 'Bank'    },
    { value: 'pablo',   label: 'Pablo'   },
    { value: 'alberto', label: 'Alberto' },
  ]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fade-up modal-sheet scrollbar-thin" style={{
        width: '100%', maxWidth: 480,
        background: '#1E2D42',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        maxHeight: '90dvh', overflowY: 'auto',
        padding: 24,
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>
            {isEdit ? 'Edit Bet' : 'Add Bet'}
          </h2>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, color: 'var(--color-muted)', cursor: 'pointer',
            width: 30, height: 30, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Description */}
            <div>
              <label style={lbl}>Description (optional)</label>
              <input
                className="input-dark"
                type="text"
                placeholder="e.g. Brazil corners O9.5, Spain handicap -1..."
                value={form.match}
                onChange={e => set('match', e.target.value)}
              />
            </div>

            {/* Odds + Stake */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Odds *</label>
                <input
                  className="input-dark"
                  type="number" step="any" min="1.01"
                  placeholder="2.10"
                  value={form.odds}
                  onChange={e => set('odds', e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={lbl}>Stake ($) *</label>
                <input
                  className="input-dark"
                  type="number" step="0.5" min="0.5"
                  placeholder="50"
                  value={form.stake}
                  onChange={e => set('stake', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Potential win preview */}
            {valid && form.result === 'pending' && potentialWin !== null && (
              <div style={{
                padding: '10px 14px', borderRadius: 7,
                background: 'rgba(61,214,140,0.07)',
                border: '1px solid rgba(61,214,140,0.15)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Potential win</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-win)' }}>
                  {fmtPnL(potentialWin)}
                </span>
              </div>
            )}

            {/* Result */}
            <div>
              <label style={lbl}>Result</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {resultOptions.map(({ value, label, color }) => {
                  const active = form.result === value
                  return (
                    <button key={value} type="button" onClick={() => set('result', value)} style={{
                      padding: '9px 6px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: `1px solid ${active ? color + '60' : 'rgba(255,255,255,0.08)'}`,
                      background: active ? color + '18' : 'rgba(255,255,255,0.03)',
                      color: active ? color : 'var(--color-muted)',
                      transition: 'all 0.12s',
                    }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Result P&L */}
            {valid && preview !== null && form.result !== 'pending' && (
              <div style={{
                padding: '10px 14px', borderRadius: 7,
                background: preview >= 0 ? 'rgba(61,214,140,0.07)' : 'rgba(224,83,83,0.07)',
                border: `1px solid ${preview >= 0 ? 'rgba(61,214,140,0.2)' : 'rgba(224,83,83,0.2)'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>P&L</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: preview >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                  {fmtPnL(preview)}
                </span>
              </div>
            )}

            {/* Who picked / funded */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Picked by</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {pickerOptions.map(({ value, label }) => {
                    const active = form.picker === value
                    return (
                      <button key={value} type="button" onClick={() => set('picker', value)} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        border: `1px solid ${active ? 'rgba(245,166,35,0.5)' : 'rgba(255,255,255,0.07)'}`,
                        background: active ? 'rgba(245,166,35,0.12)' : 'rgba(255,255,255,0.03)',
                        color: active ? 'var(--color-accent)' : 'var(--color-muted)',
                        transition: 'all 0.12s',
                      }}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={lbl}>Funded by</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {funderOptions.map(({ value, label }) => {
                    const active = form.fundedBy === value
                    return (
                      <button key={value} type="button" onClick={() => set('fundedBy', value)} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        border: `1px solid ${active ? 'rgba(245,166,35,0.5)' : 'rgba(255,255,255,0.07)'}`,
                        background: active ? 'rgba(245,166,35,0.12)' : 'rgba(255,255,255,0.03)',
                        color: active ? 'var(--color-accent)' : 'var(--color-muted)',
                        transition: 'all 0.12s',
                      }}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Date + notes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Date</label>
                <input className="input-dark" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
              </div>
              <div>
                <label style={lbl}>Notes (optional)</label>
                <input className="input-dark" type="text" placeholder="Any notes..." value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>

            {/* Betting slip image */}
            <div>
              <label style={lbl}>Betting slip (optional)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleSlipChange(f) }}
              />
              {slipPreview ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src={slipPreview}
                    alt="Betting slip"
                    style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, display: 'block', cursor: 'pointer' }}
                    onClick={() => fileRef.current?.click()}
                  />
                  <button
                    type="button"
                    onClick={() => { setSlipFile(null); setSlipPreview(null) }}
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.7)', border: 'none',
                      color: '#fff', fontSize: 14, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >×</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: '100%', padding: '14px 0', borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px dashed rgba(255,255,255,0.15)',
                    color: 'var(--color-muted)', cursor: 'pointer', fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  📎 Attach slip image
                </button>
              )}
            </div>

          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '11px 0', borderRadius: 7,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'var(--color-muted)', cursor: 'pointer', fontWeight: 600, fontSize: 14,
            }}>
              Cancel
            </button>
            <button type="submit" disabled={uploading} className="btn-primary" style={{ flex: 2, padding: '11px 0', fontSize: 14, opacity: uploading ? 0.7 : 1 }}>
              {uploading ? 'Saving…' : (isEdit ? 'Update' : 'Save bet')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--color-muted)', letterSpacing: '0.05em',
  textTransform: 'uppercase', marginBottom: 6,
}
