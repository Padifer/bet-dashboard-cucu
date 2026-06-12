'use client'
import { useState, useRef, useCallback } from 'react'
import { Bet, BetResult, BetPicker, BetFunder, ParlayLeg } from '@/types/bet'
import { parseBookmakerText, ParsedBet } from '@/utils/parseBookmakerText'
import { fmt, fmtPnL } from '@/utils/currency'

// Invert dark-background screenshots before OCR — Tesseract fails on white-on-dark
async function preprocessForOcr(file: File): Promise<File> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const id = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = id.data

      // Sample centre region to measure average brightness
      let sum = 0, n = 0
      const cx = Math.floor(canvas.width / 2), cy = Math.floor(canvas.height / 2)
      for (let y = Math.max(0, cy - 150); y < Math.min(canvas.height, cy + 150); y++) {
        for (let x = Math.max(0, cx - 150); x < Math.min(canvas.width, cx + 150); x++) {
          const i = (y * canvas.width + x) * 4
          sum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
          n++
        }
      }
      const avg = n > 0 ? sum / n : 128

      if (avg < 110) {
        // Dark background — invert all pixels
        for (let i = 0; i < d.length; i += 4) {
          d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]
        }
        ctx.putImageData(id, 0, 0)
      }

      URL.revokeObjectURL(url)
      canvas.toBlob(blob => resolve(new File([blob!], file.name, { type: 'image/png' })), 'image/png')
    }
    img.src = url
  })
}

interface AddBetModalProps {
  onClose: () => void
  onAdd: (bet: Omit<Bet, 'id'>) => void
  editBet?: Bet
  onUpdate?: (id: string, updates: Partial<Bet>) => void
}

const LEAGUES = ['Mix Parlay', 'FIFA World Cup', 'UEFA Champions League', 'UEFA Europa League', 'La Liga', 'Premier League', 'Bundesliga', 'Serie A', 'Ligue 1', 'UEFA Nations League', 'UEFA Euros', 'Other']
const BET_TYPES = ['Match Result (1X2)', 'Double Chance', 'Over/Under', 'BTTS', 'Handicap', 'Mix Parlay', 'First Goalscorer', 'Correct Score', 'Cards', 'Corners', 'Other']

// Map parser output → a valid BET_TYPES entry
function toBetTypeOption(raw: string): string {
  const u = raw.toLowerCase()
  if (u.includes('asian') || u.includes('handicap') || u === 'hdp' || u === 'ah') return 'Handicap'
  if (u.includes('over') || u.includes('under') || u === 'ou') return 'Over/Under'
  if (u.includes('btts') || u.includes('both')) return 'BTTS'
  if (u.includes('1x2') || u.includes('match result')) return 'Match Result (1X2)'
  if (u.includes('double chance')) return 'Double Chance'
  if (u.includes('correct score')) return 'Correct Score'
  return BET_TYPES.includes(raw) ? raw : 'Other'
}
const PICKABLE = LEAGUES.filter(l => l !== 'Mix Parlay')

