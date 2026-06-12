'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useBets } from '@/hooks/useBets'
import { Bet } from '@/types/bet'
import BottomNav from '@/components/BottomNav'
import type { UpcomingMatch } from '../api/upcoming-matches/route'
import type { MatchOdds } from '../api/odds/route'

type TabId = 'partidos' | 'stats' | 'guides'

interface MatchesResponse {
  matches: UpcomingMatch[]
  total: number
  competitionsOk: number
  competitionsFailed: number
}

interface OddsResponse {
  odds: MatchOdds[]
  available: boolean
}

// Lightweight team name normalization for odds matching
function normOdds(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(fc|sc|cf|ac|as|rc|cd|united|city|athletic|club|de|la|le|el|al|real|atletico|inter|sporting)\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function findOdds(oddsMap: Map<string, MatchOdds>, homeTeam: string, awayTeam: string): MatchOdds | null {
  const nh = normOdds(homeTeam)
  const na = normOdds(awayTeam)
  for (const o of oddsMap.values()) {
    const oh = normOdds(o.homeTeam)
    const oa = normOdds(o.awayTeam)
    const homeMatch = oh === nh || oh.includes(nh) || nh.includes(oh) || nh.split(' ').some(w => w.length > 3 && oh.includes(w))
    const awayMatch = oa === na || oa.includes(na) || na.includes(oa) || na.split(' ').some(w => w.length > 3 && oa.includes(w))
    if (homeMatch && awayMatch) return o
  }
  return null
}

// ----- Tips page nav (matches Navbar glass style) ---------------------------

function TipsNav({ active }: { active: TabId }) {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(9,9,15,0.96)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontSize: 18 }}>⚽</span>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
            Bet<span style={{ color: 'var(--color-win)' }}>Tracker</span>
          </span>
        </Link>

        <div className="nav-tabs-top" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/" style={navPill(false)}>⌂</Link>
          <Link href="/bets" style={navPill(false)}>Bets</Link>
          <Link href="/tips" style={navPill(true)} aria-current={active === 'partidos' || active === 'stats' || active === 'guides' ? 'page' : undefined}>Tips</Link>
        </div>
      </div>
    </nav>
  )
}

function navPill(isActive: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    color: isActive ? '#fff' : 'var(--color-muted)',
    background: isActive
      ? 'linear-gradient(135deg, #4f8ef7 0%, #7c5cf5 100%)'
      : 'rgba(255,255,255,0.04)',
    border: isActive ? '1px solid rgba(79,142,247,0.45)' : '1px solid rgba(255,255,255,0.08)',
    transition: 'background 0.18s, color 0.18s, border-color 0.18s',
  }
}

// ----- Inner tab bar --------------------------------------------------------

