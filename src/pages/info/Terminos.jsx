import { C } from '../../stitch'
import InfoLayout, { Section, P, Notice } from './InfoLayout'

// Fecha de publicación — editable.
const UPDATED = '22 de junio de 2026'
const mail = { color: C.primary, textDecoration: 'none', fontWeight: 600 }

export default function Terminos() {
  return (
    <InfoLayout kicker="Legal" title="Términos y Condiciones">
      <Notice>
        Última actualización: {UPDATED}. Esta es una versión preliminar de nuestros Términos y
        Condiciones. Te recomendamos revisarla periódicamente, ya que puede actualizarse.
      </Notice>

      <Section title="1. Aceptación de los términos">
        <P>
          Al acceder y utilizar Chill N Go International ("la Plataforma", "nosotros"), aceptas estos
          Términos y Condiciones en su totalidad. Si no estás de acuerdo con ellos, no debes utilizar la
          Plataforma. El uso continuado de Chill N Go constituye tu aceptación de estos términos y de
          cualquier modificación futura.
        </P>
      </Section>

      <Section title="2. Descripción del servicio">
        <P>
          Chill N Go es una comunidad privada de comercio por invitación que conecta a miembros y
          vendedores verificados. La Plataforma permite a sus usuarios comprar y vender productos y
          servicios, participar en una comunidad, y acceder a un sistema de recompensas internas
          (Chilliums). El acceso como miembro es por invitación y requiere una membresía de pago. La venta
          está abierta a personas y empresas que completen el proceso de verificación de vendedor.
        </P>
      </Section>

      <Section title="3. Registro, cuentas e identidad">
        <P>
          Para participar, debes crear una cuenta y, según tu rol, completar un proceso de verificación de
          identidad. Te comprometes a proporcionar información veraz, completa y actualizada. Eres
          responsable de mantener la confidencialidad de tus credenciales de acceso y de toda actividad que
          ocurra bajo tu cuenta. Nos reservamos el derecho de suspender o cancelar cuentas con información
          falsa, fraudulenta o que incumplan estos términos.
        </P>
      </Section>

      <Section title="4. Membresía y pagos">
        <P>
          La membresía de Chill N Go es una suscripción mensual recurrente. Al activarla, autorizas el
          cargo periódico correspondiente. La membresía no es reembolsable, incluso si no se completa la
          verificación de identidad o si no se utiliza el servicio. Puedes cancelar la renovación de tu
          membresía en cualquier momento; la cancelación detiene cargos futuros pero no genera reembolsos de
          periodos ya pagados. Los pagos se procesan a través de proveedores externos de pago.
        </P>
      </Section>

      <Section title="5. Verificación de identidad">
        <P>
          La Plataforma requiere la verificación de identidad de sus miembros y vendedores a través de un
          proveedor externo de verificación. Al completar este proceso, autorizas el tratamiento de tu
          información de identidad conforme a nuestro Aviso de Privacidad. Una verificación fallida puede
          impedir la activación de tu cuenta, y los pagos realizados no son reembolsables por este motivo.
        </P>
      </Section>

      <Section title="6. Vendedores">
        <P>
          Los vendedores deben completar la verificación de vendedor, que incluye una cuota única no
          reembolsable. Como vendedor, eres el único responsable de: la veracidad de tus publicaciones, la
          calidad y entrega de tus productos, la atención a tus compradores, y el cumplimiento de todas tus
          obligaciones fiscales y legales aplicables. Chill N Go actúa como plataforma de intermediación y no
          es responsable de las transacciones entre vendedores y compradores, sin perjuicio de las medidas
          que podamos tomar para proteger a la comunidad.
        </P>
      </Section>

      <Section title="7. Recompensas (Chilliums)">
        <P>
          Los Chilliums son recompensas internas sin valor monetario, no son dinero, no son canjeables por
          efectivo y no son retirables. Se otorgan y utilizan exclusivamente dentro de la Plataforma conforme
          a las reglas vigentes, que podemos modificar. Los Chilliums no constituyen una inversión ni una
          promesa de rendimiento económico.
        </P>
      </Section>

      <Section title="8. Conducta del usuario">
        <P>
          Te comprometes a utilizar la Plataforma de forma lícita y respetuosa. Queda prohibido: publicar
          contenido o productos ilegales, fraudulentos o que infrinjan derechos de terceros; suplantar
          identidades; manipular el sistema de recompensas; y cualquier uso que dañe a la comunidad o a la
          Plataforma. Nos reservamos el derecho de retirar contenido y suspender cuentas que incumplan estas
          normas.
        </P>
      </Section>

      <Section title="9. Propiedad intelectual">
        <P>
          Todo el contenido de la Plataforma (marca, logotipos, diseño, software) es propiedad de Chill N Go
          International o de sus licenciantes y está protegido por las leyes aplicables. No se permite su uso
          sin autorización.
        </P>
      </Section>

      <Section title="10. Limitación de responsabilidad">
        <P>
          La Plataforma se ofrece "tal cual". En la máxima medida permitida por la ley, Chill N Go no será
          responsable por daños indirectos, incidentales o consecuentes derivados del uso de la Plataforma,
          ni por las acciones de otros usuarios, vendedores o compradores.
        </P>
      </Section>

      <Section title="11. Modificaciones">
        <P>
          Podemos modificar estos Términos en cualquier momento. Los cambios entrarán en vigor al publicarse
          en la Plataforma. El uso continuado tras una modificación constituye tu aceptación de los nuevos
          términos.
        </P>
      </Section>

      <Section title="12. Contacto">
        <P>
          Para cualquier duda sobre estos Términos, contáctanos en{' '}
          <a href="mailto:contact@chillngointernational.com" style={mail}>contact@chillngointernational.com</a>.
        </P>
      </Section>
    </InfoLayout>
  )
}
