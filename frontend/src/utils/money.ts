/** Formato pesos sin centavos: $1.000 */
export function money(n: number | string | null | undefined) {
  const value = Math.round(Number(n) || 0)
  return (
    '$' +
    value.toLocaleString('es-AR', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    })
  )
}
