import { NextRequest, NextResponse } from 'next/server'

const FD_BASE = 'https://api.football-data.org/v4'
const AF_BASE = 'https://api-football-v1.p.rapidapi.com/v3'

// Map human-readable league names → football-data.org competition codes (free tier)
const LEAGUE_MAP: Record<string, string> = {
  'premier league': 'PL',
  'english premier league': 'PL',
  'epl': 'PL',
  'fa cup': 'FAC',
  'english fa cup': 'FAC',
  'fa cup england': 'FAC',
  'efl cup': 'ELC',
  'carabao cup': 'ELC',
  'championship': 'ELC',
  'english championship': 'ELC',
  'bundesliga': 'BL1',
  'german bundesliga': 'BL1',
  'dfb pokal': 'DFB',
  'dfb-pokal': 'DFB',
  'serie a': 'SA',
  'italian serie a': 'SA',
  'coppa italia': 'CIT',
  'italy cup': 'CIT',
  'italian cup': 'CIT',
  'la liga': 'PD',
  'primera division': 'PD',
  'spanish la liga': 'PD',
  'copa del rey': 'CDR',
  'ligue 1': 'FL1',
  'french ligue 1': 'FL1',
  'ligue1': 'FL1',
  'champions league': 'CL',
  'uefa champions league': 'CL',
  'ucl': 'CL',
  'europa league': 'EL',
  'uefa europa league': 'EL',
  'uel': 'EL',
  'conference league': 'ECL',
  'eredivisie': 'DED',
  'primeira liga': 'PPL',
  'copa libertadores': 'CLI',
  'world cup': 'WC',
  'fifa world cup': 'WC',
  'european championship': 'EC',
  'euro': 'EC',
  'euros': 'EC',
}

