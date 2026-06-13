'use client'
import { useBets } from '@/hooks/useBets'
import { useBankAccount } from '@/hooks/useBankAccount'
import BankWidget from '@/components/BankWidget'
import BalancesWidget from '@/components/BalancesWidget'
import Navbar from '@/components/Navbar'
import BottomNav from '@/components/BottomNav'
import { useState } from 'react'
import AddBetModal from '@/components/AddBetModal'
import AddTransactionModal from '@/components/AddTransactionModal'
import { Bet } from '@/types/bet'
import { fmt } from '@/utils/currency'

function ActionBtn({
  label, icon, color, onClick,
}: { label: string; icon: string; color: string; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, padding: '16px 12px', borderRadius: 12, cursor: 'pointer', border: 'none',
        background: hover ? `${color}CC` : `${color}22`,
        color: hover ? '#F0EBE0' : color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontSize: 15, fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase',
        transition: 'background 0.15s, color 0.15s',
        outline: `1px solid ${color}44`,
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      {label}
    </button>
  )
}

export default function BankPage() {
  const { bets, addBet } = useBets()
  const {
    transactions, addTransaction, deleteTransaction, deleteGroup,
    total: bankTotal, pabloTotal, albertoTotal, loaded,
  } = useBankAccount()
  const [showBetModal, setShowBetModal] = useState(false)
  const [editingBet, setEditingBet] = useState<Bet | null>(null)
  const [showTxModal, setShowTxModal] = useState(false)
  const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit')

  const bankFundedImpact = bets
    .filter(b => b.fundedBy === 'bank')
    .reduce((sum, b) => b.result === 'pending' ? sum - b.stake : sum + b.profit, 0)

  const adjustedBankTotal    = bankTotal    + bankFundedImpact
  const adjustedPabloTotal   = pabloTotal   + bankFundedImpact / 2
  const adjustedAlbertoTotal = albertoTotal + bankFundedImpact / 2

  const isPositive = adjustedBankTotal >= 0
  const heroColor  = isPositive ? '#6EC200' : '#E85C2A'

  function openTx(type: 'deposit' | 'withdrawal') {
    setTxType(type)
    setShowTxModal(true)
  }

  return (
    <>
      <Navbar onAddBet={() => setShowBetModal(true)} />

      <main className="page-main" style={{
        maxWidth: 700, margin: '0 auto',
        padding: '24px 20px 100px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>

        {/* ── Balance hero ───────────────────────────────────────────────── */}
        <div style={{
          background: '#223022', border: '1px solid rgba(240,235,224,0.07)', borderRadius: 16,
          padding: '28px 28px 24px', textAlign: 'center',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: 'rgba(240,235,224,0.4)', marginBottom: 10,
          }}>
            Bank Account
          </div>
          {!loaded ? (
            <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-muted)', fontSize: 14 }}>
              Loading…
            </div>
          ) : (
            <>
              <div className="num" style={{
                fontSize: 56, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1,
                color: heroColor,
              }}>
                {fmt(adjustedBankTotal)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 18 }}>
                {[
                  { name: 'Pablo',   val: adjustedPabloTotal },
                  { name: 'Alberto', val: adjustedAlbertoTotal },
                ].map(({ name, val }) => (
                  <div key={name} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,235,224,0.35)', marginBottom: 3 }}>{name}</div>
                    <div className="num" style={{ fontSize: 20, fontWeight: 800, color: val >= 0 ? '#6EC200' : '#E85C2A' }}>{fmt(val)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Quick actions ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12 }}>
          <ActionBtn label="Deposit" icon="+" color="#6EC200" onClick={() => openTx('deposit')} />
          <ActionBtn label="Withdraw" icon="−" color="#E85C2A" onClick={() => openTx('withdrawal')} />
        </div>

        {/* ── History ───────────────────────────────────────────────────── */}
        {loaded && (
          <>
            <BankWidget
              transactions={transactions}
              total={adjustedBankTotal}
              pabloTotal={adjustedPabloTotal}
              albertoTotal={adjustedAlbertoTotal}
              onAdd={addTransaction}
              onDelete={deleteTransaction}
              onDeleteGroup={deleteGroup}
              hideHeader
            />
            <BalancesWidget bets={bets} transactions={transactions} />
          </>
        )}
      </main>

      <BottomNav />

      {showTxModal && (
        <AddTransactionModal
          onClose={() => setShowTxModal(false)}
          onAdd={addTransaction}
          defaultType={txType}
        />
      )}
      {showBetModal && <AddBetModal onClose={() => setShowBetModal(false)} onAdd={addBet} />}
      {editingBet && <AddBetModal onClose={() => setEditingBet(null)} onAdd={addBet} editBet={editingBet} />}
    </>
  )
}
