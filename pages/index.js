import { useState } from 'react'
import { useRouter } from 'next/router'
import { USUARIOS, login } from '../lib/supabase'

const s = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' },
  card: { background: '#fff', borderRadius: 12, border: '1px solid #e5e5e5', padding: '32px 28px', width: '100%', maxWidth: 380 },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 },
  dot:  { width: 10, height: 10, borderRadius: '50%', background: '#C00000' },
  name: { fontSize: 16, fontWeight: 600, color: '#111' },
  title:{ fontSize: 20, fontWeight: 600, marginBottom: 4 },
  sub:  { fontSize: 13, color: '#666', marginBottom: 24 },
  label:{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' },
  field:{ marginBottom: 16 },
  sel:  { width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, background: '#fff', color: '#111', appearance: 'auto' },
  inp:  { width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, background: '#fff', color: '#111' },
  btn:  { width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: '#002060', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  err:  { color: '#C00000', fontSize: 12, marginBottom: 12 },
  hint: { fontSize: 12, color: '#999', marginTop: 16, textAlign: 'center' },
}

export default function LoginPage() {
  const router = useRouter()
  const [suc, setSuc] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function doLogin() {
    if (!suc) { setError('Selecciona una sucursal o rol'); return }
    setLoading(true)
    setError('')
    const user = login(suc, clave)
    if (!user) {
      setError('Contraseña incorrecta')
      setLoading(false)
      return
    }
    // Guardar sesión en localStorage
    localStorage.setItem('tabu_user', JSON.stringify({ ...user, key: suc }))
    // Redirigir según rol
    if (user.rol === 'dir') {
      router.push('/direccion')
    } else {
      router.push('/inventario')
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logo}>
          <div style={s.dot}></div>
          <div style={s.name}>Tabu Sushi — Inventarios</div>
        </div>
        <div style={s.title}>Bienvenido</div>
        <div style={s.sub}>Ingresa para continuar</div>

        <div style={s.field}>
          <label style={s.label}>Sucursal / Rol</label>
          <select style={s.sel} value={suc} onChange={e => setSuc(e.target.value)}>
            <option value="">Selecciona...</option>
            <optgroup label="Dirección">
              <option value="dir">Dirección General</option>
            </optgroup>
            <optgroup label="Sucursales">
              {Object.entries(USUARIOS).filter(([k]) => k !== 'dir').map(([k, v]) => (
                <option key={k} value={k}>{v.nombre}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div style={s.field}>
          <label style={s.label}>Contraseña</label>
          <input
            style={s.inp} type="password" value={clave}
            placeholder="••••••••"
            onChange={e => setClave(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLogin()}
          />
        </div>

        {error && <div style={s.err}>{error}</div>}

        <button style={s.btn} onClick={doLogin} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <div style={s.hint}>
          Sistema de inventarios v1.0 · Tabu Sushi 2025
        </div>
      </div>
    </div>
  )
}
