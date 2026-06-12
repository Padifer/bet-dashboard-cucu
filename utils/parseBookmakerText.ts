import { ParlayLeg } from '@/types/bet'

export interface ParsedBet {
  match?: string
  prediction?: string
  odds?: number
  stake?: number
  league?: string
  betType?: string
  isParlay?: boolean
  legs?: ParlayLeg[]
  date?: string
}

// ── Number helpers ────────────────────────────────────────────────────────────

// Tolerant number parser: handles OCR O→0, comma/dot ambiguity
function toNum(raw: string): number | undefined {
  const s = raw.replace(/[Oo]/g, '0').replace(/\s/g, '')
  const clean = s.replace(/,(?=\d{3})/g, '').replace(',', '.')
  const n = parseFloat(clean)
  return isNaN(n) ? undefined : n
}

// Currency amounts: also handles European dot-thousands "3.000" → 3000
function toCurrency(raw: string): number | undefined {
  const s = raw.replace(/[Oo]/g, '0').replace(/\s/g, '')
  // Dot-thousands: "3.000" or "43.878" where dot separates thousands
  const dotK = /^(\d{1,3})\.(\d{3})$/.exec(s)
  if (dotK) {
    const asThousands = parseInt(dotK[1] + dotK[2])
    if (asThousands >= 100) return asThousands
  }
  // Comma-thousands: "3,000" → 3000
  const clean = s.replace(/,(?=\d{3})/g, '').replace(',', '.')
  const n = parseFloat(clean)
  return isNaN(n) ? undefined : n
}

// ── League helpers ────────────────────────────────────────────────────────────

const LEAGUE_MAP: [RegExp, string][] = [
  // SBOBET/Asian abbreviations (ALL CAPS short codes)
  [/^eng\s*pr$/i,                                          'Premier League'],
  [/^spn\s*ll$/i,                                          'La Liga'],
  [/^ita\s*sa$/i,                                          'Serie A'],
  [/^ger\s*bl$/i,                                          'Bundesliga'],
  [/^fra\s*l1$/i,                                          'Ligue 1'],
  [/^uefa\s*cl$/i,                                         'UEFA Champions League'],
  [/^uefa\s*el$/i,                                         'UEFA Europa League'],
  [/^uefa\s*nl$/i,                                         'UEFA Nations League'],
  // Full name variants
  [/world\s*cup|fifa\s*wc/i,                               'FIFA World Cup'],
  [/champions\s*league|ucl/i,                              'UEFA Champions League'],
  [/europa\s*league|uel/i,                                 'UEFA Europa League'],
  [/english\s*premier\s*league|premier\s*league|epl/i,    'Premier League'],
  [/la\s*liga|laliga/i,                                    'La Liga'],
  [/germany\s*bundesliga|bundesliga/i,                     'Bundesliga'],
  [/serie\s*a/i,                                           'Serie A'],
  [/ligue\s*1/i,                                           'Ligue 1'],
  [/nations\s*league/i,                                    'UEFA Nations League'],
  [/euros?|euro\s*20\d\d/i,                                'UEFA Euros'],
  [/fa\s*cup/i,                                            'FA Cup'],
  [/copa\s*del\s*rey/i,                                    'Copa del Rey'],
  [/mls/i,                                                 'MLS'],
  [/eredivisie/i,                                          'Eredivisie'],
]

function mapLeague(raw: string): string {
  for (const [re, name] of LEAGUE_MAP) {
    if (re.test(raw)) return name
  }
  return raw.trim()
}

