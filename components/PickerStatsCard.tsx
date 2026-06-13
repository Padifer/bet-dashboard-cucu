'use client'
import { BetStats } from '@/types/bet'
import { fmt } from '@/utils/currency'

interface Props { stats: BetStats }

export default function PickerStatsCard({ stats }: Props) {
  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
          Picker Performance
        </h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { name: 'Pablo', s: stats.pabloStats, light: true },
          { name: 'Alberto', s: stats.albertoStats, light: false },
        ].map(({ name, s, light }) => {
          const bg = light ? '#F0EBE0' : '#223022'
          const border = light ? 'rgba(27,43,27,0.1)' : 'rgba(240,235,224,0.07)'
          const label = light ? 'rgba(27,43,27,0.4)' : 'rgba(240,235,224,0.4)'
          const rColor = s.roi >= 0 ? (light ? '#1B6B1B' : '#6EC200') : (light ? '#B03020' : '#E85C2A')
          return (
            <div key={name} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: label, marginBottom: 8 }}>{name}</div>
              <div className="num" style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: rColor }}>{s.roi >= 0 ? '+' : ''}{s.roi.toFixed(1)}%</div>
              <div style={{ fontSize: 11, marginTop: 6, color: label }}>{s.wins}W · {s.losses}L</div>
              <div className="num" style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: rColor }}>{s.profit >= 0 ? '+' : ''}{fmt(s.profit)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
