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
        color: active ? '#F5A623' : '#64748B',
        background: active ? 'rgba(245,166,35,0.08)' : 'transparent',
        border: '1px solid',
        borderColor: active ? 'rgba(245,166,35,0.25)' : 'transparent',
        borderRadius: 8, textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center',
        transition: 'color 0.15s',
      }}>{label}</Link>
    )
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: '#152030',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '0 24px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>⚽</span>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{
              fontSize: 16, fontWeight: 900, letterSpacing: '-0.02em',
              color: '#F5A623',
              fontStyle: 'italic',
              textTransform: 'uppercase',
            }}>Mundial</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
            }}>de los Chunguitos</span>
          </div>
        </Link>

        <div className="nav-tabs-top" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tab('/', 'Stats')}
          {tab('/bets', 'Bets')}
          {tab('/bank', 'Bank')}
          {tab('/fixtures', 'Fixtures')}
          <button className="btn-primary" onClick={onAddBet} style={{ padding: '7px 16px', fontSize: 13 }}>
            + Add Bet
          </button>
        </div>
      </div>
    </nav>
  )
}
