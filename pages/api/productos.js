import productosDB from '../../lib/productos.json'

export default function handler(req, res) {
  const { sucursal } = req.query
  if (!sucursal) return res.status(400).json({ error: 'Falta sucursal' })
  const datos = productosDB[sucursal]
  if (!datos) return res.status(404).json({ error: 'Sucursal no encontrada', productos: [] })
  return res.status(200).json({ productos: datos.productos || [] })
}
