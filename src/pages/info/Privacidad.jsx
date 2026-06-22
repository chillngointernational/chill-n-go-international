import { C } from '../../stitch'
import InfoLayout, { Section, P, List, Notice } from './InfoLayout'

// Fecha de publicación — editable.
const UPDATED = '22 de junio de 2026'
const mail = { color: C.primary, textDecoration: 'none', fontWeight: 600 }
const Mail = () => <a href="mailto:contact@chillngointernational.com" style={mail}>contact@chillngointernational.com</a>

export default function Privacidad() {
  return (
    <InfoLayout kicker="Legal" title="Aviso de Privacidad">
      <Notice>
        Última actualización: {UPDATED}. Esta es una versión preliminar de nuestro Aviso de Privacidad.
      </Notice>

      <Section title="Responsable del tratamiento de tus datos">
        <P>
          Chill N Go International ("nosotros") es responsable del tratamiento de tus datos personales
          conforme a la legislación aplicable en materia de protección de datos. Para cualquier asunto
          relacionado con tu privacidad, puedes contactarnos en <Mail />.
        </P>
      </Section>

      <Section title="Datos personales que recabamos">
        <P>Para brindarte nuestros servicios, recabamos las siguientes categorías de datos:</P>
        <List items={[
          { title: 'Datos de identificación y contacto:', desc: 'nombre, correo electrónico, teléfono, y los datos contenidos en tu identificación oficial (INE), incluyendo tu CURP.' },
          { title: 'Datos biométricos:', desc: 'durante la verificación de identidad se realiza una comparación facial y una prueba de vida. Estos datos se procesan a través de nuestro proveedor de verificación con el fin exclusivo de validar tu identidad.' },
          { title: 'Datos fiscales (vendedores):', desc: 'RFC, razón social, constancia de situación fiscal y datos del representante legal, cuando aplique.' },
          { title: 'Datos de transacciones:', desc: 'historial de compras, ventas, membresía y recompensas dentro de la Plataforma.' },
          { title: 'Datos de uso:', desc: 'información sobre cómo interactúas con la Plataforma.' },
        ]} />
      </Section>

      <Section title="Datos personales sensibles">
        <P>
          Reconocemos que algunos de los datos que tratamos —como los datos biométricos y los de tu
          identificación oficial— pueden considerarse sensibles. Su tratamiento se limita estrictamente a
          las finalidades de verificación de identidad y cumplimiento legal, y se realiza con las medidas de
          seguridad correspondientes. Al utilizar nuestro servicio de verificación, otorgas tu consentimiento
          expreso para el tratamiento de estos datos.
        </P>
      </Section>

      <Section title="Finalidades del tratamiento">
        <P>Utilizamos tus datos para:</P>
        <List items={[
          'Verificar tu identidad y mantener la seguridad de la comunidad.',
          'Crear y administrar tu cuenta y tu membresía o perfil de vendedor.',
          'Procesar pagos y transacciones.',
          'Administrar el sistema de recompensas (Chilliums).',
          'Cumplir con obligaciones legales y fiscales aplicables.',
          'Comunicarnos contigo sobre el servicio.',
        ]} />
      </Section>

      <Section title="Tratamiento por terceros">
        <P>Para operar, compartimos ciertos datos con proveedores que nos prestan servicios, entre ellos:</P>
        <List items={[
          'Nuestro proveedor de verificación de identidad, que procesa tus documentos y datos biométricos.',
          'Nuestros procesadores de pago, que gestionan las transacciones.',
        ]} />
        <P>
          Estos proveedores tratan tus datos conforme a sus propias políticas y solo para los fines
          contratados. Chill N Go no almacena las imágenes de tus documentos ni tus datos biométricos crudos;
          conservamos únicamente el resultado de la verificación y los datos mínimos necesarios para operar.
        </P>
      </Section>

      <Section title="Tus derechos (ARCO)">
        <P>
          Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte al tratamiento de tus datos personales
          (derechos ARCO), así como a revocar tu consentimiento. Para ejercer estos derechos, escríbenos a{' '}
          <Mail /> con tu solicitud. Responderemos conforme a los plazos que marca la ley.
        </P>
      </Section>

      <Section title="Seguridad de tus datos">
        <P>
          Implementamos medidas de seguridad administrativas, técnicas y físicas para proteger tus datos
          contra acceso no autorizado, pérdida o alteración. Sin embargo, ningún sistema es completamente
          infalible, y no podemos garantizar seguridad absoluta.
        </P>
      </Section>

      <Section title="Conservación de datos">
        <P>
          Conservamos tus datos durante el tiempo necesario para cumplir con las finalidades descritas y con
          nuestras obligaciones legales. Cuando dejen de ser necesarios, los eliminamos o anonimizamos de
          forma segura.
        </P>
      </Section>

      <Section title="Cambios al Aviso de Privacidad">
        <P>
          Podemos actualizar este Aviso de Privacidad. Publicaremos cualquier cambio en la Plataforma,
          indicando la fecha de la última actualización.
        </P>
      </Section>

      <Section title="Contacto">
        <P>
          Si tienes dudas sobre el tratamiento de tus datos personales, contáctanos en <Mail />.
        </P>
      </Section>
    </InfoLayout>
  )
}
