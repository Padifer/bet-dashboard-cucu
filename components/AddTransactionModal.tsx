'use client'
import { useState } from 'react'
import { BankTransaction, TransactionPerson, TransactionType } from '@/types/bank'
import { fmt } from '@/utils/currency'

interface Props {
  onClose: () => void
  onAdd: (tx: Omit<BankTransaction, 'id'>) => void
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, color: 'var(--color-muted)',
  fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6,
}

function localNow() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function newGroupId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

type PersonOption = TransactionPerson | 'Both'
type TabType = 'deposit' | 'withdrawal' | 'debt'

export default function AddTransactionModal({ onClose, onAdd }: Props) {
  const [tab, setTab] = useState<TabType>('deposit')
  const [person, setPerson] = useState<PersonOption>('Both')
  const [debtor, setDebtor] = useState<TransactionPerson>('Pablo')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [datetime, setDatetime] = useState(localNow)

  const amtNum = parseFloat(amount)
  const isValid = Number.isFinite(amtNum) && amtNum > 0 && amtNum < 1_000_000_000
  const creditor: TransactionPerson = debtor === 'Pablo' ? 'Alberto' : 'Pablo'
  const isDebt = tab === 'debt'

  // Rounding-safe split: halfA + halfB always equals amtNum exactly (to the cent)
  const halfA = isValid ? Math.floor(amtNum * 100 / 2) / 100 : 0
  const halfB = isValid ? parseFloat((amtNum - halfA).toFixed(2)) : 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    const createdAt = new Date(datetime).toISOString()
    const noteVal = note.trim() || undefined

    if (isDebt) {
      onAdd({ type: 'debt', amount: amtNum, person: debtor, debtCreditor: creditor, note: noteVal, createdAt })
    } else if (person === 'Both') {
      const groupId = newGroupId()
      onAdd({ type: tab as TransactionType, amount: halfA, person: 'Pablo',  groupId, note: noteVal, createdAt })
      onAdd({ type: tab as TransactionType, amount: halfB, person: 'Alberto', groupId, note: noteVal, createdAt })
    } else {
      onAdd({ type: tab as TransactionType, amount: amtNum, person, note: noteVal, createdAt })
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass-card fade-up" style={{ width: '100%', maxWidth: 420, padding: 28 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            {isDebt ? '📋 Record Debt' : 'New Transaction'}
          </h2>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, color: 'var(--color-muted)', cursor: 'pointer', width: 32, height: 32, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Tab selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, padding: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
          {([
            { id: 'deposit'    as TabType, label: '⬆️ Deposit',    activeColor: 'rgba(52,211,153,0.15)',  activeBorder: 'rgba(52,211,153,0.4)',  activeText: 'var(--color-win)' },
            { id: 'withdrawal' as TabType, label: '⬇️ Withdrawal', activeColor: 'rgba(248,113,113,0.15)', activeBorder: 'rgba(248,113,113,0.4)', activeText: 'var(--color-loss)' },
            { id: 'debt'       as TabType, label: '📋 Debt',       activeColor: 'rgba(251,191,36,0.15)', activeBorder: 'rgba(251,191,36,0.4)', activeText: '#fbbf24' },
          ]).map(({ id, label, activeColor, activeBorder, activeText }) => {
            const on = tab === id
            return (
              <button key={id} type="button" onClick={() => setTab(id)} style={{
                flex: 1, padding: '8px 6px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: on ? `1px solid ${activeBorder}` : '1px solid transparent',
                background: on ? activeColor : 'transparent',
                color: on ? activeText : 'var(--color-muted)',
                transition: 'all 0.15s', fontFamily: 'inherit',
              }}>
                {label}
              </button>
            )
          })}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 14 }}>

            {isDebt ? (
              /* Debt: choose debtor — creditor is the other person automatically */
              <div>
                <label style={labelStyle}>Who owes?</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {(['Pablo', 'Alberto'] as TransactionPerson[]).map(p => (
                    <button key={p} type="button" onClick={() => setDebtor(p)} style={{
                      flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: debtor === p ? '1.5px solid rgba(251,191,36,0.6)' : '1px solid rgba(255,255,255,0.08)',
                      background: debtor === p ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.03)',
                      color: debtor === p ? '#fbbf24' : 'var(--color-muted)',
                      transition: 'all 0.15s', fontFamily: 'inherit',
                    }}>
                      {p === 'Pablo' ? '👤' : '👥'} {p}
                    </button>
                  ))}
                  <span style={{ fontSize: 18, color: 'var(--color-muted)', padding: '0 4px' }}>→</span>
                  <div style={{
                    flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 13, fontWeight: 600, textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'var(--color-text)',
                  }}>
                    {creditor === 'Pablo' ? '👤' : '👥'} {creditor}
                  </div>
                </div>
                {isValid && (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: '#fbbf24' }}>
                    {debtor} owes {fmt(amtNum)} to {creditor}
                  </div>
                )}
              </div>
            ) : (
              /* Deposit / withdrawal: choose person */
              <div>
                <label style={labelStyle}>Person</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([
                    { v: 'Pablo'  as PersonOption, label: '👤 Pablo' },
                    { v: 'Alberto' as PersonOption, label: '👥 Alberto' },
                    { v: 'Both'   as PersonOption, label: '🤝 Both 50/50' },
                  ]).map(({ v, label }) => (
                    <button key={v} type="button" onClick={() => setPerson(v)} style={{
                      flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: person === v ? '1.5px solid rgba(129,140,248,0.6)' : '1px solid rgba(255,255,255,0.08)',
                      background: person === v ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.03)',
                      color: person === v ? 'var(--color-accent)' : 'var(--color-muted)',
                      transition: 'all 0.15s', fontFamily: 'inherit',
                    }}>
                      {label}
                    </button>
                  ))}
                </div>
                {isValid && (
                  <div style={{ marginTop: 5, fontSize: 12, fontWeight: 600, color: tab === 'deposit' ? 'var(--color-win)' : 'var(--color-loss)' }}>
                    {person === 'Both'
                      ? `${tab === 'deposit' ? '+' : '−'}${fmt(halfA)} Pablo · ${tab === 'deposit' ? '+' : '−'}${fmt(halfB)} Alberto`
                      : `${tab === 'deposit' ? '+' : '−'}${fmt(amtNum)} for ${person}`}
                  </div>
                )}
              </div>
            )}

            {/* Amount */}
            <div>
              <label style={labelStyle}>Amount ($)</label>
              <input
                className="input-dark"
                type="number"
                step="any"
                min="1"
                max="999999999"
                placeholder="10000"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                autoFocus
                required
              />
            </div>

            {/* Date & time */}
            <div>
              <label style={labelStyle}>Date</label>
              <input
                className="input-dark"
                type="datetime-local"
                value={datetime}
                max={localNow()}
                onChange={e => setDatetime(e.target.value)}
              />
            </div>

            {/* Note */}
            <div>
              <label style={labelStyle}>Note (optional)</label>
              <input
                className="input-dark"
                type="text"
                placeholder={isDebt ? 'e.g. loan from 01/01/2025…' : 'Initial deposit, winnings…'}
                value={note}
                maxLength={500}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-muted)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 2, padding: 12, fontSize: 14, opacity: isValid ? 1 : 0.5 }}>
              {isDebt ? 'Record debt' : tab === 'deposit' ? 'Add deposit' : 'Record withdrawal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
