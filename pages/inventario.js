import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { ordenarComoSoft } from '../lib/grupos'
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
  const [cobrosSuc, setCobrosSuc] = useState([])      // artículos enviados a cobro / cobrados de esta sucursal
  const [histSemanas, setHistSemanas] = useState([])     // semanas con datos
  const [histSemana, setHistSemana]   = useState(null)   // semana seleccionada
  const [histInv, setHistInv]         = useState({})     // semana → inventario
  const [histAnal, setHistAnal]       = useState({})     // semana → análisis
  const [histRevs, setHistRevs]       = useState([])     // todas las revisiones de la sucursal
  const [histCargando, setHistCargando] = useState(false)
  const [cambios, setCambios] = useState([])           // pila de cambios para Deshacer (máx 50)
  const cantidadesRef = useRef({})

  useEffect(() => { cantidadesRef.current = cantidades }, [cantidades])

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
            (r.estatus === 'EN REVISIÓN' || r.estatus === 'CONFIRMADO' || r.estatus === 'A COBRO' || r.estatus === 'REVISADA')
          )
          setRevisiones(misSucursal)
          // Cobros: todo lo enviado a cobro (pendiente o ya cobrado)
          setCobrosSuc(data.filter(r =>
            r.sucursal === u.nombre &&
            (r.estatus === 'A COBRO' || String(r.notas||'').includes('Cobrado'))
          ))
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

  const updateCantidad = useCallback((id, val, skipHist) => {
    const parsed = val === '' ? '' : parseFloat(val)

    // Registrar valor anterior para Deshacer (una entrada por producto editado)
    if (!skipHist) {
      const prevVal = cantidadesRef.current[id]
      setCambios(prev => {
        const last = prev[prev.length - 1]
        if (last && last.tipo === 'captura-item' && last.id === id) return prev
        return [...prev.slice(-49), { tipo: 'captura-item', id, prev: prevVal }]
      })
    }

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
        // Si hay una revisión activa para este producto, actualizar cantidad_ajustada
        if (parsed !== '' && !isNaN(parsed)) {
          const prod = productos.find(p => p.id === id)
          if (prod) {
            const rev = revisiones.find(r => r.producto === prod.nombre.toUpperCase() || r.producto === prod.nombre)
            if (rev) {
              fetch('/api/revisiones', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: rev.id, cantidad_ajustada: parsed })
              }).catch(() => {})
            }
          }
        }
      }).catch(() => {
        // Sin conexión — está en localStorage de todas formas
      })
    }, 800)
  }, [user, semana, responsable, productos, revisiones])

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

  async function cargarHistorialSuc() {
    if (!user) return
    setHistCargando(true)
    const año = new Date().getFullYear()
    try {
      const [invR, analR, revR] = await Promise.all([
        fetch('/api/inventario?sucursal=' + user.key + '&año=' + año).then(r=>r.json()).catch(()=>({data:[]})),
        fetch('/api/analisis?sucursal=' + user.key + '&año=' + año).then(r=>r.json()).catch(()=>({data:[]})),
        fetch('/api/revisiones').then(r=>r.json()).catch(()=>({data:[]})),
      ])
      const invMap = {}, analMap = {}
      ;(invR.data||[]).forEach(row => { if (invMap[row.semana] === undefined) invMap[row.semana] = row })
      ;(analR.data||[]).forEach(row => { if (analMap[row.semana] === undefined) analMap[row.semana] = row.resultados })
      const semanas = [...new Set([...Object.keys(invMap), ...Object.keys(analMap)].map(Number))].sort((a,b)=>b-a)
      const misRevs = (revR.data||[]).filter(r => r.sucursal === user.nombre)
      setHistInv(invMap); setHistAnal(analMap); setHistRevs(misRevs); setHistSemanas(semanas)
      if (semanas.length && histSemana === null) setHistSemana(semanas[0])
    } catch(e) {}
    setHistCargando(false)
  }

  async function deshacer() {
    if (!cambios.length) return
    const u = cambios[cambios.length - 1]
    setCambios(prev => prev.slice(0, -1))

    if (u.tipo === 'captura-todo') {
      // Restaurar snapshot completo y persistir
      setCantidades(u.snapshot)
      localStorage.setItem('inv_' + user.key + '_sem' + semana, JSON.stringify(u.snapshot))
      fetch('/api/inventario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sucursal: user.key, semana, año: new Date().getFullYear(), datos: u.snapshot, responsable })
      }).catch(()=>{})
      setSavedMsg(true); setTimeout(()=>setSavedMsg(false), 2000)
    }

    if (u.tipo === 'captura-item') {
      // Restaurar el valor anterior de ese producto (sin volver a apilar)
      updateCantidad(u.id, u.prev === undefined || u.prev === null ? '' : String(u.prev), true)
    }

    if (u.tipo === 'revision') {
      await fetch('/api/revisiones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: u.id, cantidad_ajustada: u.prev.cantidad_ajustada, estatus: u.prev.estatus })
      }).catch(()=>{})
      setRevisiones(prev => prev.map(x => x.id === u.id ? { ...x, cantidad_ajustada: u.prev.cantidad_ajustada, estatus: u.prev.estatus } : x))
    }
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
    if (cantidades[p.id] === undefined) return
    const dif = 0  // sin Soft cargado, sin diferencia
    const imp = dif * (p.costo || 0)
    if (Math.abs(dif) > 0.01) {
      if (imp < 0) totFalt += imp; else totSobr += imp
      diffs.push({ ...p, f, ajustado: f, sistema: f - dif, dif, imp })
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
          <button style={st.tab(tab==='cobros')} onClick={()=>setTab('cobros')}>
            {cobrosSuc.length > 0 ? `💰 Cobros (${cobrosSuc.length})` : 'Cobros'}
          </button>
          <button style={st.tab(tab==='historial')} onClick={()=>{setTab('historial');cargarHistorialSuc()}}>Historial</button>
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
                    ⚠ Dirección solicita revisar estos productos. Recuenta físicamente y escribe la <b>nueva cantidad</b>; al guardarla, el estatus cambia a REVISADA y dirección lo verá de inmediato.
                  </div>
                )}
                <div style={{background:'#fff',borderRadius:10,border:'1px solid #eee',overflow:'hidden'}}>
                  <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr>
                        {['Producto','Unidad','Cant. capturada','Nueva cantidad','Impacto ($)','Estatus','Notas'].map(h=>(
                          <th key={h} style={{textAlign:'left',padding:'9px 12px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,fontSize:12,background:'#f9f9f9',whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {revisiones.map((r,i)=>{
                        const prod = productos.find(p => (p.nombre||'').toUpperCase() === (r.producto||'').toUpperCase())
                        const capturada = prod && cantidades[prod.id] !== undefined && cantidades[prod.id] !== '' ? parseFloat(cantidades[prod.id]) : null
                        const revisada = r.estatus === 'REVISADA'
                        return (
                        <tr key={r.id||i} style={{background:i%2?'#f9f9f9':'#fff'}}>
                          <td style={{padding:'9px 12px',fontWeight:600}}>{r.producto}</td>
                          <td style={{padding:'9px 12px',color:'#888',fontSize:12}}>{prod?.unidad || '—'}</td>
                          <td style={{padding:'9px 12px',textAlign:'center',fontWeight:600}}>
                            {capturada !== null ? capturada.toLocaleString('es-MX',{maximumFractionDigits:3}) : '—'}
                          </td>
                          <td style={{padding:'9px 12px'}}>
                            <input
                              key={(r.id||i)+'-'+(r.cantidad_ajustada??'')+'-nueva'}
                              type="number" min="0" step="0.001"
                              style={{width:90,padding:'5px 8px',border:'1px solid '+(revisada?'#639922':'#ddd'),borderRadius:6,fontSize:12,textAlign:'center',background:revisada?'#F4FAEC':'#fff'}}
                              placeholder="0.000"
                              defaultValue={r.cantidad_ajustada ?? ''}
                              onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); e.target.blur() } }}
                              onBlur={async e=>{
                                const val = e.target.value === '' ? null : parseFloat(e.target.value)
                                if (val === null || isNaN(val)) return
                                if (val === r.cantidad_ajustada) return
                                // Registrar estado anterior para Deshacer
                                setCambios(prev => [...prev.slice(-49), { tipo:'revision', id: r.id, prev: { cantidad_ajustada: r.cantidad_ajustada ?? null, estatus: r.estatus } }])
                                // Guardar nueva cantidad y marcar como REVISADA
                                await fetch('/api/revisiones', {
                                  method:'PATCH',
                                  headers:{'Content-Type':'application/json'},
                                  body: JSON.stringify({ id: r.id, cantidad_ajustada: val, estatus:'REVISADA' })
                                }).catch(()=>{})
                                // Sincronizar el físico capturado SOLO si la revisión es de la semana actual
                                if (prod && (r.semana == null || String(r.semana) === String(semana))) {
                                  updateCantidad(prod.id, String(val))
                                }
                                // Refrescar estado local
                                setRevisiones(prev => prev.map(x => x.id===r.id ? {...x, cantidad_ajustada: val, estatus:'REVISADA'} : x))
                              }}
                            />
                          </td>
                          <td style={{padding:'9px 12px',color:'#C00000',fontWeight:600}}>
                            {r.impacto ? ('$'+Math.abs(r.impacto).toLocaleString('es-MX',{minimumFractionDigits:2})) : '—'}
                          </td>
                          <td style={{padding:'9px 12px'}}>
                            <span style={{
                              background: revisada?'#EAF3DE': r.estatus==='EN REVISIÓN'?'#FAEEDA':'#FCEBEB',
                              color: revisada?'#3B6D11': r.estatus==='EN REVISIÓN'?'#854F0B':'#C00000',
                              padding:'2px 8px',borderRadius:100,fontSize:11,fontWeight:700,whiteSpace:'nowrap'
                            }}>{revisada?'✓ REVISADA':r.estatus}</span>
                          </td>
                          <td style={{padding:'9px 12px',color:'#888',fontSize:12}}>{r.notas||'—'}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'cobros' && (
          <div style={{paddingBottom:20}}>
            {cobrosSuc.length === 0 ? (
              <div style={{textAlign:'center',padding:40,color:'#888',fontSize:13}}>
                Sin cobros registrados para esta sucursal.
              </div>
            ) : (() => {
              const fmtC = n => '$' + Math.abs(parseFloat(n)||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})
              const yaCobrado = r => String(r.notas||'').includes('Cobrado')
              // Agrupar por semana, más reciente primero
              const porSemana = {}
              cobrosSuc.forEach(r => {
                const s = r.semana != null ? r.semana : 'Sin semana'
                if (!porSemana[s]) porSemana[s] = []
                porSemana[s].push(r)
              })
              const semanasOrd = Object.keys(porSemana).sort((a,b) => (parseInt(b)||0) - (parseInt(a)||0))
              const totalGral = cobrosSuc.reduce((a,r) => a + Math.abs(r.impacto||0), 0)
              return (
                <>
                  <div style={{background:'#FCEBEB',borderRadius:10,padding:'14px 18px',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:14,color:'#C00000'}}>Artículos enviados a cobro</div>
                      <div style={{fontSize:12,color:'#888',marginTop:2}}>{cobrosSuc.length} artículos · incluye pendientes y ya cobrados</div>
                    </div>
                    <div style={{fontSize:24,fontWeight:700,color:'#C00000'}}>{fmtC(totalGral)}</div>
                  </div>
                  {semanasOrd.map(s => {
                    const items = porSemana[s]
                    const totSem = items.reduce((a,r) => a + Math.abs(r.impacto||0), 0)
                    return (
                      <div key={s} style={{background:'#fff',borderRadius:10,border:'1px solid #eee',marginBottom:14,overflow:'hidden'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:'#f9f9f9',borderBottom:'1px solid #eee'}}>
                          <div style={{fontWeight:700,fontSize:13}}>{s==='Sin semana' ? 'Sin semana asignada' : 'Semana ' + s}</div>
                          <div style={{fontWeight:700,fontSize:14,color:'#C00000'}}>{fmtC(totSem)}</div>
                        </div>
                        <div style={{overflowX:'auto'}}>
                          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                            <thead>
                              <tr>
                                {['Artículo','Costo ($)','Estatus','Notas'].map(h=>(
                                  <th key={h} style={{textAlign:'left',padding:'8px 12px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,fontSize:12}}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((r,i)=>(
                                <tr key={r.id||i} style={{background:i%2?'#f9f9f9':'#fff'}}>
                                  <td style={{padding:'8px 12px',fontWeight:600}}>{r.producto}</td>
                                  <td style={{padding:'8px 12px',fontWeight:700,color:'#C00000'}}>{fmtC(r.impacto)}</td>
                                  <td style={{padding:'8px 12px'}}>
                                    <span style={{background:yaCobrado(r)?'#EAF3DE':'#FCEBEB',color:yaCobrado(r)?'#3B6D11':'#A32D2D',padding:'2px 8px',borderRadius:100,fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>
                                      {yaCobrado(r)?'✓ COBRADO':'A COBRO'}
                                    </span>
                                  </td>
                                  <td style={{padding:'8px 12px',color:'#888',fontSize:12}}>{r.notas||'—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </>
              )
            })()}
          </div>
        )}

        {tab === 'historial' && (
          <div style={{paddingBottom:20}}>
            {histCargando ? (
              <div style={{textAlign:'center',padding:40,color:'#888',fontSize:13}}>Cargando historial...</div>
            ) : histSemanas.length === 0 ? (
              <div style={{textAlign:'center',padding:40,color:'#888',fontSize:13}}>
                Aún no hay semanas con datos para esta sucursal.
              </div>
            ) : (
              <>
                {/* Botones de semana */}
                <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                  {histSemanas.map(s2 => (
                    <button
                      key={s2}
                      onClick={()=>setHistSemana(s2)}
                      style={{
                        padding:'8px 16px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,
                        background:histSemana===s2?'#002060':'#f5f5f5',
                        color:histSemana===s2?'#fff':'#333',
                        border:histSemana===s2?'none':'1px solid #ddd',
                      }}
                    >
                      Sem {s2}{s2===semana?' (actual)':''}
                    </button>
                  ))}
                </div>

                {histSemana !== null && (() => {
                  const inv  = histInv[histSemana]
                  const anal = histAnal[histSemana]
                  const capturados = inv?.datos ? Object.values(inv.datos).filter(v=>v!==''&&v!==null&&v!==undefined).length : 0
                  const revsSem = histRevs.filter(r => r.semana == null ? false : String(r.semana)===String(histSemana))
                  // Enriquecer con grupo/unidad del catálogo (análisis viejos no traen grupo)
                  const catMap = {}
                  productos.forEach(pr => { catMap[(pr.nombre||'').toUpperCase()] = pr })
                  const enriquecido = (anal?.detalle||[]).map(d => {
                    const c = catMap[(d.nombre||'').toUpperCase()]
                    return { ...d, grupo: d.grupo || c?.grupo || '', unidad: d.unidad || c?.unidad || '',
                             capturado: d.fisico ?? (c && inv?.datos ? inv.datos[c.id] : null) }
                  })
                  const detalle = ordenarComoSoft(enriquecido.filter(d=>d.resultado!=='OK'))
                  const gruposDet = [...new Set(detalle.map(d=>d.grupo||''))]
                  return (
                    <>
                      {/* Resumen de captura */}
                      <div style={st.card}>
                        <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8,fontSize:13}}>
                          <span><b>Semana {histSemana}</b> · Capturados: <b>{inv ? capturados : '—'}</b>{productos.length?` de ${productos.length}`:''}</span>
                          <span style={{color:'#888'}}>Responsable: {inv?.responsable || '—'}</span>
                        </div>
                      </div>

                      {/* KPIs del análisis */}
                      {anal ? (
                        <div style={{display:'flex',gap:10,marginBottom:12}}>
                          <div style={st.kpi}>
                            <div style={{fontSize:11,color:'#888',marginBottom:4}}>Pérdida ($)</div>
                            <div style={{fontSize:18,fontWeight:700,color:'#C00000'}}>{fmt(anal.totalFalt||0)}</div>
                          </div>
                          <div style={st.kpi}>
                            <div style={{fontSize:11,color:'#888',marginBottom:4}}>Sobrante ($)</div>
                            <div style={{fontSize:18,fontWeight:700,color:'#3B6D11'}}>{fmt(anal.totalSobr||0)}</div>
                          </div>
                          <div style={st.kpi}>
                            <div style={{fontSize:11,color:'#888',marginBottom:4}}>Impacto neto</div>
                            <div style={{fontSize:18,fontWeight:700,color:(anal.neto||0)<0?'#C00000':'#3B6D11'}}>{fmt(anal.neto||0)}</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{background:'#f9f9f9',borderRadius:8,padding:'12px 14px',marginBottom:12,fontSize:13,color:'#888',textAlign:'center'}}>
                          Sin análisis de Soft para esta semana.
                        </div>
                      )}

                      {/* Diferencias del análisis */}
                      {detalle.length > 0 && (
                        <div style={st.card}>
                          <div style={{fontWeight:600,fontSize:13,marginBottom:10,color:'#555'}}>Productos con diferencia — Semana {histSemana}</div>
                          <div style={{overflowX:'auto'}}>
                            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                              <thead>
                                <tr>
                                  {['Producto','Unidad','Capturado','Sistema (Soft)','Diferencia','Impacto ($)','Resultado'].map(h=>(
                                    <th key={h} style={{textAlign:'left',padding:'6px 8px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,fontSize:11,whiteSpace:'nowrap'}}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {gruposDet.map(g => (
                                  <React.Fragment key={g||'singrupo'}>
                                    <tr>
                                      <td colSpan={7} style={{padding:'5px 10px',background:'#2E75B6',color:'#fff',fontWeight:700,fontSize:11,borderRadius:0}}>
                                        {g || 'SIN GRUPO'}
                                      </td>
                                    </tr>
                                    {detalle.filter(d=>(d.grupo||'')===g).map((d,i)=>(
                                      <tr key={d.nombre+i} style={{background:i%2?'#f9f9f9':'#fff'}}>
                                        <td style={{padding:'6px 8px',fontWeight:500}}>{d.nombre}</td>
                                        <td style={{padding:'6px 8px',color:'#888',fontSize:11}}>{d.unidad||'—'}</td>
                                        <td style={{padding:'6px 8px',textAlign:'right',fontWeight:700,color:'#002060'}}>
                                          {d.capturado!=null && d.capturado!=='' ? parseFloat(d.capturado).toLocaleString('es-MX',{maximumFractionDigits:3}) : '—'}
                                        </td>
                                        <td style={{padding:'6px 8px',textAlign:'right',color:'#555'}}>
                                          {d.sistema!=null ? parseFloat(d.sistema).toLocaleString('es-MX',{maximumFractionDigits:3}) : '—'}
                                        </td>
                                        <td style={{padding:'6px 8px',textAlign:'right',color:d.dif<0?'#C00000':'#3B6D11',fontWeight:600}}>
                                          {d.dif>0?'+':''}{parseFloat(d.dif||0).toFixed(3)}
                                        </td>
                                        <td style={{padding:'6px 8px',textAlign:'right',fontWeight:600,color:d.imp<0?'#C00000':'#3B6D11'}}>
                                          {d.imp<0?'-':''}{fmt(d.imp||0)}
                                        </td>
                                        <td style={{padding:'6px 8px'}}>
                                          <span style={st.badge(d.imp)}>{d.resultado}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Revisiones de esa semana */}
                      {revsSem.length > 0 && (
                        <div style={st.card}>
                          <div style={{fontWeight:600,fontSize:13,marginBottom:10,color:'#555'}}>Revisiones de dirección — Semana {histSemana}</div>
                          <div style={{overflowX:'auto'}}>
                            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                              <thead>
                                <tr>
                                  {['Producto','Nueva cantidad','Impacto ($)','Estatus','Notas'].map(h=>(
                                    <th key={h} style={{textAlign:'left',padding:'6px 8px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,fontSize:11,whiteSpace:'nowrap'}}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {revsSem.map((r,i)=>(
                                  <tr key={r.id||i} style={{background:i%2?'#f9f9f9':'#fff'}}>
                                    <td style={{padding:'6px 8px',fontWeight:600}}>{r.producto}</td>
                                    <td style={{padding:'6px 8px',textAlign:'center',fontWeight:700,color:r.cantidad_ajustada!=null?'#3B6D11':'#bbb'}}>
                                      {r.cantidad_ajustada!=null ? parseFloat(r.cantidad_ajustada).toLocaleString('es-MX',{maximumFractionDigits:3}) : '—'}
                                    </td>
                                    <td style={{padding:'6px 8px',color:'#C00000',fontWeight:600}}>
                                      {r.impacto ? ('$'+Math.abs(r.impacto).toLocaleString('es-MX',{minimumFractionDigits:2})) : '—'}
                                    </td>
                                    <td style={{padding:'6px 8px'}}>
                                      <span style={{
                                        background: r.estatus==='REVISADA'||r.estatus==='CORREGIDO'?'#EAF3DE': r.estatus==='EN REVISIÓN'||r.estatus==='PENDIENTE'?'#FAEEDA':'#FCEBEB',
                                        color: r.estatus==='REVISADA'||r.estatus==='CORREGIDO'?'#3B6D11': r.estatus==='EN REVISIÓN'||r.estatus==='PENDIENTE'?'#854F0B':'#C00000',
                                        padding:'2px 8px',borderRadius:100,fontSize:11,fontWeight:700,whiteSpace:'nowrap'
                                      }}>{r.estatus}</span>
                                    </td>
                                    <td style={{padding:'6px 8px',color:'#888',fontSize:11}}>{r.notas||'—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
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
          <button
            style={{...st.btn, opacity: cambios.length ? 1 : 0.4, cursor: cambios.length ? 'pointer' : 'default'}}
            disabled={!cambios.length}
            onClick={deshacer}
            title={!cambios.length ? 'Sin cambios que revertir' :
              cambios[cambios.length-1].tipo==='captura-todo' ? 'Revertir el Limpiar' :
              cambios[cambios.length-1].tipo==='revision' ? 'Revertir última revisión' : 'Revertir última cantidad'}
          >↩ Deshacer{cambios.length ? ` (${cambios.length})` : ''}</button>
          <button style={st.btn} onClick={()=>{
            if(!confirm('¿Limpiar todo? Podrás revertirlo con Deshacer.')) return
            setCambios(prev => [...prev.slice(-49), { tipo:'captura-todo', snapshot: { ...cantidadesRef.current } }])
            setCantidades({})
            localStorage.removeItem(`inv_${user.key}_sem${semana}`)
          }}>
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
