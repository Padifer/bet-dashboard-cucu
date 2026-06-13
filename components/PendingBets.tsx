'use client'
import { useState, useEffect, useRef } from 'react'
import { Bet, LegResult, ParlayLeg } from '@/types/bet'
import { fmt, fmtPnL } from '@/utils/currency'
import { calcParlay, LEG_RESULT_META } from '@/utils/parlayCalc'
import { suggestOutcome, Suggestion } from '@/utils/suggestOutcome'

interface PendingBetsProps {
  bets: Bet[]
  onSettle: (id: string, result: 'win' | 'loss' | 'void') => void
  onUpdateBet?: (id: string, updates: Partial<Bet>) => void
}

const LEG_ORDER: LegResult[] = ['win', 'half-win', 'half-loss', 'loss', 'void', 'pending']

// ── Shared lookup helper ──────────────────────────────────────────────────────
interface LookupResult {
  status: 'idle' | 'loading' | 'found' | 'not-found'
  matchStatus?: 'scheduled' | 'live' | 'finished'
  homeTeam?: string
  awayTeam?: string
  score?: { home: number; away: number }
  suggestion?: Suggestion
  label?: string
  confident?: boolean
  reason?: string
  utcDate?: string
}

async function fetchLookup(match: string, date: string, betType: string, prediction: string, league?: string): Promise<LookupResult> {
  try {
    const res = await fetch('/api/lookup-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match, date, league }),
    })
    const data = await res.json()
    if (!data.found) return { status: 'not-found', reason: data.reason }

    if (data.matchStatus === 'scheduled') {
      return { status: 'found', matchStatus: 'scheduled', homeTeam: data.homeTeam, awayTeam: data.awayTeam, utcDate: data.utcDate }
    }

    const teams = { home: data.homeTeam, away: data.awayTeam }
    const { suggestion, label, confident } = suggestOutcome(betType, prediction, data.score, teams)
    return {
      status: 'found',
      matchStatus: data.matchStatus,
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      score: data.score,
      suggestion: data.matchStatus === 'live' ? 'manual' : suggestion,
      label: data.matchStatus === 'live' ? `${data.score.home}–${data.score.away} · in progress` : label,
      confident: data.matchStatus === 'live' ? false : confident,
    }
  } catch {
    return { status: 'not-found', reason: 'network_error' }
  }
}

function reasonMsg(reason?: string) {
  if (reason === 'no_key') return 'API key not set — add FOOTBALL_DATA_API_KEY to .env.local'
  if (reason === 'not_found') return 'Match not found in any API'
  if (reason === 'not_found_fd_only') return 'Match not in Football-Data.org (limited to main EU leagues) — add RAPIDAPI_KEY for cup coverage'
  if (reason === 'network_error') return 'Network error'
  return 'Not found'
}

// Always produces a "why" explanation for AH and O/U bet results
function getBetExplanation(label: string, suggestion: Suggestion): string | null {
  if (suggestion === 'manual') return null

  // ── Asian Handicap ────────────────────────────────────────────────────────
  const ahMatch = label.match(/AH\(([+-]?[\d.]+)\)/)
  if (ahMatch) {
    const line = parseFloat(ahMatch[1])
    const lineStr = `AH ${line > 0 ? '+' : ''}${line}`
    const isQB = Math.round(Math.abs(line) * 4) % 2 === 1

    if (isQB) {
      const lo = Math.floor(line * 2) / 2
      const hi = Math.ceil(line * 2) / 2
      const fmt = (n: number) => n === 0 ? '0' : (n > 0 ? `+${n}` : `${n}`)
      const decomp = `${lineStr} = 50% AH ${fmt(lo)} + 50% AH ${fmt(hi)}`
      const why: Partial<Record<Suggestion, string>> = {
        win:         '→ both sub-lines won',
        'half-win':  '→ one sub-line won, one pushed',
        'half-loss': '→ one sub-line lost, one pushed',
        loss:        '→ both sub-lines lost',
        void:        '→ both sub-lines pushed',
      }
      return `${decomp} ${why[suggestion] ?? ''}`
    }
    const why: Partial<Record<Suggestion, string>> = {
      win:  `${lineStr} — covered the handicap → full odds apply`,
      loss: `${lineStr} — didn't cover → full stake lost`,
      void: `${lineStr} — exact push → stake returned`,
    }
    return why[suggestion] ?? lineStr
  }

  // ── Over / Under ──────────────────────────────────────────────────────────
  const ouMatch = label.match(/(over|under)\s+([\d.]+)/i)
  if (ouMatch) {
    const dir = ouMatch[1].toLowerCase()
    const line = parseFloat(ouMatch[2])
    const dirCap = dir === 'over' ? 'Over' : 'Under'
    const isQB = Math.round(Math.abs(line) * 4) % 2 === 1
    const totalMatch = label.match(/^(\d+) goals/)
    const total = totalMatch ? parseInt(totalMatch[1]) : null

    if (isQB) {
      const lo = Math.floor(line * 2) / 2
      const hi = Math.ceil(line * 2) / 2
      const decomp = `${dirCap} ${line} = 50% ${dirCap} ${lo} + 50% ${dirCap} ${hi}`
      const why: Partial<Record<Suggestion, string>> = {
        win:         '→ both sub-lines won',
        'half-win':  '→ one sub-line won, one pushed',
        'half-loss': '→ one sub-line lost, one pushed',
        loss:        '→ both sub-lines lost',
        void:        '→ both sub-lines pushed',
      }
      return `${decomp} ${why[suggestion] ?? ''}`
    }
    const op = dir === 'over' ? '>' : '<'
    if (total !== null) {
      if (suggestion === 'win')  return `${total} goals ${op} ${line} → won`
      if (suggestion === 'loss') return `${total} goals not ${dir} ${line} → lost`
      if (suggestion === 'void') return `${total} goals = ${line} exactly → push`
    }
    if (suggestion === 'win')  return `${dirCap} ${line} covered`
    if (suggestion === 'loss') return `${dirCap} ${line} not covered`
    if (suggestion === 'void') return `${dirCap} ${line} exact → push`
    return `${dirCap} ${line}`
  }

  return null
}

