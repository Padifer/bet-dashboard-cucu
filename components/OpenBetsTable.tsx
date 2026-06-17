'use client'
import { Bet } from '@/types/bet'
import { fmt } from '@/utils/currency'

interface Props { bets: Bet[] }

const COL_STYLE: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: 'rgba(240,235,224,0.3)',
  whiteSpace: 'nowrap', padding: '7px 16px',
}

export default function OpenBetsTable({ bets }: Props) {
  const pending = bets.filter(b => b.result === 'pending')
  if (pending.length === 0) return null

  return (
    <div style={{
      background: '#223022',
      border: '1px solid rgba(240,235,224,0.07)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '11px 16px 10px', borderBottom: '1px solid rgba(240,235,224,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,235,224,0.35)' }}>
          Open Bets
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, background: 'rgba(232,92,42,0.15)',
          color: '#E85C2A', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.06em',
        }}>
          {pending.length}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(240,235,224,0.06)' }}>
              <th style={{ ...COL_STYLE, textAlign: 'left' }}>Match / Pick</th>
              <th style={{ ...COL_STYLE, textAlign: 'right' }}>Stake</th>
              <th style={{ ...COL_STYLE, textAlign: 'right' }}>Odds</th>
              <th style={{ ...COL_STYLE, textAlign: 'right' }}>Win</th>
              <th style={{ ...COL_STYLE, textAlign: 'right' }}>Profit</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((bet, i) => {
              const win = bet.stake * bet.odds
              const profit = win - bet.stake
              return (
                <tr key={bet.id} style={{
                  borderBottom: i < pending.length - 1 ? '1px solid rgba(240,235,224,0.04)' : 'none',
                }}>
                  <td style={{ padding: '8px 16px', maxWidth: 260 }}>
                    <div style={{
                      fontWeight: 600, color: '#F0EBE0', fontSize: 12,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240,
                    }}>
                      {bet.match}
                    </div>
                    <div style={{
                      fontSize: 10, color: 'rgba(240,235,224,0.38)', marginTop: 1,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240,
                    }}>
                      {bet.prediction}
                    </div>
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', color: 'rgba(240,235,224,0.6)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(bet.stake)}
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', color: 'rgba(240,235,224,0.6)', fontVariantNumeric: 'tabular-nums' }}>
                    {bet.odds.toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', color: '#6EC200', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(win)}
                  </td>
                  <td style={{ padding: '8px 16px', textAlign: 'right', color: '#6EC200', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    +{fmt(profit)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
