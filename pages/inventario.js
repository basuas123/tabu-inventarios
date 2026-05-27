import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import productosDB from '../lib/productos.json'
import { exportarInventarioSucursal, imprimir } from '../lib/exportar'

const MERMAS = {
  'PESCADOS Y MARISCOS':0.15,'CARNES Y AVES':0.12,'FRUTAS Y VERDURAS':0.20,
  'CONGELADOS':0.08,'LACTEOS Y REFRIGERADOS':0.05,'SALSAS Y ADEREZOS':0.03,
  'SUPER ORIENTAL':0.05,'ABARROTES':0.02,'ABARROTES BAR':0.02,
  'CERVECERIA':0.01,'COCA COLA':0.01,'CRISTALERIA BAR':0.00,
  'LICORES':0.02,'VINOS':0.02,'DESECHABLES':0.02,
  'LIMPIEZA':0.00,'PAPELERIA U OFICINA':0.00,'SERVICIO':0.00,
}

function getWeek() {
  const d = new Date()
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7)
}

export default function InventarioPage() {
  const router = useRouter()
  const [user, setUser]           = useState(null)
  const [productos, setProductos] = useState([])
  const [cantidades, setCantidades] = useState({})
  const [responsable, setResponsable] = useState('')
  const [busqueda, setBusqueda]   = useState('')
  const [tab, setTab]             = useState('captura') // captura | resumen
  const [guardando, setGuardando] = useState(false)
  const [savedMsg, setSavedMsg]   = useState(false)
  const [semana]                  = useState(getWeek())

  useEffect(() => {
    const stored = localStorage.getItem('tabu_user')
    if (!stored) { router.push('/'); return }
    const u = JSON.parse(stored)
    if (u.rol === 'dir') { router.push('/direccion'); return }
    setUser(u)
    const prods = productosDB[u.key]?.productos || []
    setProductos(prods)
    // Cargar cantidades guardadas localmente
    const local = localStorage.getItem(`inv_${u.key}_sem${semana}`)
    if (local) setCantidades(JSON.parse(local))
    const resp = localStorage.getItem(`resp_${u.key}`)
    if (resp) setResponsable(resp)
  }, [])

  const updateCantidad = useCallback((id, val) => {
    setCantidades(prev => {
      const next = { ...prev, [id]: val === '' ? '' : parseFloat(val) }
      return next
    })
  }, [])

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => {
      localStorage.setItem(`inv_${user.key}_sem${semana}`, JSON.stringify(cantidades))
      localStorage.setItem(`resp_${user.key}`, responsable)
    }, 500)
    return () => clearTimeout(timer)
  }, [cantidades, responsable, user, semana])

  async function guardar() {
    setGuardando(true)
    try {
      await fetch('/api/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sucursal: user.key,
          semana,
          año: new Date().getFullYear(),
          datos: cantidades,
          responsable,
        })
      })
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 3000)
    } catch (e) {
      // Guardar solo local si no hay conexión
      localStorage.setItem(`inv_${user.key}_sem${semana}`, JSON.stringify(cantidades))
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 3000)
    }
    setGuardando(false)
  }

  function logout() {
    localStorage.removeItem('tabu_user')
    router.push('/')
  }

  if (!user) return <div style={{padding:40,textAlign:'center'}}>Cargando...</div>

  const grupos = [...new Set(productos.map(p => p.grupo))]
  const filled = productos.filter(p => cantidades[p.id] !== undefined && cantidades[p.id] !== '').length
  const pct = productos.length ? Math.round(filled / productos.length * 100) : 0

  const filtrados = busqueda
    ? productos.filter(p => p.nombre.includes(busqueda.toUpperCase()))
    : productos

  // Resumen
  let totFalt = 0, totSobr = 0, diffs = []
  productos.forEach(p => {
    const f = parseFloat(cantidades[p.id]) || 0
    if (f === 0 && cantidades[p.id] === undefined) return
    const merma = p.merma ?? MERMAS[p.grupo] ?? 0.02
    const ajustado = merma < 1 ? f / (1 - merma) : f
    const sistema = ajustado * (0.85 + Math.random() * 0.3) // placeholder
    const dif = ajustado - sistema
    const imp = dif * (p.costo || 0)
    if (Math.abs(dif) > 0.01) {
      if (imp < 0) totFalt += imp; else totSobr += imp
      diffs.push({ ...p, f, ajustado, sistema, dif, imp })
    }
  })
  diffs.sort((a, b) => a.imp - b.imp)

  const fmt = n => '$' + Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const st = {
    topbar: { background:'#fff', borderBottom:'1px solid #eee', padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:52, position:'sticky', top:0, zIndex:100 },
    logo:   { display:'flex', alignItems:'center', gap:8, fontWeight:600, fontSize:15 },
    dot:    { width:8, height:8, borderRadius:'50%', background:'#C00000' },
    page:   { maxWidth:720, margin:'0 auto', padding:'16px 12px 120px' },
    card:   { background:'#fff', borderRadius:10, border:'1px solid #eee', padding:'14px 16px', marginBottom:12 },
    btn:    { padding:'8px 14px', borderRadius:8, border:'1px solid #ddd', background:'#fff', cursor:'pointer', fontSize:13, fontWeight:500 },
    btnPr:  { padding:'9px 18px', borderRadius:8, border:'none', background:'#002060', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 },
    tabs:   { display:'flex', gap:0, borderBottom:'1px solid #eee', marginBottom:16 },
    tab:    (a) => ({ padding:'9px 18px', fontSize:13, cursor:'pointer', borderBottom: a?'2px solid #002060':'2px solid transparent', color:a?'#002060':'#666', fontWeight:a?600:400, background:'none', border:'none', borderBottom: a?'2px solid #002060':'2px solid transparent' }),
    group:  { fontSize:12, fontWeight:700, color:'#fff', background:'#2E75B6', padding:'4px 10px', borderRadius:4, margin:'10px 0 2px', display:'flex', alignItems:'center', gap:6 },
    row:    (even) => ({ display:'grid', gridTemplateColumns:'1fr 70px 110px', gap:8, alignItems:'center', padding:'6px 8px', borderRadius:4, background: even?'#f9f9f9':'#fff', fontSize:13 }),
    numInp: { width:'100%', padding:'5px 8px', border:'1px solid #ddd', borderRadius:6, fontSize:13, textAlign:'center', background:'#fff' },
    savebar:{ position:'fixed', bottom:0, left:0, right:0, background:'#fff', borderTop:'1px solid #eee', padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, zIndex:50 },
    kpi:    { background:'#f5f5f5', borderRadius:8, padding:'12px 14px', flex:1 },
    badge:  (r) => ({ display:'inline-block', padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:600, background: r<0?'#FCEBEB':'#EAF3DE', color: r<0?'#A32D2D':'#3B6D11' }),
  }

  return (
    <div>
      <div style={st.topbar}>
        <div style={st.logo}>
          <div style={st.dot}></div>
          {user.nombre}
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontSize:12,color:'#666'}}>Semana {semana}</span>
          <button style={st.btn} onClick={logout}>Salir</button>
        </div>
      </div>

      <div style={st.page}>

        {/* Tabs */}
        <div style={st.tabs}>
          <button style={st.tab(tab==='captura')} onClick={()=>setTab('captura')}>Captura</button>
          <button style={st.tab(tab==='resumen')} onClick={()=>setTab('resumen')}>Resumen</button>
        </div>

        {tab === 'captura' && (
          <>
            {/* Progreso */}
            <div style={st.card}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:13}}>
                <span style={{color:'#666'}}>Progreso de captura</span>
                <span style={{fontWeight:600}}>{filled} de {productos.length} productos ({pct}%)</span>
              </div>
              <div style={{height:6,background:'#eee',borderRadius:3}}>
                <div style={{height:'100%',background:'#002060',borderRadius:3,width:`${pct}%`,transition:'width 0.3s'}}></div>
              </div>
            </div>

            {/* Responsable */}
            <div style={st.card}>
              <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:12,alignItems:'center'}}>
                <span style={{fontSize:13,fontWeight:600,color:'#555'}}>Responsable:</span>
                <input
                  style={{padding:'7px 10px',border:'1px solid #ddd',borderRadius:6,fontSize:13}}
                  value={responsable}
                  onChange={e=>setResponsable(e.target.value)}
                  placeholder="Nombre del encargado"
                />
              </div>
            </div>

            {/* Búsqueda */}
            <input
              style={{width:'100%',padding:'9px 12px',border:'1px solid #ddd',borderRadius:8,fontSize:13,marginBottom:12,background:'#fff'}}
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={e=>setBusqueda(e.target.value)}
            />

            {/* Headers */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 70px 110px',gap:8,padding:'4px 8px',marginBottom:4}}>
              <span style={{fontSize:11,fontWeight:600,color:'#888',textTransform:'uppercase'}}>Producto</span>
              <span style={{fontSize:11,fontWeight:600,color:'#888',textTransform:'uppercase',textAlign:'center'}}>Unidad</span>
              <span style={{fontSize:11,fontWeight:600,color:'#888',textTransform:'uppercase',textAlign:'center'}}>Cantidad</span>
            </div>

            {/* Productos */}
            {busqueda ? (
              filtrados.map((p,i) => (
                <div key={p.id} style={st.row(i%2===0)}>
                  <span>{p.nombre}</span>
                  <span style={{textAlign:'center',color:'#888',fontSize:12}}>{p.unidad}</span>
                  <input
                    type="number" min="0" step="0.001" style={st.numInp}
                    value={cantidades[p.id] ?? ''}
                    onChange={e=>updateCantidad(p.id, e.target.value)}
                    placeholder="0"
                  />
                </div>
              ))
            ) : (
              grupos.map(g => {
                const items = productos.filter(p=>p.grupo===g)
                return (
                  <div key={g}>
                    <div style={st.group}>{g}</div>
                    {items.map((p,i)=>(
                      <div key={p.id} style={st.row(i%2===0)}>
                        <span>{p.nombre}</span>
                        <span style={{textAlign:'center',color:'#888',fontSize:12}}>{p.unidad}</span>
                        <input
                          type="number" min="0" step="0.001" style={st.numInp}
                          value={cantidades[p.id] ?? ''}
                          onChange={e=>updateCantidad(p.id, e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                )
              })
            )}
          </>
        )}

        {tab === 'resumen' && (
          <>
            {/* KPIs */}
            <div style={{display:'flex',gap:10,marginBottom:16}}>
              <div style={st.kpi}>
                <div style={{fontSize:11,color:'#888',marginBottom:4}}>Pérdida ($)</div>
                <div style={{fontSize:20,fontWeight:700,color:'#C00000'}}>{fmt(totFalt)}</div>
              </div>
              <div style={st.kpi}>
                <div style={{fontSize:11,color:'#888',marginBottom:4}}>Sobrante ($)</div>
                <div style={{fontSize:20,fontWeight:700,color:'#3B6D11'}}>{fmt(totSobr)}</div>
              </div>
              <div style={st.kpi}>
                <div style={{fontSize:11,color:'#888',marginBottom:4}}>Con diferencia</div>
                <div style={{fontSize:20,fontWeight:700,color:'#185FA5'}}>{diffs.length}</div>
              </div>
            </div>

            {/* Tabla diferencias */}
            <div style={st.card}>
              <div style={{fontWeight:600,fontSize:13,marginBottom:12,color:'#555'}}>Productos con diferencia</div>
              {diffs.length === 0 ? (
                <div style={{textAlign:'center',padding:30,color:'#888',fontSize:13}}>
                  Sin diferencias detectadas · Guarda primero el inventario
                </div>
              ) : (
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead>
                      <tr>
                        {['Producto','Grupo','Físico','Ajustado','Diferencia','Impacto $','Estado'].map(h=>(
                          <th key={h} style={{textAlign:'left',padding:'6px 8px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {diffs.map((d,i)=>(
                        <tr key={d.id} style={{background:i%2?'#f9f9f9':'#fff'}}>
                          <td style={{padding:'6px 8px',fontWeight:500}}>{d.nombre}</td>
                          <td style={{padding:'6px 8px',color:'#888'}}>{d.grupo}</td>
                          <td style={{padding:'6px 8px',textAlign:'right'}}>{d.f.toFixed(3)}</td>
                          <td style={{padding:'6px 8px',textAlign:'right'}}>{d.ajustado.toFixed(3)}</td>
                          <td style={{padding:'6px 8px',textAlign:'right',color:d.dif<0?'#C00000':'#3B6D11',fontWeight:600}}>
                            {d.dif>0?'+':''}{d.dif.toFixed(3)}
                          </td>
                          <td style={{padding:'6px 8px',textAlign:'right',fontWeight:600,color:d.imp<0?'#C00000':'#3B6D11'}}>
                            {d.imp<0?'-':''}{fmt(d.imp)}
                          </td>
                          <td style={{padding:'6px 8px'}}>
                            <span style={st.badge(d.imp)}>{d.imp<0?'FALTANTE':'SOBRANTE'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Save bar */}
      <div style={st.savebar}>
        {savedMsg ? (
          <span style={{color:'#3B6D11',fontSize:13,fontWeight:500}}>✓ Guardado correctamente</span>
        ) : (
          <span style={{fontSize:12,color:'#888'}}>Guardado automático activado</span>
        )}
        <div style={{display:'flex',gap:8}}>
          <button style={st.btn} onClick={()=>{ if(confirm('¿Limpiar todo?')){ setCantidades({}); localStorage.removeItem(`inv_${user.key}_sem${semana}`) } }}>
            Limpiar
          </button>
          <button style={st.btnPr} onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar inventario'}
          </button>
        </div>
      </div>
    </div>
  )
}
