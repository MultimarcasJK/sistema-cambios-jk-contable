-- =========================================================================
-- SISTEMA CAMBIOS JK - GASTOS FIJOS MENSUALES
-- La lista de lo que se paga cada mes (alquiler de cuentas, costos bancarios,
-- mantenimiento…): nombre, monto, moneda, cuenta y día de pago.
-- Los pagos de cada mes se siguen guardando en detal_/mayor_gastos_servicios.
--
-- Tablas: detal_gastos_fijos y mayor_gastos_fijos.
--
-- Cómo usarlo: Supabase → SQL Editor → pegar todo este archivo → Run.
-- Se puede ejecutar más de una vez sin problema.
-- =========================================================================

DO $$
DECLARE
  m TEXT;
  t TEXT;
  cond TEXT;
BEGIN
  FOREACH m IN ARRAY ARRAY['detal', 'mayor'] LOOP
    t := m || '_gastos_fijos';

    -- El gasto fijo completo va en "data"; al borrarlo se marca deleted = true dentro de data
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I (
        id TEXT PRIMARY KEY,
        name TEXT,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )$f$, t);

    -- Permisos: como las demás tablas detal_/mayor_ (supabase-seguridad-rls.sql)
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
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'jk_editar', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', 'jk_editar', t, cond, cond);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'jk_borrar', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (%s)', 'jk_borrar', t, cond);
  END LOOP;
END $$;
