'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Bet } from '@/types/bet'
import { BankTransaction } from '@/types/bank'

type Status = 'idle' | 'running' | 'done' | 'error'

function betToRow(b: Bet) {
  return {
    id:           b.id,
    date:         b.date,
    match:        b.match,
    league:       b.league,
    bet_type:     b.betType,
    prediction:   b.prediction,
    odds:         b.odds,
    stake:        b.stake,
    result:       b.result,
    profit:       b.profit,
    picker:       b.picker       ?? null,
    funded_by:    b.fundedBy     ?? null,
    notes:        b.notes        ?? null,
    bookmaker:    b.bookmaker    ?? null,
    my_prob:      b.myProb       ?? null,
    closing_odds: b.closingOdds  ?? null,
    cash_out:     b.cashOut      ?? null,
    legs:         b.legs         ?? null,
  }
}

function txToRow(t: BankTransaction) {
  return {
    id:           t.id,
    type:         t.type,
    amount:       t.amount,
    person:       t.person,
    debt_creditor: t.debtCreditor ?? null,
    group_id:     t.groupId       ?? null,
    note:         t.note          ?? null,
    created_at:   t.createdAt,
  }
}

export default function MigratePage() {
  const [status, setStatus]   = useState<Status>('idle')
  const [log, setLog]         = useState<string[]>([])
  const [betsCount, setBetsCount]   = useState(0)
  const [txCount,   setTxCount]     = useState(0)

  const push = (msg: string) => setLog(prev => [...prev, msg])

  async function migrate() {
    setStatus('running')
    setLog([])

    try {
      // ── Bets ────────────────────────────────────────────────────────────────
      const rawBets = localStorage.getItem('bet-dashboard-v1')
      if (rawBets) {
        const bets: Bet[] = JSON.parse(rawBets)
        push(`Found ${bets.length} bets in localStorage`)
        const rows = bets.map(betToRow)
        const { error } = await supabase.from('bets_cucu').upsert(rows, { onConflict: 'id' })
        if (error) throw new Error(`Bets error: ${error.message}`)
        setBetsCount(bets.length)
        push(`✓ ${bets.length} bets uploaded`)
      } else {
        push('No bets found in localStorage')
      }

      // ── Bank transactions ────────────────────────────────────────────────────
      const rawBank = localStorage.getItem('bet-dashboard-bank-v1')
      if (rawBank) {
        const txs: BankTransaction[] = JSON.parse(rawBank)
        push(`Found ${txs.length} bank transactions in localStorage`)
        const rows = txs.map(txToRow)
        const { error } = await supabase.from('bank_transactions_cucu').upsert(rows, { onConflict: 'id' })
        if (error) throw new Error(`Transactions error: ${error.message}`)
        setTxCount(txs.length)
        push(`✓ ${txs.length} transactions uploaded`)
      } else {
        push('No bank transactions found in localStorage')
      }

      push('Migration complete!')
      setStatus('done')
    } catch (err) {
      push(`Error: ${(err as Error).message}`)
      setStatus('error')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: 24, gap: 24,
    }}>
      <div className="glass-card" style={{ maxWidth: 500, width: '100%', padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          LocalStorage → Supabase Migration
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 24 }}>
          Run this once on the device that has your existing data. It will copy all bets and bank transactions to the shared database.
        </p>

        {status === 'idle' && (
          <button className="btn-primary" onClick={migrate}
            style={{ width: '100%', padding: '12px 0', fontSize: 15 }}>
            Start Migration
          </button>
        )}

        {status === 'running' && (
          <div style={{ color: 'var(--color-muted)', fontSize: 14 }}>Running…</div>
        )}

        {log.length > 0 && (
          <div style={{
            marginTop: 20, background: 'rgba(0,0,0,0.2)', borderRadius: 10,
            padding: '12px 16px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {log.map((l, i) => (
              <div key={i} style={{ color: l.startsWith('✓') ? 'var(--color-win)' : l.startsWith('Error') ? 'var(--color-loss)' : 'var(--color-text)' }}>
                {l}
              </div>
            ))}
          </div>
        )}

        {status === 'done' && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 700, color: 'var(--color-win)' }}>
              {betsCount} bets · {txCount} transactions migrated
            </div>
            <a href="/" style={{ display: 'block', marginTop: 16, color: 'var(--color-accent)', fontSize: 14 }}>
              Go to dashboard →
            </a>
          </div>
        )}

        {status === 'error' && (
          <div style={{ marginTop: 20 }}>
            <div style={{ color: 'var(--color-loss)', fontWeight: 700 }}>Migration failed — check the log above.</div>
            <button className="btn-primary" onClick={migrate}
              style={{ marginTop: 12, width: '100%', padding: '10px 0' }}>
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
