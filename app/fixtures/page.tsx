'use client'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import BottomNav from '@/components/BottomNav'
import AddBetModal from '@/components/AddBetModal'
import { useBets } from '@/hooks/useBets'

interface UpcomingMatch {
  id: number
  competition: string
  competitionShort: string
  homeTeam: string
  awayTeam: string
  utcDate: string
  status: string
  scoreHome: number | null
  scoreAway: number | null
}

interface MatchOdds {
  homeTeam: string
  awayTeam: string
  commenceTime: string
  homeOdds: number
  drawOdds: number
  awayOdds: number
}

interface EnrichedMatch extends UpcomingMatch {
  odds: MatchOdds | null
}

function normalize(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function mergeOdds(matches: UpcomingMatch[], odds: MatchOdds[]): EnrichedMatch[] {
  return matches.map(m => {
    const hn = normalize(m.homeTeam)
    const an = normalize(m.awayTeam)
    const found = odds.find(o => {
      const oh = normalize(o.homeTeam)
      const oa = normalize(o.awayTeam)
      return (oh.includes(hn) || hn.includes(oh)) && (oa.includes(an) || an.includes(oa))
    })
    return { ...m, odds: found ?? null }
  })
}

function localDate(utc: string) {
  return new Date(utc).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    timeZone: 'Asia/Bangkok',
  })
}

function thaiTime(utc: string) {
  return new Date(utc).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
}

function utcTime(utc: string) {
  return new Date(utc).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

function isToday(utc: string) {
  const d = new Date(utc)
  const now = new Date()
  // compare in Thailand timezone
  const dtThai = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok' })
  const nowThai = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok' })
  return dtThai === nowThai
}

function OddsButton({ value, label, onClick }: { value: number; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
        background: 'rgba(240,235,224,0.04)',
        border: '1px solid rgba(245,166,35,0.2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,235,224,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(111,106,55,0.35)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,235,224,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,166,35,0.2)' }}
    >
      <span style={{ fontSize: 10, color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
      <span className="num" style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-accent)' }}>{value.toFixed(2)}</span>
    </button>
  )
}

function MatchCard({ match, onBet }: { match: EnrichedMatch; onBet: (m: EnrichedMatch, pick: string, odds: number) => void }) {
  const live = match.status === 'IN_PLAY' || match.status === 'PAUSED'
  const finished = match.status === 'FINISHED'

  return (
    <div className="glass-card" style={{ padding: '14px 16px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'var(--color-accent)',
          background: 'rgba(240,235,224,0.07)', border: '1px solid rgba(245,166,35,0.2)',
          borderRadius: 5, padding: '2px 8px', letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>{match.competitionShort}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {live && (
            <span style={{
              fontSize: 9, fontWeight: 800, color: 'var(--color-loss)',
              background: 'rgba(224,83,83,0.15)', border: '1px solid rgba(224,83,83,0.3)',
              borderRadius: 5, padding: '2px 7px', letterSpacing: '0.05em',
            }}>● LIVE</span>
          )}
          {finished ? (
            <span style={{ fontSize: 12, color: 'var(--color-muted)', fontWeight: 700 }}>FT</span>
          ) : (
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 14, fontWeight: 800,
                color: live ? 'var(--color-loss)' : 'var(--color-text)',
                letterSpacing: '-0.01em',
              }}>
                {thaiTime(match.utcDate)} <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.6, letterSpacing: '0.06em' }}>ICT</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--color-muted)', marginTop: 1 }}>
                {utcTime(match.utcDate)} UTC
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Teams + score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, flex: 1, textAlign: 'left' }}>{match.homeTeam}</span>
        {finished || live ? (
          <span className="num" style={{
            fontSize: 20, fontWeight: 900, padding: '4px 16px',
            color: 'var(--color-text)',
            background: 'rgba(240,235,224,0.05)', borderRadius: 8,
            letterSpacing: '-0.02em',
          }}>
            {match.scoreHome ?? '—'} – {match.scoreAway ?? '—'}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--color-muted)', padding: '4px 14px' }}>vs</span>
        )}
        <span style={{ fontSize: 14, fontWeight: 700, flex: 1, textAlign: 'right' }}>{match.awayTeam}</span>
      </div>

      {/* Odds row */}
      {match.odds && !finished ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <OddsButton value={match.odds.homeOdds} label={match.homeTeam.split(' ').pop() ?? '1'} onClick={() => onBet(match, match.homeTeam, match.odds!.homeOdds)} />
          {match.odds.drawOdds > 0 && (
            <OddsButton value={match.odds.drawOdds} label="Draw" onClick={() => onBet(match, 'Draw', match.odds!.drawOdds)} />
          )}
          <OddsButton value={match.odds.awayOdds} label={match.awayTeam.split(' ').pop() ?? '2'} onClick={() => onBet(match, match.awayTeam, match.odds!.awayOdds)} />
        </div>
      ) : !finished ? (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-muted)', padding: '8px 0' }}>
          Odds not available yet
        </div>
      ) : null}
    </div>
  )
}

