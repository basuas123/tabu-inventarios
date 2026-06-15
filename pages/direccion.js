import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { exportarResumenDireccion, exportarRevisionCobro, exportarParaSoft, exportarCobro, imprimir } from '../lib/exportar'
import { ordenarComoSoft } from '../lib/grupos'
import RevisionSemanal from '../components/RevisionSemanal'

const MERMAS = {
  'PESCADOS Y MARISCOS':0.15,'CARNES Y AVES':0.12,'FRUTAS Y VERDURAS':0.20,
  'CONGELADOS':0.08,'LACTEOS Y REFRIGERADOS':0.05,'SALSAS Y ADEREZOS':0.03,
  'SUPER ORIENTAL':0.05,'ABARROTES':0.02,'ABARROTES BAR':0.02,
  'CERVECERIA':0.01,'COCA COLA':0.01,'CRISTALERIA BAR':0.00,
  'LICORES':0.02,'VINOS':0.02,'DESECHABLES':0.02,
  'LIMPIEZA':0.00,'PAPELERIA U OFICINA':0.00,'SERVICIO':0.00,
}

const SUCURSALES = [
  {k:'playas',n:'Playas de Tijuana'},
  {k:'sanpedro',n:'Mexicali San Pedro'},
  {k:'nuevomex',n:'Mexicali Plaza Nuevo Mexicali'},
  {k:'guaymas',n:'Guaymas'},
  {k:'progreso',n:'Progreso'},
  {k:'navarrete',n:'Navarrete'},
  {k:'paseo',n:'Tijuana Plaza Paseo 2000'},
  {k:'miguelaleman',n:'Obregón Miguel Alemán'},
  {k:'sanluis',n:'San Luis Río Colorado'},
  {k:'galerias',n:'Galerias Mall'},
  {k:'patio',n:'Patio'},
  {k:'dila',n:'Dila'},
  {k:'bellavista',n:'Obregón Bellavista'},
  {k:'plazario',n:'Tijuana Plaza Río'},
]

function getWeek() {
  const d = new Date()
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7)
}

function fmt(n) {
  return '$' + Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calcularImpacto(sucKey, datos, analisisData, totalProds) {
  const capturados = datos ? Object.keys(datos).filter(k => datos[k] !== '' && datos[k] !== undefined).length : 0
  const total = totalProds || 0

  // Si hay análisis real (Soft cargado), usar esos números
  // analisisData ES directamente el objeto resultados de Supabase
  if (analisisData) {
    // Puede venir como analisisData.resultados o directamente como analisisData
    const r = analisisData.resultados || analisisData
    const falt = parseFloat(r.totalFalt) || 0
    const sobr = parseFloat(r.totalSobr) || 0
    const net  = parseFloat(r.neto)      || 0
    if (falt !== 0 || sobr !== 0) {
      return {
        faltante: falt,
        sobrante: sobr,
        neto:     net,
        conDif:   r.items || 0,
        capturados,
        total,
        tieneAnalisis: true,
      }
    }
  }

  // Sin Soft — mostrar solo progreso si hay captura, o null si no hay nada
  if (!datos || capturados === 0) {
    return capturados > 0
      ? { faltante: null, sobrante: null, neto: null, conDif: 0, capturados, total, tieneAnalisis: false }
      : null
  }
  return { faltante: null, sobrante: null, neto: null, conDif: 0, capturados, total, tieneAnalisis: false }
}

function DetalleHistorial({ semanaVer, sucRevision, resumenHist, sucursales, fmt, colorNeto, estadoNeto }) {
  if (!semanaVer) return null
  const nombreSuc = sucursales.find(s=>s.k===sucRevision)?.n
  const r = resumenHist[sucRevision]
  const neto = r?.neto ?? null
  const estCol = colorNeto(neto, 2000, 500)
  const estBg2 = !r||neto===null ? '#f5f5f5' : colorNeto(neto,2000,500)==='#C00000' ? '#FCEBEB' : colorNeto(neto,2000,500)==='#EF9F27' ? '#FAEEDA' : '#EAF3DE'
  const estado = !r ? 'Sin datos' : neto===null ? 'Sin Soft' : estadoNeto(neto)
  return (
    <div style={{background:'#f9f9f9',borderRadius:10,padding:'16px 20px'}}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:14}}>
        {nombreSuc} — Semana {semanaVer}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:12}}>
        <div style={{background:'#FCEBEB',borderRadius:8,padding:'10px 14px'}}>
          <div style={{fontSize:11,color:'#888',marginBottom:3}}>Pérdida ($)</div>
          <div style={{fontSize:18,fontWeight:700,color:'#C00000'}}>{r?.faltante!=null?fmt(r.faltante):'—'}</div>
        </div>
        <div style={{background:'#EAF3DE',borderRadius:8,padding:'10px 14px'}}>
          <div style={{fontSize:11,color:'#888',marginBottom:3}}>Sobrante ($)</div>
          <div style={{fontSize:18,fontWeight:700,color:'#3B6D11'}}>{r?.sobrante!=null?fmt(r.sobrante):'—'}</div>
        </div>
        <div style={{background:'#FFF2CC',borderRadius:8,padding:'10px 14px'}}>
          <div style={{fontSize:11,color:'#888',marginBottom:3}}>Impacto neto</div>
          <div style={{fontSize:18,fontWeight:700,color:estCol}}>{neto!=null?fmt(neto):'—'}</div>
        </div>
        <div style={{background:'#f5f5f5',borderRadius:8,padding:'10px 14px'}}>
          <div style={{fontSize:11,color:'#888',marginBottom:3}}>Capturados</div>
          <div style={{fontSize:18,fontWeight:700}}>{r ? r.capturados+'/'+r.total : '—'}</div>
        </div>
        <div style={{background:estBg2,borderRadius:8,padding:'10px 14px'}}>
          <div style={{fontSize:11,color:'#888',marginBottom:3}}>Estado</div>
          <div style={{fontSize:16,fontWeight:700,color:estCol}}>{estado}</div>
        </div>
      </div>
      {r?.responsable && <div style={{fontSize:12,color:'#888'}}>Responsable: {r.responsable}</div>}
      {!r && <div style={{textAlign:'center',color:'#888',fontSize:13,padding:20}}>Sin datos para esta sucursal en la semana {semanaVer}</div>}
    </div>
  )
}