// Small score badge + suggestion chip used in both single and parlay rows
function ScoreBadge({ lk, onApply }: { lk: LookupResult; onApply?: (r: LegResult) => void }) {
  if (lk.status === 'loading') return (
    <span style={{ fontSize: 11, color: 'var(--color-muted)', opacity: 0.7 }}>Looking up…</span>
  )
  if (lk.status === 'not-found') return (
    <span style={{ fontSize: 11, color: 'rgba(248,113,113,0.6)' }}>{reasonMsg(lk.reason)}</span>
  )
  if (lk.status !== 'found') return null

  // Match found but not yet kicked off
  if (lk.matchStatus === 'scheduled') {
    const time = lk.utcDate ? new Date(lk.utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    return (
      <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 12 }}>⏰</span>
        Not started yet{time ? ` · kicks off ${time}` : ''}
      </span>
    )
  }

  if (!lk.score) return null

  const { score, suggestion, label, confident, matchStatus } = lk
  const isLive = matchStatus === 'live'
  const isManual = suggestion === 'manual' || !confident
  const meta = suggestion && suggestion !== 'manual' ? LEG_RESULT_META[suggestion as LegResult] : null
  const explanation = (label && suggestion && !isManual) ? getBetExplanation(label, suggestion) : null

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {isLive && (
          <span style={{ fontSize: 10, fontWeight: 800, color: '#ff4d4d', background: 'rgba(255,77,77,0.12)', border: '1px solid rgba(255,77,77,0.35)', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.04em' }}>LIVE</span>
        )}
        <span style={{
          fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)',
          background: 'rgba(240,235,224,0.05)', border: '1px solid rgba(240,235,224,0.1)',
          borderRadius: 6, padding: '2px 8px',
        }}>
          {score.home}–{score.away}
        </span>
        {isManual ? (
          <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{label}</span>
        ) : (
          <>
            <span style={{
              fontSize: 11, fontWeight: 700,
              background: meta?.bg ?? 'transparent', border: `1px solid ${meta?.border ?? 'transparent'}`,
              color: meta?.color ?? 'var(--color-text)', borderRadius: 5, padding: '2px 7px',
            }}>
              {meta?.label ?? suggestion} · {label}
            </span>
            {onApply && (
              <button onClick={() => onApply(suggestion as LegResult)} style={{
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.4)',
                color: 'var(--color-accent)', borderRadius: 6, padding: '2px 8px',
              }}>
                Apply
              </button>
            )}
          </>
        )}
      </span>
      {explanation && (
        <span style={{ fontSize: 10, color: 'var(--color-muted)', opacity: 0.7, paddingLeft: 2 }}>
          ↳ {explanation}
        </span>
      )}
    </span>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────
