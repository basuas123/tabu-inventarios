import * as XLSX from 'xlsx'

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTAR INVENTARIO SUCURSAL
// Columnas en pantalla: GRUPO | PRODUCTO | UNIDAD | CANTIDAD
// ═══════════════════════════════════════════════════════════════════════════════
export function exportarInventarioSucursal({ sucursal, productos, cantidades, responsable, semana, año }) {
  const wb = XLSX.utils.book_new()

  // Encabezado igual que en pantalla
  const rows = [
    ['TABU SUSHI  |  ' + sucursal.toUpperCase(), '', '', ''],
    ['Fecha: ' + new Date().toLocaleDateString('es-MX') + '   Semana: ' + semana + '   Año: ' + año, '', '', ''],
    ['Responsable: ' + (responsable || '—'), '', '', ''],
    ['', '', '', ''],
    // Encabezados de columna idénticos a pantalla
    ['GRUPO', 'PRODUCTO', 'UNIDAD', 'CANTIDAD'],
  ]

  // Productos agrupados igual que en pantalla
  let grupoActual = null
  productos.forEach(p => {
    if (p.grupo !== grupoActual) {
      // Fila de grupo (igual que la barra azul de pantalla)
      rows.push([p.grupo, '', '', ''])
      grupoActual = p.grupo
    }
    const cant = cantidades[p.id]
    rows.push([
      '',
      p.nombre,
      p.unidad,
      cant !== undefined && cant !== '' ? parseFloat(cant) : 0,
    ])
  })

  rows.push(['', '', '', ''])
  const cap = productos.filter(p => cantidades[p.id] !== undefined && cantidades[p.id] !== '').length
  rows.push(['TOTAL CAPTURADOS: ' + cap + ' de ' + productos.length, '', '', ''])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 26 }, { wch: 44 }, { wch: 12 }, { wch: 14 }]

  // Formato cantidad con 3 decimales
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let R = 5; R <= range.e.r; R++) {
    const a = XLSX.utils.encode_cell({ r: R, c: 3 })
    if (ws[a] && typeof ws[a].v === 'number') ws[a].z = '#,##0.000'
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
  XLSX.writeFile(wb, 'Inventario_' + sucursal.replace(/ /g, '_') + '_Sem' + semana + '.xlsx')
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTAR RESUMEN DIRECCIÓN
// Columnas en pantalla: Sucursal | Capturados | Faltante ($) | Sobrante ($) | Impacto neto ($) | Estado | Responsable
// ═══════════════════════════════════════════════════════════════════════════════
export function exportarResumenDireccion({ sucursales, resumen, semana, año }) {
  const wb = XLSX.utils.book_new()

  const rows = [
    ['PANEL EJECUTIVO — TABU SUSHI', '', '', '', '', '', ''],
    ['Semana: ' + semana + '   |   Año: ' + año + '   |   Generado: ' + new Date().toLocaleDateString('es-MX'), '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    // Encabezados idénticos a pantalla (sin la columna del semáforo que es visual)
    ['SUCURSAL', 'CAPTURADOS', 'FALTANTE ($)', 'SOBRANTE ($)', 'IMPACTO NETO ($)', 'ESTADO', 'RESPONSABLE'],
  ]

  let totFalt = 0, totSobr = 0, criticas = 0, sinDatos = 0

  sucursales.forEach(s => {
    const r     = resumen[s.k]
    const neto  = r?.neto     !== undefined ? r.neto     : null
    const falt  = r?.faltante !== undefined ? r.faltante : null
    const sobr  = r?.sobrante !== undefined ? r.sobrante : null
    const cap   = r ? (r.capturados || 0) + '/' + (r.total || 0) : '—'
    const estado = !r              ? 'Sin datos'
                 : neto === null   ? 'Sin Soft'
                 : neto < -2000   ? 'CRÍTICA'
                 : neto < -500    ? 'REVISAR'
                 : 'OK'

    if (falt !== null) totFalt += falt
    if (sobr !== null) totSobr += sobr
    if (neto !== null && neto < -2000) criticas++
    if (!r || r.capturados === 0) sinDatos++

    rows.push([
      s.n,
      cap,
      falt !== null ? Math.abs(falt) : '—',
      sobr !== null ? sobr           : '—',
      neto !== null ? neto           : '—',
      estado,
      r?.responsable || '—',
    ])
  })

  // Totales igual que los KPIs de pantalla
  rows.push(['', '', '', '', '', '', ''])
  rows.push([
    'TOTAL CADENA',
    '',
    Math.abs(totFalt),
    totSobr,
    totFalt + totSobr,
    criticas + ' críticas  |  ' + sinDatos + ' sin datos',
    '',
  ])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 34 }, { wch: 12 }, { wch: 16 },
    { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 20 },
  ]

  // Formato dinero columnas C, D, E (índices 2,3,4)
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let R = 4; R <= range.e.r; R++) {
    for (let C of [2, 3, 4]) {
      const a = XLSX.utils.encode_cell({ r: R, c: C })
      if (ws[a] && typeof ws[a].v === 'number') ws[a].z = '"$"#,##0.00'
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Panel ejecutivo')
  XLSX.writeFile(wb, 'Resumen_TabuSushi_Sem' + semana + '_' + año + '.xlsx')
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTAR ANÁLISIS SOFT
// Columnas en pantalla: Producto | Grupo | Físico | Sistema (Soft) | Diferencia | Costo ($) | Impacto ($) | Resultado
// ═══════════════════════════════════════════════════════════════════════════════
export function exportarAnalisisSoft({ sucursal, resultados, totalFalt, totalSobr, neto, semana, año, softData }) {
  const wb = XLSX.utils.book_new()

  // ── Hoja 1: Resumen (KPIs de pantalla) ────────────────────────────────────
  const resumen = [
    ['ANÁLISIS FÍSICO vs SISTEMA (SOFT RESTAURANT)', '', ''],
    ['Sucursal: ' + sucursal, '', ''],
    ['Semana: ' + semana + '   |   Año: ' + año, '', ''],
    ['Generado: ' + new Date().toLocaleDateString('es-MX'), '', ''],
    ['', '', ''],
    ['PÉRDIDA ($)',        Math.abs(totalFalt), ''],
    ['SOBRANTE ($)',       totalSobr,           ''],
    ['IMPACTO NETO ($)',   neto,                ''],
    ['CON DIFERENCIA',     resultados.filter(r => r.resultado !== 'OK').length, ''],
    ['SIN CAPTURAR',
      softData ? Object.keys(softData).filter(n => !resultados.some(r => r.nombre === n)).length : 0, ''],
  ]
  const wsRes = XLSX.utils.aoa_to_sheet(resumen)
  wsRes['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 6 }]
  for (let R of [5, 6, 7]) {
    const a = XLSX.utils.encode_cell({ r: R, c: 1 })
    if (wsRes[a]) wsRes[a].z = '"$"#,##0.00'
  }
  XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen')

  // ── Hoja 2: Idéntica a la tabla en pantalla ───────────────────────────────
  // Orden exacto de columnas como en pantalla:
  const rows = [
    ['PRODUCTO', 'GRUPO', 'FÍSICO', 'SISTEMA (SOFT)', 'DIFERENCIA', 'COSTO ($)', 'IMPACTO ($)', 'RESULTADO'],
  ]

  // Productos con diferencia (igual al orden en pantalla — por impacto)
  resultados.forEach(r => {
    rows.push([
      r.nombre,
      r.grupo    || '',
      r.fisico   != null ? parseFloat(r.fisico.toFixed(3))   : 0,
      r.sistema  != null ? parseFloat(r.sistema.toFixed(3))  : 0,
      r.dif      != null ? parseFloat(r.dif.toFixed(3))      : 0,
      r.costo    || 0,
      r.imp      != null ? parseFloat(r.imp.toFixed(2))      : 0,
      r.resultado || '',
    ])
  })

  // Productos no capturados — físico = 0, aparecen al final
  if (softData) {
    const noCapt = Object.entries(softData)
      .filter(([n]) => !resultados.some(r => r.nombre === n))
    if (noCapt.length > 0) {
      rows.push(['', '', '', '', '', '', '', ''])
      rows.push(['⚠ NO CAPTURADOS POR LA SUCURSAL', '', '', '', '', '', '', ''])
      noCapt.forEach(([nombre, prod]) => {
        rows.push([
          nombre,
          '',
          0,
          parseFloat((prod.existencia || 0).toFixed(3)),
          '',
          prod.costo || 0,
          '',
          'SIN CAPTURAR',
        ])
      })
    }
  }

  // Total
  rows.push(['', '', '', '', '', '', '', ''])
  rows.push(['TOTAL', '', '', '', '', '', parseFloat(neto.toFixed(2)), ''])

  const wsDet = XLSX.utils.aoa_to_sheet(rows)
  wsDet['!cols'] = [
    { wch: 44 }, { wch: 22 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 14 },
  ]

  // Formato idéntico a pantalla
  const range = XLSX.utils.decode_range(wsDet['!ref'])
  for (let R = 1; R <= range.e.r; R++) {
    for (let C of [2, 3, 4]) {                          // Físico, Sistema, Diferencia
      const a = XLSX.utils.encode_cell({ r: R, c: C })
      if (wsDet[a] && typeof wsDet[a].v === 'number') wsDet[a].z = '#,##0.000'
    }
    for (let C of [5, 6]) {                             // Costo, Impacto
      const a = XLSX.utils.encode_cell({ r: R, c: C })
      if (wsDet[a] && typeof wsDet[a].v === 'number') wsDet[a].z = '"$"#,##0.00'
    }
  }

  XLSX.utils.book_append_sheet(wb, wsDet, 'Análisis completo')
  XLSX.writeFile(wb, 'Analisis_' + sucursal.replace(/ /g, '_') + '_Sem' + semana + '.xlsx')
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTAR REVISIÓN Y COBRO
// Columnas en pantalla: Producto | Grupo | Diferencia | Impacto ($) | Resultado | Acción
// ═══════════════════════════════════════════════════════════════════════════════
export function exportarRevisionCobro({ sucursal, analisisSuc, revisiones, semana, año }) {
  const wb = XLSX.utils.book_new()
  const fmt = n => Math.abs(n)

  // ── Hoja 1: Discrepancias de la sucursal seleccionada ─────────────────────
  if (analisisSuc) {
    const rows = [
      ['REVISIÓN Y COBRO — ' + (sucursal || '').toUpperCase(), '', '', '', '', ''],
      ['Semana: ' + semana + '   |   Año: ' + año + '   |   Generado: ' + new Date().toLocaleDateString('es-MX'), '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['PÉRDIDA ($)', Math.abs(analisisSuc.totalFalt), '', 'SOBRANTE ($)', analisisSuc.totalSobr, ''],
      ['IMPACTO NETO ($)', analisisSuc.neto, '', '', '', ''],
      ['', '', '', '', '', ''],
      ['PRODUCTO', 'GRUPO', 'DIFERENCIA', 'IMPACTO ($)', 'RESULTADO', 'ESTATUS'],
    ]

    const detalle = (analisisSuc.detalle || [])
      .filter(r => r.resultado !== 'OK')
      .sort((a, b) => (a.grupo || '').localeCompare(b.grupo || '') || (a.nombre || '').localeCompare(b.nombre || ''))

    detalle.forEach(r => {
      const rev = revisiones.find(rv => rv.producto === r.nombre)
      rows.push([
        r.nombre,
        r.grupo || '',
        r.dif != null ? parseFloat(parseFloat(r.dif).toFixed(3)) : 0,
        r.imp != null ? parseFloat(parseFloat(r.imp).toFixed(2)) : 0,
        r.resultado || '',
        rev?.estatus || 'PENDIENTE',
      ])
    })

    rows.push(['', '', '', '', '', ''])
    rows.push(['TOTAL FALTANTE', '', '', Math.abs(analisisSuc.totalFalt), '', ''])
    rows.push(['TOTAL SOBRANTE', '', '', analisisSuc.totalSobr, '', ''])
    rows.push(['IMPACTO NETO',   '', '', analisisSuc.neto,      '', ''])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 44 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }]

    const range = XLSX.utils.decode_range(ws['!ref'])
    for (let R = 7; R <= range.e.r; R++) {
      const cDif = XLSX.utils.encode_cell({ r: R, c: 2 })
      const cImp = XLSX.utils.encode_cell({ r: R, c: 3 })
      if (ws[cDif] && typeof ws[cDif].v === 'number') ws[cDif].z = '#,##0.000'
      if (ws[cImp] && typeof ws[cImp].v === 'number') ws[cImp].z = '"$"#,##0.00'
    }

    XLSX.utils.book_append_sheet(wb, ws, sucursal ? sucursal.substring(0, 31) : 'Discrepancias')
  }

  // ── Hoja 2: Historial de revisiones ───────────────────────────────────────
  const rowsRev = [
    ['HISTORIAL DE REVISIONES', '', '', '', ''],
    ['Semana: ' + semana + '   |   Generado: ' + new Date().toLocaleDateString('es-MX'), '', '', '', ''],
    ['', '', '', '', ''],
    ['SUCURSAL', 'PRODUCTO', 'IMPACTO ($)', 'ESTATUS', 'NOTAS'],
  ]

  revisiones.forEach(r => {
    rowsRev.push([
      r.sucursal || '',
      r.producto || '',
      r.impacto != null ? Math.abs(r.impacto) : 0,
      r.estatus || '',
      r.notas || '',
    ])
  })

  const wsRev = XLSX.utils.aoa_to_sheet(rowsRev)
  wsRev['!cols'] = [{ wch: 30 }, { wch: 44 }, { wch: 14 }, { wch: 14 }, { wch: 30 }]

  const rangeRev = XLSX.utils.decode_range(wsRev['!ref'])
  for (let R = 4; R <= rangeRev.e.r; R++) {
    const a = XLSX.utils.encode_cell({ r: R, c: 2 })
    if (wsRev[a] && typeof wsRev[a].v === 'number') wsRev[a].z = '"$"#,##0.00'
  }

  XLSX.utils.book_append_sheet(wb, wsRev, 'Historial')

  const nomArchivo = sucursal
    ? 'Revision_' + sucursal.replace(/ /g, '_') + '_Sem' + semana + '_' + año + '.xlsx'
    : 'Revision_TabuSushi_Sem' + semana + '_' + año + '.xlsx'

  XLSX.writeFile(wb, nomArchivo)
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPRIMIR
// ═══════════════════════════════════════════════════════════════════════════════
export function imprimir() {
  window.print()
}
