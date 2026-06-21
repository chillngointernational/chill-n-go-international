import { useState } from 'react'
import { FONT, Icon } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'
import CatalogSection from '../../components/marketplace/CatalogSection'

const TEAL = '#68dbae'
const TEAL_DIM = 'rgba(104,219,174,0.10)'
const TEAL_BORDER = 'rgba(104,219,174,0.20)'

const CHAT_INIT = [
  { role: 'ai', text: 'Hola 🏡 Soy Spark, tu asesor de propiedades. Pronto podré encontrar la propiedad ideal para ti — cuéntame qué buscas: comprar, rentar o invertir.' }
]

export default function RealEstateScreen({ onBack }) {
  const [messages, setMessages] = useState(CHAT_INIT)
  const [input, setInput] = useState('')

  function handleSend() {
    const text = input.trim()
    if (!text) return
    setMessages(prev => [
      ...prev,
      { role: 'user', text },
      { role: 'ai', text: 'Estoy aprendiendo a buscar propiedades en MX y US por ti 🏡 Muy pronto podré ayudarte. Por ahora explora las categorías de abajo.' }
    ])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
      <TopBar title="Real Estate" leftIcon="arrow_back" onLeft={onBack} rightContent={
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ padding: '7px 12px', background: TEAL_DIM, border: `1px solid ${TEAL_BORDER}`, borderRadius: 99, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 13 }}>🇲🇽</span>
            <span style={{ fontSize: 11, color: TEAL, fontWeight: 700 }}>MX</span>
          </div>
          <div style={{ padding: '7px 12px', background: TEAL_DIM, border: `1px solid ${TEAL_BORDER}`, borderRadius: 99, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 13 }}>🇺🇸</span>
            <span style={{ fontSize: 11, color: TEAL, fontWeight: 700 }}>US</span>
          </div>
        </div>
      } />

      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Spark Real Estate — asesor (próximamente) */}
        <div style={{ background: 'linear-gradient(135deg, #080f0d, #0d1a14)', border: `1px solid ${TEAL_BORDER}`, borderRadius: 20, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#0f2a1e,#1a3a28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="domain" size={20} style={{ color: TEAL }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: TEAL, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 2px' }}>Asesor de Propiedades</p>
              <p style={{ fontSize: 14, color: '#c8e8d8', fontWeight: 700, margin: 0, fontFamily: FONT.headline }}>Spark · CNG Real Estate</p>
            </div>
            <span style={{ fontSize: 9, color: TEAL, fontWeight: 700, background: TEAL_DIM, border: `1px solid ${TEAL_BORDER}`, padding: '3px 8px', borderRadius: 99 }}>PRONTO</span>
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
              placeholder="¿Comprar, rentar o invertir?"
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${TEAL_BORDER}`, borderRadius: 12, padding: '11px 14px', fontSize: 13, color: '#c8e8d8', fontFamily: FONT.body, outline: 'none' }}
            />
            <button onClick={handleSend} style={{ width: 42, height: 42, background: TEAL, border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="send" size={18} style={{ color: '#0a2010' }} />
            </button>
          </div>
        </div>

        {/* Catálogo real (categorías + propiedades por LOB) */}
        <CatalogSection
          lob="real_estate"
          accent={TEAL}
          columns={1}
          emptyIcon="real_estate_agent"
          emptyTitle="El portafolio de propiedades está por abrir"
          emptySubtitle="Aún no hay propiedades publicadas. Pronto verás aquí casas, departamentos y más en MX y US."
        />

      </div>
      <BackButton onClick={onBack} />
    </div>
  )
}
