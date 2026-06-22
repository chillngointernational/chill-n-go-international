import { Link } from 'react-router-dom'
import { C } from '../../stitch'
import InfoLayout, { Section, Lead, P, List, Steps } from './InfoLayout'

const inlineLink = { color: C.primary, textDecoration: 'none', fontWeight: 600 }

export default function ComoFunciona() {
  return (
    <InfoLayout
      kicker="Cómo funciona"
      title="Cómo funciona"
      subtitle="Tu camino dentro de Chill N Go"
    >
      <Lead>
        Chill N Go no es un sitio donde simplemente entras y compras. Es una comunidad a la que
        perteneces. Por eso el camino para formar parte está pensado para proteger a todos: a ti, a
        quien te invita y a la comunidad entera. Así funciona.
      </Lead>

      <Section title="Para miembros">
        <Steps items={[
          { title: 'Recibes una invitación.', desc: 'El acceso a Chill N Go es por invitación. Cada miembro activo cuenta con un enlace personal que puede compartir con las personas en quienes confía. Cuando alguien entra con tu invitación, queda vinculado a ti dentro de la comunidad —y eso, más adelante, tiene recompensas. ¿Por qué por invitación? Porque una comunidad de confianza no se construye dejando entrar a todos, sino dejando entrar a los correctos.' },
          { title: 'Verificas tu identidad.', desc: 'Antes de activarte como miembro, validamos tu identidad con tu credencial oficial (INE). Este paso, que toma solo unos minutos, es lo que garantiza que detrás de cada perfil hay una persona real. Es la base de la confianza que nos distingue. Tus datos se procesan de forma segura a través de nuestro proveedor de verificación de identidad. Chill N Go no almacena tus documentos: solo conservamos el resultado de la validación y los datos mínimos necesarios.' },
          { title: 'Activas tu membresía.', desc: 'La membresía Chill N Go es una suscripción mensual de $140 MXN que te da acceso completo a la comunidad: comprar en GoShop, interactuar con otros miembros, acceder a beneficios exclusivos como nuestra alianza de viajes, y participar en el sistema de recompensas.' },
          { title: 'Compras, participas y ganas.', desc: 'Con tu membresía activa, el mundo de Chill N Go se abre. Explora GoShop, compra a vendedores verificados, comparte el feed de la comunidad, y empieza a ganar Chilliums —nuestras recompensas internas— por tus propias compras y por las compras de las personas que invitaste.' },
        ]} />
      </Section>

      <Section title="Sobre los Chilliums">
        <P>Los Chilliums son las recompensas internas de Chill N Go. Los ganas de dos formas:</P>
        <List items={[
          { title: 'Por tus propias compras:', desc: 'cada compra que haces en GoShop te devuelve Chilliums, como un cashback de la comunidad.' },
          { title: 'Por las compras de tu red:', desc: 'cuando las personas que invitaste compran, tú también ganas Chilliums.' },
        ]} />
        <P>
          Los Chilliums se usan dentro de Chill N Go para obtener más valor de tu membresía. Mientras
          más activa es tu comunidad, más ganas.
        </P>
      </Section>

      <Section title="Para vendedores">
        <P>
          Vender en Chill N Go está abierto a cualquier persona o empresa —no necesitas ser miembro del
          club. Los vendedores pasan por su propio proceso de verificación formal para garantizar que
          GoShop sea un lugar de comercio serio y confiable.
        </P>
        <P>
          Conoce el proceso completo en{' '}
          <Link to="/como-ser-vendedor" style={inlineLink}>Cómo ser vendedor</Link>.
        </P>
      </Section>

      <Section title="Una comunidad que se cuida sola">
        <P>
          Cada pieza de este modelo —la invitación, la verificación, la membresía, las recompensas—
          existe por una razón: mantener Chill N Go como un espacio donde la confianza no es una
          promesa, sino una garantía.
        </P>
        <P>Así es como funciona. Así es como crecemos juntos.</P>
      </Section>
    </InfoLayout>
  )
}
