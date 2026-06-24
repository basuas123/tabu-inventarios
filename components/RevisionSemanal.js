import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'

// ═══════════════════════════════════════════════════════════════════════
// REVISIÓN SEMANAL — seguimiento de productos enviados a cobro
// Fórmula: DIF = InvEstaSemana + Ventas − Compras − InvSemanaAnterior
// Negativo = faltó otra vez | Positivo = sobró (revisar cobro anterior)
// ═══════════════════════════════════════════════════════════════════════

const GRUPOS_BARRA = ['CERVECERIA','COCA COLA','LICORES','VINOS','BACANORA','ABARROTES BAR','CRISTALERIA BAR']

const UNIDADES_SUFIJO = [
  'KGS','KG','KILOS','KILO','PZAS','PZA','PZ','PIEZAS','PIEZA',
  'LTS','LT','LITROS','LITRO','ML','GRS','GR','PAQUETES','PAQUETE','PAQ',
  'CAJAS','CAJA','BOLSAS','BOLSA','1 LT','1LT',
]

function normalizar(s) {
  let t = String(s || '').toUpperCase().trim().replace(/\s+/g, ' ')
  let cambio = true
  while (cambio) {
    cambio = false
    for (const u of UNIDADES_SUFIJO) {
      if (t.endsWith(' ' + u)) { t = t.slice(0, t.length - u.length - 1).trim(); cambio = true }
    }
  }
  return t
}

// Empareja un nombre del archivo Soft con la lista de productos en vigilancia
function emparejar(nombreArchivo, listaProductos) {
  const n = normalizar(nombreArchivo)
  if (!n) return null
  let mejor = null
  for (const p of listaProductos) {
    if (n === p) return p
    if (n.startsWith(p + ' ') || p.startsWith(n + ' ')) {
      if (!mejor || p.length > mejor.length) mejor = p
    }
  }
  return mejor
}

