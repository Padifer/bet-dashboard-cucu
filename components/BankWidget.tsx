'use client'
import { useState } from 'react'
import { BankTransaction } from '@/types/bank'
import { fmt } from '@/utils/currency'
import AddTransactionModal from './AddTransactionModal'

interface Props {
  transactions: BankTransaction[]
  total: number
  pabloTotal: number
  albertoTotal: number
  onAdd: (tx: Omit<BankTransaction, 'id'>) => void
  onDelete: (id: string) => void
  onDeleteGroup: (groupId: string) => void
  hideHeader?: boolean
}

function fmtDatetime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function BankWidget({ transactions, onAdd, onDelete, onDeleteGroup, hideHeader }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const sorted = [...transactions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const handleDelete = (tx: BankTransaction) => {
    if (tx.type === 'debt') {
      if (!window.confirm('Delete this debt?')) return
      onDelete(tx.id)
      return
    }
    if (tx.groupId) { onDeleteGroup(tx.groupId); return }
    onDelete(tx.id)
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {!hideHeader && (
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,235,224,0.35)', paddingLeft: 2 }}>
            Transaction History
          </div>
        )}

        {/* History toggle */}
        <div style={{
          background: '#223022', border: '1px solid rgba(240,235,224,0.07)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              width: '100%', padding: '14px 20px', cursor: 'pointer',
              background: 'none', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
              Transaction History
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</span>
              <span style={{ fontSize: 10 }}>{expanded ? '▲' : '▼'}</span>
            </span>
          </button>

          {expanded && sorted.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(240,235,224,0.05)', padding: '8px 16px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {sorted.map(tx => {
                const isDebt    = tx.type === 'debt'
                const isDeposit = tx.type === 'deposit'
                const isPaired  = !!tx.groupId
                const amtColor  = isDebt ? '#F5C842' : isDeposit ? '#6EC200' : '#E85C2A'
                return (
                  <div key={tx.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                    padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(240,235,224,0.03)',
                    border: `1px solid rgba(240,235,224,0.06)`,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: amtColor, minWidth: 48 }}>
                      {isDebt ? 'Debt' : isDeposit ? 'In' : 'Out'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-muted)', minWidth: 70 }}>
                      {isDebt
                        ? `${tx.person} → ${tx.debtCreditor}`
                        : `${tx.person}${isPaired ? ' · 50%' : ''}`}
                    </span>
                    <span className="num" style={{ fontSize: 14, fontWeight: 800, color: amtColor }}>
                      {isDebt ? '' : isDeposit ? '+' : '−'}{fmt(tx.amount)}
                    </span>
                    {tx.note && (
                      <span style={{ fontSize: 12, color: 'var(--color-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.7 }}>
                        {tx.note}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--color-muted)', marginLeft: 'auto', opacity: 0.45 }}>
                      {fmtDatetime(tx.createdAt)}
                    </span>
                    <button
                      onClick={() => handleDelete(tx)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(232,92,42,0.45)', fontSize: 16, padding: '0 2px', lineHeight: 1, transition: 'color 0.15s' }}
                    >×</button>
                  </div>
                )
              })}
            </div>
          )}

          {expanded && sorted.length === 0 && (
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(240,235,224,0.05)', fontSize: 13, color: 'var(--color-muted)', textAlign: 'center' }}>
              No transactions yet
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <AddTransactionModal
          onClose={() => setShowModal(false)}
          onAdd={async tx => { await onAdd(tx); setShowModal(false) }}
        />
      )}
    </>
  )
}
