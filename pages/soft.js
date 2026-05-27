import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import * as XLSX from 'xlsx'
import { exportarAnalisisSoft, imprimir } from '../lib/exportar'

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

function fmt(n) {
  return '$' + Math.abs(n).toLocaleString('es-MX', {minimumFractionDigits:2,maximumFractionDigits:2})
}

function getWeek() {
  const d = new Date()
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7)
}

export default function SoftPage() {
  const router = useRouter()
  const [user, setUser]         = useState(null)
  const [sucursal, setSucursal] = useState('')
  const [softData, setSoftData] = useState(null)   // datos del Soft cargado
  const [fisico, setFisico]     = useState({})      // cantidades físicas
  const [analisis, setAnalisis] = useState(null)    // resultado del cruce
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [tab, setTab]           = useState('cargar')
  const fileRef = useRef()
  const semana = getWeek()

  useEffect(() => {
    const stored = localStorage.getItem('tabu_user')
    if (!stored) { router.push('/'); return }
    const u = JSON.parse(stored)
    if (u.rol !== 'dir') { router.push('/'); return }
    setUser(u)
  }, [])

  function parsearSoft(file) {
    setLoading(true)
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb   = XLSX.read(data, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

        // Detectar fila de encabezado
        let headerRow = 0
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const r = rows[i].map(c => String(c||'').toLowerCase())
          if (r.some(c => c.includes('descripcion') || c.includes('existencia'))) {
            headerRow = i
            break
          }
        }

        const headers = rows[headerRow].map(c => String(c||'').toLowerCase().trim())
        const colDesc  = headers.findIndex(h => h.includes('descripcion') && !h.includes('grupo'))
        const colExist = headers.findIndex(h => h.includes('existencia') && h.includes('1'))
        const colCosto = headers.findIndex(h => h.includes('costo'))
        const colUnid  = headers.findIndex(h => h.includes('unidad'))

        if (colDesc === -1) {
          setError('No se encontró la columna "descripcion" en el archivo. Verifica que sea el reporte correcto de Soft Restaurant.')
          setLoading(false)
          return
        }

        const productos = {}
        for (let i = headerRow + 1; i < rows.length; i++) {
          const row  = rows[i]
          const desc = String(row[colDesc] || '').trim().toUpperCase()
          if (!desc || desc === 'NAN') continue
          const exist = colExist >= 0 ? (parseFloat(row[colExist]) || 0) : 0
          const costo = colCosto >= 0 ? (parseFloat(row[colCosto]) || 0) : 0
          const unid  = colUnid  >= 0 ? String(row[colUnid] || '') : ''
          productos[desc] = { existencia: exist, costo, unidad: unid }
        }

        setSoftData(productos)
        setTab('fisico')
        setLoading(false)

        // Cargar físico guardado si hay
        const saved = localStorage.getItem(`inv_${sucursal}_sem${semana}`)
        if (saved) setFisico(JSON.parse(saved))

      } catch (err) {
        setError('Error al leer el archivo: ' + err.message)
        setLoading(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function cruzar() {
    if (!softData || !sucursal) return
    setLoading(true)

    const softNombres = Object.keys(softData)
    const resultados  = []
    let totalFalt = 0, totalSobr = 0, sinCruce = 0

    // Cargar productos de la sucursal
    import('../lib/productos.json').then(modulo => {
      const prods = modulo.default[sucursal]?.productos || []

      prods.forEach(p => {
        const fis    = parseFloat(fisico[p.id]) 
        const tieneFisico = fis !== undefined && !isNaN(fis)
        const softProd = softData[p.nombre]
        const sistema  = softProd?.existencia ?? null
        const costo    = softProd?.costo || p.costo || 0
        const merma    = p.merma ?? MERMAS[p.grupo] ?? 0.02
        const ajustado = tieneFisico ? (merma < 1 ? fis / (1 - merma) : fis) : null

        if (!softProd) { sinCruce++; }

        if (tieneFisico && sistema !== null) {
          const dif = ajustado - sistema
          const imp = dif * costo
          if (imp < 0) totalFalt += imp
          else if (imp > 0) totalSobr += imp
          resultados.push({
            nombre: p.nombre,
            grupo:  p.grupo,
            unidad: p.unidad,
            fisico: fis,
            ajustado,
            sistema,
            costo,
            dif,
            imp,
            resultado: Math.abs(dif) < 0.01 ? 'OK' : dif < 0 ? 'FALTANTE' : 'SOBRANTE',
          })
        }
      })

      resultados.sort((a,b) => a.imp - b.imp)
      setAnalisis({ resultados, totalFalt, totalSobr, sinCruce, neto: totalFalt + totalSobr })
      setTab('analisis')

      // Guardar análisis en Supabase para que dirección lo vea
      fetch('/api/analisis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sucursal,
          semana,
          año: new Date().getFullYear(),
          soft: softData,
          fisico,
          resultados: {
            totalFalt,
            totalSobr,
            neto: totalFalt + totalSobr,
            items: resultados.length,
            detalle: resultados.slice(0, 100), // primeros 100 para no sobrepasar límite
          }
        })
      }).then(() => {
        console.log('Análisis guardado en Supabase')
      }).catch(() => {})

      setLoading(false)
    })
  }

  if (!user) return <div style={{padding:40,textAlign:'center'}}>Cargando...</div>

  const st = {
    top:  { background:'#fff', borderBottom:'1px solid #eee', padding:'0 20px', display:'flex', alignItems:'center', justifyContent:'space-between', height:52, position:'sticky', top:0, zIndex:100 },
    logo: { display:'flex', alignItems:'center', gap:8, fontWeight:600, fontSize:15 },
    dot:  { width:8, height:8, borderRadius:'50%', background:'#C00000' },
    page: { maxWidth:900, margin:'0 auto', padding:'20px 16px 60px' },
    btn:  { padding:'8px 16px', borderRadius:8, border:'1px solid #ddd', background:'#fff', cursor:'pointer', fontSize:13, fontWeight:500 },
    btnP: { padding:'9px 20px', borderRadius:8, border:'none', background:'#002060', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 },
    card: { background:'#fff', borderRadius:10, border:'1px solid #eee', padding:'20px', marginBottom:16 },
    tabs: { display:'flex', borderBottom:'1px solid #eee', marginBottom:20 },
    tab:  a => ({ padding:'9px 18px', fontSize:13, cursor:'pointer', borderBottom:a?'2px solid #002060':'2px solid transparent', color:a?'#002060':'#666', fontWeight:a?600:400, background:'none', border:'none', borderBottom:a?'2px solid #002060':'2px solid transparent' }),
    kpi:  { background:'#f5f5f5', borderRadius:8, padding:'12px 14px', flex:1, textAlign:'center' },
    drop: { border:'2px dashed #ddd', borderRadius:10, padding:'40px', textAlign:'center', cursor:'pointer', background:'#fafafa' },
    badge: r => ({ display:'inline-block', padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:600, background:r==='FALTANTE'?'#FCEBEB':r==='SOBRANTE'?'#EAF3DE':'#f5f5f5', color:r==='FALTANTE'?'#A32D2D':r==='SOBRANTE'?'#3B6D11':'#888' }),
  }

  return (
    <div>
      <div style={st.top}>
        <div style={st.logo}>
          <div style={st.dot}></div>
          Soft Restaurant — Análisis de inventario
        </div>
        <div style={{display:'flex',gap:8}}>
          <button style={st.btn} onClick={()=>router.push('/direccion')}>← Panel</button>
          <button style={st.btn} onClick={()=>{localStorage.removeItem('tabu_user');router.push('/')}}>Salir</button>
        </div>
      </div>

      <div style={st.page}>

        <div style={st.tabs}>
          <button style={st.tab(tab==='cargar')}   onClick={()=>setTab('cargar')}>1. Cargar Soft</button>
          <button style={st.tab(tab==='fisico')}   onClick={()=>softData&&setTab('fisico')}   disabled={!softData}>2. Revisar físico</button>
          <button style={st.tab(tab==='analisis')} onClick={()=>analisis&&setTab('analisis')} disabled={!analisis}>3. Análisis</button>
        </div>

        {/* PASO 1 — CARGAR SOFT */}
        {tab === 'cargar' && (
          <div style={st.card}>
            <div style={{fontWeight:600,fontSize:15,marginBottom:4}}>Cargar reporte de Soft Restaurant</div>
            <div style={{fontSize:13,color:'#666',marginBottom:20}}>
              Exporta el reporte de Inventario Físico desde Soft Restaurant y súbelo aquí (.xls o .xlsx)
            </div>

            <div style={{marginBottom:16}}>
              <label style={{fontSize:12,fontWeight:600,color:'#555',display:'block',marginBottom:6}}>SUCURSAL</label>
              <select
                style={{width:'100%',maxWidth:340,padding:'9px 12px',border:'1px solid #ddd',borderRadius:8,fontSize:14}}
                value={sucursal}
                onChange={e=>setSucursal(e.target.value)}
              >
                <option value="">Selecciona la sucursal...</option>
                {SUCURSALES.map(s=><option key={s.k} value={s.k}>{s.n}</option>)}
              </select>
            </div>

            <div
              style={st.drop}
              onClick={()=>sucursal&&fileRef.current.click()}
              onDragOver={e=>e.preventDefault()}
              onDrop={e=>{
                e.preventDefault()
                if(!sucursal){setError('Selecciona primero la sucursal');return}
                const file=e.dataTransfer.files[0]
                if(file) parsearSoft(file)
              }}
            >
              <div style={{fontSize:40,marginBottom:12}}>📊</div>
              <div style={{fontWeight:600,fontSize:15,marginBottom:6}}>
                {sucursal ? 'Arrastra el archivo aquí o haz clic para seleccionar' : 'Selecciona primero la sucursal'}
              </div>
              <div style={{fontSize:13,color:'#888'}}>Formatos aceptados: .xls, .xlsx (reporte de Soft Restaurant)</div>
              <input
                ref={fileRef}
                type="file"
                accept=".xls,.xlsx"
                style={{display:'none'}}
                onChange={e=>e.target.files[0]&&parsearSoft(e.target.files[0])}
              />
            </div>

            {loading && <div style={{textAlign:'center',padding:20,color:'#666'}}>Procesando archivo...</div>}
            {error   && <div style={{color:'#C00000',fontSize:13,marginTop:12,padding:'10px 14px',background:'#FCEBEB',borderRadius:8}}>{error}</div>}

            <div style={{marginTop:20,padding:'14px 16px',background:'#EAF3DE',borderRadius:8,fontSize:13}}>
              <strong>¿Cómo exportar desde Soft Restaurant?</strong><br/>
              Inventario → Reporte de Existencias → Exportar → Excel (.xls)
            </div>
          </div>
        )}

        {/* PASO 2 — REVISAR FÍSICO */}
        {tab === 'fisico' && softData && (
          <div style={st.card}>
            <div style={{fontWeight:600,fontSize:15,marginBottom:4}}>
              Verificar inventario físico — {SUCURSALES.find(s=>s.k===sucursal)?.n}
            </div>
            <div style={{fontSize:13,color:'#666',marginBottom:16}}>
              Se cargaron <strong>{Object.keys(softData).length}</strong> productos del Soft.
              {Object.keys(fisico).length > 0
                ? ` Hay ${Object.keys(fisico).length} cantidades físicas guardadas de la sucursal.`
                : ' No hay cantidades físicas capturadas todavía para esta sucursal esta semana.'}
            </div>

            <div style={{display:'flex',gap:10,marginBottom:20}}>
              <div style={st.kpi}>
                <div style={{fontSize:11,color:'#888',marginBottom:4}}>Productos en Soft</div>
                <div style={{fontSize:22,fontWeight:700}}>{Object.keys(softData).length}</div>
              </div>
              <div style={st.kpi}>
                <div style={{fontSize:11,color:'#888',marginBottom:4}}>Físico capturado</div>
                <div style={{fontSize:22,fontWeight:700,color:Object.keys(fisico).length?'#3B6D11':'#C00000'}}>
                  {Object.keys(fisico).length}
                </div>
              </div>
            </div>

            {Object.keys(fisico).length === 0 && (
              <div style={{padding:'14px 16px',background:'#FAEEDA',borderRadius:8,fontSize:13,marginBottom:16}}>
                ⚠️ La sucursal aún no ha capturado su inventario físico esta semana. Puedes continuar igual — los productos sin físico no aparecerán en el análisis.
              </div>
            )}

            <button style={st.btnP} onClick={cruzar} disabled={loading}>
              {loading ? 'Calculando...' : '→ Generar análisis'}
            </button>
          </div>
        )}

        {/* PASO 3 — ANÁLISIS */}
        {tab === 'analisis' && analisis && (
          <>
            {/* KPIs */}
            <div style={{display:'flex',gap:10,marginBottom:16}}>
              <div style={{...st.kpi,background:'#FCEBEB'}}>
                <div style={{fontSize:11,color:'#888',marginBottom:4}}>Pérdida ($)</div>
                <div style={{fontSize:22,fontWeight:700,color:'#C00000'}}>{fmt(analisis.totalFalt)}</div>
              </div>
              <div style={{...st.kpi,background:'#EAF3DE'}}>
                <div style={{fontSize:11,color:'#888',marginBottom:4}}>Sobrante ($)</div>
                <div style={{fontSize:22,fontWeight:700,color:'#3B6D11'}}>{fmt(analisis.totalSobr)}</div>
              </div>
              <div style={{...st.kpi,background:'#FFF2CC'}}>
                <div style={{fontSize:11,color:'#888',marginBottom:4}}>Impacto neto</div>
                <div style={{fontSize:22,fontWeight:700,color:analisis.neto<0?'#C00000':'#3B6D11'}}>{fmt(analisis.neto)}</div>
              </div>
              <div style={st.kpi}>
                <div style={{fontSize:11,color:'#888',marginBottom:4}}>Con diferencia</div>
                <div style={{fontSize:22,fontWeight:700,color:'#185FA5'}}>{analisis.resultados.filter(r=>r.resultado!=='OK').length}</div>
              </div>
            </div>

            {analisis.sinCruce > 0 && (
              <div style={{padding:'10px 14px',background:'#FFF2CC',borderRadius:8,fontSize:13,marginBottom:16}}>
                ⚠️ {analisis.sinCruce} productos del físico no encontraron coincidencia en el Soft de esta sucursal.
              </div>
            )}

            <div style={st.card}>
              <div style={{fontWeight:600,fontSize:14,marginBottom:14}}>
                Detalle por producto — {SUCURSALES.find(s=>s.k===sucursal)?.n} · Semana {semana}
              </div>

              {analisis.resultados.length === 0 ? (
                <div style={{textAlign:'center',padding:30,color:'#888'}}>
                  Sin datos suficientes para el análisis. Verifica que la sucursal haya capturado su inventario.
                </div>
              ) : (
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead>
                      <tr>
                        {['Producto','Grupo','Físico','Ajustado','Sistema (Soft)','Diferencia','Costo ($)','Impacto ($)','Resultado'].map(h=>(
                          <th key={h} style={{textAlign:'left',padding:'7px 8px',borderBottom:'1px solid #eee',color:'#888',fontWeight:600,whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analisis.resultados.map((r,i)=>(
                        <tr key={r.nombre} style={{background:i%2?'#f9f9f9':'#fff'}}>
                          <td style={{padding:'6px 8px',fontWeight:500}}>{r.nombre}</td>
                          <td style={{padding:'6px 8px',color:'#888',fontSize:11}}>{r.grupo}</td>
                          <td style={{padding:'6px 8px',textAlign:'right'}}>{r.fisico.toFixed(3)}</td>
                          <td style={{padding:'6px 8px',textAlign:'right'}}>{r.ajustado.toFixed(3)}</td>
                          <td style={{padding:'6px 8px',textAlign:'right'}}>{r.sistema.toFixed(3)}</td>
                          <td style={{padding:'6px 8px',textAlign:'right',fontWeight:600,color:r.dif<0?'#C00000':'#3B6D11'}}>
                            {r.dif>0?'+':''}{r.dif.toFixed(3)}
                          </td>
                          <td style={{padding:'6px 8px',textAlign:'right',color:'#555'}}>{fmt(r.costo)}</td>
                          <td style={{padding:'6px 8px',textAlign:'right',fontWeight:700,color:r.imp<0?'#C00000':'#3B6D11'}}>
                            {r.imp<0?'-':''}{fmt(r.imp)}
                          </td>
                          <td style={{padding:'6px 8px'}}>
                            <span style={st.badge(r.resultado)}>{r.resultado}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <button style={st.btn} onClick={()=>{setSoftData(null);setAnalisis(null);setTab('cargar')}}>
                ← Cargar otro Soft
              </button>
              <button style={st.btn} onClick={()=>exportarAnalisisSoft({sucursal:SUCURSALES.find(s=>s.k===sucursal)?.n||sucursal,resultados:analisis.resultados,totalFalt:analisis.totalFalt,totalSobr:analisis.totalSobr,neto:analisis.neto,semana,año:new Date().getFullYear()})}>
                📥 Exportar a Excel
              </button>
              <button style={st.btn} onClick={imprimir}>
                🖨 Imprimir reporte
              </button>
              <button style={st.btnP} onClick={()=>router.push('/direccion')}>
                Ver panel general →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
