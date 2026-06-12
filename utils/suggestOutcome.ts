import type { LegResult } from '@/types/bet'

export type Suggestion = LegResult | 'manual'

export interface OutcomeSuggestion {
  suggestion: Suggestion
  label: string   // short human-readable reason
  confident: boolean // false = handicap / unknown → manual preferred
}

// ── Asian Handicap resolver ───────────────────────────────────────────────────

function roundToHalfBall(h: number, direction: 'down' | 'up'): number {
  const doubled = h * 2
  return direction === 'down' ? Math.floor(doubled) / 2 : Math.ceil(doubled) / 2
}

function halfBallResult(rawDiff: number, line: number): LegResult {
  const adj = rawDiff + line
  return adj > 0 ? 'win' : adj === 0 ? 'void' : 'loss'
}

function resolveAH(rawDiff: number, handicapLine: number): LegResult {
  const isQuarterBall = Math.round(Math.abs(handicapLine) * 4) % 2 === 1
  if (!isQuarterBall) return halfBallResult(rawDiff, handicapLine)

  // Quarter-ball = average of two adjacent half-ball lines
  const line1 = roundToHalfBall(handicapLine, 'down')
  const line2 = roundToHalfBall(handicapLine, 'up')
  const r1 = halfBallResult(rawDiff, line1)
  const r2 = halfBallResult(rawDiff, line2)

  if (r1 === 'win' && r2 === 'win') return 'win'
  if (r1 === 'loss' && r2 === 'loss') return 'loss'
  if (r1 === 'win' || r2 === 'win') return 'half-win'
  if (r1 === 'loss' || r2 === 'loss') return 'half-loss'
  return 'void'
}