const LEGEND_ITEMS: { result: LegResult; desc: string }[] = [
  { result: 'win',       desc: 'Full odds × stake' },
  { result: 'half-win',  desc: '½ profit at full odds + ½ stake back' },
  { result: 'half-loss', desc: '½ stake lost + ½ returned' },
  { result: 'loss',      desc: 'Entire parlay loses — zero return' },
  { result: 'void',      desc: '×1 neutral — leg removed' },
  { result: 'pending',   desc: 'Awaiting result' },
]

const SINGLE_LEGEND_ITEMS: LegResult[] = ['win', 'loss', 'void']

function ResultLegend({ filter }: { filter?: LegResult[] }) {
  const items = filter ? LEGEND_ITEMS.filter(i => filter.includes(i.result)) : LEGEND_ITEMS
  return (
    <div style={{ padding: '8px 12px 4px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '5px 16px', borderTop: '1px solid rgba(240,235,224,0.05)', marginTop: 2 }}>
      {items.map(({ result, desc }) => {
        const m = LEG_RESULT_META[result]
        return (
          <div key={result} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ padding: '1px 6px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: m.bg, border: `1px solid ${m.border}`, color: m.color, minWidth: 24, textAlign: 'center', flexShrink: 0 }}>{m.short}</span>
            <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>
              <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{m.label}</span>{' — '}{desc}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Single-bet row ─────────────────────────────────────────────────────────────
function SingleBetRow({ bet, onSettle, triggerCount = 0 }: {
  bet: Bet
  onSettle: (r: 'win' | 'loss' | 'void') => void
  triggerCount?: number
}) {
  const [lk, setLk] = useState<LookupResult>({ status: 'idle' })
  const maxWin = parseFloat(((bet.stake * bet.odds) - bet.stake).toFixed(2))

  const handleLookup = async () => {
    setLk({ status: 'loading' })
    setLk(await fetchLookup(bet.match, bet.date, bet.betType, bet.prediction, bet.league))
  }

  useEffect(() => {
    if (triggerCount > 0) handleLookup()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerCount])

  return (
    <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(240,235,224,0.03)', border: '1px solid rgba(240,235,224,0.07)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{bet.match}</div>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(129,140,248,0.1)', color: 'var(--color-accent)', padding: '1px 7px', borderRadius: 5, fontSize: 11, fontWeight: 600 }}>
              {bet.league.replace('UEFA ', '').replace('FIFA ', '')}
            </span>
            <span>{bet.prediction}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-text)' }}>@{bet.odds.toFixed(4).replace(/\.?0+$/, '')}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 80 }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>stake</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(bet.stake)}</div>
          <div style={{ fontSize: 11, color: 'var(--color-win)', opacity: 0.8 }}>{fmtPnL(maxWin)} win</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([
            { r: 'win' as const,  label: '✅ Win',    bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.35)',  color: 'var(--color-win)' },
            { r: 'loss' as const, label: '❌ Loss',   bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.35)', color: 'var(--color-loss)' },
            { r: 'void' as const, label: '↩️ Void',   bg: 'rgba(120,144,156,0.15)', border: 'rgba(120,144,156,0.35)', color: 'var(--color-void)' },
          ]).map(({ r, label, bg, border, color }) => (
            <button key={r} onClick={() => onSettle(r)} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: bg, border: `1px solid ${border}`, color, whiteSpace: 'nowrap' }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Lookup row */}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {lk.status === 'idle' ? (
          <button onClick={handleLookup} style={{ fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(240,235,224,0.04)', border: '1px solid rgba(240,235,224,0.1)', borderRadius: 6, padding: '3px 10px', color: 'var(--color-muted)' }}>
            🔍 Look up result
          </button>
        ) : (
          <ScoreBadge lk={lk} onApply={r => {
            if (r === 'win' || r === 'loss' || r === 'void') onSettle(r)
          }} />
        )}
        {lk.status !== 'idle' && (
          <button onClick={() => setLk({ status: 'idle' })} style={{ fontSize: 10, color: 'var(--color-muted)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}>reset</button>
        )}
      </div>

      <ResultLegend filter={SINGLE_LEGEND_ITEMS} />
    </div>
  )
}

// ── Parlay row ────────────────────────────────────────────────────────────────
function ParlayBetRow({ bet, onUpdateBet, triggerCount = 0 }: {
  bet: Bet
  onUpdateBet: (id: string, updates: Partial<Bet>) => void
  triggerCount?: number
}) {
  const [localLegs, setLocalLegs] = useState<ParlayLeg[]>(bet.legs!)
  const [dirty, setDirty] = useState(false)
  const [legLookups, setLegLookups] = useState<Record<number, LookupResult>>({})
  const [lookingUp, setLookingUp] = useState(false)

  const settlement = calcParlay(localLegs, bet.stake)
  const maxWin = parseFloat(((bet.stake * bet.odds) - bet.stake).toFixed(2))

  const handleLegResult = (legIdx: number, result: LegResult) => {
    setLocalLegs(prev => prev.map((leg, i) => i === legIdx ? { ...leg, result } : leg))
    setDirty(true)
  }

  const handleSave = () => {
    const final = calcParlay(localLegs, bet.stake)
    if (final.result !== 'pending') {
      onUpdateBet(bet.id, { legs: localLegs, result: final.result, profit: final.profit })
    } else {
      onUpdateBet(bet.id, { legs: localLegs })
    }
    setDirty(false)
  }

  const handleReset = () => { setLocalLegs(bet.legs!); setDirty(false) }

  const lookupAll = async () => {
    setLookingUp(true)
    const results = await Promise.all(
      localLegs.map((leg, i) =>
        fetchLookup(leg.match || bet.match, bet.date, leg.betType, leg.prediction, leg.league || bet.league).then(r => ({ i, r }))
      )
    )
    const newLookups: Record<number, LookupResult> = {}
    const newLegs = [...localLegs]
    let changed = false
    results.forEach(({ i, r }) => {
      newLookups[i] = r
      if (r.status === 'found' && r.suggestion && r.suggestion !== 'manual' && r.confident) {
        newLegs[i] = { ...newLegs[i], result: r.suggestion as LegResult }
        changed = true
      }
    })
    setLegLookups(newLookups)
    if (changed) { setLocalLegs(newLegs); setDirty(true) }
    setLookingUp(false)
  }

  useEffect(() => {
    if (triggerCount > 0 && !lookingUp) lookupAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerCount])

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', background: 'rgba(240,235,224,0.03)', border: '1px solid rgba(129,140,248,0.18)' }}>

      {/* Header */}
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid rgba(129,140,248,0.12)', background: 'rgba(129,140,248,0.05)' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{bet.match}</div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>{localLegs.length} legs · combined @{bet.odds.toFixed(4).replace(/\.?0+$/, '')}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>stake</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(bet.stake)}</div>
        </div>
        {/* Settlement preview */}
        <div style={{ padding: '6px 12px', borderRadius: 8, background: settlement.settledCount > 0 ? (settlement.profit > 0 ? 'rgba(52,211,153,0.1)' : settlement.profit < 0 ? 'rgba(248,113,113,0.1)' : 'rgba(240,235,224,0.04)') : 'rgba(240,235,224,0.04)', border: `1px solid ${settlement.settledCount > 0 ? (settlement.profit > 0 ? 'rgba(52,211,153,0.25)' : settlement.profit < 0 ? 'rgba(248,113,113,0.25)' : 'rgba(240,235,224,0.1)') : 'rgba(240,235,224,0.08)'}`, textAlign: 'right', minWidth: 120 }}>
          <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{settlement.settledCount}/{settlement.totalLegs} settled{dirty ? ' · unsaved' : ''}</div>
          <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: settlement.settledCount === 0 ? 'var(--color-muted)' : settlement.profit > 0 ? 'var(--color-win)' : settlement.profit < 0 ? 'var(--color-loss)' : 'var(--color-muted)' }}>
            {settlement.settledCount === 0 ? `Max ${fmtPnL(maxWin)}` : fmtPnL(settlement.profit)}
          </div>
        </div>
        {/* Lookup all button */}
        <button
          onClick={lookupAll}
          disabled={lookingUp}
          style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: lookingUp ? 'default' : 'pointer', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)', color: 'var(--color-accent)', whiteSpace: 'nowrap', opacity: lookingUp ? 0.6 : 1 }}
        >
          {lookingUp ? '⏳ Looking up…' : '🔍 Look up all'}
        </button>
      </div>

      {/* Per-leg rows */}
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {localLegs.map((leg, i) => {
          const cur: LegResult = leg.result ?? 'pending'
          const meta = LEG_RESULT_META[cur]
          const lk = legLookups[i]
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: `1px solid ${meta.border}`, transition: 'border-color 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 10, color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>{leg.league}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 1 }}>{leg.match || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 1 }}>
                    <span style={{ background: 'rgba(240,235,224,0.05)', borderRadius: 3, padding: '1px 5px', marginRight: 5 }}>{leg.betType}</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{leg.prediction}</span>
                    {leg.odds > 0 && <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 6, color: 'var(--color-accent)' }}>@{leg.odds.toFixed(2)}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {LEG_ORDER.map(r => {
                    const m = LEG_RESULT_META[r]
                    const active = cur === r
                    return (
                      <button key={r} onClick={() => handleLegResult(i, r)} title={m.label} style={{ padding: '5px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: active ? m.bg : 'rgba(240,235,224,0.04)', border: `1px solid ${active ? m.border : 'rgba(240,235,224,0.08)'}`, color: active ? m.color : 'var(--color-muted)', transition: 'all 0.15s' }}>
                        {m.short}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Per-leg lookup result */}
              {lk && lk.status !== 'idle' && (
                <div style={{ paddingLeft: 4 }}>
                  <ScoreBadge lk={lk} onApply={r => handleLegResult(i, r)} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Save / Reset bar */}
      <div style={{ padding: '8px 12px 10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, borderTop: dirty ? '1px solid rgba(251,191,36,0.15)' : '1px solid transparent', transition: 'border-color 0.2s' }}>
        {dirty && (
          <button onClick={handleReset} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(240,235,224,0.04)', border: '1px solid rgba(240,235,224,0.1)', color: 'var(--color-muted)' }}>Reset</button>
        )}
        <button onClick={handleSave} disabled={!dirty} style={{ padding: '7px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: dirty ? 'pointer' : 'default', background: dirty ? 'rgba(129,140,248,0.2)' : 'rgba(240,235,224,0.04)', border: `1px solid ${dirty ? 'rgba(129,140,248,0.5)' : 'rgba(240,235,224,0.08)'}`, color: dirty ? 'var(--color-accent)' : 'var(--color-muted)', transition: 'all 0.2s' }}>
          {dirty ? 'Save settlement' : 'No changes'}
        </button>
      </div>

      {/* Legend — always visible */}
      <div style={{ padding: '0 12px 10px' }}>
        <ResultLegend />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PendingBets({ bets, onSettle, onUpdateBet }: PendingBetsProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [triggerCounts, setTriggerCounts] = useState<Record<string, number>>({})
  const [checking, setChecking] = useState(false)
  const checkedOnceRef = useRef(false)
  const pending = bets.filter(b => b.result === 'pending')

  const checkAll = async (betsToCheck: typeof pending) => {
    setChecking(true)
    for (let i = 0; i < betsToCheck.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 300))
      setTriggerCounts(prev => ({ ...prev, [betsToCheck[i].id]: (prev[betsToCheck[i].id] ?? 0) + 1 }))
    }
    setChecking(false)
  }

  // Auto-check once when panel first opens
  useEffect(() => {
    if (!collapsed && !checkedOnceRef.current && pending.length > 0) {
      checkedOnceRef.current = true
      checkAll(pending)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed])

  if (pending.length === 0) return null

  return (
    <div className="glass-card fade-up" style={{ border: '1px solid rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.04)' }}>
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div onClick={() => setCollapsed(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ fontSize: 18 }}>⏳</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-pending)' }}>{pending.length} pending bet{pending.length !== 1 ? 's' : ''}</span>
            <span style={{ fontSize: 12, color: 'var(--color-muted)', marginLeft: 10 }}>settle below</span>
          </div>
          <div style={{ textAlign: 'right', marginRight: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>at stake</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{fmt(pending.reduce((s, b) => s + b.stake, 0))}</div>
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); checkAll(pending) }}
          disabled={checking}
          style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: checking ? 'default' : 'pointer', background: checking ? 'rgba(129,140,248,0.06)' : 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.3)', color: checking ? 'var(--color-muted)' : 'var(--color-accent)', whiteSpace: 'nowrap', opacity: checking ? 0.6 : 1, transition: 'all 0.2s' }}
        >
          {checking ? '⏳ Checking…' : '↻ Re-check all'}
        </button>
        <div onClick={() => setCollapsed(v => !v)} style={{ fontSize: 12, color: 'var(--color-muted)', cursor: 'pointer', userSelect: 'none' }}>{collapsed ? '▼' : '▲'}</div>
      </div>

      {!collapsed && (
        <div style={{ borderTop: '1px solid rgba(251,191,36,0.15)', padding: '12px 24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pending.map(bet => {
            const isParlay = bet.legs && bet.legs.length > 0
            if (isParlay && onUpdateBet) return <ParlayBetRow key={bet.id} bet={bet} onUpdateBet={onUpdateBet} triggerCount={triggerCounts[bet.id] ?? 0} />
            return <SingleBetRow key={bet.id} bet={bet} onSettle={r => onSettle(bet.id, r)} triggerCount={triggerCounts[bet.id] ?? 0} />
          })}
        </div>
      )}
    </div>
  )
}
