import { useState } from 'react'
import { FONT, Icon } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'
import CatalogSection from '../../components/marketplace/CatalogSection'

const PURPLE = '#b8a4ff'
const PURPLE_DIM = 'rgba(184,164,255,0.12)'
const PURPLE_BORDER = 'rgba(184,164,255,0.22)'

const CHAT_INIT = [
  { role: 'ai', text: 'Hola 👋 Soy Spark, tu asistente de compras. Pronto podré encontrar productos por ti dentro del catálogo de CNG — escríbeme como le hablas a un amigo.' }
]

export default function StoreScreen({ onBack }) {
  const [messages, setMessages] = useState(CHAT_INIT)
  const [input, setInput] = useState('')

  function handleSend() {
    const text = input.trim()
    if (!text) return
    setMessages(prev => [
      ...prev,
      { role: 'user', text },
      { role: 'ai', text: 'Estoy aprendiendo a buscar dentro del catálogo de CNG 🛍️ Muy pronto podré encontrar exactamente lo que buscas. Por ahora explora las categorías de abajo.' }
    ])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
      <TopBar title="Store Online" leftIcon="arrow_back" onLeft={onBack} rightContent={
        <div style={{ width: 42, height: 42, borderRadius: 13, background: PURPLE_DIM, border: `1px solid ${PURPLE_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🛍</div>
      } />

      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Spark — asistente (próximamente) */}
        <div style={{ background: 'linear-gradient(135deg, #0a0810, #100d1e)', border: `1px solid ${PURPLE_BORDER}`, borderRadius: 20, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#1a1030,#2a1850)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="auto_awesome" size={20} style={{ color: PURPLE }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: PURPLE, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 2px' }}>Asistente de Compras</p>
              <p style={{ fontSize: 14, color: '#ddd8ff', fontWeight: 700, margin: 0, fontFamily: FONT.headline }}>Spark · IA CNG</p>
            </div>
            <span style={{ fontSize: 9, color: PURPLE, fontWeight: 700, background: PURPLE_DIM, border: `1px solid ${PURPLE_BORDER}`, padding: '3px 8px', borderRadius: 99 }}>PRONTO</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                background: m.role === 'ai' ? '#0d1020' : '#12101e',
                border: `1px solid ${m.role === 'ai' ? 'rgba(184,164,255,0.15)' : 'rgba(184,164,255,0.1)'}`,
                borderRadius: m.role === 'ai' ? '0 14px 14px 14px' : '14px 14px 0 14px',
                padding: '10px 14px', fontSize: 13,
                color: m.role === 'ai' ? '#c5b8ff' : '#d8d0ff',
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
              placeholder="Escríbeme como le hablas a un amigo..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${PURPLE_BORDER}`, borderRadius: 12, padding: '11px 14px', fontSize: 13, color: '#ddd8ff', fontFamily: FONT.body, outline: 'none' }}
            />
            <button onClick={handleSend} style={{ width: 42, height: 42, background: PURPLE, border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="send" size={18} style={{ color: '#1a0a2e' }} />
            </button>
          </div>
        </div>

        {/* Catálogo real (categorías + productos por LOB) */}
        <CatalogSection
          lob="store"
          accent={PURPLE}
          columns={2}
          emptyIcon="shopping_bag"
          emptyTitle="La tienda online está por abrir"
          emptySubtitle="Aún no hay productos publicados. Pronto los vendedores de CNG llenarán este espacio."
        />

      </div>
      <BackButton onClick={onBack} />
    </div>
  )
}
