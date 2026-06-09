// ═══════════════════════════════════════════════════════════════════════════════
// ORDEN MAESTRO DE GRUPOS — igual que Soft Restaurant
// Extraído del export INVENTARIOFISICO de Soft (jun 2026).
// Si Soft cambia el orden, edita SOLO esta lista y toda la app se actualiza.
// ═══════════════════════════════════════════════════════════════════════════════
export const ORDEN_GRUPOS = [
  'ABARROTES',
  'ABARROTES BAR',
  'BACANORA',
  'CARNES Y AVES',
  'CERVECERIA',
  'COCA COLA',
  'CONGELADOS',
  'CRISTALERIA BAR',
  'DESECHABLES',
  'FRUTAS Y VERDURAS',
  'LACTEOS Y REFRIGERADOS',
  'LICORES',
  'LIMPIEZA',
  'PAPELERIA U OFICINA',
  'PESCADOS Y MARISCOS',
  'SALSAS Y ADEREZOS',
  'SERVICIO',
  'SUPER ORIENTAL',
  'VINOS',
]

const IDX = {}
ORDEN_GRUPOS.forEach((g, i) => { IDX[g] = i })

// Posición de un grupo en el orden Soft; grupos desconocidos van al final (alfabético)
export function posGrupo(grupo) {
  const g = (grupo || '').toUpperCase().trim()
  return IDX[g] !== undefined ? IDX[g] : ORDEN_GRUPOS.length
}

// Comparador: primero por orden de grupo Soft, luego por nombre de producto
export function compararSoft(a, b) {
  const pa = posGrupo(a.grupo), pb = posGrupo(b.grupo)
  if (pa !== pb) return pa - pb
  const ga = (a.grupo || ''), gb = (b.grupo || '')
  if (pa === ORDEN_GRUPOS.length && ga !== gb) return ga.localeCompare(gb)
  return (a.nombre || '').localeCompare(b.nombre || '')
}

// Ordena una lista de productos/filas con campos {grupo, nombre} al estilo Soft
export function ordenarComoSoft(lista) {
  return [...(lista || [])].sort(compararSoft)
}
