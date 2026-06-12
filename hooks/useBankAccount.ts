'use client'
import { useState, useEffect } from 'react'
import { BankTransaction } from '@/types/bank'
import { supabase } from '@/lib/supabase'

// ── Row mapping ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTx(r: any): BankTransaction {
  return {
    id:            r.id,
    type:          r.type,
    amount:        r.amount,
    person:        r.person,
    debtCreditor:  r.debt_creditor ?? undefined,
    groupId:       r.group_id      ?? undefined,
    note:          r.note          ?? undefined,
    createdAt:     r.created_at,
  }
}

function txToRow(tx: Omit<BankTransaction, 'id'>): Record<string, unknown> {
  return {
    type:          tx.type,
    amount:        tx.amount,
    person:        tx.person,
    debt_creditor: tx.debtCreditor ?? null,
    group_id:      tx.groupId      ?? null,
    note:          tx.note         ?? null,
    created_at:    tx.createdAt,
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

async function fetchTxs(): Promise<BankTransaction[]> {
  const { data } = await supabase.from('bank_transactions_cucu').select('*').order('created_at', { ascending: true })
  return (data ?? []).map(rowToTx)
}

export function useBankAccount() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loaded, setLoaded]             = useState(false)
  const [channelName]                   = useState(() => `bank-rt-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    fetchTxs().then(data => { setTransactions(data); setLoaded(true) })

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_transactions_cucu' }, () => {
        fetchTxs().then(setTransactions)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [channelName])

  const addTransaction = async (tx: Omit<BankTransaction, 'id'>) => {
    await supabase.from('bank_transactions_cucu').insert(txToRow(tx))
  }

  const deleteTransaction = async (id: string) => {
    await supabase.from('bank_transactions_cucu').delete().eq('id', id)
  }

  const deleteGroup = async (groupId: string) => {
    await supabase.from('bank_transactions_cucu').delete().eq('group_id', groupId)
  }

  const sign      = (t: BankTransaction) => (t.type === 'deposit' ? 1 : -1)
  const bankTxs   = transactions.filter(t => t.type !== 'debt')
  const total       = bankTxs.reduce((s, t) => s + sign(t) * t.amount, 0)
  const pabloTotal  = bankTxs.filter(t => t.person === 'Pablo').reduce((s, t) => s + sign(t) * t.amount, 0)
  const thomasTotal = bankTxs.filter(t => t.person === 'Thomas').reduce((s, t) => s + sign(t) * t.amount, 0)

  return { transactions, addTransaction, deleteTransaction, deleteGroup, loaded, total, pabloTotal, thomasTotal }
}
