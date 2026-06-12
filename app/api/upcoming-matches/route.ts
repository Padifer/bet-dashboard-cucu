import { NextResponse } from 'next/server'

const BASE = 'https://api.football-data.org/v4'

interface CompConfig {
  code: string
  name: string
  short: string
  color: string
  priority: number
}

const COMPETITIONS: CompConfig[] = [
  { code: 'WC', name: 'FIFA World Cup 2026', short: 'WC26', color: '#F5A623', priority: 1 },
]

export interface UpcomingMatch {
  id: number
  competition: string
  competitionShort: string
  competitionCode: string
  competitionColor: string
  competitionPriority: number
  homeTeam: string
  awayTeam: string
  utcDate: string
  status: string
  scoreHome: number | null
  scoreAway: number | null
}

interface MatchesResponse {
  matches: UpcomingMatch[]
  total: number
  competitionsOk: number
  competitionsFailed: number
}

async function fetchCompetition(
  key: string,
  comp: CompConfig,
  dateFrom: string,
  dateTo: string,
): Promise<UpcomingMatch[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(
      `${BASE}/competitions/${comp.code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      {
        signal: controller.signal,
        headers: { 'X-Auth-Token': key },
        next: { revalidate: 1800 },
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as {
      matches: Array<{
        id: number
        homeTeam: { name: string }
        awayTeam: { name: string }
        utcDate: string
        status: string
        score: { fullTime: { home: number | null; away: number | null } }
      }>
    }
    return (data.matches ?? []).map(m => ({
      id: m.id,
      competition: comp.name,
      competitionShort: comp.short,
      competitionCode: comp.code,
      competitionColor: comp.color,
      competitionPriority: comp.priority,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      utcDate: m.utcDate,
      status: m.status,
      scoreHome: m.score.fullTime.home,
      scoreAway: m.score.fullTime.away,
    }))
  } finally {
    clearTimeout(timer)
  }
}

export const revalidate = 1800

export async function GET(): Promise<NextResponse<MatchesResponse>> {
  const key = process.env.FOOTBALL_DATA_API_KEY
  if (!key) {
    return NextResponse.json({ matches: [], total: 0, competitionsOk: 0, competitionsFailed: COMPETITIONS.length })
  }

  const today = new Date()
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  const dateFrom = today.toISOString().slice(0, 10)
  const dateTo = nextWeek.toISOString().slice(0, 10)

  const settled = await Promise.allSettled(
    COMPETITIONS.map(c => fetchCompetition(key, c, dateFrom, dateTo)),
  )

  let competitionsOk = 0
  let competitionsFailed = 0
  const matches: UpcomingMatch[] = []

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      competitionsOk++
      matches.push(...result.value)
    } else {
      competitionsFailed++
    }
  }

  // Sort by date first, then by competition priority within the same day
  matches.sort((a, b) => {
    const dateA = a.utcDate.slice(0, 10)
    const dateB = b.utcDate.slice(0, 10)
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    if (a.competitionPriority !== b.competitionPriority) return a.competitionPriority - b.competitionPriority
    return a.utcDate.localeCompare(b.utcDate)
  })

  return NextResponse.json({ matches, total: matches.length, competitionsOk, competitionsFailed })
}
