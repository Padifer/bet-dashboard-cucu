export const CURRENCY_SYMBOL = '$'

/**
 * Format a USD amount: $3,000  /  $3,000.50  /  +$14,627.34
 * Uses comma thousands and dot decimal. Trailing zeros are dropped.
 * Pass maxDecimals to force more precision (e.g. 4 for odds-derived values).
 */
export function fmt(amount: number, maxDecimals = 2): string {
  const abs = Math.abs(amount)
  // Adaptive: show decimals only when present
  const d = Number.isInteger(abs) ? 0 : Math.min(
    maxDecimals,
    // count actual decimal digits up to maxDecimals
    (abs.toFixed(maxDecimals).replace(/\.?0+$/, '').split('.')[1]?.length ?? 0)
  )
  return CURRENCY_SYMBOL + abs.toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: maxDecimals,
  })
}

/** With explicit +/- sign for P&L display */
export function fmtPnL(amount: number, maxDecimals = 2): string {
  return (amount >= 0 ? '+' : '−') + fmt(Math.abs(amount), maxDecimals)
}

/** Short axis label: $3K, $50K, $1.5M */
export function fmtK(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000)    return `${sign}$${(abs / 1_000).toFixed(0)}K`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}
