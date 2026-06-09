import productosDB from '../../lib/productos.json'
import { ordenarComoSoft } from '../../lib/grupos'

export default function handler(req, res) {
  const { sucursal } = req.query
  if (!sucursal) return res.status(400).json({ error: 'Falta sucursal' })
  const datos = productosDB[sucursal]
  if (!datos) return res.status(404).json({ error: 'Sucursal no encontrada', productos: [] })
  // Orden maestro: grupos como en Soft Restaurant, productos alfabéticos dentro de cada grupo
  const productos = ordenarComoSoft(datos.productos)
  return res.status(200).json({ productos })
}
