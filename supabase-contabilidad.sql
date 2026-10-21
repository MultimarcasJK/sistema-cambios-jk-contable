-- =========================================================================
-- SISTEMA CAMBIOS JK - CONTABILIDAD (FASE 1)
-- Ajustes de saldo con motivo + bitácora de auditoría
--
-- Cómo usarlo: Supabase → SQL Editor → pegar todo este archivo → Run.
-- Se puede ejecutar más de una vez sin problema.
-- =========================================================================

DO $$
DECLARE
  m TEXT;
BEGIN
  FOREACH m IN ARRAY ARRAY['detal', 'mayor'] LOOP

    -- Ajustes de saldo: cada cambio de saldo que no viene de una operación, con su motivo
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I (
        id TEXT PRIMARY KEY,
        date DATE NOT NULL,
        account_id TEXT NOT NULL,
        account_name TEXT,
        currency TEXT NOT NULL,
        previous_balance NUMERIC NOT NULL DEFAULT 0,
        new_balance NUMERIC NOT NULL DEFAULT 0,
        delta NUMERIC NOT NULL,
        reason TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'reconciliacion')),
        user_email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )$f$, m || '_ajustes_saldo');

    -- Bitácora: solo se agregan filas; nunca se editan ni se borran
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I (
        id TEXT PRIMARY KEY,
        ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        mode TEXT NOT NULL,
        user_id UUID,
        user_email TEXT,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        reason TEXT,
        data JSONB
      )$f$, m || '_auditoria');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (ts DESC)', m || '_auditoria_ts_idx', m || '_auditoria');

    -- Permisos: solo usuarios con sesión iniciada
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', m || '_ajustes_saldo');
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', m || '_auditoria');

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'ajustes_leer', m || '_ajustes_saldo');
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', 'ajustes_leer', m || '_ajustes_saldo');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'ajustes_crear', m || '_ajustes_saldo');
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)', 'ajustes_crear', m || '_ajustes_saldo');
    -- Borrar solo lo usa el "reseteo maestro"
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'ajustes_borrar', m || '_ajustes_saldo');
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true)', 'ajustes_borrar', m || '_ajustes_saldo');

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'auditoria_leer', m || '_auditoria');
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', 'auditoria_leer', m || '_auditoria');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'auditoria_crear', m || '_auditoria');
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)', 'auditoria_crear', m || '_auditoria');
  END LOOP;
END $$;

-- La bitácora no se puede modificar ni borrar, ni siquiera desde la app
CREATE OR REPLACE FUNCTION jk_auditoria_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de auditoría no se puede modificar ni borrar';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS detal_auditoria_inmutable ON detal_auditoria;
CREATE TRIGGER detal_auditoria_inmutable BEFORE UPDATE OR DELETE ON detal_auditoria
  FOR EACH ROW EXECUTE FUNCTION jk_auditoria_inmutable();

DROP TRIGGER IF EXISTS mayor_auditoria_inmutable ON mayor_auditoria;
CREATE TRIGGER mayor_auditoria_inmutable BEFORE UPDATE OR DELETE ON mayor_auditoria
  FOR EACH ROW EXECUTE FUNCTION jk_auditoria_inmutable();