function TabBar({ active, onSelect }: { active: TabId; onSelect: (t: TabId) => void }) {
  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'partidos', label: 'Partidos', icon: '🗓️' },
    { id: 'stats', label: 'Stats', icon: '📊' },
    { id: 'guides', label: 'Guías', icon: '📚' },
  ]
  return (
    <div style={{ display: 'flex', gap: 8, padding: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, width: 'fit-content' }}>
      {tabs.map(t => {
        const on = t.id === active
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: on ? '#fff' : 'var(--color-muted)',
              background: on
                ? 'linear-gradient(135deg, #4f8ef7 0%, #7c5cf5 100%)'
                : 'transparent',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'background 0.18s, color 0.18s',
              fontFamily: 'inherit',
            }}
            aria-pressed={on}
          >
            <span style={{ fontSize: 14 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ----- Partidos tab ----------------------------------------------------------

type DayFilter = 'today' | 'tomorrow' | 'week'

function formatKickoff(utcDate: string): string {
  return new Date(utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
}

function OddsChip({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      padding: '4px 8px',
      background: highlight ? 'rgba(79,142,247,0.12)' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${highlight ? 'rgba(79,142,247,0.3)' : 'rgba(255,255,255,0.09)'}`,
      borderRadius: 7,
      minWidth: 44,
    }}>
      <span style={{ fontSize: 9, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: highlight ? 'var(--color-accent)' : 'var(--color-text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{value.toFixed(2)}</span>
    </div>
  )
}

function MatchRow({ m, odds }: { m: UpcomingMatch; odds: MatchOdds | null }) {
  const isLive = ['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(m.status)
  const isFinished = m.status === 'FINISHED'
  const isScheduled = !isLive && !isFinished
  const hasScore = m.scoreHome !== null && m.scoreAway !== null

  const scoreOrTime = isFinished || (isLive && hasScore)
    ? `${m.scoreHome ?? '?'} – ${m.scoreAway ?? '?'}`
    : formatKickoff(m.utcDate)

  const bestOdds = odds && isScheduled
    ? Math.max(odds.homeOdds, odds.drawOdds > 0 ? odds.drawOdds : 0, odds.awayOdds)
    : null

  return (
    <div style={{
      padding: '10px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* Main row: badge · home · score/time · away · status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr auto', alignItems: 'center', gap: 12 }}>
        <div style={{
          padding: '3px 8px',
          background: `${m.competitionColor}18`,
          border: `1px solid ${m.competitionColor}44`,
          borderRadius: 6,
          fontSize: 10, fontWeight: 700,
          color: m.competitionColor,
          letterSpacing: '0.04em', whiteSpace: 'nowrap',
          minWidth: 52, textAlign: 'center', textTransform: 'uppercase',
        }}>
          {m.competitionShort}
        </div>

        <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 14, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.homeTeam}
        </div>

        <div style={{
          textAlign: 'center', minWidth: 60,
          fontWeight: isFinished || isLive ? 800 : 500,
          fontSize: isFinished || isLive ? 16 : 13,
          color: isLive ? 'var(--color-win)' : isFinished ? 'var(--color-text)' : 'var(--color-muted)',
          letterSpacing: isFinished || isLive ? '-0.02em' : '0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {isLive && <span style={{ fontSize: 8, verticalAlign: 'middle', marginRight: 4, color: 'var(--color-win)' }}>●</span>}
          {scoreOrTime}
        </div>

        <div style={{ textAlign: 'left', fontWeight: 600, fontSize: 14, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.awayTeam}
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: isLive ? 'var(--color-win)' : 'var(--color-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 28, textAlign: 'right' }}>
          {isLive ? 'LIVE' : isFinished ? 'FT' : ''}
        </div>
      </div>

      {/* Odds row — only for scheduled matches when odds available */}
      {odds && isScheduled && (
        <div style={{ display: 'flex', gap: 6, paddingLeft: 64 }}>
          <OddsChip label="1" value={odds.homeOdds} highlight={odds.homeOdds === bestOdds} />
          {odds.drawOdds > 0 && <OddsChip label="X" value={odds.drawOdds} highlight={odds.drawOdds === bestOdds} />}
          <OddsChip label="2" value={odds.awayOdds} highlight={odds.awayOdds === bestOdds} />
        </div>
      )}
    </div>
  )
}

function MatchesSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map(g => (
        <div key={g} className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ height: 11, width: 90, background: 'rgba(255,255,255,0.07)', borderRadius: 4, animation: 'pulse 1.4s ease-in-out infinite' }} />
          </div>
          {[1, 2, 3].map(r => (
            <div key={r} style={{ padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ height: 20, width: 52, background: 'rgba(255,255,255,0.06)', borderRadius: 6, animation: 'pulse 1.4s ease-in-out infinite' }} />
              <div style={{ flex: 1, height: 13, background: 'rgba(255,255,255,0.06)', borderRadius: 4, animation: 'pulse 1.4s ease-in-out infinite' }} />
              <div style={{ height: 16, width: 50, background: 'rgba(255,255,255,0.06)', borderRadius: 4, animation: 'pulse 1.4s ease-in-out infinite' }} />
              <div style={{ flex: 1, height: 13, background: 'rgba(255,255,255,0.06)', borderRadius: 4, animation: 'pulse 1.4s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
      ))}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }`}</style>
    </div>
  )
}

function MatchesTab() {
  const [data, setData] = useState<MatchesResponse | null>(null)
  const [oddsMap, setOddsMap] = useState<Map<string, MatchOdds>>(new Map())
  const [loading, setLoading] = useState(true)
  const [dayFilter, setDayFilter] = useState<DayFilter>('week')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/upcoming-matches').then(r => r.json() as Promise<MatchesResponse>),
      fetch('/api/odds').then(r => r.json() as Promise<OddsResponse>).catch(() => ({ odds: [], available: false })),
    ]).then(([matches, oddsResp]) => {
      if (cancelled) return
      setData(matches)
      const map = new Map<string, MatchOdds>()
      for (const o of oddsResp.odds ?? []) map.set(`${o.homeTeam}|${o.awayTeam}`, o)
      setOddsMap(map)
    }).catch(() => {
      if (!cancelled) setData({ matches: [], total: 0, competitionsOk: 0, competitionsFailed: 8 })
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const todayStr = new Date().toISOString().slice(0, 10)
  const tomorrowStr = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

  const filtered = useMemo(() => {
    if (!data) return []
    if (dayFilter === 'today') return data.matches.filter(m => m.utcDate.startsWith(todayStr))
    if (dayFilter === 'tomorrow') return data.matches.filter(m => m.utcDate.startsWith(tomorrowStr))
    return data.matches
  }, [data, dayFilter, todayStr, tomorrowStr])

  const grouped = useMemo(() => {
    const groups = new Map<string, UpcomingMatch[]>()
    for (const m of filtered) {
      const key = m.utcDate.slice(0, 10)
      const arr = groups.get(key) ?? []
      arr.push(m)
      groups.set(key, arr)
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const dayBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 14px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 8,
    border: active ? '1px solid rgba(79,142,247,0.5)' : '1px solid rgba(255,255,255,0.08)',
    background: active ? 'rgba(79,142,247,0.15)' : 'rgba(255,255,255,0.04)',
    color: active ? 'var(--color-accent)' : 'var(--color-muted)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s, color 0.15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Day filter */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={dayBtnStyle(dayFilter === 'today')} onClick={() => setDayFilter('today')}>Hoy</button>
        <button style={dayBtnStyle(dayFilter === 'tomorrow')} onClick={() => setDayFilter('tomorrow')}>Mañana</button>
        <button style={dayBtnStyle(dayFilter === 'week')} onClick={() => setDayFilter('week')}>Esta semana</button>
        {data && (
          <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 4 }}>
            {data.total} partidos · {data.competitionsOk} ligas
          </span>
        )}
      </div>

      {loading && <MatchesSkeleton />}

      {!loading && grouped.length === 0 && (
        <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🗓️</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Sin partidos</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            No hay partidos programados para {dayFilter === 'today' ? 'hoy' : dayFilter === 'tomorrow' ? 'mañana' : 'esta semana'}.
          </div>
        </div>
      )}

      {!loading && grouped.map(([dateKey, matches]) => {
        const isToday = dateKey === todayStr
        const isTomorrow = dateKey === tomorrowStr
        const dayLabel = isToday ? 'Hoy' : isTomorrow ? 'Mañana' : formatDayHeader(dateKey)
        const hasWC = matches.some(m => m.competitionCode === 'WC')

        return (
          <div key={dateKey} className="glass-card" style={{
            overflow: 'hidden',
            border: hasWC ? '1px solid rgba(245,166,35,0.25)' : undefined,
          }}>
            {/* Day header */}
            <div style={{
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: hasWC ? 'rgba(245,166,35,0.06)' : 'rgba(255,255,255,0.03)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{
                fontSize: 13,
                fontWeight: 700,
                color: isToday ? 'var(--color-accent)' : hasWC ? '#f5a623' : 'var(--color-text)',
                letterSpacing: '-0.01em',
              }}>
                {dayLabel}
              </span>
              {hasWC && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#f5a623', background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.35)', borderRadius: 5, padding: '2px 7px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Mundial
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-muted)' }}>{matches.length} partido{matches.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Match rows */}
            {matches.map(m => <MatchRow key={m.id} m={m} odds={findOdds(oddsMap, m.homeTeam, m.awayTeam)} />)}
          </div>
        )
      })}
    </div>
  )
}

// ----- Stats tab ------------------------------------------------------------

interface BetTypeRow {
  type: string
  wins: number
  losses: number
  bets: number
  winRate: number
  roi: number
  stake: number
  profit: number
}

function computeBetTypeRows(bets: Bet[]): BetTypeRow[] {
  const map = new Map<string, { wins: number; losses: number; stake: number; profit: number }>()
  for (const b of bets) {
    if (b.result !== 'win' && b.result !== 'loss') continue
    const key = b.betType || 'Unknown'
    const cur = map.get(key) ?? { wins: 0, losses: 0, stake: 0, profit: 0 }
    map.set(key, {
      wins: cur.wins + (b.result === 'win' ? 1 : 0),
      losses: cur.losses + (b.result === 'loss' ? 1 : 0),
      stake: cur.stake + b.stake,
      profit: cur.profit + b.profit,
    })
  }
  const rows: BetTypeRow[] = []
  for (const [type, s] of map) {
    const bets = s.wins + s.losses
    rows.push({
      type,
      wins: s.wins,
      losses: s.losses,
      bets,
      winRate: bets > 0 ? (s.wins / bets) * 100 : 0,
      roi: s.stake > 0 ? (s.profit / s.stake) * 100 : 0,
      stake: s.stake,
      profit: s.profit,
    })
  }
  return rows.sort((a, b) => b.roi - a.roi)
}

interface OddsAnalysis {
  avgWinningOdds: number
  avgLosingOdds: number
  highOddsCount: number
  highOddsWinRate: number
  lowOddsCount: number
  lowOddsWinRate: number
}

function computeOddsAnalysis(bets: Bet[]): OddsAnalysis {
  let winSum = 0, winCount = 0, lossSum = 0, lossCount = 0
  let highTotal = 0, highWins = 0, lowTotal = 0, lowWins = 0
  for (const b of bets) {
    if (b.result !== 'win' && b.result !== 'loss') continue
    if (b.result === 'win') { winSum += b.odds; winCount++ }
    else { lossSum += b.odds; lossCount++ }
    if (b.odds > 2.0) {
      highTotal++
      if (b.result === 'win') highWins++
    } else {
      lowTotal++
      if (b.result === 'win') lowWins++
    }
  }
  return {
    avgWinningOdds: winCount > 0 ? winSum / winCount : 0,
    avgLosingOdds: lossCount > 0 ? lossSum / lossCount : 0,
    highOddsCount: highTotal,
    highOddsWinRate: highTotal > 0 ? (highWins / highTotal) * 100 : 0,
    lowOddsCount: lowTotal,
    lowOddsWinRate: lowTotal > 0 ? (lowWins / lowTotal) * 100 : 0,
  }
}

function computeBestStreak(bets: Bet[]): number {
  const settled = bets
    .filter(b => b.result === 'win' || b.result === 'loss')
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
  let best = 0
  let current = 0
  for (const b of settled) {
    if (b.result === 'win') {
      current++
      if (current > best) best = current
    } else {
      current = 0
    }
  }
  return best
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: accent ?? 'var(--color-text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{sub}</div>}
    </div>
  )
}

function StatsTab() {
  const { bets, loaded, roiByCompetition } = useBets()

  const settledCount = useMemo(
    () => bets.filter(b => b.result === 'win' || b.result === 'loss').length,
    [bets]
  )
  const betTypeRows = useMemo(() => computeBetTypeRows(bets), [bets])
  const oddsAnalysis = useMemo(() => computeOddsAnalysis(bets), [bets])
  const bestStreak = useMemo(() => computeBestStreak(bets), [bets])

  if (!loaded) {
    return <div style={{ color: 'var(--color-muted)', fontSize: 14, padding: 24 }}>Loading stats…</div>
  }

  if (settledCount === 0) {
    return (
      <div className="glass-card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>No settled bets yet</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Settle some bets to see deeper stats here.</div>
      </div>
    )
  }

  const bestType = betTypeRows.find(r => r.bets >= 3) // ranked by ROI desc
  const bestLeague = roiByCompetition.find(c => c.bets >= 3)

  const maxAbsRoi = Math.max(1, ...betTypeRows.map(r => Math.abs(r.roi)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Quick summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <StatCard
          label="Bet types used"
          value={String(betTypeRows.length)}
          sub={`${settledCount} settled bets`}
        />
        <StatCard
          label="Best bet type (ROI)"
          value={bestType ? `${bestType.roi >= 0 ? '+' : ''}${bestType.roi.toFixed(1)}%` : '—'}
          sub={bestType ? `${bestType.type} · ${bestType.bets} bets` : 'Min 3 bets'}
          accent={bestType ? (bestType.roi >= 0 ? 'var(--color-win)' : 'var(--color-loss)') : undefined}
        />
        <StatCard
          label="Best league (ROI)"
          value={bestLeague ? `${bestLeague.roi >= 0 ? '+' : ''}${bestLeague.roi.toFixed(1)}%` : '—'}
          sub={bestLeague ? `${bestLeague.league} · ${bestLeague.bets} bets` : 'Min 3 bets'}
          accent={bestLeague ? (bestLeague.roi >= 0 ? 'var(--color-win)' : 'var(--color-loss)') : undefined}
        />
      </div>

      {/* Performance by bet type */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Performance by bet type</div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>Ranked by ROI</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {betTypeRows.map(r => {
            const roiColor = r.roi >= 0 ? 'var(--color-win)' : 'var(--color-loss)'
            const winRateBarPct = Math.max(0, Math.min(100, r.winRate))
            return (
              <div key={r.type} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1.4fr) 1fr minmax(120px, auto)', gap: 16, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{r.type}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                    {r.wins}W · {r.losses}L · {r.bets} bets
                  </div>
                </div>
                <div>
                  <div style={{
                    height: 6, width: '100%',
                    background: 'rgba(255,255,255,0.06)', borderRadius: 3,
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      width: `${winRateBarPct}%`,
                      background: 'linear-gradient(90deg, #4f8ef7, #7c5cf5)',
                      borderRadius: 3,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>
                    {r.winRate.toFixed(0)}% win rate
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: roiColor, letterSpacing: '-0.01em' }}>
                    {r.roi >= 0 ? '+' : ''}{r.roi.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                    {/* sparkline-ish hint of relative ROI */}
                    {(() => {
                      const w = Math.min(100, Math.abs(r.roi) / maxAbsRoi * 100)
                      return (
                        <span style={{
                          display: 'inline-block', width: 36, height: 4, borderRadius: 2,
                          background: 'rgba(255,255,255,0.06)', position: 'relative', verticalAlign: 'middle',
                          marginRight: 6,
                        }}>
                          <span style={{
                            position: 'absolute', inset: 0, width: `${w}%`,
                            borderRadius: 2, background: roiColor, opacity: 0.7,
                          }} />
                        </span>
                      )
                    })()}
                    ROI
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Avg odds analysis + Best streak */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 2fr) minmax(220px, 1fr)', gap: 16 }}>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Avg odds analysis</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: '12px 14px', background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.18)', borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Avg winning odds</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-win)', letterSpacing: '-0.02em', marginTop: 4 }}>
                {oddsAnalysis.avgWinningOdds > 0 ? oddsAnalysis.avgWinningOdds.toFixed(2) : '—'}
              </div>
            </div>
            <div style={{ padding: '12px 14px', background: 'rgba(255,61,113,0.06)', border: '1px solid rgba(255,61,113,0.18)', borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Avg losing odds</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-loss)', letterSpacing: '-0.02em', marginTop: 4 }}>
                {oddsAnalysis.avgLosingOdds > 0 ? oddsAnalysis.avgLosingOdds.toFixed(2) : '—'}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <OddsBucket
              title="Odds > 2.0"
              count={oddsAnalysis.highOddsCount}
              winRate={oddsAnalysis.highOddsWinRate}
            />
            <OddsBucket
              title="Odds ≤ 2.0"
              count={oddsAnalysis.lowOddsCount}
              winRate={oddsAnalysis.lowOddsWinRate}
            />
          </div>
        </div>

        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Best streak ever</div>
            <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--color-win)', letterSpacing: '-0.04em', lineHeight: 1, marginTop: 8 }}>
              {bestStreak}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 6 }}>
              consecutive wins
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 12, opacity: 0.8 }}>
            Calculated across all settled bets in chronological order.
          </div>
        </div>
      </div>
    </div>
  )
}

function OddsBucket({ title, count, winRate }: { title: string; count: number; winRate: number }) {
  const winRatePct = Math.max(0, Math.min(100, winRate))
  return (
    <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>{count}</div>
        <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>bets</div>
      </div>
      <div style={{ marginTop: 8, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${winRatePct}%`, background: 'linear-gradient(90deg, #4f8ef7, #7c5cf5)', borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 4 }}>{count > 0 ? `${winRate.toFixed(0)}% win rate` : 'No data'}</div>
    </div>
  )
}

// ----- Guides tab -----------------------------------------------------------

function GuideCard({ icon, title, children, defaultOpen = false }: { icon: string; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', textAlign: 'left',
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '18px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: 'var(--color-text)', fontFamily: 'inherit',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>{icon}</span>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</span>
        </span>
        <span style={{
          fontSize: 18, color: 'var(--color-muted)',
          transition: 'transform 0.25s ease',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          display: 'inline-block',
        }}>▸</span>
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ paddingTop: 16, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text)' }}>
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

function GuideTip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 14,
      padding: '12px 14px',
      background: 'rgba(79,142,247,0.08)',
      border: '1px solid rgba(79,142,247,0.25)',
      borderRadius: 10,
      fontSize: 13,
      color: 'var(--color-text)',
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 16, lineHeight: 1.2 }}>💡</span>
      <span><strong style={{ color: 'var(--color-accent)' }}>Tip:</strong> {children}</span>
    </div>
  )
}

function GuideTable({ headers, rows }: { headers: string[]; rows: (string | { text: string; tone?: 'win' | 'loss' | 'pending' | 'void' })[][] }) {
  const toneColor = (tone?: 'win' | 'loss' | 'pending' | 'void') =>
    tone === 'win' ? 'var(--color-win)'
    : tone === 'loss' ? 'var(--color-loss)'
    : tone === 'pending' ? 'var(--color-pending)'
    : tone === 'void' ? 'var(--color-void)'
    : 'var(--color-text)'
  return (
    <div style={{ marginTop: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderTop: ri === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
              {row.map((cell, ci) => {
                const isObj = typeof cell !== 'string'
                const text = isObj ? cell.text : cell
                const tone = isObj ? cell.tone : undefined
                return (
                  <td key={ci} style={{ padding: '10px 12px', color: toneColor(tone), fontWeight: tone ? 600 : 400 }}>
                    {text}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GuidesTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <GuideCard icon="🎯" title="Asian Handicap (AH)" defaultOpen>
        <p style={{ margin: 0 }}>
          The Asian handicap removes the draw from the equation by giving one team a virtual goal head-start (or deficit). You back either team to win after the handicap is applied.
        </p>
        <ul style={{ margin: '10px 0 0', paddingLeft: 22 }}>
          <li><strong>Whole/half ball lines</strong> (0, ±0.5, ±1, ±1.5): a single, clean outcome — Win, Push (stake refunded) or Loss.</li>
          <li><strong>Quarter ball lines</strong> (±0.25, ±0.75): the bet is automatically split across the two adjacent half-ball lines, so you can win/lose half your stake.</li>
        </ul>

        <div style={{ marginTop: 14, fontSize: 13, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Example: Home -0.25</div>
        <GuideTable
          headers={['Match result', 'Settlement']}
          rows={[
            ['Home wins by 1+ goal', { text: 'Full Win', tone: 'win' }],
            ['Draw', { text: 'Half Loss', tone: 'loss' }],
            ['Away wins', { text: 'Full Loss', tone: 'loss' }],
          ]}
        />

        <div style={{ marginTop: 14, fontSize: 13, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Example: Home +0.25</div>
        <GuideTable
          headers={['Match result', 'Settlement']}
          rows={[
            ['Home wins', { text: 'Full Win', tone: 'win' }],
            ['Draw', { text: 'Half Win', tone: 'win' }],
            ['Away wins', { text: 'Full Loss', tone: 'loss' }],
          ]}
        />

        <GuideTip>
          A quarter ball protects part of your stake against the draw when backing favorites.
        </GuideTip>
      </GuideCard>

      <GuideCard icon="⚽" title="Over/Under (O/U)">
        <p style={{ margin: 0 }}>
          The total goals market: bet on whether the total goals scored in the match goes over or under the published line.
          Quarter lines (2.25, 2.75, 3.25…) split the same way as Asian handicaps — half the stake on each adjacent line.
        </p>

        <div style={{ marginTop: 14, fontSize: 13, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Example: Over 2.25 (= 50% Over 2.0 + 50% Over 2.5)</div>
        <GuideTable
          headers={['Total goals', 'Settlement']}
          rows={[
            ['3 or more goals', { text: 'Full Win', tone: 'win' }],
            ['Exactly 2 goals', { text: 'Half Loss (Over 2.0 pushes, Over 2.5 loses)', tone: 'loss' }],
            ['1 goal or 0 goals', { text: 'Full Loss', tone: 'loss' }],
          ]}
        />

        <GuideTip>
          The cleanest line is 2.5 — no splits, no half losses. Either 3+ goals (Over wins) or ≤ 2 goals (Under wins).
        </GuideTip>
      </GuideCard>

      <GuideCard icon="🏦" title="Gestión de Bankroll">
        <ul style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li><strong>Stake size:</strong> never bet more than <strong>2–5%</strong> of your bankroll on a single bet. Variance is brutal at higher stakes.</li>
          <li><strong>Flat staking:</strong> use the same unit size on every bet and track results in <strong>units</strong>, not cash. It removes emotion.</li>
          <li><strong>Stop-loss rule:</strong> set a monthly maximum loss (e.g. <strong>20% of bankroll</strong>). When you hit it, stop for the month. No exceptions.</li>
          <li><strong>Don’t chase losses:</strong> after 3 losses in a row, <em>reduce</em> the stake — don’t increase it. Chasing is how bankrolls die.</li>
          <li><strong>Sample size:</strong> a positive ROI over <strong>100+ bets</strong> is meaningful. Don’t judge a strategy on 10 bets — that’s noise.</li>
        </ul>

        <GuideTip>
          A disciplined staking plan beats a “great pick” every single time over the long run.
        </GuideTip>
      </GuideCard>
    </div>
  )
}

// ----- Page shell -----------------------------------------------------------

export default function TipsPage() {
  const [tab, setTab] = useState<TabId>('partidos')

  return (
    <>
      <TipsNav active={tab} />
      <main className="page-main" style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1200, margin: '0 auto', padding: '32px 24px 80px',
        display: 'flex', flexDirection: 'column', gap: 24,
      }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Tips</h1>
          <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 14 }}>
            Football betting feeds, deeper stats on your bets, and short guides to common markets.
          </p>
        </header>

        <TabBar active={tab} onSelect={setTab} />

        <section className="fade-up" key={tab}>
          {tab === 'partidos' && <MatchesTab />}
          {tab === 'stats' && <StatsTab />}
          {tab === 'guides' && <GuidesTab />}
        </section>
      </main>

      <BottomNav />
    </>
  )
}