function DetalleAcumulado({ sucKey, acumData, sucursales, fmt, colorNeto, card }) {
  if (!sucKey || !acumData) return null
  const nombreSuc = sucursales.find(s=>s.k===sucKey)?.n
  const semanas = acumData[sucKey]?.semanas || []
  return (
    <div style={card}>
      <div style={{fontWeight:600,fontSize:14,marginBottom:12,color:'#555'}}>
        {nombreSuc} — Detalle por semana
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr>
              {['Semana','Faltante ($)','Sobrante ($)','Impacto neto ($)'].map(h=>(
                <th key={h} style={{textAlign:'left',padding:'7px 10px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,fontSize:12}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {semanas.map((r,i)=>{
              const neto = r?.neto ?? null
              const estCol = colorNeto(neto, 2000, 500)
              return (
                <tr key={r.semana} style={{background:i%2?'#f9f9f9':'#fff'}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>Semana {r.semana}</td>
                  <td style={{padding:'7px 10px',color:'#C00000'}}>{r?.faltante!=null?fmt(r.faltante):'—'}</td>
                  <td style={{padding:'7px 10px',color:'#3B6D11'}}>{r?.sobrante!=null?fmt(r.sobrante):'—'}</td>
                  <td style={{padding:'7px 10px',fontWeight:600,color:estCol}}>{neto!=null?fmt(neto):'Sin datos'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function DireccionPage() {
  const router = useRouter()
  const [user, setUser]         = useState(null)
  const [tab, setTab]           = useState('sucursales')
  const [resumen, setResumen]   = useState({})
  const [revisiones, setRevisiones] = useState([])
  const [cobros, setCobros]           = useState([])
  const [sucRevision, setSucRevision] = useState('')
  const [analisisSuc, setAnalisisSuc]   = useState(null)
  const [semanaAnalisis, setSemanaAnalisis] = useState(null)
  const [historial, setHistorial]       = useState([])
  const [semanaVer, setSemanaVer]       = useState(null)
  const [resumenHist, setResumenHist]   = useState({})
  const [loading, setLoading]   = useState(true)
  const [semana] = useState(getWeek())
  const [acumSemIni, setAcumSemIni] = useState(1)
  const [acumSemFin, setAcumSemFin] = useState(getWeek())
  const [acumData, setAcumData]     = useState(null)
  const [acumCargando, setAcumCargando] = useState(false)
  const [acumSucDetalle, setAcumSucDetalle] = useState(null)
  const [sucCobroDetalle, setSucCobroDetalle] = useState(null)
  const semanasDisponibles = Array.from({length:semana},(_,i)=>i+1)
  const semanasDesdeIni = semanasDisponibles.filter(s => s >= acumSemIni)
  const totalSemanasRango = acumSemFin - acumSemIni + 1
  const semanaActual = semana
  const [semanaFiltro, setSemanaFiltro] = useState(getWeek())
  // Semana global seleccionada: manda en Revisión y cobro, A cobrar, Historial y Acumulado
  const semanaRef = semanaFiltro || semana
  const [resumenFiltro, setResumenFiltro] = useState({})

  useEffect(() => {
    const stored = localStorage.getItem('tabu_user')
    if (!stored) { router.push('/'); return }
    const u = JSON.parse(stored)
    if (u.rol !== 'dir') { router.push('/inventario'); return }
    setUser(u)
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    // Cargar inventarios y análisis de Supabase
    try {
      const año = new Date().getFullYear()
      const [resInv, resAnal] = await Promise.all([
        fetch('/api/resumen?semana=' + semana + '&año=' + año).then(r => r.json()),
        // Cargar análisis de las últimas 2 semanas para cubrir cambios de semana
        fetch('/api/analisis?año=' + año).then(r => r.json()).catch(() => ({ data: [] })),
      ])

      // Construir mapa de análisis — el más reciente por sucursal
      const analisisMap = {}
      if (resAnal.data) {
        // Los datos vienen ordenados por updated_at DESC, tomar el más reciente por sucursal
        resAnal.data.forEach(row => {
          if (!analisisMap[row.sucursal]) {
            analisisMap[row.sucursal] = row.resultados
          }
          // También mapear por nombre
          const suc = SUCURSALES.find(s => s.k === row.sucursal || s.n === row.sucursal)
          if (suc && !analisisMap[suc.k]) analisisMap[suc.k] = row.resultados
        })
      }
      console.log('Analisis disponibles:', Object.keys(analisisMap))

      const map = {}

      // Primero procesar inventarios capturados
      if (resInv.data) {
        resInv.data.forEach(row => {
          const anal = analisisMap[row.sucursal]
          map[row.sucursal] = calcularImpacto(row.sucursal, row.datos, anal) || {}
          map[row.sucursal].responsable = row.responsable
        })
      }

      // Agregar sucursales con análisis Soft aunque no hayan capturado inventario
      SUCURSALES.forEach(s => {
        const anal = analisisMap[s.k]
        if (!map[s.k] && anal) {
          map[s.k] = calcularImpacto(s.k, {}, anal) || {}
        }
        // Si ya está en map pero no tiene análisis, agregar el análisis
        if (map[s.k] && !map[s.k].tieneAnalisis && anal) {
          const conAnal = calcularImpacto(s.k, {}, anal)
          if (conAnal) {
            map[s.k] = { ...map[s.k], ...conAnal }
          }
        }
        // Fallback localStorage
        if (!map[s.k]) {
          const local = localStorage.getItem('inv_' + s.k + '_sem' + semana)
          if (local) {
            map[s.k] = calcularImpacto(s.k, JSON.parse(local), anal) || {}
            map[s.k].local = true
          }
        }
      })

      console.log('Resumen cargado:', Object.keys(map).length, 'sucursales')
      console.log('Analisis cargado:', Object.keys(analisisMap))
      setResumen(map)
    } catch (e) {
      console.error('Error cargarDatos:', e)
      const map = {}
      SUCURSALES.forEach(s => {
        const local = localStorage.getItem('inv_' + s.k + '_sem' + semana)
        if (local) {
          map[s.k] = calcularImpacto(s.k, JSON.parse(local), null) || {}
        }
      })
      setResumen(map)
    }

    // Cargar revisiones
    try {
      const res = await fetch('/api/revisiones')
      const { data } = await res.json()
      if (data) {
        setRevisiones(data)
        setCobros(data.filter(r => r.estatus === 'A COBRO'))
      }
    } catch (e) {
      setRevisiones([])
      setCobros([])
    }

    setLoading(false)
  }

  async function cargarHistorial() {
    const añoH = new Date().getFullYear()
    const semanas = []
    for (let i = 0; i < 5; i++) {
      const s = semana - i
      if (s > 0) semanas.push(s)
    }
    const resultados = await Promise.all(
      semanas.map(s =>
        fetch('/api/resumen?semana=' + s + '&año=' + añoH)
          .then(r => r.json())
          .then(({ data }) => ({ semana: s, data: data || [] }))
          .catch(() => ({ semana: s, data: [] }))
      )
    )
    setHistorial(resultados.filter(r => r.data.length > 0))
  }

  async function verSemana(s) {
    setSemanaVer(s)
    const añoV = new Date().getFullYear()
    try {
      const [resInv, resAnal] = await Promise.all([
        fetch('/api/resumen?semana=' + s + '&año=' + añoV).then(r => r.json()),
        fetch('/api/analisis?semana=' + s + '&año=' + añoV).then(r => r.json()).catch(() => ({ data: [] })),
      ])
      const analisisMap = {}
      if (resAnal.data) resAnal.data.forEach(row => { analisisMap[row.sucursal] = row.resultados })
      const map = {}
      if (resInv.data) {
        resInv.data.forEach(row => {
          map[row.sucursal] = calcularImpacto(row.sucursal, row.datos, analisisMap[row.sucursal]) || {}
          map[row.sucursal].responsable = row.responsable
        })
      }
      setResumenHist(map)
    } catch(e) {}
  }

  async function cargarAnalisisSucursal(sucKey, sem) {
    setSucRevision(sucKey)
    if (!sucKey) { setAnalisisSuc(null); return }
    const semSel = sem || semanaFiltro
    try {
      // Cargar el análisis de esta sucursal para la semana seleccionada
      const res = await fetch('/api/analisis?sucursal=' + sucKey + '&semana=' + semSel + '&año=' + new Date().getFullYear())
      const { data } = await res.json()
      if (data && data.length > 0) {
        // Tomar el más reciente que tenga detalle
        const conDetalle = data.find(d => d.resultados?.detalle || d.resultados?.totalFalt)
        let resultados = conDetalle ? conDetalle.resultados : null
        // Enriquecer grupo desde el catálogo si el análisis guardado no lo trae
        if (resultados?.detalle?.some(d => !d.grupo)) {
          try {
            const catRes = await fetch('/api/productos?sucursal=' + sucKey)
            const { productos } = await catRes.json()
            const m = {}
            ;(productos || []).forEach(p => { m[(p.nombre || '').toUpperCase()] = p.grupo || '' })
            resultados = {
              ...resultados,
              detalle: resultados.detalle.map(d => ({
                ...d,
                grupo: d.grupo || m[(d.nombre || '').toUpperCase()] || ''
              }))
            }
          } catch (e2) {}
        }
        setAnalisisSuc(resultados)
        if (conDetalle) setSemanaAnalisis(conDetalle.semana)
      } else {
        setAnalisisSuc(null)
        setSemanaAnalisis(null)
      }
    } catch(e) { setAnalisisSuc(null); setSemanaAnalisis(null) }
  }

  async function cambiarEstatus(id, nuevoEstatus) {
    await fetch('/api/revisiones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estatus: nuevoEstatus })
    })
    cargarDatos()
  }

  async function agregarRevision() {
    const suc  = prompt('Sucursal:')
    const prod = prompt('Producto:')
    const imp  = parseFloat(prompt('Impacto en $ (negativo = pérdida):') || '0')
    const nota = prompt('Observación:') || ''
    if (!suc || !prod) return
    await fetch('/api/revisiones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sucursal: suc, producto: prod, impacto: imp, estatus: 'PENDIENTE', notas: nota, semana: semanaRef, año: new Date().getFullYear() })
    })
    cargarDatos()
  }

  function logout() {
    localStorage.removeItem('tabu_user')
    router.push('/')
  }

  if (!user) return <div style={{padding:40,textAlign:'center'}}>Cargando...</div>

  const sucursalesConDatos   = SUCURSALES.filter(s => resumen[s.k])
  const totalFaltante = sucursalesConDatos.reduce((a,s) => {
    const v = resumen[s.k]?.faltante
    return a + (v !== null && v !== undefined ? v : 0)
  }, 0)
  const totalSobrante = sucursalesConDatos.reduce((a,s) => {
    const v = resumen[s.k]?.sobrante
    return a + (v !== null && v !== undefined ? v : 0)
  }, 0)
  const criticas  = sucursalesConDatos.filter(s => {
    const n = resumen[s.k]?.neto
    return n !== null && n !== undefined && n < -2000
  }).length
  const sinDatos  = SUCURSALES.filter(s => !resumen[s.k] || resumen[s.k].capturados === 0).length

  const ESTATUSES = ['PENDIENTE','EN REVISIÓN','REVISADA','CORREGIDO','CONFIRMADO','A COBRO']
  const estColor  = { PENDIENTE:'#EF9F27',  'EN REVISIÓN':'#EF9F27', REVISADA:'#3B6D11', CORREGIDO:'#639922', CONFIRMADO:'#C00000', 'A COBRO':'#C00000' }
  const estBg     = { PENDIENTE:'#FAEEDA', 'EN REVISIÓN':'#FAEEDA', REVISADA:'#EAF3DE', CORREGIDO:'#EAF3DE', CONFIRMADO:'#FCEBEB', 'A COBRO':'#FCEBEB' }

  // Filtrar por semana global; registros sin semana se muestran siempre
  const enSemana = r => r.semana == null || String(r.semana) === String(semanaRef)
  const revisionesSemana = revisiones.filter(enSemana)
  const cobrosSemana = cobros.filter(enSemana)
  const totalCobro = cobrosSemana.reduce((a,r) => a + Math.abs(r.impacto || 0), 0)
  // Lo enviado a cobro (incluye ya cobrados) por sucursal en la semana seleccionada
  const esCobro = r => r.estatus === 'A COBRO' || String(r.notas||'').includes('Cobrado')
  const cobrosSucSemana = nombre => revisionesSemana.filter(r => r.sucursal === nombre && esCobro(r))

  const st = {
    topbar: { background:'#fff', borderBottom:'1px solid #eee', padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:52, position:'sticky', top:0, zIndex:100 },
    logo:   { display:'flex', alignItems:'center', gap:8, fontWeight:600, fontSize:15 },
    dot:    { width:8, height:8, borderRadius:'50%', background:'#C00000' },
    page:   { maxWidth:1000, margin:'0 auto', padding:'20px 16px 40px' },
    kpiGrid:{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:20 },
    kpi:    { background:'#fff', borderRadius:10, border:'1px solid #eee', padding:'12px 14px' },
    card:   { background:'#fff', borderRadius:10, border:'1px solid #eee', padding:'16px 20px', marginBottom:16 },
    btn:    { padding:'7px 14px', borderRadius:7, border:'1px solid #ddd', background:'#fff', cursor:'pointer', fontSize:13, fontWeight:500 },
    btnPr:  { padding:'7px 14px', borderRadius:7, border:'none', background:'#002060', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 },
    tabs:   { display:'flex', borderBottom:'1px solid #eee', marginBottom:20 },
    tab:    a => ({ padding:'9px 18px', fontSize:13, cursor:'pointer', borderBottom:a?'2px solid #002060':'2px solid transparent', color:a?'#002060':'#666', fontWeight:a?600:400, background:'none', border:'none', borderBottom:a?'2px solid #002060':'2px solid transparent' }),
    sem:    v => { const c = v===null?'#ccc':(v+2000)<0?'#C00000':(v+500)<0?'#EF9F27':'#639922'; return {width:10,height:10,borderRadius:'50%',background:c,display:'inline-block',marginRight:6} },
  }

  function getSoftDif(analisisSuc, producto, impactoFallback) {
    const det = analisisSuc?.detalle || []
    const soft = det.find(d => d.nombre === producto || (d.nombre && d.nombre.toUpperCase() === (producto||'').toUpperCase()))
    if (soft && soft.dif != null) return soft.dif.toFixed(3)
    return impactoFallback ? impactoFallback.toFixed(3) : '—'
  }

  function colorNeto(neto, umbral1, umbral2) {
    if (neto === null || neto === undefined) return '#888'
    if (neto + umbral1 < 0) return '#C00000'
    if (neto + umbral2 < 0) return '#EF9F27'
    return '#3B6D11'
  }
  function estadoNeto(neto) {
    if (neto === null || neto === undefined) return 'Sin datos'
    if (neto + 2000 < 0) return 'CRÍTICA'
    if (neto + 500 < 0) return 'REVISAR'
    return 'OK'
  }

  return (
    <div>
      <div style={st.topbar}>
        <div style={st.logo}>
          <div style={st.dot}></div>
          Panel Ejecutivo — Tabu Sushi
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontSize:12,color:'#666'}}>Semana {semana} · {new Date().toLocaleDateString('es-MX')}</span>
          <button style={st.btn} onClick={()=>router.push('/soft')}>📊 Cargar Soft</button>
          <button style={st.btn} onClick={()=>{
            if (tab === 'revision') {
              const sucNombre = SUCURSALES.find(s=>s.k===sucRevision)?.n || sucRevision
              const revFiltradas = sucRevision ? revisionesSemana.filter(r => r.sucursal === sucNombre) : revisionesSemana
              exportarRevisionCobro({ sucursal: sucNombre, analisisSuc, revisiones: revFiltradas, semana: semanaRef, año: new Date().getFullYear() })
            } else {
              exportarResumenDireccion({sucursales:SUCURSALES,resumen,semana,año:new Date().getFullYear()})
            }
          }}>📥 Excel</button>
          <button style={st.btn} onClick={imprimir}>🖨 Imprimir</button>
          <button style={st.btn} onClick={cargarDatos}>↻ Actualizar</button>
          <button style={st.btn} onClick={logout}>Salir</button>
        </div>
      </div>

      <div style={st.page}>
        {/* KPIs */}
        <div style={st.kpiGrid}>
          <div style={st.kpi}><div style={{fontSize:11,color:'#888',marginBottom:4}}>Pérdida total</div><div style={{fontSize:20,fontWeight:700,color:'#C00000'}}>{fmt(totalFaltante)}</div></div>
          <div style={st.kpi}><div style={{fontSize:11,color:'#888',marginBottom:4}}>Sobrante total</div><div style={{fontSize:20,fontWeight:700,color:'#3B6D11'}}>{fmt(totalSobrante)}</div></div>
          <div style={st.kpi}><div style={{fontSize:11,color:'#888',marginBottom:4}}>Impacto neto</div><div style={{fontSize:20,fontWeight:700,color:(totalFaltante+totalSobrante)<0?'#C00000':'#3B6D11'}}>{fmt(totalFaltante+totalSobrante)}</div></div>
          <div style={st.kpi}><div style={{fontSize:11,color:'#888',marginBottom:4}}>Críticas</div><div style={{fontSize:20,fontWeight:700,color:'#C00000'}}>{criticas}</div></div>
          <div style={st.kpi}><div style={{fontSize:11,color:'#888',marginBottom:4}}>Sin datos</div><div style={{fontSize:20,fontWeight:700,color:'#888'}}>{sinDatos}</div></div>
          <div style={st.kpi}><div style={{fontSize:11,color:'#888',marginBottom:4}}>Total a cobrar</div><div style={{fontSize:20,fontWeight:700,color:'#C00000'}}>{fmt(totalCobro)}</div></div>
        </div>

        {/* Tabs */}
        <div style={st.tabs}>
          <button style={st.tab(tab==='sucursales')} onClick={()=>setTab('sucursales')}>Sucursales</button>
          <button style={st.tab(tab==='revision')}   onClick={()=>setTab('revision')}>Revisión y cobro</button>
          <button style={st.tab(tab==='semanal')}   onClick={()=>setTab('semanal')}>Revisión semanal</button>
          <button style={st.tab(tab==='cobros')}    onClick={()=>setTab('cobros')}>
            {cobrosSemana.length ? '💰 A cobrar ('+cobrosSemana.length+')' : 'A cobrar'}
          </button>
          <button style={st.tab(tab==='historial')}  onClick={()=>{setTab('historial');cargarHistorial()}}>Historial</button>
          <button style={st.tab(tab==='acumulado')}  onClick={()=>setTab('acumulado')}>Acumulado</button>
        </div>

        {/* Selector de semana GLOBAL — aplica a todas las pestañas */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14,background:'#fff',border:'1px solid #eee',borderRadius:10,padding:'10px 14px'}}>
          <span style={{fontSize:13,fontWeight:600,color:'#555'}}>Ver semana:</span>
          <select
            style={{padding:'6px 12px',border:'1px solid #ddd',borderRadius:8,fontSize:13}}
            value={semanaFiltro}
            onChange={async e=>{
              const s = parseInt(e.target.value)
              setSemanaFiltro(s)
              // Sincronizar las demás pestañas con la semana elegida
              if (sucRevision) cargarAnalisisSucursal(sucRevision, s)
              if (tab === 'historial') verSemana(s)
              setAcumSemFin(s)
              if (s === semana) {
                setResumenFiltro({})
                return
              }
              const año = new Date().getFullYear()
              const [resR, analR] = await Promise.all([
                fetch('/api/resumen?semana='+s+'&año='+año).then(r=>r.json()).catch(()=>({data:[]})),
                fetch('/api/analisis?semana='+s+'&año='+año).then(r=>r.json()).catch(()=>({data:[]})),
              ])
              const analMap = {}
              if (analR.data) analR.data.forEach(row=>{ analMap[row.sucursal]=row.resultados })
              const map = {}
              if (resR.data) resR.data.forEach(row=>{
                map[row.sucursal] = calcularImpacto(row.sucursal, row.datos, analMap[row.sucursal]) || {}
              })
              SUCURSALES.forEach(suc=>{ if(!map[suc.k]) map[suc.k]=null })
              setResumenFiltro(map)
            }}
          >
            {Array.from({length:semana},(_,i)=>semana-i).map(s=>(
              <option key={s} value={s}>Semana {s}{s===semanaActual?' (actual)':''}</option>
            ))}
          </select>
          {semanaFiltro !== semana && (
            <span style={{fontSize:12,color:'#854F0B',background:'#FAEEDA',padding:'3px 10px',borderRadius:100,fontWeight:600}}>
              Viendo y editando semana {semanaFiltro}
            </span>
          )}
        </div>

        {tab === 'sucursales' && (
          <div style={st.card}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr>
                    {['','Sucursal','Capturados','Faltante ($)','Sobrante ($)','Impacto neto ($)','Estado','A cobro (sem)','Responsable'].map(h=>(
                      <th key={h} style={{textAlign:'left',padding:'8px 10px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,whiteSpace:'nowrap',fontSize:12}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SUCURSALES.map((s,i) => {
                    const r = semanaFiltro === semana ? resumen[s.k] : (resumenFiltro[s.k] ?? null)
                    const neto = r?.neto ?? null
                    const estado = !r ? 'Sin datos' : neto < -2000 ? 'CRÍTICA' : neto < -500 ? 'REVISAR' : 'OK'
                    const estCol = !r ? '#888' : neto < -2000 ? '#C00000' : neto < -500 ? '#EF9F27' : '#3B6D11'
                    const estBg2 = !r ? '#f5f5f5' : neto < -2000 ? '#FCEBEB' : neto < -500 ? '#FAEEDA' : '#EAF3DE'
                    return (
                      <tr key={s.k} style={{background:i%2?'#f9f9f9':'#fff'}}>
                        <td style={{padding:'8px 10px'}}><span style={st.sem(neto)}></span></td>
                        <td style={{padding:'8px 10px',fontWeight:600}}>{s.n}</td>
                        <td style={{padding:'8px 10px',color:'#555'}}>
                          {r ? `${r.capturados || 0}/${r.total || 0}` : '—'}
                        </td>
                        <td style={{padding:'8px 10px',color:'#C00000',fontWeight:r?.faltante?600:400}}>
                          {r?.faltante !== null && r?.faltante !== undefined ? fmt(r.faltante) : '—'}
                        </td>
                        <td style={{padding:'8px 10px',color:'#3B6D11',fontWeight:r?.sobrante?600:400}}>
                          {r?.sobrante !== null && r?.sobrante !== undefined ? fmt(r.sobrante) : '—'}
                        </td>
                        <td style={{padding:'8px 10px',fontWeight:600,color:estCol}}>
                          {neto !== null ? fmt(neto) : r?.tieneAnalisis === false ? 'Sin Soft' : '—'}
                        </td>
                        <td style={{padding:'8px 10px'}}>
                          <span style={{background:estBg2,color:estCol,padding:'2px 8px',borderRadius:100,fontSize:11,fontWeight:700}}>
                            {estado}
                          </span>
                        </td>
                        <td style={{padding:'8px 10px'}}>
                          {(() => {
                            const items = cobrosSucSemana(s.n)
                            if (items.length === 0) return <span style={{color:'#ccc'}}>—</span>
                            const tot = items.reduce((a,c)=>a+Math.abs(c.impacto||0),0)
                            const abierto = sucCobroDetalle === s.k
                            return (
                              <button
                                style={{padding:'3px 10px',borderRadius:6,border:'1px solid #f0c3c3',background:abierto?'#C00000':'#FCEBEB',color:abierto?'#fff':'#A32D2D',cursor:'pointer',fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}
                                onClick={()=>setSucCobroDetalle(abierto?null:s.k)}
                              >{fmt(tot)} · {items.length} art. {abierto?'▲':'▼'}</button>
                            )
                          })()}
                        </td>
                        <td style={{padding:'8px 10px',color:'#888',fontSize:12}}>{r?.responsable || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Detalle de artículos a cobro de la sucursal seleccionada */}
            {sucCobroDetalle && (() => {
              const sucSel = SUCURSALES.find(x=>x.k===sucCobroDetalle)
              const items = cobrosSucSemana(sucSel?.n)
              const tot = items.reduce((a,c)=>a+Math.abs(c.impacto||0),0)
              return (
                <div style={{marginTop:14,background:'#f9f9f9',borderRadius:10,padding:'14px 18px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                    <div style={{fontWeight:700,fontSize:13}}>{sucSel?.n} — Enviado a cobro · Semana {semanaRef}</div>
                    <div style={{fontWeight:700,fontSize:15,color:'#C00000'}}>{fmt(tot)}</div>
                  </div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead>
                      <tr>
                        {['Artículo','Costo ($)','Estatus','Notas'].map(h=>(
                          <th key={h} style={{textAlign:'left',padding:'6px 8px',borderBottom:'1px solid #e5e5e5',color:'#888',fontWeight:600,fontSize:11}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((c,j)=>(
                        <tr key={c.id||j} style={{background:j%2?'#f3f3f3':'transparent'}}>
                          <td style={{padding:'6px 8px',fontWeight:600}}>{c.producto}</td>
                          <td style={{padding:'6px 8px',fontWeight:700,color:'#C00000'}}>{fmt(Math.abs(c.impacto||0))}</td>
                          <td style={{padding:'6px 8px'}}>
                            <span style={{background:String(c.notas||'').includes('Cobrado')?'#EAF3DE':'#FCEBEB',color:String(c.notas||'').includes('Cobrado')?'#3B6D11':'#A32D2D',padding:'2px 8px',borderRadius:100,fontSize:10,fontWeight:700}}>
                              {String(c.notas||'').includes('Cobrado')?'COBRADO':'A COBRO'}
                            </span>
                          </td>
                          <td style={{padding:'6px 8px',color:'#888',fontSize:11}}>{c.notas||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        )}

        {tab === 'revision' && (
          <>
            {/* Selector de sucursal para ver análisis */}
            <div style={st.card}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:analisisSuc?16:0}}>
                <div style={{fontWeight:600,fontSize:14}}>Ver discrepancias de:</div>
                <select
                  style={{padding:'7px 12px',border:'1px solid #ddd',borderRadius:8,fontSize:13,flex:1,maxWidth:280}}
                  value={sucRevision}
                  onChange={e=>cargarAnalisisSucursal(e.target.value)}
                >
                  <option value="">Selecciona una sucursal...</option>
                  {SUCURSALES.map(s=><option key={s.k} value={s.k}>{s.n}</option>)}
                </select>
                {sucRevision && <span style={{fontSize:12,color:'#888'}}>Semana {semanaRef}</span>}
              </div>

              {sucRevision && !analisisSuc && (
                <div style={{padding:'20px',textAlign:'center',color:'#888',fontSize:13,background:'#f9f9f9',borderRadius:8}}>
                  Esta sucursal no tiene análisis de Soft para la semana {semanaRef}.<br/>
                  <span style={{fontSize:12}}>Elige otra semana arriba, o usa "Cargar Soft" para generar el análisis.</span>
                </div>
              )}

              {analisisSuc && (
                <>
                  <div style={{display:'flex',gap:10,marginBottom:14}}>
                    <div style={{background:'#FCEBEB',borderRadius:8,padding:'10px 14px',flex:1,textAlign:'center'}}>
                      <div style={{fontSize:11,color:'#888',marginBottom:2}}>Pérdida</div>
                      <div style={{fontSize:18,fontWeight:700,color:'#C00000'}}>{fmt(analisisSuc.totalFalt)}</div>
                    </div>
                    <div style={{background:'#EAF3DE',borderRadius:8,padding:'10px 14px',flex:1,textAlign:'center'}}>
                      <div style={{fontSize:11,color:'#888',marginBottom:2}}>Sobrante</div>
                      <div style={{fontSize:18,fontWeight:700,color:'#3B6D11'}}>{fmt(analisisSuc.totalSobr)}</div>
                    </div>
                    <div style={{background:'#FFF2CC',borderRadius:8,padding:'10px 14px',flex:1,textAlign:'center'}}>
                      <div style={{fontSize:11,color:'#888',marginBottom:2}}>Impacto neto</div>
                      <div style={{fontSize:18,fontWeight:700,color:analisisSuc.neto<0?'#C00000':'#3B6D11'}}>{fmt(analisisSuc.neto)}</div>
                    </div>
                  </div>

                  <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
                    <button style={{padding:'7px 14px',borderRadius:7,border:'none',background:'#002060',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600}}
                      onClick={()=>{
                        const suc = SUCURSALES.find(s=>s.k===sucRevision)?.n||sucRevision
                        const revSuc = revisiones.filter(r=>r.sucursal===suc&&r.estatus==='CORREGIDO')
                        exportarParaSoft({sucursal:suc, revisiones:revSuc, analisisSuc, semana: semanaRef, año:new Date().getFullYear()})
                      }}
                    >📤 Exportar para Soft</button>
                  </div>

                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                      <thead>
                        <tr>
                          {['Producto','Grupo','Sistema (Soft)','Físico','Diferencia','Impacto ($)','Resultado','Cant. ajustada','Acción'].map(h=>(
                            <th key={h} style={{textAlign:'left',padding:'7px 8px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,fontSize:11}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ordenarComoSoft((analisisSuc.detalle||[]).filter(r=>r.resultado!=='OK')).map((r,i)=>(
                          <tr key={r.nombre} style={{background:i%2?'#f9f9f9':'#fff'}}>
                            <td style={{padding:'6px 8px',fontWeight:500}}>{r.nombre}</td>
                            <td style={{padding:'6px 8px',color:'#888',fontSize:11}}>{r.grupo}</td>
                            <td style={{padding:'6px 8px',textAlign:'right',fontWeight:600,color:r.sistema<0?'#C00000':'#555'}}>
                              {parseFloat(r.sistema||0).toFixed(3)}{r.sistema<0?' ⚠':''}
                            </td>
                            <td style={{padding:'6px 8px',textAlign:'right',fontWeight:600,color:'#185FA5'}}>
                              {parseFloat(r.fisico||0).toFixed(3)}
                            </td>
                            <td style={{padding:'6px 8px',textAlign:'right',color:r.dif<0?'#C00000':'#3B6D11',fontWeight:600}}>
                              {r.dif && r.dif !== 0 ? (r.dif > 0 ? '+' : '') : ''}{parseFloat(r.dif||0).toFixed(3)}
                            </td>
                            <td style={{padding:'6px 8px',textAlign:'right',fontWeight:700,color:r.imp<0?'#C00000':'#3B6D11'}}>
                              {r.imp && r.imp !== 0 ? (r.imp < 0 ? '-' : '') : ''}{fmt(r.imp)}
                            </td>
                            <td style={{padding:'6px 8px'}}>
                              <span style={{background:r.resultado==='FALTANTE'?'#FCEBEB':'#EAF3DE',color:r.resultado==='FALTANTE'?'#A32D2D':'#3B6D11',padding:'2px 8px',borderRadius:100,fontSize:11,fontWeight:700}}>
                                {r.resultado}
                              </span>
                            </td>
                            <td style={{padding:'6px 8px'}}>
                              <input
                                key={semanaRef+'-'+sucRevision+'-'+r.nombre}
                                type="number" min="0" step="0.001"
                                style={{width:80,padding:'4px 6px',border:'1px solid #ddd',borderRadius:6,fontSize:11,textAlign:'center'}}
                                defaultValue={revisionesSemana.find(rv=>rv.sucursal===(SUCURSALES.find(s=>s.k===sucRevision)?.n||sucRevision)&&rv.producto===r.nombre)?.cantidad_ajustada??''}
                                placeholder={parseFloat(r.fisico??0).toFixed(3)}
                                data-ajuste-id={r.nombre}
                                onKeyDown={e=>{
                                  if(e.key==='Enter'){
                                    e.preventDefault()
                                    const inputs = Array.from(document.querySelectorAll('input[data-ajuste-id]'))
                                    const idx = inputs.findIndex(el=>el.dataset.ajusteId===r.nombre)
                                    if(idx>=0 && idx<inputs.length-1) inputs[idx+1].focus()
                                    else e.target.blur()
                                  }
                                }}
                                onBlur={async e=>{
                                  const suc = SUCURSALES.find(s=>s.k===sucRevision)?.n||sucRevision
                                  const val = e.target.value===''?null:parseFloat(e.target.value)
                                  const existing = revisionesSemana.find(rev=>rev.sucursal===suc&&rev.producto===r.nombre)
                                  if (existing) {
                                    await fetch('/api/revisiones',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:existing.id,cantidad_ajustada:val})})
                                  } else {
                                    await fetch('/api/revisiones',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sucursal:suc,producto:r.nombre,impacto:r.imp,estatus:'PENDIENTE',cantidad_ajustada:val,notas:'',semana:semanaRef,año:new Date().getFullYear()})})
                                  }
                                  await cargarDatos()
                                }}
                              />
                            </td>
                            <td style={{padding:'6px 8px'}}>
                              <select
                                key={semanaRef+'-'+sucRevision+'-'+r.nombre+'-est'}
                                style={{padding:'4px 8px',borderRadius:6,border:'1px solid #ddd',fontSize:11,cursor:'pointer'}}
                                defaultValue={revisionesSemana.find(rv=>rv.sucursal===(SUCURSALES.find(s=>s.k===sucRevision)?.n||sucRevision)&&rv.producto===r.nombre)?.estatus||'PENDIENTE'}
                                onChange={async e=>{
                                  const suc = SUCURSALES.find(s=>s.k===sucRevision)?.n||sucRevision
                                  const nuevoEstatus = e.target.value
                                  // Buscar si ya existe esta revisión
                                  const existing = revisionesSemana.find(
                                    rev => rev.sucursal===suc && rev.producto===r.nombre
                                  )
                                  if (existing) {
                                    // Actualizar existente
                                    await fetch('/api/revisiones', {
                                      method:'PATCH',
                                      headers:{'Content-Type':'application/json'},
                                      body:JSON.stringify({ id: existing.id, estatus: nuevoEstatus })
                                    })
                                  } else {
                                    // Crear nuevo
                                    await fetch('/api/revisiones', {
                                      method:'POST',
                                      headers:{'Content-Type':'application/json'},
                                      body:JSON.stringify({
                                        sucursal: suc,
                                        producto: r.nombre,
                                        impacto: r.imp,
                                        estatus: nuevoEstatus,
                                        notas: '',
                                        semana: semanaRef,
                                        año: new Date().getFullYear()
                                      })
                                    })
                                  }
                                  await cargarDatos()
                                  // Actualizar selector visualmente
                                  e.target.value = nuevoEstatus
                                }}
                              >
                                <option value="PENDIENTE">Pendiente</option>
                                <option value="EN REVISIÓN">En revisión</option>
                                <option value="REVISADA">Revisada (sucursal)</option>
                                <option value="CORREGIDO">Corregido</option>
                                <option value="CONFIRMADO">Confirmado</option>
                                <option value="A COBRO">A cobro</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Revisiones registradas */}
            <div style={st.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <div style={{fontWeight:600,fontSize:14}}>Historial de revisiones</div>
                <button style={st.btnPr} onClick={agregarRevision}>+ Agregar manual</button>
              </div>
              {(() => {
                const nombreSuc = sucRevision ? SUCURSALES.find(s=>s.k===sucRevision)?.n : null
                const revFiltradas = nombreSuc ? revisionesSemana.filter(r => r.sucursal === nombreSuc) : revisionesSemana
                return revFiltradas.length === 0 ? (
                <div style={{textAlign:'center',padding:30,color:'#888',fontSize:13}}>
                  {nombreSuc ? `Sin revisiones registradas para ${nombreSuc}` : 'Sin discrepancias registradas'}
                </div>
              ) : (
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr>
                        {['Sucursal','Producto','Cant. nueva','Impacto ($)','Estatus','Notas','Acción'].map(h=>(
                          <th key={h} style={{textAlign:'left',padding:'7px 10px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,fontSize:12}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {revFiltradas.map((r,i) => (
                        <tr key={r.id||i} style={{background:i%2?'#f9f9f9':'#fff'}}>
                          <td style={{padding:'7px 10px',fontWeight:600}}>{r.sucursal}</td>
                          <td style={{padding:'7px 10px'}}>{r.producto}</td>
                          <td style={{padding:'7px 10px',textAlign:'center',fontWeight:700,color:r.cantidad_ajustada!=null?'#3B6D11':'#bbb'}}>
                            {r.cantidad_ajustada!=null ? parseFloat(r.cantidad_ajustada).toLocaleString('es-MX',{maximumFractionDigits:3}) : '—'}
                          </td>
                          <td style={{padding:'7px 10px',fontWeight:600,color:'#C00000'}}>{r.impacto?fmt(r.impacto):'—'}</td>
                          <td style={{padding:'7px 10px'}}>
                            <span style={{background:estBg[r.estatus]||'#f5f5f5',color:estColor[r.estatus]||'#555',padding:'2px 8px',borderRadius:100,fontSize:11,fontWeight:700}}>
                              {r.estatus}
                            </span>
                          </td>
                          <td style={{padding:'7px 10px',color:'#888',fontSize:12}}>{r.notas}</td>
                          <td style={{padding:'7px 10px'}}>
                            <select
                              style={{padding:'4px 8px',borderRadius:6,border:'1px solid #ddd',fontSize:12,cursor:'pointer'}}
                              value={r.estatus}
                              onChange={e=>cambiarEstatus(r.id,e.target.value)}
                            >
                              {ESTATUSES.map(e=><option key={e} value={e}>{e}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )})()}
            </div>
          </>
        )}

        {tab === 'semanal' && <RevisionSemanal key={semanaRef} SUCURSALES={SUCURSALES} semanaInicial={semanaRef} />}

        {tab === 'cobros' && (
          <>
            <div style={st.card}>
              {/* Selector de sucursal */}
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                <div style={{fontWeight:600,fontSize:14}}>Ver cobros de:</div>
                <select
                  style={{padding:'7px 12px',border:'1px solid #ddd',borderRadius:8,fontSize:13,flex:1,maxWidth:280}}
                  value={sucRevision}
                  onChange={e=>cargarAnalisisSucursal(e.target.value)}
                >
                  <option value="">Selecciona una sucursal...</option>
                  {SUCURSALES.map(s=><option key={s.k} value={s.k}>{s.n}</option>)}
                </select>
                {sucRevision && (
                  <span style={{fontSize:12,color:'#888'}}>Semana {semanaRef}</span>
                )}
              </div>

              {!sucRevision ? (
                <div style={{textAlign:'center',padding:30,color:'#888',fontSize:13}}>
                  Selecciona una sucursal para ver sus productos a cobrar.
                </div>
              ) : (() => {
                const nombreSuc = SUCURSALES.find(s=>s.k===sucRevision)?.n || sucRevision
                const itemsSuc = cobrosSemana.filter(r => r.sucursal === nombreSuc)
                const totalSuc = itemsSuc.reduce((a,r) => a + Math.abs(r.impacto||0), 0)

                return itemsSuc.length === 0 ? (
                  <div style={{textAlign:'center',padding:30,color:'#888',fontSize:13}}>
                    Sin productos marcados "A cobro" para {nombreSuc}.
                  </div>
                ) : (
                  <>
                    {/* KPI total sucursal */}
                    <div style={{background:'#FCEBEB',borderRadius:10,padding:'14px 18px',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14,color:'#C00000'}}>{nombreSuc}</div>
                        <div style={{fontSize:12,color:'#888',marginTop:2}}>{itemsSuc.length} productos a cobrar</div>
                      </div>
                      <div style={{fontSize:26,fontWeight:700,color:'#C00000'}}>{fmt(totalSuc)}</div>
                    </div>

                    {/* Tabla de productos */}
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                      <thead>
                        <tr>
                          {['Producto','Unidad','Diferencia','Monto ($)','Notas','Acción'].map(h=>(
                            <th key={h} style={{textAlign:'left',padding:'7px 10px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,fontSize:12}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {itemsSuc.map((r,i)=>(
                          <tr key={i} style={{background:i%2?'#f9f9f9':'#fff'}}>
                            <td style={{padding:'7px 10px',fontWeight:600}}>{r.producto}</td>
                            <td style={{padding:'7px 10px',color:'#888',fontSize:12}}>
                              {(analisisSuc?.detalle||[]).find(d=>d.nombre===r.producto||d.nombre?.toUpperCase()===r.producto?.toUpperCase())?.unidad||'—'}
                            </td>
                            <td style={{padding:'7px 10px',color:'#C00000',fontWeight:600}}>
                              {getSoftDif(analisisSuc, r.producto, r.impacto)}
                            </td>
                            <td style={{padding:'7px 10px',fontWeight:700,color:'#C00000'}}>{fmt(Math.abs(r.impacto||0))}</td>
                            <td style={{padding:'7px 10px',color:'#888',fontSize:12}}>{r.notas||'—'}</td>
                            <td style={{padding:'7px 10px'}}>
                              <button
                                style={{padding:'4px 10px',borderRadius:6,border:'none',background:'#002060',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:600}}
                                onClick={async ()=>{
                                  if(!confirm('¿Confirmar cobro de '+r.producto+'?')) return
                                  await fetch('/api/revisiones',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:r.id,estatus:'CORREGIDO',notas:(r.notas?r.notas+' | ':'')+' Cobrado sem '+semanaRef})})
                                  await cargarDatos()
                                }}
                              >✓ Cobrado</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Total + Exportar */}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12,paddingTop:10,borderTop:'1px solid #eee'}}>
                      <button
                        style={{padding:'7px 14px',borderRadius:7,border:'none',background:'#C00000',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600}}
                        onClick={()=>{
                        // Enriquecer items con dif y unidad del análisis Soft
                        const detalle = analisisSuc?.detalle || []
                        const itemsEnriquecidos = itemsSuc.map(r => {
                          const softProd = detalle.find(d => d.nombre === r.producto || d.nombre?.toUpperCase() === r.producto?.toUpperCase())
                          return { ...r, dif: softProd?.dif ?? null, unidad: softProd?.unidad || '', grupo: softProd?.grupo || '' }
                        })
                        exportarCobro({sucursal:nombreSuc,items:itemsEnriquecidos,total:totalSuc,semana:semanaRef,año:new Date().getFullYear()})
                      }}
                      >📄 Exportar comprobante</button>
                      <div style={{fontWeight:700,fontSize:15}}>
                        Total a cobrar: <span style={{color:'#C00000'}}>{fmt(totalSuc)}</span>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </>
        )}

        {tab === 'historial' && (
          <>
            <div style={st.card}>
              {/* Selector de sucursal */}
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                <div style={{fontWeight:600,fontSize:14}}>Ver historial de:</div>
                <select
                  style={{padding:'7px 12px',border:'1px solid #ddd',borderRadius:8,fontSize:13,flex:1,maxWidth:280}}
                  value={sucRevision}
                  onChange={e=>setSucRevision(e.target.value)}
                >
                  <option value="">Selecciona una sucursal...</option>
                  {SUCURSALES.map(s=><option key={s.k} value={s.k}>{s.n}</option>)}
                </select>
              </div>

              {!sucRevision ? (
                <div style={{textAlign:'center',padding:30,color:'#888',fontSize:13}}>
                  Selecciona una sucursal para ver su historial.
                </div>
              ) : historial.length === 0 ? (
                <div style={{textAlign:'center',padding:30,color:'#888',fontSize:13}}>
                  No hay datos históricos aún.
                </div>
              ) : (
                <>
                  {/* Botones de semana */}
                  <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
                    {historial.map(h => (
                      <button
                        key={h.semana}
                        onClick={()=>verSemana(h.semana)}
                        style={{
                          padding:'10px 20px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,
                          background:semanaVer===h.semana?'#002060':'#f5f5f5',
                          color:semanaVer===h.semana?'#fff':'#333',
                          border:semanaVer===h.semana?'none':'1px solid #ddd',
                        }}
                      >
                        Semana {h.semana}
                        <span style={{display:'block',fontSize:11,fontWeight:400,opacity:0.8}}>
                          {h.data.length} sucursal{h.data.length!==1?'es':''}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Detalle de la sucursal seleccionada para la semana elegida */}
                  <DetalleHistorial
                    semanaVer={semanaVer}
                    sucRevision={sucRevision}
                    resumenHist={resumenHist}
                    sucursales={SUCURSALES}
                    fmt={fmt}
                    colorNeto={colorNeto}
                    estadoNeto={estadoNeto}
                  />
                </>
              )}
            </div>
          </>
        )}

        {tab === 'acumulado' && (
          <>
            {/* Selectores de rango */}
            <div style={st.card}>
              <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                <span style={{fontSize:13,fontWeight:600,color:'#555'}}>Semana inicio:</span>
                <select
                  style={{padding:'6px 12px',border:'1px solid #ddd',borderRadius:8,fontSize:13}}
                  value={acumSemIni}
                  onChange={e=>setAcumSemIni(parseInt(e.target.value))}
                >
                  {Array.from({length:semana},(_,i)=>i+1).map(s=>(
                    <option key={s} value={s}>Semana {s}</option>
                  ))}
                </select>
                <span style={{fontSize:13,fontWeight:600,color:'#555'}}>Semana fin:</span>
                <select
                  style={{padding:'6px 12px',border:'1px solid #ddd',borderRadius:8,fontSize:13}}
                  value={acumSemFin}
                  onChange={e=>setAcumSemFin(parseInt(e.target.value))}
                >
                  {semanasDesdeIni.map(s=>(
                    <option key={s} value={s}>Semana {s}{s===semanaActual?' (actual)':''}</option>
                  ))}
                </select>
                <button
                  style={{padding:'7px 18px',borderRadius:8,border:'none',background:'#002060',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}
                  disabled={acumCargando}
                  onClick={async ()=>{
                    setAcumCargando(true)
                    setAcumSucDetalle(null)
                    const año = new Date().getFullYear()
                    const semanas = Array.from({length:acumSemFin-acumSemIni+1},(_,i)=>acumSemIni+i)
                    // Cargar todas las semanas en paralelo
                    const resultados = await Promise.all(semanas.map(async s=>{
                      const [resR, analR] = await Promise.all([
                        fetch('/api/resumen?semana='+s+'&año='+año).then(r=>r.json()).catch(()=>({data:[]})),
                        fetch('/api/analisis?semana='+s+'&año='+año).then(r=>r.json()).catch(()=>({data:[]})),
                      ])
                      const analMap = {}
                      if (analR.data) analR.data.forEach(row=>{ analMap[row.sucursal]=row.resultados })
                      const map = {}
                      if (resR.data) resR.data.forEach(row=>{
                        map[row.sucursal] = calcularImpacto(row.sucursal, row.datos, analMap[row.sucursal]) || {}
                      })
                      return { semana: s, data: map }
                    }))
                    // Acumular por sucursal
                    const acum = {}
                    SUCURSALES.forEach(s=>{ acum[s.k] = { faltante:0, sobrante:0, neto:0, semanas:[] } })
                    resultados.forEach(({semana:s, data})=>{
                      SUCURSALES.forEach(suc=>{
                        const r = data[suc.k]
                        if (r?.faltante!=null) acum[suc.k].faltante += r.faltante
                        if (r?.sobrante!=null) acum[suc.k].sobrante += r.sobrante
                        if (r?.neto!=null) acum[suc.k].neto += r.neto
                        acum[suc.k].semanas.push({ semana:s, ...r })
                      })
                    })
                    setAcumData(acum)
                    setAcumCargando(false)
                  }}
                >{acumCargando ? 'Cargando...' : 'Consultar'}</button>
              </div>
            </div>

            {acumData && (
              <>
                {/* Tabla resumen acumulado */}
                <div style={st.card}>
                  <div style={{fontWeight:600,fontSize:14,marginBottom:12,color:'#555'}}>
                    Resumen semanas {acumSemIni}–{acumSemFin} · {totalSemanasRango} semanas
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                      <thead>
                        <tr>
                          {['Sucursal','Faltante ($)','Sobrante ($)','Impacto neto ($)','Detalle'].map(h=>(
                            <th key={h} style={{textAlign:'left',padding:'8px 10px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,fontSize:12}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {SUCURSALES.map((s,i)=>{
                          const r = acumData[s.k]
                          const neto = r?.neto ?? 0
                          const estCol = colorNeto(neto, 10000, 3000)
                          return (
                            <tr key={s.k} style={{background:i%2?'#f9f9f9':'#fff'}}>
                              <td style={{padding:'8px 10px',fontWeight:600}}>{s.n}</td>
                              <td style={{padding:'8px 10px',color:'#C00000',fontWeight:600}}>{fmt(r?.faltante||0)}</td>
                              <td style={{padding:'8px 10px',color:'#3B6D11',fontWeight:600}}>{fmt(r?.sobrante||0)}</td>
                              <td style={{padding:'8px 10px',fontWeight:700,color:estCol}}>{fmt(neto)}</td>
                              <td style={{padding:'8px 10px'}}>
                                <button
                                  style={{padding:'4px 10px',borderRadius:6,border:'1px solid #ddd',background:'#fff',cursor:'pointer',fontSize:11,fontWeight:500}}
                                  onClick={()=>{ const next = acumSucDetalle===s.k ? null : s.k; setAcumSucDetalle(next) }}
                                >{acumSucDetalle===s.k?'Ocultar':'Ver semanas'}</button>
                              </td>
                            </tr>
                          )
                        })}
                        {/* Totales */}
                        <tr style={{background:'#f0f4ff',fontWeight:700}}>
                          <td style={{padding:'8px 10px'}}>TOTAL CADENA</td>
                          <td style={{padding:'8px 10px',color:'#C00000'}}>{fmt(Object.values(acumData).reduce((a,r)=>a+(r?.faltante||0),0))}</td>
                          <td style={{padding:'8px 10px',color:'#3B6D11'}}>{fmt(Object.values(acumData).reduce((a,r)=>a+(r?.sobrante||0),0))}</td>
                          <td style={{padding:'8px 10px',color:'#002060'}}>{fmt(Object.values(acumData).reduce((a,r)=>a+(r?.neto||0),0))}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Detalle por semana de la sucursal seleccionada */}
                <DetalleAcumulado
                  sucKey={acumSucDetalle}
                  acumData={acumData}
                  sucursales={SUCURSALES}
                  fmt={fmt}
                  colorNeto={colorNeto}
                  card={st.card}
                />
              </>
            )}
          </>
        )}

      </div>
    </div>
  )
}
