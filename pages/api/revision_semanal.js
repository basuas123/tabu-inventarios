import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { sucursal, semana, año } = req.query
    let q = supabase.from('revision_semanal').select('*')
    if (sucursal) q = q.eq('sucursal', sucursal)
    if (semana)   q = q.eq('semana', semana)
    if (año)      q = q.eq('año', año)
    q = q.order('updated_at', { ascending: false })
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data })
  }

  if (req.method === 'POST') {
    const { sucursal, semana, año, compras, consumo, resultados } = req.body
    if (!sucursal || !semana || !año) {
      return res.status(400).json({ error: 'Faltan campos requeridos' })
    }
    const { data, error } = await supabase
      .from('revision_semanal')
      .upsert({
        sucursal,
        semana,
        año,
        compras: compras || {},
        consumo: consumo || {},
        resultados: resultados || {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'sucursal,semana,año' })
      .select()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, data })
  }

  res.status(405).json({ error: 'Método no permitido' })
}