// Detect ALL CAPS league header lines (includes short codes like "ENG PR")
function isLeagueLine(line: string): boolean {
  if (line.length < 3 || line.length > 60) return false
  if (/^(type|bet|odds|date|time|game|est|https?|mix|running|won|lost|void|half|status)\s*[:.;,|\/]/i.test(line)) return false
  if (/\d{2}:\d{2}/.test(line)) return false
  if (/\d+[.,]\d{2,}/.test(line)) return false
  if (/^[-+]?[\d.,O]+\s*[@\[]/.test(line)) return false
  const letters = line.replace(/[^a-zA-Z]/g, '')
  if (letters.length < 2) return false
  const upperRatio = (line.replace(/[^A-Z]/g, '').length) / letters.length
  return upperRatio > 0.60
}

// ── Bet type normalization ────────────────────────────────────────────────────

function normaliseBetType(raw: string): string {
  const r = raw.trim()
  const u = r.toUpperCase()
  // Asian book abbreviations first
  if (/^FT\.HDP$|^FH\.HDP$|^HDP$|^AHC?$/.test(u)) {
    return /FH\./i.test(r) ? 'Handicap (1H)' : 'Handicap'
  }
  if (/^FT\.OU$|^FH\.OU$|^OU$|^O\/U$/.test(u)) {
    return /FH\./i.test(r) ? 'Over/Under (1H)' : 'Over/Under'
  }
  if (/^FT\.1X2$|^1X2$/.test(u)) return 'Match Result (1X2)'
  if (/^OE$/.test(u)) return 'Odd/Even'
  if (/^ML$/.test(u)) return 'Moneyline'
  // Full name variants
  if (/asian\s*handicap|^asian$/i.test(r)) return 'Handicap'
  if (/over.?under/i.test(r))       return 'Over/Under'
  if (/btts|both\s*teams|^gg$/i.test(r)) return 'BTTS'
  if (/1x2|match\s*result/i.test(r)) return 'Match Result (1X2)'
  if (/correct\s*score/i.test(r))   return 'Correct Score'
  if (/double\s*chance/i.test(r))   return 'Double Chance'
  return r
}

// ── Single-leg parser ─────────────────────────────────────────────────────────

// Separator pattern — OCR frequently turns : into . ; , or |
const SEP = /\s*[:.;,|\/]\s*/

function parseLeg(lines: string[]): ParlayLeg | null {
  if (lines.length < 1) return null

  const leagueRaw = lines[0] ?? ''
  const league = mapLeague(leagueRaw)

  // Match: various separators between teams
  let match: string | undefined
  const matchPatterns = [
    /([A-Za-zÀ-ÿ0-9 .'&()]{2,40})\s*-[Vv][Ss5]-\s*([A-Za-zÀ-ÿ0-9 .'&()]{2,40})/,
    /([A-Za-zÀ-ÿ0-9 .'&()]{2,40})\s+[Vv][Ss5]\.?\s+([A-Za-zÀ-ÿ0-9 .'&()]{2,40})/,
    /([A-Za-zÀ-ÿ0-9 .'&()]{2,40})\s+—\s+([A-Za-zÀ-ÿ0-9 .'&()]{2,40})/,
    // Plain dash: "Arsenal - Chelsea" (with spaces around dash)
    /([A-Za-zÀ-ÿ0-9 .'&()]{2,40})\s+-\s+([A-Za-zÀ-ÿ0-9 .'&()]{2,40})/,
  ]

  // Team name lines: capitalized words, no digits, 2–40 chars — looks like a team name
  const isTeamLine = (line: string) =>
    line.length >= 2 && line.length <= 40 &&
    !/\d/.test(line) &&
    !/^(type|bet|odds|date|time|est|running|won|lost|void|half|status|mix|parlay|payout|amount|stake)\b/i.test(line) &&
    /[A-Za-zÀ-ÿ]{2}/.test(line)

  const bodyLines = lines.slice(1)
  for (const line of bodyLines) {
    if (/^(type|bet|odds|date|time|est)\s*[:.;,|\/]/i.test(line)) break
    for (const re of matchPatterns) {
      const m = line.match(re)
      if (m) { match = `${m[1].trim()} vs ${m[2].trim()}`; break }
    }
    if (match) break
  }

  // Fallback: consecutive lines that look like team names (SBOBET puts each team on its own line)
  if (!match) {
    for (let i = 0; i < bodyLines.length - 1; i++) {
      const a = bodyLines[i].trim()
      const b = bodyLines[i + 1].trim()
      if (/^(type|bet|odds|date|time|est)\s*[:.;,|\/]/i.test(a)) break
      if (isTeamLine(a) && isTeamLine(b) && a !== b) {
        match = `${a} vs ${b}`
        break
      }
    }
  }

  // Bet type + prediction + odds
  let betType = 'Other'
  let prediction = ''
  let odds: number | undefined

  for (let j = 0; j < lines.length; j++) {
    const line = lines[j]

    // Skip status tokens
    if (/^(running|won|lost|void|half\s+won|half\s+lost|cancelled|refund)\b/i.test(line)) continue

    // "Type : FT.HDP   Arsenal -0.5" or "Type : Asian Handicap  Odds : 1.98"
    // Capture up to two words separated by a SINGLE space (stops before double-space separator)
    const typeLine = line.match(/type\s*[:.;,|\/]\s*([A-Za-z0-9._/]+(?: [A-Za-z0-9._/]+)?)(?:\s{2,}(.+))?/i)
    if (typeLine) {
      betType = normaliseBetType(typeLine[1])
      if (typeLine[2] && !prediction) {
        const pick = typeLine[2].trim()
        if (!/^[\d,O. ]+$/.test(pick) && !/^odds\s*[:.;,|\/]/i.test(pick)) prediction = pick
      }
    }

    // "Bet : Over 2.5" or "Bet : Arsenal -0.5"
    const betLine = line.match(/^bet\s*[:.;,|\/]\s*(.+)/i)
    if (betLine && !prediction) {
      const pick = betLine[1].trim()
      if (!/^[\d,O. ]+$/.test(pick)) {
        prediction = pick
        // Peek at next line — SBOBET puts the line/handicap on the line after "Bet :"
        // e.g.  Bet : Over          → prediction so far: "Over"
        //        2.5 @ 1.83         → next line has the line value → append → "Over 2.5"
        // e.g.  Bet : Aston Villa   → prediction so far: "Aston Villa"
        //        -0.75 @ 2.03       → append handicap → "Aston Villa -0.75"
        const nextLine = lines[j + 1]?.trim() ?? ''
        if (nextLine && !/^(type|bet|odds|date|time|running|won|lost|void|half|est|payout)\b/i.test(nextLine)) {
          const supp = nextLine.match(/^([+-]?\d+(?:\.\d+)?)/)
          if (supp) {
            let val = supp[1]
            const numVal = parseFloat(val)
            // OCR frequently drops decimal points: "2.5"→"25", "0.75"→"75", "1.5"→"15"
            // Repair heuristic (type-aware — betType is already set from the "Type :" line above):
            //   O/U lines (1.5, 2.5, 3.5…): always ÷10 for 2-digit, ÷100 for 3-digit
            //   AH lines (0.25, 0.5, 0.75, 1.5…): multiples of 25 (25,50,75) → ÷100; others → ÷10
            if (Number.isInteger(numVal)) {
              const abs = Math.abs(numVal)
              const sign = numVal < 0 ? -1 : 1
              const isOU = /over.?under|\bou\b/i.test(betType)
              if (abs >= 10 && abs <= 99) {
                val = String(sign * (isOU || abs % 25 !== 0 ? abs / 10 : abs / 100))
              } else if (abs >= 100 && abs <= 950) {
                val = String(sign * abs / 100)
              }
            }
            prediction = `${prediction} ${val}`
          }
        }
      }
    }

    // Individual leg odds: "Odds : 1.85" / "Odds . 1.85"
    const oddsLine = line.match(/^odds\s*[:.;,|\/]\s*([\dO,. ]+)/i)
    if (oddsLine && !odds) {
      const v = toNum(oddsLine[1])
      if (v && v >= 1.01 && v <= 30) odds = v
    }

    // Inline "@" or "[odds]" notation
    const atStyle = line.match(/[@\[]\s*([\d.]+)\s*[\]]?/)
    if (atStyle && !odds) {
      const v = parseFloat(atStyle[1])
      if (v >= 1.01 && v <= 30) odds = v
    }
  }

  if (!match && !prediction) return null

  return { league, match: match ?? '', betType, prediction, odds: odds ?? 0 }
}

// ── Parlay splitting ──────────────────────────────────────────────────────────

function splitIntoLegs(lines: string[]): string[][] {
  let summaryIdx = lines.length
  for (let i = 0; i < lines.length; i++) {
    if (/^(bet\s+amount|est[.,]\s*\/?payout|total\s+odds|payout)/i.test(lines[i])) {
      summaryIdx = i
      break
    }
  }

  const betLines = lines.slice(0, summaryIdx)
  const legs: string[][] = []
  let cur: string[] = []

  for (const line of betLines) {
    if (isLeagueLine(line) && cur.length > 0) {
      legs.push(cur)
      cur = [line]
    } else {
      cur.push(line)
    }
  }
  if (cur.length > 0) legs.push(cur)

  return legs
}

// ── Date extraction helpers ───────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function tryParseDate(line: string): string | undefined {
  const now = new Date()
  const thisYear = now.getFullYear().toString()

  // YYYY-MM-DD (ISO) — check first to avoid mis-parsing year as day
  const iso = line.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // DD/MM/YYYY or DD/MM/YY — full date with year
  const dmy = line.match(/\b(\d{1,2})\/(\d{2})\/(\d{2,4})\b/)
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]
    return `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }

  // DD-MM-YYYY
  const dmyDash = line.match(/\b(\d{1,2})-(\d{2})-(\d{4})\b/)
  if (dmyDash) return `${dmyDash[3]}-${dmyDash[2].padStart(2, '0')}-${dmyDash[1].padStart(2, '0')}`

  // Labeled date — handles "Date : 19/04", "Date/Time : 19/04 5:43pm", "Date : Saturday, 08/04"
  // Matches any "Date..." prefix regardless of what's between Date and the numbers
  const labeledDM = line.match(/\bdate[^0-9\n]{0,30}?(\d{1,2})\/(\d{2})\b/i)
  if (labeledDM) {
    const a = parseInt(labeledDM[1]), b = parseInt(labeledDM[2])
    // If one > 12 it's unambiguously the day; otherwise assume DD/MM
    const day   = a > 12 ? a : b > 12 ? b : a
    const month = a > 12 ? b : b > 12 ? a : b
    return `${thisYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // DD Mon YYYY or Mon DD, YYYY (e.g. "02 May 2026" / "May 2, 2026")
  const wordDate = line.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i)
    ?? line.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i)
  if (wordDate) {
    const [, a, b, c] = wordDate
    if (/^\d/.test(a)) {
      const m = MONTHS[b.toLowerCase().slice(0, 3)]
      if (m) return `${c}-${m}-${a.padStart(2, '0')}`
    } else {
      const m = MONTHS[a.toLowerCase().slice(0, 3)]
      if (m) return `${c}-${m}-${b.padStart(2, '0')}`
    }
  }

  return undefined
}