// football-data.org free-tier codes (cups like CIT, DFB, CDR will 403 — caught gracefully)
function leagueToCode(league: string): string | null {
  const key = league.toLowerCase().trim()
  if (LEAGUE_MAP[key]) return LEAGUE_MAP[key]
  for (const [k, v] of Object.entries(LEAGUE_MAP)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return null
}

function norm(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(fc|sc|cf|ac|as|rc|cd|afc|bsc|vfb|vfl|rb|sv|hsv|tsv|1\.|borussia|olympique|sporting|real|inter)\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function teamsMatch(api: string, query: string) {
  const na = norm(api)
  const nq = norm(query)
  if (!na || !nq) return false
  if (na === nq || na.startsWith(nq) || nq.startsWith(na) || na.includes(nq) || nq.includes(na)) return true
  const naWords = na.split(' ').filter(w => w.length > 3)
  const nqWords = nq.split(' ').filter(w => w.length > 3)
  return naWords.some(w => nq.includes(w)) || nqWords.some(w => na.includes(w))
}

// ── football-data.org ──────────────────────────────────────────────────────────

type FdMatch = {
  homeTeam: { name: string; shortName: string; tla: string }
  awayTeam: { name: string; shortName: string; tla: string }
  score: { fullTime: { home: number | null; away: number | null }; halfTime: { home: number | null; away: number | null } }
  status: string
  utcDate: string
}

async function fetchFD(key: string, date: string, code?: string | null): Promise<FdMatch[]> {
  const url = code
    ? `${FD_BASE}/competitions/${code}/matches?dateFrom=${date}&dateTo=${date}`
    : `${FD_BASE}/matches?dateFrom=${date}&dateTo=${date}`
  const res = await fetch(url, { headers: { 'X-Auth-Token': key }, next: { revalidate: 60 } })
  if (!res.ok) return []
  const data = await res.json()
  return data.matches ?? []
}

// ── API-Football (RapidAPI) — covers 800+ competitions ────────────────────────

type AfFixture = {
  teams: { home: { name: string }; away: { name: string } }
  goals: { home: number | null; away: number | null }
  fixture: { status: { short: string }; date: string }
}

async function fetchAF(rapidKey: string, date: string): Promise<AfFixture[]> {
  try {
    const res = await fetch(`${AF_BASE}/fixtures?date=${date}`, {
      headers: {
        'X-RapidAPI-Key': rapidKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
      },
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.response ?? []
  } catch {
    return []
  }
}

function buildResultFromAF(fixture: AfFixture, team1: string, team2: string) {
  const homeName = fixture.teams.home.name
  const awayName = fixture.teams.away.name
  const hMatch = teamsMatch(homeName, team1)
  const statusShort = fixture.fixture.status.short
  const liveShorts = ['1H', 'HT', '2H', 'ET', 'P']
  const matchStatus: 'scheduled' | 'live' | 'finished' =
    statusShort === 'FT' || statusShort === 'AET' || statusShort === 'PEN' ? 'finished' :
    liveShorts.includes(statusShort) ? 'live' :
    'scheduled'

  const rawHome = fixture.goals.home
  const rawAway = fixture.goals.away

  return {
    found: true,
    matchStatus,
    homeTeam: homeName,
    awayTeam: awayName,
    source: 'api-football',
    ...(matchStatus !== 'scheduled' && rawHome !== null && rawAway !== null ? {
      score: {
        home: hMatch ? rawHome : rawAway,
        away: hMatch ? rawAway : rawHome,
      },
    } : { utcDate: fixture.fixture.date }),
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const fdKey     = process.env.FOOTBALL_DATA_API_KEY
  const rapidKey  = process.env.RAPIDAPI_KEY

  if (!fdKey && !rapidKey) return NextResponse.json({ found: false, reason: 'no_key' })

  try {
    const { match, date, league } = (await req.json()) as { match: string; date: string; league?: string }

    const clean = match.replace(/\s*\([^)]*\)/g, '').trim()
    const parts = clean.split(/\s*(?:-vs-|\svs\.?\s)\s*/i)
    if (parts.length < 2) return NextResponse.json({ found: false, reason: 'bad_match_string' })

    const [team1, team2] = parts.map(p => p.trim())

    // ── Try football-data.org first ──────────────────────────────────────────
    if (fdKey) {
      const code = league ? leagueToCode(league) : null
      let fdMatches = await fetchFD(fdKey, date, code)
      if (fdMatches.length === 0 && code) fdMatches = await fetchFD(fdKey, date, null)

      const found = fdMatches.find(m => {
        const hNames = [m.homeTeam.name, m.homeTeam.shortName, m.homeTeam.tla].filter(Boolean)
        const aNames = [m.awayTeam.name, m.awayTeam.shortName, m.awayTeam.tla].filter(Boolean)
        return (hNames.some(n => teamsMatch(n, team1)) && aNames.some(n => teamsMatch(n, team2)))
            || (hNames.some(n => teamsMatch(n, team2)) && aNames.some(n => teamsMatch(n, team1)))
      })

      if (found) {
        const hNames = [found.homeTeam.name, found.homeTeam.shortName, found.homeTeam.tla].filter(Boolean)
        const reversed = !hNames.some(n => teamsMatch(n, team1))
        const liveStatuses = ['IN_PLAY', 'PAUSED', 'HALFTIME']
        const matchStatus: 'scheduled' | 'live' | 'finished' =
          found.status === 'FINISHED' ? 'finished' :
          liveStatuses.includes(found.status) ? 'live' : 'scheduled'

        if (matchStatus === 'scheduled') {
          return NextResponse.json({ found: true, matchStatus, homeTeam: found.homeTeam.name, awayTeam: found.awayTeam.name, utcDate: found.utcDate })
        }

        const rawHome = found.score.fullTime.home ?? found.score.halfTime.home
        const rawAway = found.score.fullTime.away ?? found.score.halfTime.away
        if (rawHome === null || rawAway === null) return NextResponse.json({ found: false, reason: 'no_score' })

        return NextResponse.json({
          found: true, matchStatus,
          homeTeam: found.homeTeam.name, awayTeam: found.awayTeam.name,
          score: { home: reversed ? rawAway : rawHome, away: reversed ? rawHome : rawAway },
        })
      }
    }

    // ── Fallback: API-Football (covers cups + all leagues) ───────────────────
    if (rapidKey) {
      const fixtures = await fetchAF(rapidKey, date)
      const fixture = fixtures.find(f => {
        const h = f.teams.home.name
        const a = f.teams.away.name
        return (teamsMatch(h, team1) && teamsMatch(a, team2))
            || (teamsMatch(h, team2) && teamsMatch(a, team1))
      })
      if (fixture) return NextResponse.json(buildResultFromAF(fixture, team1, team2))
    }

    // ── Neither found it ────────────────────────────────────────────────────
    const reason = rapidKey ? 'not_found' : 'not_found_fd_only'
    return NextResponse.json({ found: false, reason })

  } catch {
    return NextResponse.json({ found: false, reason: 'server_error' })
  }
}
