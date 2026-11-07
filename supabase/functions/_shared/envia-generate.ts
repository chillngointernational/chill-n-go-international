// E-6: builder PURO del body de POST /ship/generate/ (GENERA la guía con Envia). Hermano de
// buildRateBase (./envia-rate.ts) pero para GENERAR, no cotizar. NO modifica nada de envia-rate.ts.
//
// Diferencias clave vs la COTIZACIÓN (/ship/rate/):
//   1) destination va con datos REALES del comprador (la cotización manda placeholders —name 'Cliente',
//      phone '0000000000', street '-'— porque /ship/rate/ solo necesita CP+ciudad+estado; la guía los
//      IMPRIME en físico, así que deben ser reales).
//   2) shipment.service es OBLIGATORIO (la cotización lo omite y Envia devuelve TODOS los servicios;
//      generar compra UN servicio específico).
//   origin / packages / settings / Bearer se reúsan igual que en la cotización.
//
// input = los 6 insumos CONGELADOS que devuelve rpc_claim_label (Pieza 3): origin_snapshot,
// package_snapshot, declared_value_cents, shipping_address (destino real), shipping_carrier,
// shipping_service. content/quantity/currency son OPCIONALES (el edge los toma de order_items/listing).
// PURO: sin DB ni red. El fetch a `${host}${ENVIA_GENERATE_PATH}` con Bearer lo hace el edge.

export const ENVIA_GENERATE_PATH = '/ship/generate/'

// origin_snapshot: forma que congela cng-mp-create-order (Pieza 2) — claves "de salida" de Envia.
export interface OriginSnapshot {
  name: string; phone: string; email?: string | null; street: string; number: string;
  district: string; city: string; state: string; postal_code: string;
  country?: string | null; reference?: string | null;
}
// shipping_address: orders.shipping_address — forma CRUDA del comprador (buyer_addresses).
export interface DestinationSnapshot {
  contact_name: string; phone: string; email?: string | null; street: string; ext_number: string;
  int_number?: string | null; district: string; city: string; state: string; postal_code: string;
  country?: string | null; reference?: string | null;
}
export interface PackageSnapshot {
  weight_grams: number; length_cm: number; width_cm: number; height_cm: number;
}
export interface GenerateInput {
  origin_snapshot: OriginSnapshot;
  package_snapshot: PackageSnapshot;
  declared_value_cents: number;
  shipping_address: DestinationSnapshot;
  shipping_carrier: string;
  shipping_service: string;
  content?: string;   // qué va dentro (default 'Producto'); el edge puede pasar el título del producto
  quantity?: number;  // amount / nº de paquetes (default 1)
  currency?: string;  // default 'MXN'
}

export function buildGenerateBody(input: GenerateInput) {
  const o = input.origin_snapshot
  const d = input.shipping_address
  const p = input.package_snapshot
  return {
    // origin REAL (ya venía real en la cotización; aquí solo cambian las claves del snapshot a las de Envia).
    origin: {
      name: o.name, company: 'CNG', email: o.email || 'envios@chillngointernational.com',
      phone: o.phone, street: o.street, number: o.number,
      district: o.district, city: o.city, state: o.state,
      country: o.country || 'MX', postalCode: o.postal_code,
      reference: o.reference || undefined,
    },
    // destination REAL del comprador (EL punto crítico vs la cotización, que mandaba placeholders).
    destination: {
      name: d.contact_name, email: d.email || 'cliente@chillngointernational.com',
      phone: d.phone, street: d.street, number: d.ext_number,
      district: d.district, city: d.city, state: d.state,
      country: d.country || 'MX', postalCode: d.postal_code,
      reference: [d.reference, d.int_number ? `Int. ${d.int_number}` : null].filter(Boolean).join(' · ') || undefined,
    },
    packages: [{
      type: 'box',
      content: String(input.content || 'Producto').slice(0, 40),
      amount: input.quantity ?? 1,
      declaredValue: Math.round(input.declared_value_cents) / 100,   // centavos -> pesos
      weight: Number(p.weight_grams) / 1000, weightUnit: 'KG',
      lengthUnit: 'CM',
      dimensions: { length: Number(p.length_cm), width: Number(p.width_cm), height: Number(p.height_cm) },
    }],
    // service OBLIGATORIO aquí (la cotización solo manda { type:1, carrier }).
    shipment: { carrier: input.shipping_carrier, service: input.shipping_service, type: 1 },
    settings: { currency: input.currency || 'MXN' },
  }
}