function num(v) { const x = parseFloat(v); return isNaN(x) ? 0 : x }
function esNegativo(v) { return num(v) < -0.005 }
function esPositivo(v) { return num(v) > 0.005 }
function fmt$(n) { return '$' + Math.abs(num(n)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtQ(n) { return num(n).toLocaleString('es-MX', { maximumFractionDigits: 3 }) }

function getWeekDefault() {
  const d = new Date()
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7)
}

function navegarEnter(e) {
  if (e.key !== 'Enter') return
  e.preventDefault()
  const inputs = Array.from(document.querySelectorAll('input[data-rev-nav]'))
  const idx = inputs.indexOf(e.target)
  if (idx >= 0 && idx + 1 < inputs.length) inputs[idx + 1].focus()
  else e.target.blur()
}

export default function RevisionSemanal({ SUCURSALES, semanaInicial }) {
  const [suc, setSuc]         = useState('')
  const [semana, setSemana]   = useState(semanaInicial || getWeekDefault())
  const año                   = new Date().getFullYear()
  const [filas, setFilas]     = useState({})   // { NOMBRE: {b,c,d,e,merma,costo,nota,grupo,unidad,cobro} }
  const [orden, setOrden]     = useState([])   // nombres en orden
  const [msg, setMsg]         = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [archComp, setArchComp] = useState('')
  const [archCons, setArchCons] = useState('')
  const compRef = useRef()
  const consRef = useRef()

  const nombreSuc = SUCURSALES.find(s => s.k === suc)?.n || suc

  function semanaAnterior() {
    const s = parseInt(semana)
    return s > 1 ? { semana: s - 1, año } : { semana: 52, año: año - 1 }
  }

  async function cargar(sucKey, sem) {
    if (!sucKey) return
    setLoading(true); setError(''); setMsg(''); setFilas({}); setOrden([])
    setArchComp(''); setArchCons('')
    try {
      const nomSuc = SUCURSALES.find(s => s.k === sucKey)?.n || sucKey

      // 1. Productos enviados a cobro EN LA SEMANA INMEDIATA ANTERIOR únicamente
      const semAnt = parseInt(sem) > 1 ? { s: parseInt(sem) - 1, a: año } : { s: 52, a: año - 1 }
      const rRev = await fetch('/api/revisiones?sucursal=' + encodeURIComponent(nomSuc))
      const jRev = await rRev.json()
      const previas = (jRev.data || []).filter(r =>
        num(r.semana) === semAnt.s && num(r.año) === semAnt.a
      )
      if (previas.length === 0) {
        setError('No hay productos enviados a cobro en la semana ' + semAnt.s + ' para esta sucursal.')
        setLoading(false); return
      }
      const cobroPorProducto = {}
      for (const r of previas) {
        const p = String(r.producto || '').toUpperCase().trim()
        if (!p) continue
        const prev = cobroPorProducto[p]
        if (!prev || num(r.semana) > num(prev.semana)) cobroPorProducto[p] = r
      }

      // 1b. Análisis Soft históricos: cantidad que faltó en la semana del cobro
      let analisisHist = []
      try {
        const rAn = await fetch('/api/analisis?sucursal=' + sucKey + '&año=' + año)
        analisisHist = (await rAn.json()).data || []
      } catch (e2) {}
      function difEnSemana(producto, sem2) {
        for (const a of analisisHist) {
          if (num(a.semana) !== num(sem2)) continue
          const det = a.resultados?.detalle || []
          const hit = det.find(d => String(d.nombre || '').toUpperCase().trim() === producto)
          if (hit && hit.dif != null) return num(hit.dif)
        }
        return null
      }

      // 2. Catálogo de la sucursal (id, grupo, unidad, costo)
      const rCat = await fetch('/api/productos?sucursal=' + sucKey)
      const jCat = await rCat.json()
      const catalogo = {}
      for (const p of (jCat.productos || [])) catalogo[String(p.nombre).toUpperCase().trim()] = p

      // 3. Inventario semana anterior (ajustado) y de esta semana
      const ant = parseInt(sem) > 1 ? { s: parseInt(sem) - 1, a: año } : { s: 52, a: año - 1 }
      const [rAnt, rAct] = await Promise.all([
        fetch(`/api/inventario?sucursal=${sucKey}&semana=${ant.s}&año=${ant.a}`),
        fetch(`/api/inventario?sucursal=${sucKey}&semana=${sem}&año=${año}`),
      ])
      const datosAnt = (await rAnt.json()).data?.[0]?.datos || {}
      const datosAct = (await rAct.json()).data?.[0]?.datos || {}

      // 4. Revisión semanal guardada previamente (restaurar ajustes)
      const rSav = await fetch(`/api/revision_semanal?sucursal=${sucKey}&semana=${sem}&año=${año}`)
      const guardado = (await rSav.json()).data?.[0]?.resultados || {}

      const nuevas = {}
      const nombres = Object.keys(cobroPorProducto).sort((a, b) => a.localeCompare(b))
      for (const nom of nombres) {
        const cat = catalogo[nom] || {}
        const sav = guardado[nom] || {}
        nuevas[nom] = {
          b:     sav.b     ?? (cat.id != null && datosAnt[cat.id] !== undefined && datosAnt[cat.id] !== '' ? num(datosAnt[cat.id]) : ''),
          c:     sav.c     ?? '',
          d:     sav.d     ?? '',
          e:     sav.e     ?? (cat.id != null && datosAct[cat.id] !== undefined && datosAct[cat.id] !== '' ? num(datosAct[cat.id]) : ''),
          merma: sav.merma ?? '',
          costo: sav.costo ?? (num(cat.costo) > 0 ? num(cat.costo) : ''),
          nota:  sav.nota  ?? '',
          grupo: cat.grupo || '',
          unidad: cat.unidad || '',
          cobro: cobroPorProducto[nom],
          cobroDif: difEnSemana(nom, cobroPorProducto[nom]?.semana),
        }
      }
      setFilas(nuevas)
      setOrden(nombres)
      setMsg(`${nombres.length} productos en vigilancia (enviados a cobro en la semana ${semAnt.s}).`)
    } catch (err) {
      setError('Error al cargar: ' + err.message)
    }
    setLoading(false)
  }

  // ── Carga de archivos del Soft ──────────────────────────────────────
  function leerArchivo(file, cb) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })
        cb(rows)
      } catch (err) { setError('No se pudo leer el archivo: ' + err.message) }
    }
    reader.readAsArrayBuffer(file)
  }

  function encontrarHeader(rows) {
    for (let i = 0; i < Math.min(8, rows.length); i++) {
      const r = (rows[i] || []).map(c => String(c || '').toLowerCase().trim())
      if (r.some(c => c.includes('descripcion')) && r.some(c => c.includes('cantidad'))) return i
    }
    return -1
  }

  function cargarCompras(file) {
    leerArchivo(file, (rows) => {
      const h = encontrarHeader(rows)
      if (h < 0) { setError('El archivo de compras no tiene columnas "descripcion" y "cantidad".'); return }
      const heads = rows[h].map(c => String(c || '').toLowerCase().trim())
      const iDesc = heads.findIndex(c => c === 'descripcion' || c.includes('descripcion'))
      const iCant = heads.findIndex(c => c.includes('cantidad'))
      const iCost = heads.findIndex(c => c.includes('costounitario') || c.includes('costo unitario'))
      const lista = Object.keys(filas)
      const acum = {}, costos = {}
      for (let i = h + 1; i < rows.length; i++) {
        const prod = emparejar(rows[i]?.[iDesc], lista)
        if (!prod) continue
        const cant = num(rows[i][iCant])
        acum[prod] = (acum[prod] || 0) + cant
        const cu = iCost >= 0 ? num(rows[i][iCost]) : 0
        if (cu > 0 && (!costos[prod] || cant >= costos[prod].cant)) costos[prod] = { cant, cu }
      }
      setFilas(prev => {
        const f = { ...prev }
        for (const nom of Object.keys(f)) {
          f[nom] = { ...f[nom], c: acum[nom] !== undefined ? acum[nom] : 0 }
          if (costos[nom]) f[nom].costo = costos[nom].cu
        }
        return f
      })
      setArchComp(file.name + ' — ' + Object.keys(acum).length + ' productos emparejados')
      setError('')
    })
  }

  function cargarConsumo(file) {
    leerArchivo(file, (rows) => {
      const h = encontrarHeader(rows)
      if (h < 0) { setError('El archivo de insumos no tiene columnas "descripcion" y "cantidad".'); return }
      const heads = rows[h].map(c => String(c || '').toLowerCase().trim())
      const iDesc = heads.findIndex(c => c === 'descripcion' || (c.includes('descripcion') && !c.includes('grupo')))
      const iCant = heads.findIndex(c => c.includes('cantidad'))
      const lista = Object.keys(filas)
      const acum = {}
      for (let i = h + 1; i < rows.length; i++) {
        const prod = emparejar(rows[i]?.[iDesc], lista)
        if (!prod) continue
        acum[prod] = (acum[prod] || 0) + num(rows[i][iCant])
      }
      setFilas(prev => {
        const f = { ...prev }
        for (const nom of Object.keys(f)) f[nom] = { ...f[nom], d: acum[nom] !== undefined ? acum[nom] : 0 }
        return f
      })
      setArchCons(file.name + ' — ' + Object.keys(acum).length + ' productos emparejados')
      setError('')
    })
  }

  // ── Cálculos ────────────────────────────────────────────────────────
  function calcular(f) {
    const completos = f.b !== '' && f.c !== '' && f.d !== '' && f.e !== ''
    if (!completos) return { dif: null, difNeta: null, impacto: null }
    const dif = num(f.e) + num(f.d) - num(f.c) - num(f.b)
    const merma = num(f.merma)
    const mag = Math.max(Math.abs(dif) - merma, 0)
    const difNeta = dif >= 0 ? mag : -mag
    const impacto = difNeta * num(f.costo)
    return { dif, difNeta, impacto }
  }

  function estado(difNeta) {
    if (difNeta === null) return { t: 'INCOMPLETO', bg: '#f5f5f5', col: '#888' }
    if (Math.abs(difNeta) <= 0.005) return { t: 'CORREGIDO', bg: '#EAF3DE', col: '#3B6D11' }
    if (difNeta < 0) return { t: 'FALTA DE NUEVO', bg: '#FCEBEB', col: '#A32D2D' }
    return { t: 'SOBRANTE — REVISAR COBRO', bg: '#FFF2CC', col: '#8A6D00' }
  }

  function esBarra(grupo) { return GRUPOS_BARRA.includes(String(grupo || '').toUpperCase().trim()) }

  function totales() {
    let cocina = 0, barra = 0, sobr = 0
    for (const nom of orden) {
      const { difNeta, impacto } = calcular(filas[nom])
      if (difNeta === null) continue
      if (difNeta < 0) { if (esBarra(filas[nom].grupo)) barra += Math.abs(impacto); else cocina += Math.abs(impacto) }
      else if (difNeta > 0) sobr += impacto
    }
    return { cocina, barra, total: cocina + barra, sobr }
  }

  function setCampo(nom, campo, valor) {
    setFilas(prev => ({ ...prev, [nom]: { ...prev[nom], [campo]: valor } }))
  }

  // ── Guardar y exportar ──────────────────────────────────────────────
  async function guardar() {
    setLoading(true); setError('')
    try {
      const resultados = {}
      for (const nom of orden) {
        const f = filas[nom]
        const { dif, difNeta, impacto } = calcular(f)
        resultados[nom] = { b: f.b, c: f.c, d: f.d, e: f.e, merma: f.merma, costo: f.costo, nota: f.nota, grupo: f.grupo, dif, difNeta, impacto }
      }
      const r = await fetch('/api/revision_semanal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sucursal: suc, semana: parseInt(semana), año, resultados }),
      })
      const j = await r.json()
      if (j.error) setError(j.error)
      else setMsg('Revisión semanal guardada ✓ (semana ' + semana + ', ' + nombreSuc + ')')
    } catch (err) { setError('Error al guardar: ' + err.message) }
    setLoading(false)
  }

  function exportar() {
    const t = totales()
    const ant = semanaAnterior()
    const filasXls = [
      ['REVISIÓN SEMANAL — ' + nombreSuc.toUpperCase() + ' — SEMANA ' + semana + ' / ' + año],
      [],
      ['PRODUCTO', 'CANT. COBRO PREVIO', 'INV SEM ANTERIOR (' + ant.semana + ')', 'COMPRAS', 'VENTAS', 'INV ESTA SEMANA', 'DIFERENCIA', 'MERMA', 'DIF NETA', 'COSTO UNIT', 'IMPACTO $', 'ÁREA', 'ESTADO', 'NOTAS'],
    ]
    for (const nom of orden) {
      const f = filas[nom]
      const { dif, difNeta, impacto } = calcular(f)
      filasXls.push([
        nom, f.cobroDif !== null && f.cobroDif !== undefined ? f.cobroDif : '', num(f.b), num(f.c), num(f.d), num(f.e),
        dif === null ? '' : dif, num(f.merma), difNeta === null ? '' : difNeta,
        num(f.costo), impacto === null ? '' : impacto,
        esBarra(f.grupo) ? 'BARRA' : 'COCINA', estado(difNeta).t, f.nota || '',
      ])
    }
    filasXls.push([])
    filasXls.push(['', '', '', '', '', '', '', '', 'FALTANTE COCINA', t.cocina])
    filasXls.push(['', '', '', '', '', '', '', '', 'FALTANTE BARRA', t.barra])
    filasXls.push(['', '', '', '', '', '', '', '', 'TOTAL FALTANTE', t.total])
    filasXls.push(['', '', '', '', '', '', '', '', 'SOBRANTES', t.sobr])
    const ws = XLSX.utils.aoa_to_sheet(filasXls)
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 11 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 22 }, { wch: 24 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'REVISION')
    XLSX.writeFile(wb, `REVISION_SEMANAL_${suc.toUpperCase()}_S${semana}_${año}.xlsx`)
  }

  // ── UI ──────────────────────────────────────────────────────────────
  const t = totales()
  const inp = { width: 52, padding: '3px 4px', border: '1px solid #ddd', borderRadius: 6, fontSize: 11, textAlign: 'center' }
  const card = { background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', padding: 18, marginBottom: 16 }
  const btn = { padding: '8px 14px', borderRadius: 7, border: 'none', background: '#002060', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }

  return (
    <>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Revisión semanal de:</div>
          <select
            style={{ padding: '7px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 13, flex: 1, maxWidth: 280 }}
            value={suc}
            onChange={e => { setSuc(e.target.value); cargar(e.target.value, semana) }}
          >
            <option value="">Selecciona una sucursal...</option>
            {SUCURSALES.map(s => <option key={s.k} value={s.k}>{s.n}</option>)}
          </select>
          <div style={{ fontSize: 12, color: '#888' }}>Semana</div>
          <input
            type="number" min="1" max="53" value={semana}
            style={{ ...inp, width: 46 }}
            onChange={e => setSemana(e.target.value)}
            onBlur={() => suc && cargar(suc, semana)}
          />
          <div style={{ fontSize: 12, color: '#888' }}>{año}</div>
        </div>
        <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
          Solo entran productos que se enviaron a cobro la semana inmediata anterior. Inventario anterior y captura actual se llenan automáticamente del sistema; compras y ventas se cargan de los archivos del Soft.
        </div>
      </div>

      {suc && orden.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={btn} onClick={() => compRef.current?.click()}>📥 Cargar compras (Soft)</button>
            <input ref={compRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) cargarCompras(e.target.files[0]); e.target.value = '' }} />
            <span style={{ fontSize: 11, color: archComp ? '#3B6D11' : '#999' }}>{archComp || 'Sin archivo'}</span>

            <button style={btn} onClick={() => consRef.current?.click()}>📥 Cargar ventas / insumos (Soft)</button>
            <input ref={consRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) cargarConsumo(e.target.files[0]); e.target.value = '' }} />
            <span style={{ fontSize: 11, color: archCons ? '#3B6D11' : '#999' }}>{archCons || 'Sin archivo'}</span>
          </div>
        </div>
      )}

      {error && <div style={{ ...card, color: '#C00000', fontSize: 13 }}>{error}</div>}
      {msg && !error && <div style={{ ...card, color: '#3B6D11', fontSize: 13 }}>{msg}</div>}
      {loading && <div style={{ ...card, color: '#888', fontSize: 13 }}>Cargando...</div>}

      {orden.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ background: '#FCEBEB', borderRadius: 8, padding: '10px 14px', flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#888' }}>Faltante cocina</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#C00000' }}>{fmt$(t.cocina)}</div>
            </div>
            <div style={{ background: '#FCEBEB', borderRadius: 8, padding: '10px 14px', flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#888' }}>Faltante barra</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#C00000' }}>{fmt$(t.barra)}</div>
            </div>
            <div style={{ background: '#FFF2CC', borderRadius: 8, padding: '10px 14px', flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#888' }}>Total faltante</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#8A6D00' }}>{fmt$(t.total)}</div>
            </div>
            <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '10px 14px', flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#888' }}>Sobrantes</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#3B6D11' }}>{fmt$(t.sobr)}</div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 10.5, color: '#bbb', marginBottom: 4, textAlign: 'right' }}>← desliza para ver todas las columnas →</div>
            <div style={{ overflowX: 'scroll', width: '100%', paddingBottom: 6 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 1040 }}>
              <thead>
                <tr>
                  {['Producto', 'Cobro previo (cant. y $)', 'Inv. sem. anterior', 'Compras', 'Ventas', 'Inv. esta semana', 'Diferencia', 'Merma', 'Dif. neta', 'Costo unit.', 'Impacto $', 'Estado', 'Notas'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 5px', borderBottom: '1px solid #eee', color: '#888', fontWeight: 600, fontSize: 10.5, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orden.map((nom, i) => {
                  const f = filas[nom]
                  const { dif, difNeta, impacto } = calcular(f)
                  const est = estado(difNeta)
                  const negDif = esNegativo(dif)
                  const posDif = esPositivo(dif)
                  return (
                    <tr key={nom} style={{ background: i % 2 ? '#f9f9f9' : '#fff' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {nom}
                        <div style={{ fontSize: 10, color: '#aaa' }}>{esBarra(f.grupo) ? 'BARRA' : 'COCINA'} · {f.unidad}</div>
                      </td>
                      <td style={{ padding: '6px 8px', fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>
                        S{f.cobro?.semana} · {f.cobro?.estatus}
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#A32D2D' }}>
                          {f.cobroDif !== null && f.cobroDif !== undefined ? fmtQ(f.cobroDif) + ' ' + (f.unidad || '') : ''}
                        </div>
                        <div style={{ fontSize: 10 }}>{fmt$(f.cobro?.impacto)}</div>
                      </td>
                      <td style={{ padding: '5px 2px' }}><input data-rev-nav type="number" step="0.001" style={inp} value={f.b} onChange={e => setCampo(nom, 'b', e.target.value)} onKeyDown={navegarEnter} /></td>
                      <td style={{ padding: '5px 2px' }}><input data-rev-nav type="number" step="0.001" style={inp} value={f.c} onChange={e => setCampo(nom, 'c', e.target.value)} onKeyDown={navegarEnter} /></td>
                      <td style={{ padding: '5px 2px' }}><input data-rev-nav type="number" step="0.001" style={inp} value={f.d} onChange={e => setCampo(nom, 'd', e.target.value)} onKeyDown={navegarEnter} /></td>
                      <td style={{ padding: '5px 2px' }}><input data-rev-nav type="number" step="0.001" style={inp} value={f.e} onChange={e => setCampo(nom, 'e', e.target.value)} onKeyDown={navegarEnter} /></td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: negDif ? '#C00000' : (posDif ? '#3B6D11' : '#555') }}>
                        {dif === null ? '—' : (posDif ? '+' : '') + fmtQ(dif)}
                      </td>
                      <td style={{ padding: '5px 2px' }}><input data-rev-nav type="number" min="0" step="0.001" style={{ ...inp, width: 46 }} value={f.merma} onChange={e => setCampo(nom, 'merma', e.target.value)} onKeyDown={navegarEnter} /></td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: difNeta !== null && esNegativo(difNeta) ? '#C00000' : '#3B6D11' }}>
                        {difNeta === null ? '—' : fmtQ(difNeta)}
                      </td>
                      <td style={{ padding: '5px 2px' }}><input data-rev-nav type="number" min="0" step="0.01" style={{ ...inp, width: 56 }} value={f.costo} onChange={e => setCampo(nom, 'costo', e.target.value)} onKeyDown={navegarEnter} /></td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: impacto !== null && esNegativo(impacto) ? '#C00000' : '#3B6D11' }}>
                        {impacto === null ? '—' : (esNegativo(impacto) ? '-' : '') + fmt$(impacto)}
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{ background: est.bg, color: est.col, padding: '2px 8px', borderRadius: 100, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{est.t}</span>
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <input data-rev-nav type="text" placeholder="ej. 0.256 merma" style={{ ...inp, width: 96, textAlign: 'left' }} value={f.nota} onChange={e => setCampo(nom, 'nota', e.target.value)} onKeyDown={navegarEnter} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={{ ...btn, background: '#3B6D11' }} onClick={exportar}>📤 Exportar Excel</button>
              <button style={btn} onClick={guardar} disabled={loading}>💾 Guardar revisión</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
