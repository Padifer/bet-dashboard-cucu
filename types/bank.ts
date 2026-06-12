export type TransactionType = 'deposit' | 'withdrawal' | 'debt'
export type TransactionPerson = 'Pablo' | 'Alberto'

export interface BankTransaction {
  id: string
  type: TransactionType
  amount: number
  person: TransactionPerson       // depositor/withdrawer, or debtor when type='debt'
  debtCreditor?: TransactionPerson // only for type='debt': who is owed the money
  groupId?: string                // links the two halves of a 50/50 split
  note?: string
  createdAt: string // ISO datetime
}
