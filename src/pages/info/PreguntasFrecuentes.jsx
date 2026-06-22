import { useState } from 'react'
import { C, FONT } from '../../stitch'
import InfoLayout, { Section } from './InfoLayout'

// Acordeón accesible (controlado). Cada pregunta abre/cierra su respuesta.
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          padding: '16px 2px', color: C.text, fontFamily: FONT.body, fontSize: 15.5, fontWeight: 600, lineHeight: 1.45,
        }}
      >
        <span>{q}</span>
        <span aria-hidden="true" style={{ color: C.primary, fontSize: 22, fontWeight: 400, flexShrink: 0, lineHeight: 1, transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease' }}>+</span>
      </button>
      {open && (
        <p style={{ fontSize: 15, color: C.onSurfaceVariant, lineHeight: 1.72, margin: '0', padding: '0 2px 18px' }}>{a}</p>
      )}
    </div>
  )
}

const GROUPS = [
  {
    title: 'Sobre Chill N Go',
    items: [
      { q: '¿Qué es Chill N Go?', a: 'Chill N Go International es una comunidad privada de comercio por invitación. Reunimos a miembros y vendedores con identidad verificada en un espacio confiable para comprar, vender y ganar recompensas. No somos un marketplace anónimo: somos una comunidad donde cada persona es real y verificada.' },
      { q: '¿Por qué es por invitación?', a: 'Porque la confianza no se construye dejando entrar a todos. El modelo de invitación mantiene la comunidad sana: cada nuevo miembro llega respaldado por alguien que ya forma parte. Así protegemos la calidad y la seguridad de todos.' },
      { q: '¿En qué países está disponible?', a: 'Chill N Go es una comunidad internacional en crecimiento. Estamos expandiéndonos de forma cuidadosa para mantener la calidad de la experiencia en cada mercado donde llegamos.' },
    ],
  },
  {
    title: 'Membresía',
    items: [
      { q: '¿Cuánto cuesta la membresía?', a: 'La membresía Chill N Go cuesta $140 MXN al mes. Con esta suscripción obtienes acceso completo a la comunidad: comprar en GoShop, ganar Chilliums, acceder a beneficios exclusivos y participar en el feed.' },
      { q: '¿Qué incluye mi membresía?', a: 'Por tus $140 MXN mensuales obtienes: acceso completo a GoShop, el sistema de recompensas Chilliums, beneficios exclusivos como nuestra alianza de viajes, la capacidad de invitar a otros, y participar en la comunidad.' },
      { q: '¿Puedo cancelar cuando quiera?', a: 'Sí. La membresía es una suscripción mensual que puedes gestionar según los términos del servicio.' },
      { q: '¿Por qué tengo que verificar mi identidad?', a: 'La verificación de identidad es el corazón de la confianza en Chill N Go. Garantiza que cada miembro es una persona real, lo que protege a toda la comunidad de fraudes y anonimato. Es lo que nos hace diferentes.' },
    ],
  },
  {
    title: 'Chilliums',
    items: [
      { q: '¿Qué son los Chilliums?', a: 'Son las recompensas internas de Chill N Go. Los ganas por tus propias compras y por las compras de las personas que invitas a la comunidad.' },
      { q: '¿Los Chilliums son dinero?', a: 'No. Los Chilliums son recompensas que se usan dentro de Chill N Go para obtener más valor de tu experiencia. No son dinero retirable.' },
      { q: '¿Cómo gano Chilliums?', a: 'De dos formas: cuando tú compras en GoShop (un cashback de la comunidad), y cuando las personas que invitaste compran. Mientras más activa tu comunidad, más ganas.' },
    ],
  },
  {
    title: 'Para vendedores',
    items: [
      { q: '¿Necesito ser miembro para vender?', a: 'No. Vender en Chill N Go está abierto a cualquier persona o empresa. Solo necesitas completar el proceso de verificación de vendedor.' },
      { q: '¿Qué necesito para vender?', a: 'Si eres persona física: tu INE y RFC. Si eres empresa: RFC, constancia de situación fiscal e identificación del representante legal. Todos los vendedores se verifican para garantizar un comercio confiable.' },
      { q: '¿Hay un costo para vender?', a: 'Hay una cuota única de verificación de vendedor ($249 MXN persona física / $499 MXN empresa) que cubre tu proceso de validación. Esto nos permite mantener una comunidad de vendedores serios y profesionales.' },
      { q: '¿Por qué cobran una cuota de verificación?', a: 'Porque preferimos una comunidad de vendedores comprometidos sobre una multitud de anuncios sin respaldo. La cuota cubre el costo de verificar tu identidad y filtra a quienes no van en serio, protegiendo la calidad de GoShop.' },
    ],
  },
  {
    title: 'Seguridad y datos',
    items: [
      { q: '¿Qué hacen con mis datos de identidad?', a: 'Tu identidad se valida de forma segura a través de nuestro proveedor de verificación. Chill N Go no almacena tus documentos: solo conservamos el resultado de la validación y los datos mínimos necesarios.' },
      { q: '¿Es seguro pagar en Chill N Go?', a: 'Sí. Los pagos se procesan a través de Mercado Pago, con sus protecciones de seguridad estándar de la industria.' },
    ],
  },
]

export default function PreguntasFrecuentes() {
  return (
    <InfoLayout kicker="Ayuda" title="Preguntas Frecuentes">
      {GROUPS.map((g) => (
        <Section key={g.title} title={g.title}>
          <div>
            {g.items.map((it) => <FaqItem key={it.q} q={it.q} a={it.a} />)}
          </div>
        </Section>
      ))}
    </InfoLayout>
  )
}
