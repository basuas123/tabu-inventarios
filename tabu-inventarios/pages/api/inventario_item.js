import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { sucursal, semana, año, producto_id, cantidad, responsable } = req.body

  if (!sucursal || !producto_id) {
    return res.status(400).json({ error: 'Faltan datos' })
  }

  try {
    // Primero obtener el inventario existente de esta semana
    const { data: existing } = await supabase
      .from('inventarios')
      .select('datos, responsable')
      .eq('sucursal', sucursal)
      .eq('semana', semana)
      .eq('año', año)
      .single()

    // Mezclar el dato nuevo con los existentes
    const datosActuales = existing?.datos || {}
    datosActuales[producto_id] = cantidad

    // Guardar el inventario actualizado
    const { error } = await supabase
      .from('inventarios')
      .upsert({
        sucursal,
        semana,
        año,
        datos: datosActuales,
        responsable: responsable || existing?.responsable || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'sucursal,semana,año' })

    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({ ok: true })

  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