// ── Footer: stake + combined odds + date ─────────────────────────────────────

function extractFooter(lines: string[]): { stake?: number; combinedOdds?: number; date?: string } {
  let stake: number | undefined
  let combinedOdds: number | undefined
  let estPayout: number | undefined
  let date: string | undefined
  let pastBetAmount = false

  for (const line of lines) {
    // Stake: "Bet Amount : 3,000" / "Bet Amount . 3,000" / "Stake : 100"
    if (/bet\s*amount/i.test(line) || /^(stake|amount|apuesta)\s*[:.;,|\/]/i.test(line)) {
      const m = line.match(/[:.;,|\/]\s*([\dO,. ]+?)(?:\s|$)/)
      if (m) {
        const v = toCurrency(m[1])
        if (v && v > 0) { stake = v; pastBetAmount = true }
      }
    }

    // Combined odds — only count the one AFTER Bet Amount (footer odds vs per-leg odds)
    if (pastBetAmount && /^odds\s*[:.;,|\/]/i.test(line)) {
      const m = line.match(/[:.;,|\/]\s*([\dO,. ]+)/)
      if (m) {
        const v = toNum(m[1])
        if (v && v > 1.01) combinedOdds = v
      }
    }

    // Total Odds label (alternative)
    if (/total\s*odds\s*[:.;,|\/]/i.test(line)) {
      const m = line.match(/[:.;,|\/]\s*([\dO,. ]+)/)
      if (m) {
        const v = toNum(m[1])
        if (v && v > 1.01) combinedOdds = v
      }
    }

    // Est. Payout — back-calculate combined odds if stake known
    if (/est[.,]\s*payout|est\s*payout/i.test(line)) {
      const m = line.match(/[:.;,|\/]\s*([\dO,. ]+)/)
      if (m) {
        const v = toCurrency(m[1])
        if (v && v > 0) estPayout = v
      }
    }

    // Date extraction — try on every line, prefer lines with "Date" label
    if (!date) {
      const hasDateLabel = /\bdate\b/i.test(line)
      const parsed = tryParseDate(line)
      // Accept labelled lines always; unlabelled only if year is present (avoids false positives from scores)
      if (parsed && (hasDateLabel || /\d{4}/.test(line))) {
        date = parsed
      }
    }
  }

  // Back-calculate combined odds from payout if still missing
  if (!combinedOdds && stake && estPayout && estPayout > stake) {
    combinedOdds = parseFloat((estPayout / stake).toFixed(3))
    if (combinedOdds > 200) combinedOdds = undefined // sanity check
  }

  return { stake, combinedOdds, date }
}

