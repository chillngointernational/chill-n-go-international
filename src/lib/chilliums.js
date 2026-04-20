/**
 * Formateo y helpers para Chilliums.
 *
 * Toda la persistencia de Chilliums vive en centi-chilliums (enteros):
 *   1 Chillium = 100 centi-chilliums = 1 USD
 *
 * El frontend SIEMPRE recibe centi-chilliums desde la DB y debe usar
 * formatChilliums() para convertir a display humano.
 *
 * Politica: floor estricto, 2 decimales siempre, separador de miles en-US.
 *
 * Ejemplos:
 *   formatChilliums(0)       -> '0.00'
 *   formatChilliums(1)       -> '0.01'
 *   formatChilliums(275)     -> '2.75'
 *   formatChilliums(150000)  -> '1,500.00'
 *   formatChilliums(null)    -> '0.00'
 *   formatChilliums(undefined) -> '0.00'
 */

/**
 * Convierte centi-chilliums (bigint/number desde DB) a string formateado.
 * @param {number|bigint|null|undefined} centi - valor en centi-chilliums
 * @returns {string} valor formateado con 2 decimales y separador de miles
 */
export function formatChilliums(centi) {
  if (centi == null) return '0.00';
  const num = Number(centi);
  if (!Number.isFinite(num)) return '0.00';
  return (num / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Convierte Chilliums decimales (legacy, inputs de usuario, UI) a centi-chilliums.
 * Usa Math.floor para mantener la politica de redondeo hacia abajo.
 * @param {number|string} chilliums - valor en Chilliums (puede ser decimal)
 * @returns {number} valor en centi-chilliums (entero)
 */
export function toCentiChilliums(chilliums) {
  const num = Number(chilliums);
  if (!Number.isFinite(num)) return 0;
  return Math.floor(num * 100);
}

/**
 * Convierte centi-chilliums a Chilliums numericos (para calculos, NO para display).
 * Para display siempre usar formatChilliums().
 * @param {number|bigint|null|undefined} centi - valor en centi-chilliums
 * @returns {number} valor en Chilliums decimales
 */
export function fromCentiChilliums(centi) {
  if (centi == null) return 0;
  const num = Number(centi);
  if (!Number.isFinite(num)) return 0;
  return num / 100;
}
