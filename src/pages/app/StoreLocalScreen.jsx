import { useState } from 'react'
import { FONT, Icon } from '../../stitch'
import TopBar from '../../components/TopBar'
import BackButton from '../../components/BackButton'
import CatalogSection from '../../components/marketplace/CatalogSection'

const GOLD = '#e7c092'
const GOLD_DIM = 'rgba(231,192,146,0.10)'
const GOLD_BORDER = 'rgba(231,192,146,0.20)'

const CHAT_INIT = [
  { role: 'ai', text: 'Hola 👋 Soy Spark, tu guía de comercios locales. Pronto podré encontrarte el lugar perfecto cerca de ti — dime qué se te antoja o necesitas.' }
]

export default function StoreLocalScreen({ onBack }) {
  const [messages, setMessages] = useState(CHAT_INIT)
  const [input, setInput] = useState('')

  function handleSend() {
    const text = input.trim()
    if (!text) return
    setMessages(prev => [
      ...prev,
      { role: 'user', text },
      { role: 'ai', text: 'Estoy aprendiendo a encontrar comercios y servicios cerca de ti 📍 Muy pronto podré ayudarte. Por ahora explora las categorías de abajo.' }
    ])
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#080C14', minHeight: '100vh' }}>
      <TopBar title="Store Local" leftIcon="arrow_back" onLeft={onBack} rightContent={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}`, borderRadius: 99 }}>
          <div style={{ width: 7, height: 7, borderRadius: 99, background: GOLD }} />
          <span style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>Local</span>
        </div>
      } />

      <div style={{ padding: '0 16px 120px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Spark — directorio local (próximamente) */}
        <div style={{ background: 'linear-gradient(135deg, #100c06, #1a1208)', border: `1px solid ${GOLD_BORDER}`, borderRadius: 20, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg,#2a1a08,#3a2810)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="storefront" size={20} style={{ color: GOLD }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: GOLD, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 2px' }}>Asistente de Comercios</p>
              <p style={{ fontSize: 14, color: '#f5ead8', fontWeight: 700, margin: 0, fontFamily: FONT.headline }}>Spark · Directorio CNG</p>
            </div>
            <span style={{ fontSize: 9, color: GOLD, fontWeight: 700, background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}`, padding: '3px 8px', borderRadius: 99 }}>PRONTO</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                background: '#100e08',
                border: `1px solid ${m.role === 'ai' ? 'rgba(231,192,146,0.15)' : 'rgba(231,192,146,0.1)'}`,
                borderRadius: m.role === 'ai' ? '0 14px 14px 14px' : '14px 14px 0 14px',
                padding: '10px 14px', fontSize: 13,
                color: m.role === 'ai' ? '#e0c88a' : '#f0e4c0',
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
              placeholder="¿Qué se te antoja o necesitas?"
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${GOLD_BORDER}`, borderRadius: 12, padding: '11px 14px', fontSize: 13, color: '#f5ead8', fontFamily: FONT.body, outline: 'none' }}
            />
            <button onClick={handleSend} style={{ width: 42, height: 42, background: GOLD, border: 'none', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="send" size={18} style={{ color: '#1a0e00' }} />
            </button>
          </div>
        </div>

        {/* Catálogo real (categorías + comercios por LOB) */}
        <CatalogSection
          lob="store_local"
          accent={GOLD}
          columns={1}
          emptyIcon="storefront"
          emptyTitle="El directorio local está por abrir"
          emptySubtitle="Aún no hay comercios afiliados publicados. Pronto descubrirás negocios cerca de ti."
        />

      </div>
      <BackButton onClick={onBack} />
    </div>
  )
}