// ── League detection for single bets ─────────────────────────────────────────

function detectLeague(text: string): string | undefined {
  for (const [re, name] of LEAGUE_MAP) {
    if (re.test(text)) return name
  }
  return undefined
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function parseBookmakerText(rawText: string): ParsedBet {
  // Normalize OCR artifacts: collapse whitespace runs, strip carriage returns
  const cleaned = rawText
    .replace(/\r/g, '')
    .replace(/[ \t]{3,}/g, '  ')  // keep double-space (used as field separator)
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)
  const fullText = lines.join(' ')

  const isParlay =
    /mix\s*par[il]a[iy]/i.test(fullText) ||   // "Mix Parlay" + OCR variants "Pariay"
    /accumulator|acca|combo\s*bet/i.test(fullText) ||
    lines.filter(isLeagueLine).length >= 2

  if (isParlay) {
    const legGroups = splitIntoLegs(lines)
    const legs = legGroups.map(parseLeg).filter((l): l is ParlayLeg => l !== null)
    const { stake, combinedOdds, date } = extractFooter(lines)

    const firstLeague = legs[0]?.league ?? detectLeague(fullText) ?? 'Other'

    return {
      match: 'Mix Parlay',
      league: firstLeague,
      betType: 'Mix Parlay',
      prediction: legs.map(l => `${l.match || l.league} — ${l.prediction}`).join(' / '),
      odds: combinedOdds,
      stake,
      isParlay: true,
      legs,
      date,
    }
  }

  // ── Single bet ──────────────────────────────────────────────────────────────
  const { stake, combinedOdds, date } = extractFooter(lines)

  // Match
  let match: string | undefined
  const matchPatterns = [
    /([A-Za-zÀ-ÿ0-9 .'&]{2,35})\s*-[Vv][Ss5]-\s*([A-Za-zÀ-ÿ0-9 .'&]{2,35})/,
    /([A-Za-zÀ-ÿ0-9 .'&]{2,35})\s+[Vv][Ss5]\.?\s+([A-Za-zÀ-ÿ0-9 .'&]{2,35})/,
    /([A-Za-zÀ-ÿ0-9 .'&]{2,35})\s+—\s+([A-Za-zÀ-ÿ0-9 .'&]{2,35})/,
    /([A-Za-zÀ-ÿ0-9 .'&]{2,35})\s+-\s+([A-Za-zÀ-ÿ0-9 .'&]{2,35})/,
  ]
  const isTeamNameLine = (l: string) =>
    l.length >= 2 && l.length <= 40 &&
    !/\d/.test(l) &&
    !/^(type|bet|odds|date|time|est|running|won|lost|void|half|status|mix|parlay|payout|amount|stake)\b/i.test(l) &&
    /[A-Za-zÀ-ÿ]{2}/.test(l)

  for (const line of lines) {
    if (/date|time|type|odds|bet\s*[:.;,|\/]|amount|payout|https?/i.test(line)) continue
    for (const re of matchPatterns) {
      const m = line.match(re)
      if (m) { match = `${m[1].trim()} vs ${m[2].trim()}`; break }
    }
    if (match) break
  }

  // Fallback: two consecutive team-name lines
  if (!match) {
    const candidates = lines.filter(l => !/date|time|type|odds|bet\s*[:.;,|\/]|amount|payout|https?/i.test(l))
    for (let i = 0; i < candidates.length - 1; i++) {
      const a = candidates[i].trim(), b = candidates[i + 1].trim()
      if (isTeamNameLine(a) && isTeamNameLine(b) && a !== b) {
        match = `${a} vs ${b}`; break
      }
    }
  }

  // Odds
  let odds: number | undefined = combinedOdds
  if (!odds) {
    for (const line of lines) {
      const labeled = line.match(/odds\s*[:.;,|\/]\s*([\dO,. ]+)/i)
      if (labeled) {
        const v = toNum(labeled[1])
        if (v && v >= 1.01 && v <= 30) { odds = v; break }
      }
      const atStyle = line.match(/[@\[]\s*([\d.]+)/)
      if (atStyle) {
        const v = parseFloat(atStyle[1])
        if (v >= 1.01 && v <= 30) { odds = v; break }
      }
    }
  }

  // Bet type + prediction
  let betType: string | undefined
  let prediction: string | undefined
  for (const line of lines) {
    if (!betType) {
      const typeLine = line.match(/type\s*[:.;,|\/]\s*([A-Za-z0-9._/]+)/i)
      if (typeLine) betType = normaliseBetType(typeLine[1])
    }
    if (!prediction) {
      const betLine = line.match(/^bet\s*[:.;,|\/]\s*(.+)/i)
      if (betLine) {
        const pick = betLine[1].trim()
        if (!/^[\d,O. ]+$/.test(pick)) prediction = pick
      }
    }
  }

  return {
    match,
    league: detectLeague(fullText),
    betType,
    prediction,
    odds,
    stake,
    isParlay: false,
    date,
  }
}
