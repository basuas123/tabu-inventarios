import * as XLSX from 'xlsx'

// ── EXPORTAR INVENTARIO DE SUCURSAL ──────────────────────────────────────────
export function exportarInventarioSucursal({ sucursal, productos, cantidades, responsable, semana, año }) {
  const wb = XLSX.utils.book_new()

  const rows = [
    ['TABU SUSHI — INVENTARIO FÍSICO', '', '', ''],
    [`Sucursal: ${sucursal}`, '', '', ''],
    [`Semana: ${semana}  |  Año: ${año}`, '', '', ''],
    [`Responsable: ${responsable || '—'}`, '', '', ''],
    [`Fecha: ${new Date().toLocaleDateString('es-MX')}`, '', '', ''],
    ['', '', '', ''],
    ['GRUPO', 'PRODUCTO', 'UNIDAD', 'CANTIDAD'],
  ]

  let grupoActual = null
  productos.forEach(p => {
    if (p.grupo !== grupoActual) {
      rows.push([p.grupo, '', '', ''])
      grupoActual = p.grupo
    }
    const cant = cantidades[p.id]
    rows.push([
      '',
      p.nombre,
      p.unidad,
      cant !== undefined && cant !== '' ? parseFloat(cant) : '',
    ])
  })

  rows.push(['', '', '', ''])
  const capturados = productos.filter(p => cantidades[p.id] !== undefined && cantidades[p.id] !== '').length
  rows.push([`Total capturados: ${capturados} de ${productos.length}`, '', '', ''])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 26 }, { wch: 42 }, { wch: 12 }, { wch: 14 }]

  // Formato numérico columna CANTIDAD
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let R = 7; R <= range.e.r; R++) {
    const addr = XLSX.utils.encode_cell({ r: R, c: 3 })
    if (ws[addr] && typeof ws[addr].v === 'number') {
      ws[addr].z = '#,##0.000'
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
  XLSX.writeFile(wb, `Inventario_${sucursal.replace(/ /g,'_')}_Sem${semana}.xlsx`)
}

// ── EXPORTAR RESUMEN DIRECCIÓN ────────────────────────────────────────────────
export function exportarResumenDireccion({ sucursales, resumen, semana, año }) {
  const wb = XLSX.utils.book_new()

  const rows = [
    ['TABU SUSHI — RESUMEN EJECUTIVO DE INVENTARIOS', '', '', '', '', ''],
    [`Semana: ${semana}   Año: ${año}`, '', '', '', '', ''],
    [`Generado: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}`, '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['SUCURSAL', 'CAPTURADOS', 'PÉRDIDA ($)', 'SOBRANTE ($)', 'IMPACTO NETO ($)', 'ESTADO'],
  ]

  let totFalt = 0, totSobr = 0, criticas = 0

  sucursales.forEach(s => {
    const r      = resumen[s.k]
    const neto   = r?.neto     !== undefined ? r.neto   : null
    const falt   = r?.faltante !== undefined ? r.faltante : null
    const sobr   = r?.sobrante !== undefined ? r.sobrante : null
    const cap    = r ? `${r.capturados || 0}/${r.total || 0}` : '—'
    const estado = !r ? 'Sin datos'
                 : neto === null ? 'Sin Soft'
                 : neto < -2000 ? 'CRÍTICA'
                 : neto < -500  ? 'REVISAR'
                 : 'OK'

    if (falt !== null) totFalt += falt
    if (sobr !== null) totSobr += sobr
    if (neto !== null && neto < -2000) criticas++

    rows.push([
      s.n,
      cap,
      falt !== null ? Math.abs(falt) : '—',
      sobr !== null ? sobr           : '—',
      neto !== null ? neto           : '—',
      estado,
    ])
  })

  rows.push(['', '', '', '', '', ''])
  rows.push(['TOTAL CADENA', '', Math.abs(totFalt), totSobr, totFalt + totSobr, `${criticas} críticas`])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 12 }]

  // Formato de dinero
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let R = 5; R <= range.e.r; R++) {
    for (let C = 2; C <= 4; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      if (ws[addr] && typeof ws[addr].v === 'number') {
        ws[addr].z = '"$"#,##0.00'
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Resumen ejecutivo')
  XLSX.writeFile(wb, `Resumen_TabuSushi_Sem${semana}_${año}.xlsx`)
}

// ── EXPORTAR ANÁLISIS SOFT ────────────────────────────────────────────────────
export function exportarAnalisisSoft({ sucursal, resultados, totalFalt, totalSobr, neto, semana, año }) {
  const wb = XLSX.utils.book_new()

  // Hoja resumen
  const resumen = [
    ['TABU SUSHI — ANÁLISIS FÍSICO vs SISTEMA (SOFT RESTAURANT)', '', ''],
    [`Sucursal: ${sucursal}`, '', ''],
    [`Semana: ${semana}   Año: ${año}`, '', ''],
    [`Generado: ${new Date().toLocaleDateString('es-MX')}`, '', ''],
    ['', '', ''],
    ['CONCEPTO', 'MONTO ($)', ''],
    ['Pérdida total',  Math.abs(totalFalt), ''],
    ['Sobrante total', totalSobr,           ''],
    ['Impacto neto',   neto,                ''],
    ['Productos con diferencia', resultados.filter(r => r.resultado !== 'OK').length, ''],
  ]
  const wsRes = XLSX.utils.aoa_to_sheet(resumen)
  wsRes['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen')

  // Hoja detalle
  const detalleRows = [
    ['PRODUCTO', 'GRUPO', 'FÍSICO', 'AJUSTADO', 'SISTEMA', 'DIFERENCIA', 'COSTO ($)', 'IMPACTO ($)', 'RESULTADO'],
  ]
  resultados.forEach(r => {
    detalleRows.push([
      r.nombre,
      r.grupo,
      r.fisico,
      parseFloat((r.ajustado || 0).toFixed(3)),
      parseFloat((r.sistema  || 0).toFixed(3)),
      parseFloat((r.dif      || 0).toFixed(3)),
      r.costo || 0,
      parseFloat((r.imp      || 0).toFixed(2)),
      r.resultado,
    ])
  })
  detalleRows.push(['', '', '', '', '', '', '', neto, 'TOTAL'])

  const wsDet = XLSX.utils.aoa_to_sheet(detalleRows)
  wsDet['!cols'] = [
    { wch: 40 }, { wch: 24 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }
  ]

  // Formato dinero columnas G y H
  const range = XLSX.utils.decode_range(wsDet['!ref'])
  for (let R = 1; R <= range.e.r; R++) {
    for (let C of [6, 7]) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      if (wsDet[addr] && typeof wsDet[addr].v === 'number') {
        wsDet[addr].z = '"$"#,##0.00'
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, wsDet, 'Detalle por producto')
  XLSX.writeFile(wb, `Analisis_${sucursal.replace(/ /g,'_')}_Sem${semana}.xlsx`)
}

// ── IMPRIMIR ──────────────────────────────────────────────────────────────────
export function imprimir() {
  window.print()
}
