import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import productosDB from '../lib/productos.json'
import { exportarResumenDireccion, imprimir } from '../lib/exportar'

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

function calcularImpacto(sucKey, datos) {
  const prods = productosDB[sucKey]?.productos || []
  if (!datos || Object.keys(datos).length === 0) return null
  let faltante = 0, sobrante = 0, conDif = 0
  prods.forEach(p => {
    const f = parseFloat(datos[p.id]) || 0
    if (datos[p.id] === undefined || datos[p.id] === '') return
    const merma = p.merma ?? MERMAS[p.grupo] ?? 0.02
    const ajustado = merma < 1 ? f / (1 - merma) : f
    // Aquí iría el valor del sistema (Soft) — por ahora simulado
    const sistema = ajustado * 1.0  // cuando integres Soft, reemplazar
    const dif = ajustado - sistema
    const imp = dif * (p.costo || 0)
    if (Math.abs(dif) > 0.01) {
      conDif++
      if (imp < 0) faltante += imp; else sobrante += imp
    }
  })
  return { faltante, sobrante, neto: faltante + sobrante, conDif, capturados: Object.keys(datos).length, total: prods.length }
}

export default function DireccionPage() {
  const router = useRouter()
  const [user, setUser]         = useState(null)
  const [tab, setTab]           = useState('sucursales')
  const [resumen, setResumen]   = useState({})
  const [revisiones, setRevisiones] = useState([])
  const [loading, setLoading]   = useState(true)
  const [semana] = useState(getWeek())

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
    // Cargar inventarios de Supabase
    try {
      const res = await fetch(`/api/resumen?semana=${semana}&año=${new Date().getFullYear()}`)
      const { data } = await res.json()
      const map = {}
      if (data) {
        data.forEach(row => {
          map[row.sucursal] = calcularImpacto(row.sucursal, row.datos) || {}
          map[row.sucursal].responsable = row.responsable
          map[row.sucursal].updated_at  = row.updated_at
        })
      }
      // También revisar localStorage como fallback
      SUCURSALES.forEach(s => {
        if (!map[s.k]) {
          const local = localStorage.getItem(`inv_${s.k}_sem${semana}`)
          if (local) {
            const datos = JSON.parse(local)
            map[s.k] = calcularImpacto(s.k, datos) || {}
            map[s.k].local = true
          }
        }
      })
      setResumen(map)
    } catch (e) {
      // Solo localStorage
      const map = {}
      SUCURSALES.forEach(s => {
        const local = localStorage.getItem(`inv_${s.k}_sem${semana}`)
        if (local) {
          map[s.k] = calcularImpacto(s.k, JSON.parse(local)) || {}
        }
      })
      setResumen(map)
    }

    // Cargar revisiones
    try {
      const res = await fetch('/api/revisiones')
      const { data } = await res.json()
      if (data) setRevisiones(data)
    } catch (e) {
      setRevisiones([])
    }

    setLoading(false)
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
      body: JSON.stringify({ sucursal: suc, producto: prod, impacto: imp, estatus: 'PENDIENTE', notas: nota, semana, año: new Date().getFullYear() })
    })
    cargarDatos()
  }

  function logout() {
    localStorage.removeItem('tabu_user')
    router.push('/')
  }

  if (!user) return <div style={{padding:40,textAlign:'center'}}>Cargando...</div>

  const sucursalesConDatos   = SUCURSALES.filter(s => resumen[s.k])
  const totalFaltante        = sucursalesConDatos.reduce((a,s) => a + (resumen[s.k]?.faltante || 0), 0)
  const totalSobrante        = sucursalesConDatos.reduce((a,s) => a + (resumen[s.k]?.sobrante || 0), 0)
  const criticas             = sucursalesConDatos.filter(s => (resumen[s.k]?.neto || 0) < -2000).length
  const sinDatos             = SUCURSALES.length - sucursalesConDatos.length

  const ESTATUSES = ['PENDIENTE','EN REVISIÓN','CORREGIDO','CONFIRMADO','A COBRO']
  const estColor  = { PENDIENTE:'#EF9F27',  'EN REVISIÓN':'#EF9F27', CORREGIDO:'#639922', CONFIRMADO:'#C00000', 'A COBRO':'#C00000' }
  const estBg     = { PENDIENTE:'#FAEEDA', 'EN REVISIÓN':'#FAEEDA', CORREGIDO:'#EAF3DE', CONFIRMADO:'#FCEBEB', 'A COBRO':'#FCEBEB' }

  const cobros    = revisiones.filter(r => r.estatus === 'A COBRO')
  const totalCobro = cobros.reduce((a,r) => a + Math.abs(r.impacto || 0), 0)

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
    sem:    v => { const c = v===null?'#ccc':v<-2000?'#C00000':v<-500?'#EF9F27':'#639922'; return {width:10,height:10,borderRadius:'50%',background:c,display:'inline-block',marginRight:6} },
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
          <button style={st.btn} onClick={()=>exportarResumenDireccion({sucursales:SUCURSALES,resumen,semana,año:new Date().getFullYear()})}>📥 Excel</button>
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
        </div>

        {tab === 'sucursales' && (
          <div style={st.card}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr>
                    {['','Sucursal','Capturados','Faltante ($)','Sobrante ($)','Impacto neto ($)','Estado','Responsable'].map(h=>(
                      <th key={h} style={{textAlign:'left',padding:'8px 10px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,whiteSpace:'nowrap',fontSize:12}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SUCURSALES.map((s,i) => {
                    const r = resumen[s.k]
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
                          {r?.faltante ? fmt(r.faltante) : '—'}
                        </td>
                        <td style={{padding:'8px 10px',color:'#3B6D11',fontWeight:r?.sobrante?600:400}}>
                          {r?.sobrante ? fmt(r.sobrante) : '—'}
                        </td>
                        <td style={{padding:'8px 10px',fontWeight:600,color:estCol}}>
                          {neto !== null ? fmt(neto) : '—'}
                        </td>
                        <td style={{padding:'8px 10px'}}>
                          <span style={{background:estBg2,color:estCol,padding:'2px 8px',borderRadius:100,fontSize:11,fontWeight:700}}>
                            {estado}
                          </span>
                        </td>
                        <td style={{padding:'8px 10px',color:'#888',fontSize:12}}>{r?.responsable || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'revision' && (
          <>
            {/* Revisiones */}
            <div style={st.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <div style={{fontWeight:600,fontSize:14}}>Discrepancias en revisión</div>
                <button style={st.btnPr} onClick={agregarRevision}>+ Agregar</button>
              </div>
              {revisiones.length === 0 ? (
                <div style={{textAlign:'center',padding:30,color:'#888',fontSize:13}}>Sin discrepancias registradas</div>
              ) : (
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr>
                        {['Sucursal','Producto','Impacto ($)','Estatus','Notas','Acción'].map(h=>(
                          <th key={h} style={{textAlign:'left',padding:'7px 10px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,fontSize:12}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {revisiones.map((r,i) => (
                        <tr key={r.id||i} style={{background:i%2?'#f9f9f9':'#fff'}}>
                          <td style={{padding:'7px 10px',fontWeight:600}}>{r.sucursal}</td>
                          <td style={{padding:'7px 10px'}}>{r.producto}</td>
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
              )}
            </div>

            {/* Cobros */}
            <div style={st.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <div style={{fontWeight:600,fontSize:14}}>Cobro autorizado — semana {semana}</div>
                <div style={{fontSize:22,fontWeight:700,color:'#C00000'}}>{fmt(totalCobro)}</div>
              </div>
              {cobros.length === 0 ? (
                <div style={{textAlign:'center',padding:20,color:'#888',fontSize:13}}>Sin cobros autorizados esta semana</div>
              ) : (
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead>
                    <tr>
                      {['Sucursal','Producto','Monto ($)','Autorizado por'].map(h=>(
                        <th key={h} style={{textAlign:'left',padding:'7px 10px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,fontSize:12}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cobros.map((r,i)=>(
                      <tr key={r.id||i} style={{background:i%2?'#f9f9f9':'#fff'}}>
                        <td style={{padding:'7px 10px',fontWeight:600}}>{r.sucursal}</td>
                        <td style={{padding:'7px 10px'}}>{r.producto}</td>
                        <td style={{padding:'7px 10px',fontWeight:700,color:'#C00000'}}>{fmt(Math.abs(r.impacto))}</td>
                        <td style={{padding:'7px 10px',color:'#888'}}>Directora de Inventarios</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
