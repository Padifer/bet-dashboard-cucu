import { NextResponse } from 'next/server'

const BASE = 'https://api.the-odds-api.com/v4/sports'

// WC only — 1 request per fetch, well within 500/month free quota
const SPORT_KEYS = [
  'soccer_fifa_world_cup',
]

export interface MatchOdds {
  homeTeam: string
  awayTeam: string
  commenceTime: string
  homeOdds: number
  drawOdds: number
  awayOdds: number
}

interface OddsResponse {
  odds: MatchOdds[]
  available: boolean
  reason?: string
}

type Outcome = { name: string; price: number }
type Market = { key: string; outcomes: Outcome[] }
type Bookmaker = { markets: Market[] }
type ApiMatch = {
  home_team: string
  away_team: string
  commence_time: string
  bookmakers: Bookmaker[]
}

function avgOdds(bookmakers: Bookmaker[], homeTeam: string, awayTeam: string): { home: number; draw: number; away: number } | null {
  const home: number[] = []
  const draw: number[] = []
  const away: number[] = []

  for (const bm of bookmakers) {
    const h2h = bm.markets.find(m => m.key === 'h2h')
    if (!h2h) continue
    for (const o of h2h.outcomes) {
      if (o.name === homeTeam) home.push(o.price)
      else if (o.name === awayTeam) away.push(o.price)
      else draw.push(o.price)
    }
  }

  if (!home.length || !away.length) return null
  const avg = (arr: number[]) => parseFloat((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2))
  return { home: avg(home), draw: draw.length ? avg(draw) : 0, away: avg(away) }
}

async function fetchSport(key: string, apiKey: string): Promise<MatchOdds[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(
      `${BASE}/${key}/odds/?apiKey=${apiKey}&regions=eu&markets=h2h&oddsFormat=decimal`,
      { signal: controller.signal, cache: 'no-store' },
    )
    if (!res.ok) return []
    const data = (await res.json()) as ApiMatch[]
    if (!Array.isArray(data)) return []
    const result: MatchOdds[] = []
    for (const m of data) {
      const avg = avgOdds(m.bookmakers ?? [], m.home_team, m.away_team)
      if (!avg) continue
      result.push({
        homeTeam: m.home_team,
        awayTeam: m.away_team,
        commenceTime: m.commence_time,
        homeOdds: avg.home,
        drawOdds: avg.draw,
        awayOdds: avg.away,
      })
    }
    return result
  } finally {
    clearTimeout(timer)
  }
}

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse<OddsResponse>> {
  const apiKey = process.env.ODDS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ odds: [], available: false, reason: 'no_key' })
  }

  const settled = await Promise.allSettled(SPORT_KEYS.map(k => fetchSport(k, apiKey)))
  const odds: MatchOdds[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled') odds.push(...r.value)
  }

  return NextResponse.json({ odds, available: true })
}
