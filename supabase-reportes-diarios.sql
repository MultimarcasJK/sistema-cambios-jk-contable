-- =========================================================================
-- SISTEMA CAMBIOS JK - REPORTE DEL DÍA DE LAS OPERADORAS
-- Cada vez que una operadora comparte el "Reporte del día" (Cierre) queda
-- guardado aquí: ventas, ganancia, abonos, deudas nuevas, saldos por cuenta
-- y el cuadre de caja (lo que contó contra lo que dice el sistema).
--
-- Tablas: detal_reportes_diarios y mayor_reportes_diarios.
--
-- Cómo usarlo: Supabase → SQL Editor → pegar todo este archivo → Run.
-- Se puede ejecutar más de una vez sin problema.
-- Ya trae los mismos permisos que las demás tablas (solo usuarios activos con
-- acceso a ese modo). Si más adelante vuelves a ejecutar supabase-seguridad-rls.sql,
-- también las cubre.
-- =========================================================================

DO $$
DECLARE
  m TEXT;
  t TEXT;
  cond TEXT;
BEGIN
  FOREACH m IN ARRAY ARRAY['detal', 'mayor'] LOOP
    t := m || '_reportes_diarios';

    -- El reporte completo va en "data"; las demás columnas son para buscar y ordenar
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I (
        id TEXT PRIMARY KEY,
        date DATE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        operadora TEXT,
        cuadra BOOLEAN,
        ganancia_neta NUMERIC,
        data JSONB NOT NULL
      )$f$, t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (date DESC, created_at DESC)', t || '_date_idx', t);

    -- Permisos: como las demás tablas detal_/mayor_ (supabase-seguridad-rls.sql).
    -- Si todavía no existe esa función, basta con tener sesión iniciada.
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'jk_puede_modo') THEN
      cond := format('public.jk_puede_modo(%L)', m);
    ELSE
      cond := 'true';
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'jk_leer', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (%s)', 'jk_leer', t, cond);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'jk_crear', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (%s)', 'jk_crear', t, cond);
    -- Editar: al volver a compartir el mismo reporte se actualiza la misma fila
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'jk_editar', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', 'jk_editar', t, cond, cond);
    -- Borrar solo lo usa el "reseteo"
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'jk_borrar', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (%s)', 'jk_borrar', t, cond);
  END LOOP;
END $$;
