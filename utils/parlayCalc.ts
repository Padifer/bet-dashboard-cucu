import { ParlayLeg, LegResult, BetResult } from '@/types/bet'

/**
 * Asian Mix Parlay settlement rules (SBOBET/glm77 family):
 *
 *   Win       → leg multiplies parlay by its full odds
 *   Half Win  → leg multiplies parlay by ((odds - 1) * 0.5) + 1
 *   Void      → leg contributes ×1 (neutral — doesn't kill nor boost)
 *   Half Loss → leg contributes ×0.5 (you get back half the running stake)
 *   Full Loss → ENTIRE parlay loses, no return at all
 *   Pending   → treated as full win for "max potential" display
 */

export interface ParlaySettlement {
  effectiveOdds: number  // combined multiplier applied to stake
  payout: number         // gross return (stake × effectiveOdds)
  profit: number         // net profit (payout - stake)
  result: BetResult
  settledCount: number
  totalLegs: number
}

export function legMultiplier(leg: ParlayLeg, treatPendingAs: 'win' | 'skip' = 'win'): number | null {
  switch (leg.result) {
    case 'win':       return leg.odds
    case 'half-win':  return ((leg.odds - 1) * 0.5) + 1
    case 'void':      return 1
    case 'half-loss': return 0.5
    case 'loss':      return null   // signals full parlay loss
    case 'pending':
    case undefined:
      return treatPendingAs === 'win' ? leg.odds : 1
  }
}

export function calcParlay(legs: ParlayLeg[], stake: number): ParlaySettlement {
  const total = legs.length
  const settled = legs.filter(l => l.result && l.result !== 'pending').length

  // Any full-loss leg kills the whole parlay
  if (legs.some(l => l.result === 'loss')) {
    return { effectiveOdds: 0, payout: 0, profit: -stake, result: 'loss', settledCount: settled, totalLegs: total }
  }

  let effectiveOdds = 1
  for (const leg of legs) {
    const m = legMultiplier(leg, 'win')
    if (m === null) { effectiveOdds = 0; break }
    effectiveOdds *= m
  }

  const payout = parseFloat((stake * effectiveOdds).toFixed(2))
  const profit = parseFloat((payout - stake).toFixed(2))

  let result: BetResult = 'pending'
  const allSettled = settled === total
  if (allSettled) {
    if (effectiveOdds === 1) result = 'void'
    else if (profit >= 0)   result = 'win'
    else                    result = 'loss'
  }

  return { effectiveOdds: parseFloat(effectiveOdds.toFixed(4)), payout, profit, result, settledCount: settled, totalLegs: total }
}

/** Labels and colors for each leg result */
export const LEG_RESULT_META: Record<LegResult, { label: string; short: string; color: string; bg: string; border: string }> = {
  pending:    { label: 'Running',   short: '—',   color: '#ffd740',               bg: 'rgba(255,215,64,0.18)',  border: 'rgba(255,215,64,0.5)' },
  win:        { label: 'Win',       short: 'W',   color: 'var(--color-win)',       bg: 'rgba(0,230,118,0.12)',   border: 'rgba(0,230,118,0.3)' },
  'half-win': { label: 'Half Win',  short: '½W',  color: '#4ade80',               bg: 'rgba(74,222,128,0.15)',  border: 'rgba(74,222,128,0.4)' },
  'half-loss':{ label: 'Half Loss', short: '½L',  color: '#fb923c',               bg: 'rgba(251,146,60,0.15)',  border: 'rgba(251,146,60,0.4)' },
  loss:       { label: 'Loss',      short: 'L',   color: 'var(--color-loss)',      bg: 'rgba(255,61,113,0.12)',  border: 'rgba(255,61,113,0.3)' },
  void:       { label: 'Void',      short: 'V',   color: '#cbd5e1',               bg: 'rgba(100,116,139,0.28)', border: 'rgba(100,116,139,0.55)' },
}
