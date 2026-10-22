-- =========================================================================
-- CAMBIOS JK - SINCRONIZACIÓN INSTANTÁNEA (Supabase Realtime)
-- =========================================================================
-- Activa los avisos en tiempo real para todas las tablas detal_* y mayor_*.
-- Así, cuando una computadora guarda o borra algo, las demás se actualizan
-- al instante (la app sigue revisando cada 10 segundos como respaldo).
-- Los avisos respetan la seguridad (RLS): cada usuario solo recibe cambios
-- de las tablas que puede leer.
--
-- Cómo usarlo: Supabase > SQL Editor > pegar todo > Run.
-- Es seguro ejecutarlo varias veces. Si se crean tablas nuevas, vuelve a correrlo.
-- =========================================================================

DO $$
DECLARE
  tbl text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOR tbl IN
    SELECT t.tablename FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND (t.tablename LIKE 'detal\_%' OR t.tablename LIKE 'mayor\_%')
      AND NOT EXISTS (
        SELECT 1 FROM pg_publication_tables p
        WHERE p.pubname = 'supabase_realtime' AND p.schemaname = 'public' AND p.tablename = t.tablename
      )
  LOOP
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
  END LOOP;
END $$;

-- Comprobación: lista las tablas con sincronización instantánea
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;
