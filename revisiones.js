import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const semana = req.query.semana || getWeek()
  const año    = req.query.año    || new Date().getFullYear()

  const { data, error } = await supabase
    .from('inventarios')
    .select('sucursal, semana, año, datos, responsable, updated_at')
    .eq('semana', semana)
    .eq('año', año)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ data, semana, año })
}

function getWeek() {
  const d = new Date()
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7)
}
