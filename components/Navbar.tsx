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
        padding: '6px 14px', fontSize: 13, fontWeight: 600,
        color: active ? '#1B2B1B' : 'rgba(247,245,236,0.55)',
        background: active ? 'rgba(247,245,236,0.15)' : 'transparent',
        border: '1px solid',
        borderColor: active ? 'rgba(247,245,236,0.3)' : 'transparent',
        borderRadius: 8, textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center',
        transition: 'color 0.15s',
      }}>{label}</Link>
    )
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: '#141F14',
      borderBottom: '1px solid rgba(240,235,224,0.06)',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ fontSize: 24, lineHeight: 1 }}>⚽</span>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{
              fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em',
              color: '#E85C2A',
              fontStyle: 'italic',
              textTransform: 'uppercase',
            }}>Mundial</span>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
              color: 'rgba(240,235,224,0.5)',
              textTransform: 'uppercase',
            }}>de los Chunguitos</span>
          </div>
        </Link>

        <div className="nav-tabs-top" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tab('/', 'Stats')}
          {tab('/bets', 'Bets')}
          {tab('/bank', 'Bank')}
          {tab('/fixtures', 'Fixtures')}
          <button onClick={onAddBet} style={{
            padding: '7px 16px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
            background: '#E85C2A', color: '#F0EBE0',
            border: 'none', borderRadius: 6, letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            + Add Bet
          </button>
        </div>
      </div>
    </nav>
  )
}
