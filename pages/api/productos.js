import productosDB from '../../lib/productos.json'

export default function handler(req, res) {
  const { sucursal } = req.query
  if (!sucursal) return res.status(400).json({ error: 'Falta sucursal' })
  const datos = productosDB[sucursal]
  if (!datos) return res.status(404).json({ error: 'Sucursal no encontrada', productos: [] })
  // Orden defensivo: por grupo y luego por nombre (alfabético)
  const productos = [...(datos.productos || [])].sort((a, b) =>
    (a.grupo || '').localeCompare(b.grupo || '') || (a.nombre || '').localeCompare(b.nombre || '')
  )
  return res.status(200).json({ productos })
}
