'use client'
import { useState, useEffect } from 'react'
import { Bet, BetStats, CompetitionStat, BetTypeROI, MonthlyPnL } from '@/types/bet'
import { supabase } from '@/lib/supabase'

// ── Row mapping ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBet(r: any): Bet {
  return {
    id: r.id,
    date: r.date,
    match: r.match,
    league: r.league,
    betType: r.bet_type,
    prediction: r.prediction,
    odds: r.odds,
    stake: r.stake,
    result: r.result,
    profit: r.profit,
    picker: r.picker ?? undefined,
    fundedBy: r.funded_by ?? undefined,
    notes: r.notes ?? undefined,
    bookmaker: r.bookmaker ?? undefined,
    myProb: r.my_prob ?? undefined,
    closingOdds: r.closing_odds ?? undefined,
    cashOut: r.cash_out ?? undefined,
    slipUrl: r.slip_url ?? undefined,
    legs: r.legs ?? undefined,
  }
}

function betToRow(b: Omit<Bet, 'id'> | Partial<Bet>): Record<string, unknown> {
  const r: Record<string, unknown> = {}
  if (b.date       !== undefined) r.date         = b.date
  if (b.match      !== undefined) r.match        = b.match
  if (b.league     !== undefined) r.league       = b.league
  if (b.betType    !== undefined) r.bet_type     = b.betType
  if (b.prediction !== undefined) r.prediction   = b.prediction
  if (b.odds       !== undefined) r.odds         = b.odds
  if (b.stake      !== undefined) r.stake        = b.stake
  if (b.result     !== undefined) r.result       = b.result
  if (b.profit     !== undefined) r.profit       = b.profit
  if ('picker'      in b) r.picker        = b.picker      ?? null
  if ('fundedBy'    in b) r.funded_by     = b.fundedBy    ?? null
  if ('notes'       in b) r.notes         = b.notes       ?? null
  if ('bookmaker'   in b) r.bookmaker     = b.bookmaker   ?? null
  if ('myProb'      in b) r.my_prob       = b.myProb      ?? null
  if ('closingOdds' in b) r.closing_odds  = b.closingOdds ?? null
  if ('cashOut'     in b) r.cash_out      = b.cashOut     ?? null
  if ('slipUrl'     in b) r.slip_url      = b.slipUrl     ?? null
  if ('legs'        in b) r.legs          = b.legs        ?? null
  return r
}

// ── Stats helpers (unchanged logic) ───────────────────────────────────────────

function pickerStats(bets: Bet[], picker: 'pablo' | 'alberto') {
  let wins = 0, losses = 0, stake = 0, profit = 0
  for (const b of bets) {
    if (b.result !== 'win' && b.result !== 'loss') continue
    const share = b.picker === 'both' ? 0.5 : b.picker === picker ? 1 : 0
    if (share === 0) continue
    wins   += b.result === 'win'  ? share : 0
    losses += b.result === 'loss' ? share : 0
    stake  += b.stake  * share
    profit += b.profit * share
  }
  return {
    wins:   parseFloat(wins.toFixed(1)),
    losses: parseFloat(losses.toFixed(1)),
    roi:    stake > 0 ? (profit / stake) * 100 : 0,
    profit: parseFloat(profit.toFixed(2)),
  }
}

