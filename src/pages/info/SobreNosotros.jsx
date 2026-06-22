import InfoLayout, { Section, Lead, P, List } from './InfoLayout'

export default function SobreNosotros() {
  return (
    <InfoLayout
      kicker="Sobre nosotros"
      title="Chill N Go International"
      subtitle="Reinventamos lo que significa comprar, vender y pertenecer."
    >
      <Lead>
        Chill N Go International es una comunidad global privada de comercio, construida sobre un
        principio que el mercado había olvidado: la confianza no debería ser opcional.
      </Lead>
      <P>
        En un mundo donde los marketplaces se llenaron de anonimato, productos falsos y vendedores
        fantasma, nosotros tomamos el camino contrario. Aquí cada miembro tiene una identidad
        verificada. Cada vendedor es una persona o empresa real, formalmente validada. Y cada
        transacción ocurre dentro de un círculo de confianza al que se entra por invitación.
      </P>
      <P>No somos otro lugar para comprar. Somos un club donde pertenecer tiene valor.</P>

      <Section title="Nuestra filosofía">
        <P>
          Creemos que el comercio es, en su esencia, un acto de confianza entre personas. Cuando
          confías en quien te vende, en quien te invita y en la comunidad que te rodea, todo cambia:
          compras tranquilo, vendes con orgullo y creces acompañado.
        </P>
        <P>Por eso construimos Chill N Go sobre tres pilares que no negociamos:</P>
        <List items={[
          { title: 'Confianza verificada.', desc: 'Todos nuestros miembros y vendedores pasan por un proceso de verificación de identidad. No hay anónimos. No hay fantasmas. Solo personas reales, responsables de lo que ofrecen.' },
          { title: 'Pertenencia con propósito.', desc: 'El acceso por invitación no es exclusividad por exclusividad: es la forma de mantener una comunidad sana, donde cada nuevo miembro llega respaldado por alguien que ya cree en el proyecto.' },
          { title: 'Valor que regresa a la comunidad.', desc: 'A diferencia de las plataformas tradicionales que extraen valor de sus usuarios, nosotros lo regresamos. Cada compra genera Chilliums —nuestras recompensas internas— que premian tanto a quien compra como a quien hace crecer la comunidad.' },
        ]} />
      </Section>

      <Section title="Lo que nos hace diferentes">
        <P>
          Mientras otros marketplaces compiten por ser los más grandes a cualquier costo, nosotros
          competimos por ser los más confiables. Preferimos una comunidad de miembros y vendedores
          comprometidos sobre una multitud anónima. Preferimos relaciones de largo plazo sobre
          transacciones de una sola vez. Preferimos hacer las cosas bien sobre hacerlas rápido.
        </P>
        <P>
          Esa es la diferencia entre un mercado y una comunidad. Entre un usuario y un miembro. Entre
          pasar y pertenecer.
        </P>
      </Section>

      <Section title="Nuestra visión">
        <P>
          Construir la comunidad de comercio de confianza más grande del mundo —una donde millones de
          personas compren, vendan y crezcan juntas, sabiendo que detrás de cada nombre hay una persona
          real, y detrás de cada compra, una comunidad que gana.
        </P>
        <P>Bienvenido a Chill N Go. Bienvenido a un lugar donde perteneces.</P>
      </Section>
    </InfoLayout>
  )
}
