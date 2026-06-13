'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useBets } from '@/hooks/useBets'
import AddBetModal from '@/components/AddBetModal'

export default function BottomNav() {
  const path = usePathname()
  const [showModal, setShowModal] = useState(false)
  const { addBet } = useBets()

  const leftTabs  = [
    { href: '/',          icon: HomeIcon,     label: 'Home'     },
    { href: '/bets',      icon: BetsIcon,     label: 'Bets'     },
  ]
  const rightTabs = [
    { href: '/bank',      icon: BankIcon,     label: 'Bank'     },
    { href: '/fixtures',  icon: FixturesIcon, label: 'Fixtures' },
  ]

  const tabStyle = (active: boolean): React.CSSProperties => ({
    width: 48, height: 46,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 3, textDecoration: 'none', borderRadius: 9999,
    color: active ? 'var(--color-accent)' : 'rgba(255,255,255,0.45)',
    background: active ? 'rgba(245,166,35,0.1)' : 'transparent',
    transition: 'color 0.15s, background 0.15s',
  })

  return (
    <>
      <nav className="bottom-nav" style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'rgba(21, 32, 48, 0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 9999,
        padding: '8px 10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
      }}>
        {leftTabs.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} style={tabStyle(path === href)}>
            <Icon size={18} />
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.04em' }}>{label}</span>
          </Link>
        ))}

        {/* Center + button */}
        <button
          onClick={() => setShowModal(true)}
          style={{
            width: 44, height: 44,
            borderRadius: 9999,
            background: 'var(--color-accent)',
            color: '#1A2534',
            border: 'none',
            fontSize: 22, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(245,166,35,0.45)',
            marginInline: 4,
            flexShrink: 0,
            transition: 'transform 0.15s',
          }}
          onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
          onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          +
        </button>

        {rightTabs.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} style={tabStyle(path === href)}>
            <Icon size={18} />
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.04em' }}>{label}</span>
          </Link>
        ))}
      </nav>

      {showModal && <AddBetModal onClose={() => setShowModal(false)} onAdd={addBet} />}
    </>
  )
}

function HomeIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function BetsIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function BankIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
  )
}

function FixturesIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  )
}
