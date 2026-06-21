import { useState } from 'react'
import { FONT, Icon } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'
import CatalogSection from '../../components/marketplace/CatalogSection'

const GREEN_BRIGHT = '#68dbae'
const GREEN_DIM = 'rgba(29,158,117,0.12)'
const GREEN_BORDER = 'rgba(29,158,117,0.22)'

const CHAT_INIT = [
  { role: 'ai', text: 'Hola ✈️ Soy Spark, tu asistente de viajes. Pronto podré armar el viaje perfecto para ti — cuéntame a dónde te gustaría ir.' }
]

export default function TravelScreen({ onBack }) {
  const [messages, setMessages] = useState(CHAT_INIT)
  const [input, setInput] = useState('')

  function handleSend() {
    const text = input.trim()
    if (!text) return
    setMessages(prev => [
      ...prev,
      { role: 'user', text },
      { role: 'ai', text: 'Estoy aprendiendo a buscar vuelos, hoteles y paquetes por ti ✈️ Muy pronto podré ayudarte. Por ahora explora las categorías de abajo.' }
    ])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
      <TopBar title="Travel" leftIcon="arrow_back" onLeft={onBack} rightContent={
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ padding: '6px 10px', background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}`, borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12 }}>🇲🇽</span>
            <span style={{ fontSize: 11, color: GREEN_BRIGHT, fontWeight: 700 }}>MX</span>
          </div>
          <div style={{ padding: '6px 10px', background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}`, borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12 }}>🇺🇸</span>
            <span style={{ fontSize: 11, color: GREEN_BRIGHT, fontWeight: 700 }}>US</span>
          </div>
        </div>
      } />

      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Spark Travel — asistente (próximamente) */}
        <div style={{ background: 'linear-gradient(135deg, #080f0d, #0d1a14)', border: `1px solid ${GREEN_BORDER}`, borderRadius: 20, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#0f2a1e,#1a3a28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="flight_takeoff" size={20} style={{ color: GREEN_BRIGHT }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: GREEN_BRIGHT, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 2px' }}>Asistente de Viajes</p>
              <p style={{ fontSize: 14, color: '#c8e8d8', fontWeight: 700, margin: 0, fontFamily: FONT.headline }}>Spark · CNG Travel</p>
            </div>
            <span style={{ fontSize: 9, color: GREEN_BRIGHT, fontWeight: 700, background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}`, padding: '3px 8px', borderRadius: 99 }}>PRONTO</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                background: '#0a1010',
                border: `1px solid ${m.role === 'ai' ? 'rgba(104,219,174,0.15)' : 'rgba(104,219,174,0.1)'}`,
                borderRadius: m.role === 'ai' ? '0 14px 14px 14px' : '14px 14px 0 14px',
                padding: '10px 14px', fontSize: 13,
                color: m.role === 'ai' ? '#a8d8c8' : '#c8e8d8',
                lineHeight: 1.55, maxWidth: '86%',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>{m.text}</div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="¿A dónde quieres ir?"
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${GREEN_BORDER}`, borderRadius: 12, padding: '11px 14px', fontSize: 13, color: '#c8e8d8', fontFamily: FONT.body, outline: 'none' }}
            />
            <button onClick={handleSend} style={{ width: 42, height: 42, background: GREEN_BRIGHT, border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="send" size={18} style={{ color: '#0a2010' }} />
            </button>
          </div>
        </div>

        {/* Catálogo real (categorías + ofertas por LOB) */}
        <CatalogSection
          lob="travel"
          accent={GREEN_BRIGHT}
          columns={2}
          emptyIcon="travel_explore"
          emptyTitle="Los viajes están por despegar"
          emptySubtitle="Aún no hay vuelos, hoteles ni paquetes publicados. Vuelve pronto para descubrir destinos."
        />

      </div>
      <BackButton onClick={onBack} />
    </div>
  )
}
