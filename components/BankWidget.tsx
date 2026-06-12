'use client'
import { useState } from 'react'
import { BankTransaction } from '@/types/bank'
import { fmt } from '@/utils/currency'
import AddTransactionModal from './AddTransactionModal'

interface Props {
  transactions: BankTransaction[]
  total: number
  pabloTotal: number
  thomasTotal: number
  onAdd: (tx: Omit<BankTransaction, 'id'>) => void
  onDelete: (id: string) => void
  onDeleteGroup: (groupId: string) => void
}

function fmtDatetime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function BankWidget({ transactions, total, pabloTotal, thomasTotal, onAdd, onDelete, onDeleteGroup }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const sorted = [...transactions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const isPositive = total >= 0

  const handleDelete = (tx: BankTransaction) => {
    if (tx.type === 'debt') {
      if (!window.confirm('Delete this debt? This cannot be undone.')) return
      onDelete(tx.id)
      return
    }
    if (tx.groupId) {
      onDeleteGroup(tx.groupId)
      return
    }
    onDelete(tx.id)
  }

  return (
    <>
      <div className="glass-card fade-up" style={{
        border: `1px solid ${isPositive ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'}`,
        background: `${isPositive ? 'rgba(52,211,153,0.02)' : 'rgba(248,113,113,0.02)'}`,
      }}>
        {/* Main row */}
        <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22 }}>🏦</span>

          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Bank Account
            </div>
            <div style={{
              fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2,
              fontFamily: 'var(--font-mono)',
              color: isPositive ? 'var(--color-win)' : 'var(--color-loss)',
            }}>
              {fmt(total)}
            </div>
          </div>

          {/* Per-person net cash flow — see Balances widget for true net position */}
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { name: 'Pablo', icon: '👤', val: pabloTotal },
              { name: 'Thomas', icon: '👥', val: thomasTotal },
            ].map(({ name, icon, val }) => (
              <div key={name} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>{icon} {name}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                  {val === 0 ? '—' : (val > 0 ? '+' : '') + fmt(val)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-muted)', opacity: 0.6 }}>
                  net contributed
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary"
              style={{ padding: '8px 18px', fontSize: 13, borderRadius: 10, whiteSpace: 'nowrap' }}
            >
              + New Transaction
            </button>
            {transactions.length > 0 && (
              <button
                onClick={() => setExpanded(v => !v)}
                style={{
                  padding: '8px 12px', borderRadius: 10, fontSize: 12, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--color-muted)', whiteSpace: 'nowrap',
                }}
              >
                {expanded ? '▲' : '▼'} {transactions.length} tx
              </button>
            )}
          </div>
        </div>

        {/* Transaction history */}
        {expanded && sorted.length > 0 && (
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '8px 24px 14px',
            display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            {sorted.map(tx => {
              const isDebt = tx.type === 'debt'
              const isDeposit = tx.type === 'deposit'
              const isPaired = !!tx.groupId
              return (
                <div key={tx.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  padding: '7px 10px', borderRadius: 8,
                  background: isDebt ? 'rgba(251,191,36,0.04)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isDebt ? 'rgba(251,191,36,0.2)' : isDeposit ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)'}`,
                }}>
                  <span style={{ fontSize: 13 }}>{isDebt ? '📋' : isDeposit ? '⬆️' : '⬇️'}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)', minWidth: 70 }}>
                    {isDebt
                      ? <><span>{tx.person === 'Pablo' ? '👤' : '👥'} {tx.person}</span><span style={{ opacity: 0.5 }}> → </span><span>{tx.debtCreditor === 'Pablo' ? '👤' : '👥'} {tx.debtCreditor}</span></>
                      : <>{tx.person === 'Pablo' ? '👤' : '👥'} {tx.person}{isPaired ? ' · 50%' : ''}</>
                    }
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)',
                    color: isDebt ? '#fbbf24' : isDeposit ? 'var(--color-win)' : 'var(--color-loss)',
                    minWidth: 90,
                  }}>
                    {isDebt ? '' : isDeposit ? '+' : '−'}{fmt(tx.amount)}
                    {isDebt && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>debt</span>}
                  </span>
                  {tx.note && (
                    <span style={{ fontSize: 12, color: 'var(--color-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.note}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 'auto', opacity: 0.55 }}>
                    {fmtDatetime(tx.createdAt)}
                  </span>
                  <button
                    onClick={() => handleDelete(tx)}
                    title={isDebt ? 'Delete debt' : isPaired ? 'Delete both halves of the 50/50 split' : 'Delete'}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(248,113,113,0.45)', fontSize: 16, padding: '0 4px',
                      lineHeight: 1, borderRadius: 4, transition: 'color 0.15s',
                    }}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <AddTransactionModal
          onClose={() => setShowModal(false)}
          onAdd={tx => { onAdd(tx); setShowModal(false) }}
        />
      )}
    </>
  )
}
