// Lógica de cotización de Envia COMPARTIDA entre cng-shipping-quote (mostrar opciones) y
// cng-mp-create-order (RE-COTIZAR al pagar). Fuente ÚNICA del shape del request /ship/rate/ y del
// parseo -> garantiza que el precio re-cotizado al cobrar coincide EXACTO con el mostrado.
// Puro (sin DB): cada edge resuelve sus datos y llama estas funciones con los mismos insumos.

export const ENVIA_TEST_HOST = 'https://api-test.envia.com'
export const CARRIER_TIMEOUT_MS = 8000

export interface OriginRow {
  contact_name: string; phone: string; email?: string | null; street: string; ext_number: string;
  int_number?: string | null; district: string; city: string; state: string; postal_code: string;
  country?: string | null; reference?: string | null;
}
export interface RateOption {
  carrier: string; carrier_label: string; service: string | null; service_description: string | null;
  price: number; currency: string; delivery_estimate: string | null; delivery_date: string | null;
}

// Construye el body base de /ship/rate/ (sin el carrier; se agrega por llamada en quoteCarrier).
export function buildRateBase(opts: {
  origin: OriginRow;
  destCity?: string; destState?: string; destCountry?: string; destPostalCode: string;
  weightGrams: number; lengthCm: number; widthCm: number; heightCm: number;
  declaredValue: number; content: string; quantity: number; currency: string;
}) {
  const o = opts.origin
  return {
    origin: {
      name: o.contact_name, company: 'CNG', email: o.email || 'envios@chillngointernational.com',
      phone: o.phone, street: o.street, number: o.ext_number,
      district: o.district, city: o.city, state: o.state, country: o.country || 'MX',
      postalCode: o.postal_code,
      reference: [o.reference, o.int_number ? `Int. ${o.int_number}` : null].filter(Boolean).join(' · ') || undefined,
    },
    destination: {
      name: 'Cliente', company: 'CNG', email: 'cliente@chillngointernational.com', phone: '0000000000',
      street: '-', number: '0', district: '-',
      city: String(opts.destCity || '-'), state: String(opts.destState || '-'),
      country: String(opts.destCountry || 'MX'), postalCode: String(opts.destPostalCode),
    },
    packages: [{
      type: 'box', content: String(opts.content || 'Producto').slice(0, 40), amount: opts.quantity,
      declaredValue: Number(opts.declaredValue), weight: Number(opts.weightGrams) / 1000, weightUnit: 'KG',
      lengthUnit: 'CM', dimensions: { length: Number(opts.lengthCm), width: Number(opts.widthCm), height: Number(opts.heightCm) },
    }],
    settings: { currency: opts.currency || 'MXN' },
  }
}

// Cotiza UN carrier (con timeout propio). Devuelve opciones normalizadas; [] ante timeout / error /
// sin cobertura (data vacío). Así un carrier lento/caído no tumba al resto en el fan-out.
export async function quoteCarrier(
  host: string, token: string, base: unknown, carrier: { code: string; label?: string }, timeoutMs = CARRIER_TIMEOUT_MS,
): Promise<RateOption[]> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(`${host}/ship/rate/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(base as Record<string, unknown>), shipment: { type: 1, carrier: carrier.code } }),
      signal: ctrl.signal,
    })
    const data: any = await r.json().catch(() => null)
    if (!data || data.meta !== 'rate' || !Array.isArray(data.data)) return []
    return data.data
      .map((x: any): RateOption => ({
        carrier: x.carrier || carrier.code,
        carrier_label: carrier.label || carrier.code,
        service: x.service ?? null,
        service_description: x.serviceDescription ?? null,
        price: Number(x.totalPrice),
        currency: x.currency || (base as any)?.settings?.currency || 'MXN',
        delivery_estimate: x.deliveryEstimate ?? null,
        delivery_date: x.deliveryDate?.date ?? null,
      }))
      .filter((x: RateOption) => Number.isFinite(x.price) && x.price >= 0)
  } catch {
    return []
  } finally {
    clearTimeout(t)
  }
}
