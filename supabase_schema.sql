-- =====================================================
-- TABU SUSHI — SISTEMA DE INVENTARIOS
-- Ejecuta este SQL en Supabase > SQL Editor
-- =====================================================

-- Tabla principal de inventarios semanales
CREATE TABLE IF NOT EXISTS inventarios (
  id          BIGSERIAL PRIMARY KEY,
  sucursal    TEXT NOT NULL,
  semana      INTEGER NOT NULL,
  año         INTEGER NOT NULL,
  datos       JSONB NOT NULL DEFAULT '{}',
  responsable TEXT DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sucursal, semana, año)
);

-- Tabla de revisiones y cobros
CREATE TABLE IF NOT EXISTS revisiones (
  id         BIGSERIAL PRIMARY KEY,
  sucursal   TEXT NOT NULL,
  producto   TEXT NOT NULL,
  impacto    NUMERIC(10,2) DEFAULT 0,
  estatus    TEXT DEFAULT 'PENDIENTE',
  notas      TEXT DEFAULT '',
  semana     INTEGER,
  año        INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_inventarios_sucursal ON inventarios(sucursal);
CREATE INDEX IF NOT EXISTS idx_inventarios_semana   ON inventarios(semana, año);
CREATE INDEX IF NOT EXISTS idx_revisiones_estatus   ON revisiones(estatus);
CREATE INDEX IF NOT EXISTS idx_revisiones_sucursal  ON revisiones(sucursal);

-- Habilitar Row Level Security
ALTER TABLE inventarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisiones  ENABLE ROW LEVEL SECURITY;

-- Políticas: acceso público con anon key (la autenticación la maneja la app)
CREATE POLICY "Acceso público inventarios"
  ON inventarios FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Acceso público revisiones"
  ON revisiones FOR ALL TO anon USING (true) WITH CHECK (true);
