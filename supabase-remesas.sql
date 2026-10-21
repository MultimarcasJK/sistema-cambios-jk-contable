-- =========================================================================
-- SISTEMA CAMBIOS JK - REMESAS (FASE 2)
-- Remesas (envíos de dinero a otros países) y sus remitentes/beneficiarios
--
-- Cómo usarlo: Supabase → SQL Editor → pegar todo este archivo → Run.
-- Se puede ejecutar más de una vez sin problema.
-- =========================================================================

DO $$
DECLARE
  m TEXT;
  t TEXT;
BEGIN
  FOREACH m IN ARRAY ARRAY['detal', 'mayor'] LOOP

    -- Remesas: la remesa completa (con su historial) va en "data"
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I (
        id TEXT PRIMARY KEY,
        numero INTEGER,
        date DATE,
        estado TEXT,
        pais_pago TEXT,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )$f$, m || '_remesas');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (date DESC)', m || '_remesas_date_idx', m || '_remesas');

    -- Remitentes (clientes que envían) con sus beneficiarios guardados
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I (
        id TEXT PRIMARY KEY,
        name TEXT,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )$f$, m || '_remitentes');

    -- Permisos: solo usuarios con sesión iniciada
    FOREACH t IN ARRAY ARRAY[m || '_remesas', m || '_remitentes'] LOOP
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'leer', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', 'leer', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'crear', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)', 'crear', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'editar', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', 'editar', t);
      -- Borrar solo lo usa el "reseteo"
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'borrar', t);
      EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true)', 'borrar', t);
    END LOOP;
  END LOOP;
END $$;
