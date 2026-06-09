# Tabu Sushi — Sistema de Inventarios
App web completa para gestión de inventarios de 14 sucursales.

## Tecnología
- **Next.js 14** — framework web
- **Supabase** — base de datos PostgreSQL gratuita
- **Vercel** — hosting gratuito

---

## PASO 1 — Crear cuenta en Supabase (base de datos)

1. Entra a **https://supabase.com** y crea una cuenta gratis
2. Crea un nuevo proyecto → ponle nombre: `tabu-inventarios`
3. Guarda la contraseña que te pide (la necesitarás después)
4. Espera ~2 minutos a que el proyecto se inicialice

### Crear las tablas
5. En Supabase, ve a **SQL Editor** (panel izquierdo)
6. Copia todo el contenido del archivo `supabase_schema.sql`
7. Pégalo en el editor y haz clic en **Run**
8. Deben aparecer las tablas `inventarios` y `revisiones`

### Obtener las credenciales
9. Ve a **Settings → API** (panel izquierdo)
10. Copia estos 3 valores:
    - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
    - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - **service_role key** → `SUPABASE_SERVICE_KEY`

---

## PASO 2 — Subir el código a GitHub

1. Crea una cuenta en **https://github.com** si no tienes
2. Crea un repositorio nuevo → nombre: `tabu-inventarios`
3. Descarga e instala **GitHub Desktop** desde https://desktop.github.com
4. En GitHub Desktop:
   - **Add existing repository** → selecciona la carpeta `tabu-inventario`
   - **Publish repository** → sube todo el código
5. Verifica que en GitHub.com aparezcan todos los archivos

---

## PASO 3 — Publicar en Vercel

1. Entra a **https://vercel.com** y crea cuenta con tu GitHub
2. Clic en **Add New → Project**
3. Selecciona el repositorio `tabu-inventarios`
4. Antes de hacer deploy, agrega las variables de entorno:
   - Clic en **Environment Variables**
   - Agrega las 3 variables con los valores de Supabase:
     ```
     NEXT_PUBLIC_SUPABASE_URL      = https://xxxx.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
     SUPABASE_SERVICE_KEY          = eyJ...
     ```
5. Clic en **Deploy**
6. En ~3 minutos tendrás una URL como: `https://tabu-inventarios.vercel.app`

---

## PASO 4 — Probar el sistema

1. Abre la URL de Vercel
2. Entra como **Dirección General** (contraseña: `tabu2025dir`)
3. En otra pestaña, entra como una sucursal (ej: Guaymas, contraseña: `guaymas2025`)
4. Llena algunas cantidades y guarda
5. Regresa al panel de dirección y haz clic en **↻ Actualizar**

---

## Contraseñas iniciales por sucursal

| Sucursal                      | Usuario       | Contraseña      |
|-------------------------------|---------------|-----------------|
| Dirección General             | dir           | tabu2025dir     |
| Playas de Tijuana             | playas        | playas2025      |
| Mexicali San Pedro            | sanpedro      | sanpedro2025    |
| Mexicali Plaza Nuevo Mexicali | nuevomex      | nuevomex2025    |
| Guaymas                       | guaymas       | guaymas2025     |
| Progreso                      | progreso      | progreso2025    |
| Navarrete                     | navarrete     | navarrete2025   |
| Tijuana Plaza Paseo 2000      | paseo         | paseo2025       |
| Obregón Miguel Alemán         | miguelaleman  | miguel2025      |
| San Luis Río Colorado         | sanluis       | sanluis2025     |
| Galerias Mall                 | galerias      | galerias2025    |
| Patio                         | patio         | patio2025       |
| Dila                          | dila          | dila2025        |
| Obregón Bellavista            | bellavista    | bellavista2025  |
| Tijuana Plaza Río             | plazario      | plazario2025    |

---

## Estructura del proyecto

```
tabu-inventario/
├── pages/
│   ├── index.js          ← Login
│   ├── inventario.js     ← Captura (sucursales)
│   ├── direccion.js      ← Panel ejecutivo (dirección)
│   └── api/
│       ├── inventario.js ← API guardar/leer inventarios
│       ├── resumen.js    ← API resumen para dirección
│       └── revisiones.js ← API revisiones y cobros
├── lib/
│   ├── supabase.js       ← Cliente Supabase + usuarios
│   └── productos.json    ← Todos los productos de las 14 sucursales
├── styles/
│   └── globals.css
├── supabase_schema.sql   ← Ejecutar en Supabase SQL Editor
└── .env.local.example    ← Copiar a .env.local con tus credenciales
```

---

## Para desarrollo local (opcional)

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con tus credenciales de Supabase

# Iniciar servidor de desarrollo
npm run dev
# Abrir http://localhost:3000
```
