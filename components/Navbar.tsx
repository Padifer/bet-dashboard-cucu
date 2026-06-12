'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavbarProps {
  onAddBet: () => void
}

export default function Navbar({ onAddBet }: NavbarProps) {
  const path = usePathname()

  const tab = (href: string, label: string) => {
    const active = path === href
    return (
      <Link href={href} style={{
        padding: '7px 14px', fontSize: 12, fontWeight: 600,
        color: active ? 'var(--color-accent)' : 'var(--color-muted)',
        background: active ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.04)',
        border: active ? '1px solid rgba(129,140,248,0.3)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8, textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center',
        transition: 'all 0.15s',
      }}>{label}</Link>
    )
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(9,9,15,0.96)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontSize: 18 }}>⚽</span>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
            Bet<span style={{ color: 'var(--color-win)' }}>Tracker</span>
          </span>
        </Link>

        <div className="nav-tabs-top" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tab('/', '⌂')}
          {tab('/bets', 'Bets')}
          {tab('/tips', 'Tips')}
          <button className="btn-primary" onClick={onAddBet} style={{ padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Add Bet
          </button>
        </div>
      </div>
    </nav>
  )
}
