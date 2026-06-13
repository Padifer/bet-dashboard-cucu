'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useBets } from '@/hooks/useBets'
import AddBetModal from '@/components/AddBetModal'

interface TabProps {
  href: string
  icon: string
  label: string
  active: boolean
}

function Tab({ href, icon, label, active }: TabProps) {
  return (
    <Link
      href={href}
      style={{
        flex: 1,
        minHeight: 56,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        textDecoration: 'none',
        color: active ? 'var(--color-accent)' : 'var(--color-muted)',
        background: 'transparent',
        transition: 'color 0.15s',
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.02em' }}>{label}</span>
    </Link>
  )
}

export default function BottomNav() {
  const path = usePathname()
  const [showModal, setShowModal] = useState(false)
  const { addBet } = useBets()

  return (
    <>
      <nav
        className="bottom-nav"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: '#0F1117',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          alignItems: 'stretch',
        }}
      >
        <Tab href="/" icon="⌂" label="Home" active={path === '/'} />

        {/* Center elevated + button */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            aria-label="Add bet"
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #F5A623 0%, #E8930E 100%)',
              color: '#050D1A',
              border: 'none',
              fontSize: 24,
              fontWeight: 700,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transform: 'translateY(-10px)',
              boxShadow: '0 8px 24px rgba(245,166,35,0.5), 0 2px 6px rgba(0,0,0,0.4)',
            }}
          >
            +
          </button>
        </div>

        <Tab href="/bets" icon="📋" label="Bets" active={path === '/bets'} />
      </nav>

      {showModal && <AddBetModal onClose={() => setShowModal(false)} onAdd={addBet} />}
    </>
  )
}
