import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export const USUARIOS = {
  dir:          { nombre: 'Dirección General',              rol: 'dir',  clave: 'tabu2025dir'    },
  playas:       { nombre: 'Playas de Tijuana',              rol: 'suc',  clave: 'playas2025'     },
  sanpedro:     { nombre: 'Mexicali San Pedro',             rol: 'suc',  clave: 'sanpedro2025'   },
  nuevomex:     { nombre: 'Mexicali Plaza Nuevo Mexicali',  rol: 'suc',  clave: 'nuevomex2025'   },
  guaymas:      { nombre: 'Guaymas',                        rol: 'suc',  clave: 'guaymas2025'    },
  progreso:     { nombre: 'Progreso',                       rol: 'suc',  clave: 'progreso2025'   },
  navarrete:    { nombre: 'Navarrete',                      rol: 'suc',  clave: 'navarrete2025'  },
  paseo:        { nombre: 'Tijuana Plaza Paseo 2000',       rol: 'suc',  clave: 'paseo2025'      },
  miguelaleman: { nombre: 'Obregón Miguel Alemán',          rol: 'suc',  clave: 'miguel2025'     },
  sanluis:      { nombre: 'San Luis Río Colorado',          rol: 'suc',  clave: 'sanluis2025'    },
  galerias:     { nombre: 'Galerias Mall',                  rol: 'suc',  clave: 'galerias2025'   },
  patio:        { nombre: 'Patio',                          rol: 'suc',  clave: 'patio2025'      },
  dila:         { nombre: 'Dila',                           rol: 'suc',  clave: 'dila2025'       },
  bellavista:   { nombre: 'Obregón Bellavista',             rol: 'suc',  clave: 'bellavista2025' },
  plazario:     { nombre: 'Tijuana Plaza Río',              rol: 'suc',  clave: 'plazario2025'   },
}

export function login(sucursal, clave) {
  const user = USUARIOS[sucursal]
  if (!user) return null
  if (user.clave !== clave) return null
  return { ...user, key: sucursal }
}
