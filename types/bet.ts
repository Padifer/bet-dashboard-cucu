export type BetResult = 'win' | 'loss' | 'void' | 'pending'
export type BetPicker = 'pablo' | 'alberto' | 'both'
export type BetFunder = 'bank' | 'pablo' | 'alberto'

// Per-leg results for Asian handicap Mix Parlay settlement
export type LegResult = 'pending' | 'win' | 'half-win' | 'loss' | 'half-loss' | 'void'

export interface ParlayLeg {
  league: string
  match: string
  betType: string
  prediction: string
  odds: number
  result?: LegResult
}

export interface Bet {
  legs?: ParlayLeg[]
  id: string
  date: string
  match: string
  league: string
  betType: string
  prediction: string
  odds: number
  stake: number
  result: BetResult
  profit: number
  picker?: BetPicker
  fundedBy?: BetFunder
  notes?: string
  bookmaker?: string
  myProb?: number      // estimated win probability (0–1) — used to compute EV
  closingOdds?: number // odds at market close, for "beat the close" tracking
  cashOut?: number     // gross amount received on early cash-out
  slipUrl?: string     // URL of attached betting slip image
}

export interface BetStats {
  totalStake: number
  totalReturns: number
  netProfit: number
  roi: number
  wins: number
  losses: number
  voids: number
  pending: number
  total: number
  currentStreak: number
  currentStreakType: 'win' | 'loss' | null
  pabloStats: { wins: number; losses: number; roi: number; profit: number; avgOdds: number }
  albertoStats: { wins: number; losses: number; roi: number; profit: number; avgOdds: number }
}

export interface CompetitionStat {
  league: string
  roi: number
  profit: number
  bets: number
  wins: number
}

export interface BetTypeROI {
  betType: string
  roi: number
  profit: number
  bets: number
  wins: number
}

export interface MonthlyPnL {
  month: string   // "Mar 26"
  profit: number
  bets: number
}
