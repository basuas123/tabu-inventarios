import * as XLSX from 'xlsx'

// ── EXPORTAR INVENTARIO DE SUCURSAL ──────────────────────────────────────────
export function exportarInventarioSucursal({ sucursal, productos, cantidades, responsable, semana, año }) {
  const wb = XLSX.utils.book_new()

  // Hoja de inventario
  const rows = [
    ['TABU SUSHI — INVENTARIO FÍSICO'],
    [`Sucursal: ${sucursal}`],
    [`Semana: ${semana} | Año: ${año}`],
    [`Responsable: ${responsable || '—'}`],
    [`Fecha: ${new Date().toLocaleDateString('es-MX')}`],
    [],
    ['GRUPO', 'PRODUCTO', 'UNIDAD', 'CANTIDAD'],
  ]

  let grupoActual = null
  productos.forEach(p => {
    if (p.grupo !== grupoActual) {
      rows.push([p.grupo, '', '', ''])
      grupoActual = p.grupo
    }
    const cant = cantidades[p.id]
    rows.push(['', p.nombre, p.unidad, cant !== undefined && cant !== '' ? parseFloat(cant) : ''])
  })

  rows.push([])
  rows.push([`Total capturados: ${productos.filter(p => cantidades[p.id] !== undefined && cantidades[p.id] !== '').length} de ${productos.length}`])

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Anchos de columna
  ws['!cols'] = [{ wch: 25 }, { wch: 40 }, { wch: 12 }, { wch: 14 }]

  XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
  XLSX.writeFile(wb, `Inventario_${sucursal.replace(/ /g,'_')}_Sem${semana}.xlsx`)
}

// ── EXPORTAR RESUMEN DIRECCIÓN ────────────────────────────────────────────────
export function exportarResumenDireccion({ sucursales, resumen, semana, año }) {
  const wb = XLSX.utils.book_new()

  // Hoja resumen
  const rows = [
    ['TABU SUSHI — RESUMEN EJECUTIVO DE INVENTARIOS'],
    [`Semana: ${semana} | Año: ${año}`],
    [`Generado: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}`],
    [],
    ['SUCURSAL', 'PRODUCTOS CAPTURADOS', 'PÉRDIDA ($)', 'SOBRANTE ($)', 'IMPACTO NETO ($)', 'ESTADO'],
  ]

  let totFalt = 0, totSobr = 0

  sucursales.forEach(s => {
    const r = resumen[s.k]
    const neto     = r?.neto ?? null
    const faltante = r?.faltante ?? null
    const sobrante = r?.sobrante ?? null
    const estado   = !r ? 'Sin datos' : neto < -2000 ? 'CRÍTICA' : neto < -500 ? 'REVISAR' : 'OK'
    const cap      = r ? `${r.capturados || 0}/${r.total || 0}` : '—'

    if (faltante) totFalt += faltante
    if (sobrante) totSobr += sobrante

    rows.push([
      s.n,
      cap,
      faltante !== null ? faltante : '—',
      sobrante !== null ? sobrante : '—',
      neto     !== null ? neto     : '—',
      estado,
    ])
  })

  rows.push([])
  rows.push(['TOTALES', '', totFalt, totSobr, totFalt + totSobr, ''])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 32 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Resumen')

  XLSX.writeFile(wb, `Resumen_TabuSushi_Sem${semana}_${año}.xlsx`)
}

// ── EXPORTAR ANÁLISIS SOFT ────────────────────────────────────────────────────
export function exportarAnalisisSoft({ sucursal, resultados, totalFalt, totalSobr, neto, semana, año }) {
  const wb = XLSX.utils.book_new()

  const rows = [
    ['TABU SUSHI — ANÁLISIS FÍSICO vs SISTEMA (SOFT RESTAURANT)'],
    [`Sucursal: ${sucursal}`],
    [`Semana: ${semana} | Año: ${año}`],
    [`Generado: ${new Date().toLocaleDateString('es-MX')}`],
    [],
    ['RESUMEN'],
    ['Pérdida total ($)', totalFalt],
    ['Sobrante total ($)', totalSobr],
    ['Impacto neto ($)', neto],
    ['Productos con diferencia', resultados.filter(r => r.resultado !== 'OK').length],
    [],
    ['DETALLE POR PRODUCTO'],
    ['PRODUCTO', 'GRUPO', 'FÍSICO', 'AJUSTADO (c/merma)', 'SISTEMA (Soft)', 'DIFERENCIA', 'COSTO ($)', 'IMPACTO ($)', 'RESULTADO'],
  ]

  resultados.forEach(r => {
    rows.push([
      r.nombre,
      r.grupo,
      r.fisico,
      parseFloat(r.ajustado?.toFixed(3) || 0),
      parseFloat(r.sistema?.toFixed(3) || 0),
      parseFloat(r.dif?.toFixed(3) || 0),
      r.costo,
      parseFloat(r.imp?.toFixed(2) || 0),
      r.resultado,
    ])
  })

  rows.push([])
  rows.push(['', '', '', '', '', '', '', neto, 'TOTAL'])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 38 }, { wch: 22 }, { wch: 10 }, { wch: 16 },
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Análisis')

  XLSX.writeFile(wb, `Analisis_${sucursal.replace(/ /g,'_')}_Sem${semana}.xlsx`)
}

// ── IMPRIMIR (abre ventana de impresión del navegador) ────────────────────────
export function imprimir() {
  window.print()
}