function computeStats(bets: Bet[]): BetStats {
  const settled = bets.filter(b => b.result !== 'pending' && b.result !== 'void')
  const wins    = bets.filter(b => b.result === 'win').length
  const losses  = bets.filter(b => b.result === 'loss').length
  const voids   = bets.filter(b => b.result === 'void').length
  const pending = bets.filter(b => b.result === 'pending').length
  const totalStake   = settled.reduce((s, b) => s + b.stake,  0)
  const netProfit    = settled.reduce((s, b) => s + b.profit, 0)
  const totalReturns = totalStake + netProfit
  const roi          = totalStake > 0 ? (netProfit / totalStake) * 100 : 0

  let currentStreak = 0
  let currentStreakType: 'win' | 'loss' | null = null
  const sorted = [...bets]
    .filter(b => b.result === 'win' || b.result === 'loss')
    .sort((a, b) => b.date.localeCompare(a.date))
  if (sorted.length > 0) {
    currentStreakType = sorted[0].result as 'win' | 'loss'
    for (const b of sorted) {
      if (b.result === currentStreakType) currentStreak++
      else break
    }
  }

  return {
    totalStake, totalReturns, netProfit, roi, wins, losses, voids, pending,
    total: bets.length, currentStreak, currentStreakType,
    pabloStats:  pickerStats(bets, 'pablo'),
    albertoStats: pickerStats(bets, 'alberto'),
  }
}

function computeRoiByCompetition(bets: Bet[]): CompetitionStat[] {
  const map = new Map<string, { stake: number; profit: number; wins: number; bets: number }>()
  for (const b of bets.filter(b => b.result !== 'pending' && b.result !== 'void')) {
    const cur = map.get(b.league) ?? { stake: 0, profit: 0, wins: 0, bets: 0 }
    map.set(b.league, { stake: cur.stake + b.stake, profit: cur.profit + b.profit, wins: cur.wins + (b.result === 'win' ? 1 : 0), bets: cur.bets + 1 })
  }
  return [...map.entries()]
    .map(([league, s]) => ({ league, roi: s.stake > 0 ? (s.profit / s.stake) * 100 : 0, profit: s.profit, bets: s.bets, wins: s.wins }))
    .sort((a, b) => b.roi - a.roi)
}

function computeRoiByBetType(bets: Bet[]): BetTypeROI[] {
  const map = new Map<string, { stake: number; profit: number; wins: number; bets: number }>()
  for (const b of bets.filter(b => b.result !== 'pending' && b.result !== 'void')) {
    const cur = map.get(b.betType) ?? { stake: 0, profit: 0, wins: 0, bets: 0 }
    map.set(b.betType, { stake: cur.stake + b.stake, profit: cur.profit + b.profit, wins: cur.wins + (b.result === 'win' ? 1 : 0), bets: cur.bets + 1 })
  }
  return [...map.entries()]
    .map(([betType, s]) => ({ betType, roi: s.stake > 0 ? (s.profit / s.stake) * 100 : 0, profit: s.profit, bets: s.bets, wins: s.wins }))
    .sort((a, b) => b.roi - a.roi)
}

function computeMonthlyPnL(bets: Bet[]): MonthlyPnL[] {
  const map = new Map<string, { profit: number; bets: number; label: string }>()
  for (const b of bets.filter(b => b.result !== 'pending' && b.result !== 'void')) {
    const d     = new Date(b.date)
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en', { month: 'short', year: '2-digit' })
    const cur   = map.get(key) ?? { profit: 0, bets: 0, label }
    map.set(key, { ...cur, profit: parseFloat((cur.profit + b.profit).toFixed(2)), bets: cur.bets + 1 })
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ month: v.label, profit: v.profit, bets: v.bets }))
}

export interface OddsBand {
  label: string
  bets: number
  wins: number
  roi: number
  profit: number
}

export interface DailyPnL {
  day: string   // 'MM/DD'
  profit: number
  bets: number
}

function computeOddsBands(bets: Bet[]): OddsBand[] {
  const BANDS = [
    { label: '1-2', min: 1, max: 2 },
    { label: '2-5', min: 2, max: 5 },
    { label: '5-15', min: 5, max: 15 },
    { label: '15+', min: 15, max: Infinity },
  ]
  return BANDS.map(({ label, min, max }) => {
    const settled = bets.filter(b =>
      b.odds >= min && b.odds < max &&
      (b.result === 'win' || b.result === 'loss')
    )
    const wins = settled.filter(b => b.result === 'win').length
    const stake = settled.reduce((s, b) => s + b.stake, 0)
    const profit = settled.reduce((s, b) => s + b.profit, 0)
    return { label, bets: settled.length, wins, roi: stake > 0 ? (profit / stake) * 100 : 0, profit }
  }).filter(b => b.bets > 0)
}

