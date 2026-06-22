import { Link } from 'react-router-dom'
import { C } from '../../stitch'
import InfoLayout, { Section, Lead, P, Steps, Callout, CTA } from './InfoLayout'

const inlineLink = { color: C.primary, textDecoration: 'none', fontWeight: 600 }

export default function ComoSerVendedor() {
  return (
    <InfoLayout
      kicker="Vender"
      title="Cómo ser vendedor"
      subtitle="Vende ante una comunidad que confía"
    >
      <Lead>
        En Chill N Go no le vendes a desconocidos anónimos: le vendes a una comunidad de miembros
        verificados que valoran la confianza. Y lo mejor: no necesitas ser miembro del club para vender.
        Vender está abierto a cualquier persona o empresa que cumpla nuestro estándar de seriedad.
      </Lead>

      <Section title="Así te conviertes en vendedor">
        <Steps items={[
          { title: 'Regístrate como vendedor.', desc: (<>Entra a la página <Link to="/vender" style={inlineLink}>Vender</Link> y crea tu cuenta de vendedor. Eliges si vendes como persona física o como empresa, y aceptas los términos de vendedor. Es rápido y no requiere invitación.</>) },
          { title: 'Verifica tu identidad.', desc: 'La confianza es el corazón de Chill N Go, y eso empieza contigo. Validamos tu identidad para que los compradores sepan que detrás de tu tienda hay alguien real y responsable. Persona física: verificas con tu INE. Empresa: validamos tus datos fiscales y la identidad de tu representante legal.' },
          { title: 'Cubre tu cuota de verificación.', desc: 'La verificación de vendedor tiene una cuota única: $249 MXN para persona física, $499 MXN para empresa. Cubre el proceso de validación e incluye hasta tres intentos. ¿Por qué una cuota? Porque preferimos una comunidad de vendedores serios y comprometidos sobre una multitud de anuncios sin respaldo. Tu cuota es la señal de que vas en serio —y la garantía de que tus compradores tratan con profesionales como tú.' },
          { title: 'Abre tu tienda y publica.', desc: 'Una vez verificado, abres tu propia tienda dentro de GoShop y empiezas a publicar tus productos: fotos, descripción, precio y detalles. Tu tienda tendrá su propio espacio, y podrás compartirla con quien quieras —dentro y fuera de Chill N Go.' },
        ]} />
      </Section>

      <Callout title="Vende con respaldo, no solo con anuncios.">
        Cuando vendes en Chill N Go, no eres un anuncio más perdido entre millones. Eres un vendedor
        verificado en una comunidad que premia la confianza. Esa es la diferencia. Empieza hoy. Tu tienda
        te espera.
      </Callout>

      <CTA to="/vender">Registrarme como vendedor</CTA>
    </InfoLayout>
  )
}
