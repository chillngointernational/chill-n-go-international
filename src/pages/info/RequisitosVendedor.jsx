import InfoLayout, { Section, Lead, P, List, CTA } from './InfoLayout'

export default function RequisitosVendedor() {
  return (
    <InfoLayout
      kicker="Vender"
      title="Requisitos de vendedor"
      subtitle="Todo lo que necesitas para vender en Chill N Go"
    >
      <Lead>
        Queremos que tu camino para convertirte en vendedor sea claro desde el primer momento. Aquí está
        exactamente lo que necesitas, según el tipo de vendedor que seas.
      </Lead>

      <Section title="Si vendes como persona física">
        <List items={[
          'Identificación oficial (INE) vigente, para verificar tu identidad.',
          'RFC (Registro Federal de Contribuyentes), para tu identificación fiscal.',
          'Cuota de verificación: $249 MXN (pago único).',
        ]} />
      </Section>

      <Section title="Si vendes como empresa">
        <List items={[
          'RFC de la empresa.',
          'Constancia de Situación Fiscal actualizada.',
          'Identificación oficial (INE) del representante legal, para verificar a la persona responsable.',
          'Cuota de verificación: $499 MXN (pago único).',
        ]} />
      </Section>

      <Section title="Qué esperamos de nuestros vendedores">
        <P>
          Verificar tu identidad es solo el comienzo. Al vender en Chill N Go, te comprometes con el
          estándar que define a nuestra comunidad:
        </P>
        <List items={[
          { title: 'Productos reales y bien presentados.', desc: 'Cada publicación debe incluir fotos claras, una descripción honesta, precio y los detalles necesarios. Vendemos confianza, no sorpresas.' },
          { title: 'Cumplimiento.', desc: 'Lo que ofreces es lo que entregas. Los vendedores son responsables de cumplir con sus ventas y de atender a sus compradores con seriedad.' },
          { title: 'Responsabilidad fiscal.', desc: 'Como vendedor, eres responsable de cumplir con tus obligaciones fiscales conforme a la ley aplicable.' },
        ]} />
      </Section>

      <Section title="Por qué pedimos todo esto">
        <P>
          Sabemos que otros lugares te dejan vender sin pedirte nada. Nosotros elegimos el camino
          contrario, a propósito. Cada requisito existe para proteger algo: tu identidad protege a los
          compradores, tu cuota filtra a quienes no van en serio, y tu compromiso construye la reputación
          de toda la comunidad. Cuando todos cumplen el estándar, todos ganan —empezando por ti, porque
          vendes en un lugar donde la gente confía.
        </P>
        <P>No buscamos la mayor cantidad de vendedores. Buscamos los mejores. Y eso te incluye.</P>
      </Section>

      <CTA to="/vender">Quiero vender</CTA>
    </InfoLayout>
  )
}