function computeDailyPnL(bets: Bet[]): DailyPnL[] {
  const map = new Map<string, { profit: number; bets: number }>()
  for (const b of bets.filter(b => b.result !== 'pending' && b.result !== 'void')) {
    const key = b.date
    const cur = map.get(key) ?? { profit: 0, bets: 0 }
    map.set(key, { profit: parseFloat((cur.profit + b.profit).toFixed(2)), bets: cur.bets + 1 })
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day: day.slice(5).replace('-', '/'), profit: v.profit, bets: v.bets }))
}

// ── Hook ───────────────────────────────────────────────────────────────────────

const BANKROLL_KEY = 'bet-dashboard-bankroll-start'

async function fetchBets(): Promise<Bet[]> {
  const { data } = await supabase.from('bets_cucu').select('*').order('date', { ascending: true })
  return (data ?? []).map(rowToBet)
}

export function useBets() {
  const [bets, setBets]                   = useState<Bet[]>([])
  const [loaded, setLoaded]               = useState(false)
  const [bankrollStart, setBankrollStartState] = useState(0)
  const [channelName]                     = useState(() => `bets-rt-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    fetchBets().then(data => { setBets(data); setLoaded(true) })

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets_cucu' }, () => {
        fetchBets().then(setBets)
      })
      .subscribe()

    const saved = localStorage.getItem(BANKROLL_KEY)
    if (saved) setBankrollStartState(parseFloat(saved))

    return () => { supabase.removeChannel(channel) }
  }, [channelName])

  const setBankrollStart = (amount: number) => {
    setBankrollStartState(amount)
    localStorage.setItem(BANKROLL_KEY, String(amount))
  }

  const addBet = async (bet: Omit<Bet, 'id'>) => {
    const { data } = await supabase.from('bets_cucu').insert(betToRow(bet)).select().single()
    if (data) setBets(prev => [...prev, rowToBet(data)])
  }

  const deleteBet = async (id: string) => {
    setBets(prev => prev.filter(b => b.id !== id))
    await supabase.from('bets_cucu').delete().eq('id', id)
  }

  const updateBet = async (id: string, updates: Partial<Bet>) => {
    setBets(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
    await supabase.from('bets_cucu').update(betToRow(updates)).eq('id', id)
  }

  const settleBet = async (id: string, result: 'win' | 'loss' | 'void') => {
    const bet = bets.find(b => b.id === id)
    if (!bet) return
    const profit = result === 'win'  ? parseFloat(((bet.stake * bet.odds) - bet.stake).toFixed(2))
                 : result === 'loss' ? -bet.stake
                 : 0
    await updateBet(id, { result, profit })
  }

  const stats = computeStats(bets)

  const bankrollData = (() => {
    const settled = [...bets]
      .filter(b => b.result !== 'pending' && b.result !== 'void')
      .sort((a, b) => a.date.localeCompare(b.date))
    let cumulative = bankrollStart
    return settled.map(b => {
      cumulative += b.profit
      return { date: b.date, profit: parseFloat(cumulative.toFixed(2)), match: b.match }
    })
  })()

  return {
    bets, addBet, deleteBet, updateBet, settleBet, loaded, stats, bankrollData,
    roiByCompetition: computeRoiByCompetition(bets),
    roiByBetType:     computeRoiByBetType(bets),
    monthlyPnL:       computeMonthlyPnL(bets),
    oddsBandData:     computeOddsBands(bets),
    dailyPnL:         computeDailyPnL(bets),
    bankrollStart, setBankrollStart,
  }
}
