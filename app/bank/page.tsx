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

function BigCard({
  label, value, sub, lines, light = false, valueColor, onClick,
}: {
  label: string; value: string; sub?: string; lines?: string[]
  light?: boolean; valueColor?: string; onClick?: () => void
}) {
  const bg           = light ? '#F0EBE0' : '#223022'
  const border       = light ? 'rgba(27,43,27,0.1)' : 'rgba(240,235,224,0.07)'
  const labelColor   = light ? 'rgba(27,43,27,0.4)' : 'rgba(240,235,224,0.4)'
  const defaultValue = light ? '#1B2B1B' : '#F0EBE0'
  const subColor     = light ? 'rgba(27,43,27,0.38)' : 'rgba(240,235,224,0.35)'
  return (
    <div
      onClick={onClick}
      style={{
        background: bg, border: `1px solid ${border}`, borderRadius: 12,
        padding: '20px 22px', minHeight: 110,
        cursor: onClick ? 'pointer' : 'default',
        transition: onClick ? 'filter 0.12s' : undefined,
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.filter = 'brightness(1.06)' }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.filter = 'none' }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: labelColor, marginBottom: 10 }}>{label}</div>
      <div className="num" style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, color: valueColor ?? defaultValue }}>{value}</div>
      {lines && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {lines.map((l, i) => <div key={i} style={{ fontSize: 11, color: subColor }}>{l}</div>)}
        </div>
      )}
      {sub && !lines && <div style={{ fontSize: 11, marginTop: 8, color: subColor }}>{sub}</div>}
    </div>
  )
}

export default function BankPage() {
  const { bets, addBet } = useBets()
  const {
    transactions, addTransaction, deleteTransaction, deleteGroup,
    total: bankTotal, pabloTotal, albertoTotal, loaded,
  } = useBankAccount()
  const [showBetModal, setShowBetModal]     = useState(false)
  const [editingBet,   setEditingBet]       = useState<Bet | null>(null)
  const [showTxModal,  setShowTxModal]      = useState(false)
  const [txType,       setTxType]           = useState<'deposit' | 'withdrawal'>('deposit')

  const bankFundedImpact = bets
    .filter(b => b.fundedBy === 'bank')
    .reduce((sum, b) => b.result === 'pending' ? sum - b.stake : sum + b.profit, 0)

  const adjustedBankTotal    = bankTotal    + bankFundedImpact
  const adjustedPabloTotal   = pabloTotal   + bankFundedImpact / 2
  const adjustedAlbertoTotal = albertoTotal + bankFundedImpact / 2

  const bankColor = adjustedBankTotal >= 0 ? '#1B6B1B' : '#B03020'

  // Shared-fund view: treat all deposits as pooled, each person owns 50%
  const cashTxs = transactions.filter(t => t.type !== 'debt' && t.type !== 'settlement')
  const totalDeposited  = cashTxs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  const totalWithdrawn  = cashTxs.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0)
  const eachContributed = (totalDeposited - totalWithdrawn) / 2   // fair share of net deposits
  const eachShareNow    = adjustedBankTotal / 2                    // current value if split today
  const eachProfit      = parseFloat((eachShareNow - eachContributed).toFixed(2))
  const shareColor      = eachShareNow >= eachContributed ? '#6EC200' : '#E85C2A'
  const pendingStake    = bets.filter(b => b.result === 'pending').reduce((s, b) => s + b.stake, 0)

  function openTx(type: 'deposit' | 'withdrawal') {
    setTxType(type); setShowTxModal(true)
  }

  return (
    <>
      <Navbar onAddBet={() => setShowBetModal(true)} />

      <main className="page-main" style={{
        maxWidth: 900, margin: '0 auto',
        padding: '20px 20px 100px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>

        {/* ── Row 1: bento balance grid ──────────────────────────────────── */}
        <div className="grid-bank-hero">
          <BigCard
            label="Bank Balance"
            value={loaded ? `${adjustedBankTotal < 0 ? '-' : ''}${fmt(Math.abs(adjustedBankTotal))}` : '…'}
            lines={loaded ? [
              `Deposited  ${fmt(totalDeposited)}  (${cashTxs.length} transaction${cashTxs.length !== 1 ? 's' : ''})`,
              bankFundedImpact !== 0
                ? `Bets impact  ${bankFundedImpact > 0 ? '+' : '-'}${fmt(Math.abs(bankFundedImpact))}`
                : 'no bets placed yet',
            ] : undefined}
            light
            valueColor={bankColor}
          />
          <BigCard
            label="Pablo"
            value={loaded ? `${eachShareNow < 0 ? '-' : ''}${fmt(Math.abs(eachShareNow))}` : '…'}
            lines={loaded ? [
              `Pool share  ${fmt(eachContributed)}`,
              `Bets P&L  ${eachProfit >= 0 ? '+' : '-'}${fmt(Math.abs(eachProfit))}`,
              ...(pendingStake > 0 ? [`At risk  ${fmt(pendingStake / 2)}`] : []),
            ] : undefined}
            valueColor={shareColor}
          />
          <BigCard
            label="Alberto"
            value={loaded ? `${eachShareNow < 0 ? '-' : ''}${fmt(Math.abs(eachShareNow))}` : '…'}
            lines={loaded ? [
              `Pool share  ${fmt(eachContributed)}`,
              `Bets P&L  ${eachProfit >= 0 ? '+' : '-'}${fmt(Math.abs(eachProfit))}`,
              ...(pendingStake > 0 ? [`At risk  ${fmt(pendingStake / 2)}`] : []),
            ] : undefined}
            light
            valueColor={eachShareNow >= eachContributed ? '#1B6B1B' : '#B03020'}
          />
        </div>

        {/* ── Row 2: action cards ───────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <BigCard
            label="Deposit"
            value="+"
            sub="Add funds to the shared pool"
            valueColor="#6EC200"
            onClick={() => openTx('deposit')}
          />
          <BigCard
            label="Withdraw"
            value="−"
            sub="Take funds out of the pool"
            light
            valueColor="#B03020"
            onClick={() => openTx('withdrawal')}
          />
        </div>

        {/* ── Settlement + history ───────────────────────────────────────── */}
        {loaded && (
          <>
            <BalancesWidget
              bets={bets}
              transactions={transactions}
              onSettle={async (amount, debtor) => {
                await addTransaction({
                  type: 'settlement',
                  person: debtor,
                  amount,
                  note: 'Settlement paid',
                  createdAt: new Date().toISOString(),
                })
              }}
            />
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
