import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { sucursal, estatus } = req.query
    let q = supabase.from('revisiones').select('*').order('created_at', { ascending: false })
    if (sucursal) q = q.eq('sucursal', sucursal)
    if (estatus)  q = q.eq('estatus', estatus)
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data })
  }

  if (req.method === 'POST') {
    const body = req.body
    const { data, error } = await supabase.from('revisiones').insert(body).select()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, data })
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body
    const { data, error } = await supabase
      .from('revisiones').update(updates).eq('id', id).select()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, data })
  }

  res.status(405).end()
}
