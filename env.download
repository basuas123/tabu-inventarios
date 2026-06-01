import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { sucursal, semana, año, soft, fisico, resultados } = req.body

    const { data, error } = await supabase
      .from('analisis')
      .upsert({
        sucursal,
        semana,
        año,
        soft_data:   soft,
        fisico_data: fisico,
        resultados,
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'sucursal,semana,año' })
      .select()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, data })
  }

  if (req.method === 'GET') {
    const { sucursal, semana, año } = req.query
    let q = supabase.from('analisis').select('*')
    if (sucursal) q = q.eq('sucursal', sucursal)
    if (semana)   q = q.eq('semana', semana)
    if (año)      q = q.eq('año', año)
    q = q.order('updated_at', { ascending: false })
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data })
  }

  res.status(405).end()
}