export default function FixturesPage() {
  const { addBet } = useBets()
  const [matches, setMatches] = useState<EnrichedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'today' | 'upcoming'>('today')
  const [showModal, setShowModal] = useState(false)
  const [prefilledBet, setPrefilledBet] = useState<{ match: string; odds: string } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [matchRes, oddsRes] = await Promise.all([
          fetch('/api/upcoming-matches'),
          fetch('/api/odds'),
        ])
        const matchData = await matchRes.json()
        const oddsData = await oddsRes.json()
        const enriched = mergeOdds(matchData.matches ?? [], oddsData.odds ?? [])
        setMatches(enriched)
      } catch {
        setError('Could not load fixtures — check API keys')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const todayMatches    = matches.filter(m => isToday(m.utcDate))
  const upcomingMatches = matches.filter(m => !isToday(m.utcDate))

  const displayed = tab === 'today' ? todayMatches : upcomingMatches

  const grouped: Record<string, EnrichedMatch[]> = {}
  for (const m of displayed) {
    const key = localDate(m.utcDate)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m)
  }

  const handleBet = (match: EnrichedMatch, pick: string, odds: number) => {
    setPrefilledBet({
      match: `${match.homeTeam} vs ${match.awayTeam} — ${pick}`,
      odds: odds.toFixed(2),
    })
    setShowModal(true)
  }

  return (
    <>
      <Navbar onAddBet={() => setShowModal(true)} />

      <div style={{
        position: 'sticky',
        top: 'calc(56px + env(safe-area-inset-top))',
        zIndex: 39,
        background: '#223022',
        borderBottom: '1px solid rgba(240,235,224,0.08)',
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '10px 16px', display: 'flex', gap: 8 }}>
          {([['today', `Today${todayMatches.length ? ` (${todayMatches.length})` : ''}`], ['upcoming', `Upcoming${upcomingMatches.length ? ` (${upcomingMatches.length})` : ''}`]] as const).map(([key, label]) => {
            const active = tab === key
            return (
              <button key={key} onClick={() => setTab(key)} style={{
                padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: active ? 'rgba(240,235,224,0.1)' : 'rgba(240,235,224,0.04)',
                border: active ? '1px solid rgba(111,106,55,0.3)' : '1px solid rgba(240,235,224,0.08)',
                color: active ? 'var(--color-accent)' : 'var(--color-muted)',
              }}>{label}</button>
            )
          })}
        </div>
      </div>

      <main style={{ maxWidth: 700, margin: '0 auto', padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-muted)' }}>Loading fixtures…</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-loss)', fontSize: 14 }}>{error}</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-muted)', fontSize: 14 }}>
            {tab === 'today' ? 'No matches today' : 'No upcoming matches in the next 14 days'}
          </div>
        ) : (
          Object.entries(grouped).map(([day, dayMatches]) => (
            <div key={day}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: 'var(--color-muted)',
                letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10,
              }}>{day}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dayMatches.map(m => (
                  <MatchCard key={m.id} match={m} onBet={handleBet} />
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      <BottomNav />

      {showModal && (
        <AddBetModal
          onClose={() => { setShowModal(false); setPrefilledBet(null) }}
          onAdd={addBet}
          prefill={prefilledBet ?? undefined}
        />
      )}
    </>
  )
}
