import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { sucursal, semana, año, datos, responsable } = req.body

    if (!sucursal || !datos) {
      return res.status(400).json({ error: 'Faltan campos requeridos' })
    }

    const { data, error } = await supabase
      .from('inventarios')
      .upsert({
        sucursal,
        semana: semana || getWeek(),
        año: año || new Date().getFullYear(),
        datos,
        responsable: responsable || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'sucursal,semana,año' })
      .select()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, data })
  }

  if (req.method === 'GET') {
    const { sucursal, semana, año } = req.query

    let query = supabase.from('inventarios').select('*')
    if (sucursal) query = query.eq('sucursal', sucursal)
    if (semana)   query = query.eq('semana', semana)
    if (año)      query = query.eq('año', año)
    query = query.order('updated_at', { ascending: false })

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data })
  }

  res.status(405).json({ error: 'Método no permitido' })
}

function getWeek() {
  const d = new Date()
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7)
}
