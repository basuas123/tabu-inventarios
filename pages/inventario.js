import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
// exportar loaded dynamically

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
  const [revisiones, setRevisiones] = useState([])

  useEffect(() => {
    const stored = localStorage.getItem('tabu_user')
    if (!stored) { router.push('/'); return }
    const u = JSON.parse(stored)
    if (u.rol === 'dir') { router.push('/direccion'); return }
    setUser(u)
    // Cargar productos via API para no pesar en el cliente
    fetch('/api/productos?sucursal=' + u.key)
      .then(r => r.json())
      .then(({ productos: prods }) => {
        if (prods) setProductos(prods)
      })
      .catch(() => setProductos([]))
    // Cargar cantidades — primero Supabase, luego localStorage como fallback
    const resp = localStorage.getItem('resp_' + u.key)
    if (resp) setResponsable(resp)

    // Cargar revisiones pendientes — filtrar por nombre de sucursal
    fetch('/api/revisiones')
      .then(r => r.json())
      .then(({ data }) => {
        if (data) {
          // Filtrar solo las de esta sucursal (por nombre exacto)
          const misSucursal = data.filter(r =>
            r.sucursal === u.nombre &&
            (r.estatus === 'EN REVISIÓN' || r.estatus === 'CONFIRMADO' || r.estatus === 'A COBRO')
          )
          setRevisiones(misSucursal)
        }
      })
      .catch(() => {})

    fetch('/api/inventario?sucursal=' + u.key + '&semana=' + getWeek() + '&año=' + new Date().getFullYear())
      .then(r => r.json())
      .then(({ data }) => {
        if (data && data.length > 0 && data[0].datos) {
          setCantidades(data[0].datos)
          if (data[0].responsable) setResponsable(data[0].responsable)
        } else {
          // Fallback localStorage
          const local = localStorage.getItem('inv_' + u.key + '_sem' + getWeek())
          if (local) setCantidades(JSON.parse(local))
        }
      })
      .catch(() => {
        const local = localStorage.getItem('inv_' + u.key + '_sem' + getWeek())
        if (local) setCantidades(JSON.parse(local))
      })
  }, [])

  const updateCantidad = useCallback((id, val) => {
    const parsed = val === '' ? '' : parseFloat(val)

    // Actualizar estado local inmediatamente
    setCantidades(prev => {
      const next = { ...prev, [id]: parsed }
      // Guardar en localStorage
      if (user) localStorage.setItem('inv_' + user.key + '_sem' + semana, JSON.stringify(next))
      return next
    })

    // Guardar en Supabase con debounce de 800ms por producto
    const timerKey = 'timer_' + id
    if (window[timerKey]) clearTimeout(window[timerKey])
    window[timerKey] = setTimeout(() => {
      if (!user) return
      fetch('/api/inventario_item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sucursal: user.key,
          semana,
          año: new Date().getFullYear(),
          producto_id: id,
          cantidad: parsed,
          responsable,
        })
      }).then(() => {
        setSavedMsg(true)
        setTimeout(() => setSavedMsg(false), 1500)
      }).catch(() => {
        // Sin conexión — está en localStorage de todas formas
      })
    }, 800)
  }, [user, semana, responsable])

  useEffect(() => {
    if (!user) return
    localStorage.setItem('resp_' + user.key, responsable)
  }, [responsable, user])

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
    const sistema = f * (0.85 + Math.random() * 0.3) // placeholder hasta cargar Soft
    const dif = f - sistema
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
          <button style={st.tab(tab==='revisiones')} onClick={()=>setTab('revisiones')}>
            {revisiones.length > 0 ? `⚠ Revisiones (${revisiones.length})` : 'Revisiones'}
          </button>
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
                    data-prod-id={p.id}
                    onKeyDown={e=>{
                      if(e.key==='Enter'){
                        e.preventDefault()
                        const inputs = Array.from(document.querySelectorAll('input[data-prod-id]'))
                        const idx = inputs.findIndex(el=>el.dataset.prodId===p.id)
                        if(idx>=0 && idx<inputs.length-1) inputs[idx+1].focus()
                      }
                    }}
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

        {tab === 'revisiones' && (
          <div style={{paddingBottom:20}}>
            {revisiones.length === 0 ? (
              <div style={{textAlign:'center',padding:40,color:'#888',fontSize:13}}>
                Sin notificaciones de dirección para esta sucursal.
              </div>
            ) : (
              <>
                {revisiones.some(r=>r.estatus==='A COBRO') && (
                  <div style={{background:'#FCEBEB',borderRadius:8,padding:'12px 14px',marginBottom:12,fontSize:13,color:'#C00000',fontWeight:600}}>
                    🚨 Tienes productos marcados para cobro. Comunícate con dirección.
                  </div>
                )}
                {revisiones.some(r=>r.estatus==='EN REVISIÓN'||r.estatus==='CONFIRMADO') && (
                  <div style={{background:'#FAEEDA',borderRadius:8,padding:'12px 14px',marginBottom:14,fontSize:13,color:'#854F0B'}}>
                    ⚠ Dirección solicita que revises los siguientes productos y confirmes las cantidades.
                  </div>
                )}
                <div style={{background:'#fff',borderRadius:10,border:'1px solid #eee',overflow:'hidden'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr>
                        {['Producto','Impacto ($)','Estatus','Notas'].map(h=>(
                          <th key={h} style={{textAlign:'left',padding:'9px 12px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,fontSize:12,background:'#f9f9f9'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {revisiones.map((r,i)=>(
                        <tr key={i} style={{background:i%2?'#f9f9f9':'#fff'}}>
                          <td style={{padding:'9px 12px',fontWeight:600}}>{r.producto}</td>
                          <td style={{padding:'9px 12px',color:'#C00000',fontWeight:600}}>
                            {r.impacto ? ('$'+Math.abs(r.impacto).toLocaleString('es-MX',{minimumFractionDigits:2})) : '—'}
                          </td>
                          <td style={{padding:'9px 12px'}}>
                            <span style={{
                              background: r.estatus==='EN REVISIÓN'?'#FAEEDA':'#FCEBEB',
                              color: r.estatus==='EN REVISIÓN'?'#854F0B':'#C00000',
                              padding:'2px 8px',borderRadius:100,fontSize:11,fontWeight:700
                            }}>{r.estatus}</span>
                          </td>
                          <td style={{padding:'9px 12px',color:'#888',fontSize:12}}>{r.notas||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
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
