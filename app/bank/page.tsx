'use client'
import { useBets } from '@/hooks/useBets'
import { useBankAccount } from '@/hooks/useBankAccount'
import BankWidget from '@/components/BankWidget'
import BalancesWidget from '@/components/BalancesWidget'
import Navbar from '@/components/Navbar'
import BottomNav from '@/components/BottomNav'
import { useState } from 'react'
import AddBetModal from '@/components/AddBetModal'
import { Bet } from '@/types/bet'

export default function BankPage() {
  const { bets, addBet } = useBets()
  const {
    transactions, addTransaction, deleteTransaction, deleteGroup,
    total: bankTotal, pabloTotal, albertoTotal, loaded,
  } = useBankAccount()
  const [showBetModal, setShowBetModal] = useState(false)
  const [editingBet, setEditingBet] = useState<Bet | null>(null)

  const bankFundedImpact = bets
    .filter(b => b.fundedBy === 'bank')
    .reduce((sum, b) => b.result === 'pending' ? sum - b.stake : sum + b.profit, 0)

  const adjustedBankTotal    = bankTotal    + bankFundedImpact
  const adjustedPabloTotal   = pabloTotal   + bankFundedImpact / 2
  const adjustedAlbertoTotal = albertoTotal + bankFundedImpact / 2

  return (
    <>
      <Navbar onAddBet={() => setShowBetModal(true)} />

      <main className="page-main" style={{
        maxWidth: 900, margin: '0 auto',
        padding: '24px 20px 100px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
          Bank
        </h1>

        {!loaded ? (
          <div style={{ color: 'var(--color-muted)', fontSize: 14, padding: 40, textAlign: 'center' }}>Loading…</div>
        ) : (
          <>
            <BankWidget
              transactions={transactions}
              total={adjustedBankTotal}
              pabloTotal={adjustedPabloTotal}
              albertoTotal={adjustedAlbertoTotal}
              onAdd={addTransaction}
              onDelete={deleteTransaction}
              onDeleteGroup={deleteGroup}
            />
            <BalancesWidget bets={bets} transactions={transactions} />
          </>
        )}
      </main>

      <BottomNav />

      {showBetModal && <AddBetModal onClose={() => setShowBetModal(false)} onAdd={addBet} />}
      {editingBet && <AddBetModal onClose={() => setEditingBet(null)} onAdd={addBet} editBet={editingBet} />}
    </>
  )
}