// Parlay multi-league chip picker. Stores as "La Liga · UCL" or 'Mix Parlay' when empty.
function LeaguePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const selected = (value === 'Mix Parlay' ? [] : value.split(' · ')).filter(l => l && PICKABLE.includes(l))
  const available = PICKABLE.filter(l => !selected.includes(l))

  const add = (l: string) => { onChange([...selected, l].join(' · ')); setOpen(false) }
  const remove = (l: string) => {
    const next = selected.filter(x => x !== l)
    onChange(next.length > 0 ? next.join(' · ') : 'Mix Parlay')
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="input-dark" style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '6px 10px', minHeight: 40, alignItems: 'center' }}>
        {selected.length === 0 && <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>Mix Parlay</span>}
        {selected.map(l => (
          <span key={l} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.35)',
            borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600, color: 'var(--color-accent)',
          }}>
            {l.replace('UEFA ', '').replace('FIFA ', '')}
            <button type="button" onClick={() => remove(l)} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1, opacity: 0.7 }}>×</button>
          </span>
        ))}
        {available.length > 0 && (
          <button type="button" onClick={() => setOpen(v => !v)} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 5, padding: '2px 8px', fontSize: 11, color: 'var(--color-muted)', cursor: 'pointer',
          }}>+ add</button>
        )}
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: '#0e0e2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
          overflow: 'hidden', maxHeight: 200, overflowY: 'auto',
        }}>
          {available.map(l => (
            <button key={l} type="button" onClick={() => add(l)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13,
              background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
              color: 'var(--color-text)', cursor: 'pointer',
            }}>{l}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function calcProfit(odds: number, stake: number, result: BetResult): number {
  if (result === 'win') return parseFloat(((stake * odds) - stake).toFixed(2))
  if (result === 'loss') return -stake
  return 0
}

type OcrStatus = 'idle' | 'loading' | 'reading' | 'done' | 'error'

export default function AddBetModal({ onClose, onAdd, editBet, onUpdate }: AddBetModalProps) {
  const isEdit = !!editBet
  const [form, setForm] = useState({
    date:         editBet?.date        ?? new Date().toISOString().slice(0, 10),
    match:        editBet?.match       ?? '',
    league:       editBet?.league      ?? 'FIFA World Cup',
    betType:      editBet?.betType     ?? 'Match Result (1X2)',
    prediction:   editBet?.prediction  ?? '',
    odds:         editBet?.odds   != null ? String(editBet.odds)  : '',
    stake:        editBet?.stake  != null ? String(editBet.stake) : '',
    result:       editBet?.result      ?? 'pending' as BetResult,
    picker:       editBet?.picker      ?? 'both' as BetPicker,
    fundedBy:     editBet?.fundedBy    ?? 'bank' as BetFunder,
    notes:        editBet?.notes       ?? '',
    bookmaker:    editBet?.bookmaker   ?? '',
    myProb:       editBet?.myProb  != null ? String(Math.round(editBet.myProb * 100)) : '',
    closingOdds:  editBet?.closingOdds != null ? String(editBet.closingOdds) : '',
    cashOut:      editBet?.cashOut     != null ? String(editBet.cashOut) : '',
  })
  const [showOcr, setShowOcr] = useState(false)
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle')
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrPreview, setOcrPreview] = useState<string | null>(null)
  const [ocrFields, setOcrFields] = useState<Record<string, string>>({})
  const [ocrParsed, setOcrParsed] = useState<ParsedBet | null>(null)
  const [editingLegs, setEditingLegs] = useState<ParlayLeg[] | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const updateEditLeg = (idx: number, field: keyof ParlayLeg, value: string | number) =>
    setEditingLegs(prev => prev?.map((leg, i) => i === idx ? { ...leg, [field]: value } : leg) ?? prev)

  const removeEditLeg = (idx: number) =>
    setEditingLegs(prev => prev?.filter((_, i) => i !== idx) ?? prev)

  const clearOcr = () => {
    setOcrStatus('idle'); setOcrPreview(null); setOcrFields({})
    setOcrParsed(null); setEditingLegs(null)
  }

  const handleRescan = () => { clearOcr(); setTimeout(() => fileRef.current?.click(), 50) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const odds = parseFloat(form.odds)
    const stake = parseFloat(form.stake)
    if (!form.match || isNaN(odds) || odds <= 1 || isNaN(stake) || stake <= 0) return

    const cashOutAmt = form.cashOut ? parseFloat(form.cashOut) : NaN
    const profit = form.result === 'win' && !isNaN(cashOutAmt) && cashOutAmt > 0
      ? parseFloat((cashOutAmt - stake).toFixed(2))
      : calcProfit(odds, stake, form.result)

    const extra = {
      bookmaker:   form.bookmaker.trim() || undefined,
      myProb:      form.myProb && !isNaN(parseFloat(form.myProb)) ? parseFloat(form.myProb) / 100 : undefined,
      closingOdds: form.closingOdds && !isNaN(parseFloat(form.closingOdds)) ? parseFloat(form.closingOdds) : undefined,
      cashOut:     !isNaN(cashOutAmt) && cashOutAmt > 0 ? cashOutAmt : undefined,
    }

    const legs = editingLegs ?? (ocrParsed?.isParlay ? ocrParsed.legs : undefined)
    if (isEdit && editBet && onUpdate) {
      onUpdate(editBet.id, { ...form, odds, stake, profit, fundedBy: form.fundedBy as BetFunder, ...extra })
    } else {
      onAdd({ ...form, odds, stake, profit, legs, fundedBy: form.fundedBy as BetFunder, ...extra })
    }
    onClose()
  }

  const oddsNum = parseFloat(form.odds)
  const stakeNum = parseFloat(form.stake)
  const hasNumbers = !isNaN(oddsNum) && !isNaN(stakeNum) && stakeNum > 0 && oddsNum > 1
  const isParlay = form.betType === 'Mix Parlay'
  const potentialWin = hasNumbers ? parseFloat(((stakeNum * oddsNum) - stakeNum).toFixed(2)) : null
  const preview = hasNumbers ? calcProfit(oddsNum, stakeNum, form.result) : null
  const previewLabel = form.result === 'pending'
    ? isParlay
      ? `Max win (all legs full win): ${potentialWin != null ? fmtPnL(potentialWin) : ''}`
      : `Potential win: ${potentialWin != null ? fmtPnL(potentialWin) : ''}`
    : 'Calculated result'

  const runOcr = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file)
    setOcrPreview(url)
    setOcrStatus('loading')
    setOcrProgress(0)
    setOcrFields({})

    try {
      // Preprocess: invert dark backgrounds (bet slips are usually white-on-dark)
      // Tesseract v4+ is documented to fail on inverted images without this step
      const processedFile = await preprocessForOcr(file)

      const { createWorker } = await import('tesseract.js')
      setOcrStatus('reading')

      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100))
          }
        },
      })

      const { data: { text } } = await worker.recognize(processedFile)
      await worker.terminate()

      const parsed = parseBookmakerText(text)
      setOcrParsed(parsed)
      if (parsed.isParlay && parsed.legs) {
        setEditingLegs(parsed.legs.map(leg => ({ ...leg, betType: toBetTypeOption(leg.betType) })))
      }

      const detected: Record<string, string> = {}
      if (parsed.match)      detected.match      = parsed.match
      if (parsed.odds)       detected.odds       = String(parsed.odds)
      if (parsed.stake)      detected.stake      = String(parsed.stake)
      if (parsed.league)     detected.league     = parsed.league
      if (parsed.prediction) detected.prediction = parsed.prediction
      if (parsed.date)       detected.date       = parsed.date
      if (parsed.isParlay) {
        detected.betType = 'Mix Parlay'
        const legLeagues = [...new Set((parsed.legs ?? []).map(l => l.league).filter(Boolean))]
        detected.league = legLeagues.length > 0 ? legLeagues.join(' · ') : 'Mix Parlay'
        const dateStr = parsed.date ?? new Date().toISOString().slice(0, 10)
        detected.match = `Parlay · ${dateStr}`
      } else if (parsed.betType) {
        detected.betType = parsed.betType
      }

      // Auto-fill form immediately — user can still correct below
      setForm(f => ({
        ...f,
        ...(detected.match      && { match:      detected.match }),
        ...(detected.odds       && { odds:       detected.odds }),
        ...(detected.stake      && { stake:      detected.stake }),
        ...(detected.league     && { league:     detected.league }),
        ...(detected.prediction && { prediction: detected.prediction }),
        ...(detected.betType    && { betType:    detected.betType }),
        ...(detected.date       && { date:       detected.date }),
      }))

      setOcrFields(detected)
      setOcrStatus('done')
    } catch {
      setOcrStatus('error')
    }
  }, [])

  const applyOcrField = (key: string, value: string) => {
    set(key, value)
    setOcrFields(f => { const n = { ...f }; delete n[key]; return n })
  }

  const applyAllOcr = () => {
    Object.entries(ocrFields).forEach(([k, v]) => set(k, v))
    setOcrFields({})
  }

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) runOcr(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const fieldLabel = (k: string) => ({ match: 'Match', odds: 'Odds', stake: 'Stake', league: 'Competition', prediction: 'Pick', betType: 'Bet Type', date: 'Date' }[k] ?? k)

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass-card fade-up scrollbar-thin modal-sheet" style={{ width: '100%', maxWidth: 540, maxHeight: '90dvh', overflowY: 'auto', padding: 28 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{isEdit ? '✏️ Edit Bet' : '➕ Add Bet'}</h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: 'var(--color-muted)', cursor: 'pointer', width: 32, height: 32, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* OCR toggle — only in add mode */}
        {!isEdit && <button
          type="button"
          onClick={() => setShowOcr(v => !v)}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 12, marginBottom: 20,
            background: showOcr ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.04)',
            border: showOcr ? '1px solid rgba(129,140,248,0.35)' : '1px solid rgba(255,255,255,0.1)',
            color: showOcr ? 'var(--color-accent)' : 'var(--color-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600,
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: 20 }}>📷</span>
          <div style={{ textAlign: 'left' }}>
            <div>Import from screenshot</div>
            <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.7, marginTop: 1 }}>Upload a bookmaker screenshot — reads it automatically</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12 }}>{showOcr ? '▲' : '▼'}</span>
        </button>}

        {/* OCR panel */}
        {!isEdit && showOcr && (
          <div style={{ marginBottom: 20 }}>
            {/* Drop zone */}
            {ocrStatus === 'idle' && (
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? 'rgba(129,140,248,0.6)' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                  background: dragging ? 'rgba(129,140,248,0.08)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
                <div style={{ fontSize: 14, color: 'var(--color-muted)' }}>
                  Drag & drop or <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>click to upload</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4, opacity: 0.6 }}>
                  Works with any bookmaker app screenshot
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
            )}

            {/* Image preview + progress */}
            {(ocrStatus === 'loading' || ocrStatus === 'reading') && (
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
                {ocrPreview && (
                  <img src={ocrPreview} alt="screenshot" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block', opacity: 0.5 }} />
                )}
                <div style={{ padding: '16px', background: 'rgba(6,6,26,0.9)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>🔍</span>
                    <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                      {ocrStatus === 'loading' ? 'Loading OCR engine…' : `Reading text… ${ocrProgress}%`}
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2, transition: 'width 0.3s',
                      background: 'var(--color-accent)',
                      width: ocrStatus === 'loading' ? '15%' : `${ocrProgress}%`,
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 6, opacity: 0.6 }}>
                    {ocrStatus === 'loading' ? 'First load takes ~5 sec, cached after that' : 'Analysing…'}
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {ocrStatus === 'error' && (
              <div style={{ padding: 16, borderRadius: 12, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', fontSize: 13, color: 'var(--color-loss)', display: 'flex', gap: 10, alignItems: 'center' }}>
                <span>❌</span>
                <div>
                  <div style={{ fontWeight: 600 }}>Couldn't read the image</div>
                  <div style={{ opacity: 0.7, marginTop: 2 }}>Try a clearer screenshot or fill in manually.</div>
                </div>
                <button onClick={handleRescan} style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, color: 'var(--color-loss)', cursor: 'pointer', padding: '4px 8px', fontSize: 11 }}>Retry</button>
              </div>
            )}

            {/* Results */}
            {ocrStatus === 'done' && (
              <div>
                <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 12 }}>
                  {ocrPreview && (
                    <img src={ocrPreview} alt="screenshot" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', display: 'block' }} />
                  )}
                </div>

                {/* Parlay legs preview — editable */}
                {editingLegs && editingLegs.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Mix Parlay · {editingLegs.length} legs detected</span>
                      <span style={{ fontSize: 10, color: 'var(--color-accent)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>✏️ Edit if needed</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {editingLegs.map((leg, i) => (
                        <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.15)' }}>
                          {/* League + remove */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 10, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{leg.league}</span>
                            <button type="button" onClick={() => removeEditLeg(i)} style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', fontSize: 16, padding: '0 2px', opacity: 0.5, lineHeight: 1 }}>×</button>
                          </div>
                          {/* Match name */}
                          <input
                            value={leg.match}
                            onChange={e => updateEditLeg(i, 'match', e.target.value)}
                            placeholder="Match name (e.g. Arsenal vs Chelsea)"
                            className="input-dark"
                            style={{ width: '100%', marginBottom: 5, fontSize: 12, padding: '4px 8px', boxSizing: 'border-box' }}
                          />
                          {/* Row 2: Bet type + odds */}
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 4 }}>
                            <select
                              value={leg.betType}
                              onChange={e => updateEditLeg(i, 'betType', e.target.value)}
                              className="input-dark"
                              style={{ fontSize: 11, padding: '3px 5px', flex: 1 }}
                            >
                              {BET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <span style={{ fontSize: 11, color: 'var(--color-muted)', flexShrink: 0 }}>@</span>
                            <input
                              type="number"
                              step="0.01"
                              value={leg.odds || ''}
                              onChange={e => updateEditLeg(i, 'odds', parseFloat(e.target.value) || 0)}
                              placeholder="odds"
                              className="input-dark"
                              style={{ fontSize: 12, padding: '3px 6px', width: 68, flexShrink: 0 }}
                            />
                          </div>
                          {/* Row 3: Prediction pick */}
                          <input
                            value={leg.prediction}
                            onChange={e => updateEditLeg(i, 'prediction', e.target.value)}
                            placeholder="Pick (e.g. Over 2.5, Arsenal -0.75)"
                            className="input-dark"
                            style={{ width: '100%', fontSize: 12, padding: '4px 8px', boxSizing: 'border-box' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Object.keys(ocrFields).length === 0 ? (
                  <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', fontSize: 13, color: 'var(--color-win)' }}>
                    ✅ Nothing detected — fill in manually below
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-win)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        ✅ Auto-filled · review &amp; correct if needed
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {Object.entries(ocrFields).map(([key, value]) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <span style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', minWidth: 80 }}>{fieldLabel(key)}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 8, opacity: 0.6 }}>
                      Form filled automatically — correct anything wrong in the fields below.
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button type="button" onClick={handleRescan} style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 8, color: 'var(--color-accent)', padding: '6px 14px' }}>
                    ↩ Scan again
                  </button>
                  <button type="button" onClick={clearOcr} style={{ fontSize: 12, color: 'var(--color-muted)', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer', padding: '6px 12px' }}>
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        {!isEdit && showOcr && <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 20 }} />}

        {/* Manual form */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input className="input-dark" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Competition</label>
                {isParlay
                  ? <LeaguePicker value={form.league} onChange={v => set('league', v)} />
                  : <select className="input-dark" value={form.league} onChange={e => set('league', e.target.value)}>
                      {LEAGUES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                }
              </div>
            </div>

            <div>
              <label style={labelStyle}>Match</label>
              <input className="input-dark" type="text" placeholder="e.g. Spain vs Germany" value={form.match} onChange={e => set('match', e.target.value)} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Bet Type</label>
                <select className="input-dark" value={form.betType} onChange={e => set('betType', e.target.value)}>
                  {BET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Pick</label>
                <input className="input-dark" type="text" placeholder="e.g. 1, X, Over 2.5..." value={form.prediction} onChange={e => set('prediction', e.target.value)} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Odds</label>
                <input className="input-dark" type="number" step="any" min="1.0001" placeholder="2.10 or 14.6267" value={form.odds} onChange={e => set('odds', e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Stake (฿)</label>
                <input className="input-dark" type="number" step="0.50" min="0.5" placeholder="20" value={form.stake} onChange={e => set('stake', e.target.value)} required />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Result</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['pending', 'win', 'loss', 'void'] as BetResult[]).map(r => {
                  const labels = { pending: '⏳ Pending', win: '✅ Win', loss: '❌ Loss', void: '↩️ Void' }
                  const colors = { pending: 'var(--color-pending)', win: 'var(--color-win)', loss: 'var(--color-loss)', void: 'var(--color-void)' }
                  const active = form.result === r
                  return (
                    <button key={r} type="button" onClick={() => set('result', r)} style={{
                      flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: active ? `1.5px solid ${colors[r]}` : '1px solid rgba(255,255,255,0.08)',
                      background: active ? `${colors[r]}18` : 'rgba(255,255,255,0.03)',
                      color: active ? colors[r] : 'var(--color-muted)',
                      transition: 'all 0.15s',
                    }}>
                      {labels[r]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Who picked it + Funded by — two columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Who picked it?</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['pablo', 'alberto', 'both'] as BetPicker[]).map(p => {
                    const labels = { pablo: '👤 Pablo', alberto: '👥 Alberto', both: '🤝 Both' }
                    const active = form.picker === p
                    return (
                      <button key={p} type="button" onClick={() => set('picker', p)} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: active ? '1.5px solid rgba(129,140,248,0.6)' : '1px solid rgba(255,255,255,0.08)',
                        background: active ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.03)',
                        color: active ? 'var(--color-accent)' : 'var(--color-muted)',
                        transition: 'all 0.15s',
                      }}>
                        {labels[p]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Funded by</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([
                    { value: 'bank',   label: '🏦 Banco',   accent: '#f5a623' },
                    { value: 'pablo',  label: '👤 Pablo',   accent: 'var(--color-accent)' },
                    { value: 'alberto', label: '👥 Alberto',  accent: '#a78bfa' },
                  ] as { value: BetFunder; label: string; accent: string }[]).map(({ value, label, accent }) => {
                    const active = form.fundedBy === value
                    return (
                      <button key={value} type="button" onClick={() => set('fundedBy', value)} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: active ? `1.5px solid ${accent}88` : '1px solid rgba(255,255,255,0.08)',
                        background: active ? `${accent}18` : 'rgba(255,255,255,0.03)',
                        color: active ? accent : 'var(--color-muted)',
                        transition: 'all 0.15s',
                      }}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Notes (optional)</label>
              <input className="input-dark" type="text" placeholder="Tip, gut feeling..." value={form.notes} maxLength={500} onChange={e => set('notes', e.target.value)} />
            </div>

            {/* ── Analytics fields (all optional) ── */}
            <div>
              <label style={labelStyle}>Bookmaker (optional)</label>
              <input className="input-dark" type="text" placeholder="e.g. Pinnacle, bet365, 1xBet…" value={form.bookmaker} maxLength={60} onChange={e => set('bookmaker', e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>My Probability % (optional)</label>
                <input className="input-dark" type="number" step="1" min="1" max="99" placeholder="e.g. 55" value={form.myProb} onChange={e => set('myProb', e.target.value)} />
                {form.myProb && !isNaN(parseFloat(form.myProb)) && hasNumbers && (() => {
                  const ev = (parseFloat(form.myProb) / 100 * oddsNum - 1) * 100
                  return (
                    <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: ev >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                      EV: {ev >= 0 ? '+' : ''}{ev.toFixed(1)}% per bet
                    </div>
                  )
                })()}
              </div>
              <div>
                <label style={labelStyle}>Closing Odds (optional)</label>
                <input className="input-dark" type="number" step="any" min="1.001" placeholder="Odds at close" value={form.closingOdds} onChange={e => set('closingOdds', e.target.value)} />
                {form.closingOdds && !isNaN(parseFloat(form.closingOdds)) && hasNumbers && (() => {
                  const close = parseFloat(form.closingOdds)
                  const beat = oddsNum >= close
                  return (
                    <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: beat ? 'var(--color-win)' : 'var(--color-loss)' }}>
                      {beat ? '✓ Beat the close' : '↓ Closed shorter'}
                    </div>
                  )
                })()}
              </div>
            </div>

            {form.result === 'win' && (
              <div>
                <label style={labelStyle}>Cash-Out Amount ฿ (optional — overrides profit)</label>
                <input className="input-dark" type="number" step="any" min="0" placeholder="Gross amount received if cashed out early" value={form.cashOut} onChange={e => set('cashOut', e.target.value)} />
                {form.cashOut && !isNaN(parseFloat(form.cashOut)) && hasNumbers && (() => {
                  const net = parseFloat(form.cashOut) - stakeNum
                  return (
                    <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: net >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                      Net: {net >= 0 ? '+' : ''}{net.toFixed(2)} ฿ (vs full win {hasNumbers ? '+' + ((oddsNum - 1) * stakeNum).toFixed(2) : '—'} ฿)
                    </div>
                  )
                })()}
              </div>
            )}

            {preview !== null && (
              <div>
                <div style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: preview >= 0 ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
                  border: `1px solid ${preview >= 0 ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{previewLabel}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: preview >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                    {fmtPnL(preview)}
                  </span>
                </div>
                {isParlay && form.result === 'pending' && (
                  <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.18)', fontSize: 11, color: '#fb923c', lineHeight: 1.5 }}>
                    <strong>Parlay settlement rules:</strong> Full Loss on any leg = whole parlay lost · Void leg = neutral (×1) · Half Win = reduced odds · Half Loss = half stake returned · settle each leg individually in the bet table
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Inline validation hint */}
          {(() => {
            const missing: string[] = []
            if (!form.match) missing.push('Match')
            if (!form.odds || isNaN(parseFloat(form.odds))) missing.push('Odds')
            if (!form.stake || isNaN(parseFloat(form.stake))) missing.push('Stake')
            return missing.length > 0 ? (
              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.18)', fontSize: 12, color: 'var(--color-loss)' }}>
                Missing: {missing.join(' · ')}
              </div>
            ) : null
          })()}

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-muted)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 2, padding: 12, fontSize: 14 }}>
              {isEdit ? 'Update bet' : 'Save bet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: 'var(--color-muted)',
  fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6,
}