function normTeam(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(fc|sc|cf|ac|as|rc|cd|afc|bsc|vfb|vfl|rb|sv|hsv|united|city|athletic|club|de|la|le|el|al)\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function suggestOutcome(
  betType: string,
  prediction: string,
  score: { home: number; away: number },
  teams?: { home: string; away: string },
): OutcomeSuggestion {
  const bt = betType.toLowerCase()
  const pred = prediction.toLowerCase().trim()
  const { home, away } = score
  const total = home + away

  // ── Over / Under (same split-line maths as Asian Handicap) ──────────────────
  // Over 2.25 = 50% Over 2.0 + 50% Over 2.5  →  identical to AH quarter-ball
  // Over N  → resolveAH(total, -N)   [adj = total - N; WIN if >0, VOID if 0, LOSS if <0]
  // Under N → resolveAH(-total, N)   [adj = N - total; WIN if >0, VOID if 0, LOSS if <0]
  const ouMatch = pred.match(/(?:^|\s)(over|under)\s*([\d.]+)/i)
  if (ouMatch || bt.includes('over/under') || bt.includes('ou')) {
    const dir = ouMatch?.[1].toLowerCase() ?? (pred.includes('over') ? 'over' : 'under')
    const lineMatch = pred.match(/([\d.]+)/)
    let line = lineMatch ? parseFloat(lineMatch[1]) : null
    // OCR decimal repair: soccer O/U lines are always < 10; integer ≥10 means a dropped decimal point
    if (line !== null && Number.isInteger(line) && line >= 10) {
      if (line <= 95) line = line / 10
      else if (line <= 950) line = line / 100
    }
    if (line !== null) {
      const rawDiff = dir === 'over' ? total : -total
      const hdpLine = dir === 'over' ? -line : line
      const result = resolveAH(rawDiff, hdpLine)
      return { suggestion: result, label: `${total} goals (${dir} ${line})`, confident: true }
    }
  }

  // ── BTTS ─────────────────────────────────────────────────────────────────────
  if (bt.includes('btts') || bt.includes('both teams')) {
    const btts = home > 0 && away > 0
    const predYes = pred.includes('yes') || (!pred.includes('no') && pred.includes('both'))
    const won = predYes ? btts : !btts
    return { suggestion: won ? 'win' : 'loss', label: btts ? 'Both scored' : 'Not both', confident: true }
  }

  // ── Match Result 1X2 ─────────────────────────────────────────────────────────
  if (bt.includes('1x2') || bt.includes('match result')) {
    const isHome = pred === '1' || pred.startsWith('1 ') || pred.startsWith('home')
    const isDraw = pred === 'x' || pred.includes('draw') || pred === 'x (draw)'
    const isAway = pred === '2' || pred.startsWith('2 ') || pred.startsWith('away')
    if (isHome) return { suggestion: home > away ? 'win' : 'loss', label: `${home}–${away}`, confident: true }
    if (isDraw) return { suggestion: home === away ? 'win' : 'loss', label: `${home}–${away}`, confident: true }
    if (isAway) return { suggestion: away > home ? 'win' : 'loss', label: `${home}–${away}`, confident: true }
  }

  // ── Double Chance ─────────────────────────────────────────────────────────────
  if (bt.includes('double chance')) {
    if (pred.includes('1') && pred.includes('x')) return { suggestion: home >= away ? 'win' : 'loss', label: `${home}–${away}`, confident: true }
    if (pred.includes('x') && pred.includes('2')) return { suggestion: away >= home ? 'win' : 'loss', label: `${home}–${away}`, confident: true }
    if (pred.includes('1') && pred.includes('2')) return { suggestion: home !== away ? 'win' : 'loss', label: `${home}–${away}`, confident: true }
  }

  // ── Asian Handicap ────────────────────────────────────────────────────────────
  if (bt.includes('asian') || bt.includes('handicap') || bt === 'hdp' || bt === 'ah') {
    // Extract handicap line from prediction, e.g. "Arsenal (-0.5)", "Arsenal -1", "Arsenal 0"
    const hdpMatch = pred.match(/\(?\s*([+-]?\d+(?:\.\d+)?)\s*\)?$/)
    let handicapLine = hdpMatch ? parseFloat(hdpMatch[1]) : null
    // OCR decimal repair: AH lines are always ≤ ±4; integer ≥10 means decimal was dropped
    if (handicapLine !== null && Number.isInteger(handicapLine)) {
      const abs = Math.abs(handicapLine); const sign = handicapLine < 0 ? -1 : 1
      if (abs >= 10 && abs <= 99)   handicapLine = sign * (abs % 25 === 0 ? abs / 100 : abs / 10)
      else if (abs >= 100 && abs <= 950) handicapLine = sign * abs / 100
    }

    // Determine which team was picked (home or away)
    let pickedIsHome: boolean | null = null
    if (teams) {
      const normHome = normTeam(teams.home)
      const normAway = normTeam(teams.away)
      // Extract just the team-name portion of prediction (strip handicap suffix)
      const predTeam = normTeam(pred.replace(/\(?\s*[+-]?\d+(?:\.\d+)?\s*\)?$/, '').trim())
      if (predTeam) {
        const homeMatch = normHome.includes(predTeam) || predTeam.includes(normHome) ||
          normHome.split(' ').some(w => w.length > 3 && predTeam.includes(w)) ||
          predTeam.split(' ').some(w => w.length > 3 && normHome.includes(w))
        const awayMatch = normAway.includes(predTeam) || predTeam.includes(normAway) ||
          normAway.split(' ').some(w => w.length > 3 && predTeam.includes(w)) ||
          predTeam.split(' ').some(w => w.length > 3 && normAway.includes(w))
        if (homeMatch && !awayMatch) pickedIsHome = true
        else if (awayMatch && !homeMatch) pickedIsHome = false
      }
    }

    if (pickedIsHome === null) {
      return { suggestion: 'manual', label: `${home}–${away} · check handicap`, confident: false }
    }

    const pickedScore = pickedIsHome ? home : away
    const oppScore = pickedIsHome ? away : home
    const rawDiff = pickedScore - oppScore
    const line = handicapLine ?? 0  // default to level ball if no handicap found
    const result = resolveAH(rawDiff, line)
    const hdpStr = line === 0 ? '(level)' : `(${line > 0 ? '+' : ''}${line})`

    return { suggestion: result, label: `${home}–${away} AH${hdpStr}`, confident: true }
  }

  // ── Fallback ──────────────────────────────────────────────────────────────────
  return { suggestion: 'manual', label: `${home}–${away} · check bet type`, confident: false }
}
