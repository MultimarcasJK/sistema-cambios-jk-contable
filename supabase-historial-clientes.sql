-- =========================================================================
-- CAMBIOS JK - HISTORIAL POR CLIENTE (RESPALDO)
-- =========================================================================
-- Crea detal_historial_clientes y mayor_historial_clientes: una copia de cada
-- movimiento de cada cliente (ventas Cripto/Dólar, ventas Monedas Regionales,
-- abonos, remesas y cambios de deuda en Deudores).
--
-- La llena la propia base de datos (triggers), no la app: cada vez que una de
-- esas tablas recibe una fila nueva, un cambio o un borrado, se guarda una copia
-- completa del registro con la fecha y el usuario. Nadie puede editar ni borrar
-- esta tabla desde la app, así que sirve de respaldo aunque algo se dañe o se
-- borre en las tablas normales.
--
-- Al ejecutarlo por primera vez también copia todo lo que ya existe hoy
-- (accion = 'INICIAL').
--
-- Cómo usarlo: Supabase → SQL Editor → pegar todo este archivo → Run.
-- Se puede ejecutar más de una vez sin problema (no duplica la copia inicial).
--
-- Ver el historial de un cliente:
--   select registrado_at, tipo, accion, fecha, monto, datos
--   from detal_historial_clientes
--   where client_name = 'CAROLINA'
--   order by registrado_at desc;
-- =========================================================================

BEGIN;

-- 1. Función que copia el registro al historial. Si algo falla, solo avisa:
--    el respaldo nunca debe impedir guardar una venta o un abono.
CREATE OR REPLACE FUNCTION public.jk_historial_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  destino text := TG_ARGV[0];
  tipo    text := TG_ARGV[1];
  fila    jsonb;
  accion  text;
  nombre  text;
  monto   text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    fila := to_jsonb(OLD);
    accion := 'BORRADO';
  ELSE
    fila := to_jsonb(NEW);
    accion := CASE WHEN TG_OP = 'INSERT' THEN 'CREADO' ELSE 'CAMBIADO' END;
    -- Una subida repetida sin cambios no deja fila
    IF TG_OP = 'UPDATE' AND to_jsonb(OLD) = fila THEN
      RETURN NEW;
    END IF;
  END IF;

  BEGIN
    nombre := upper(trim(coalesce(
      fila->>'client_name',
      fila->>'remitente_name',
      fila->'data'->>'remitente_name',
      ''
    )));
    IF nombre <> '' THEN
      monto := coalesce(
        fila->>'total_to_pay',
        fila->>'amount',
        fila->>'current_debt',
        fila->'data'->>'fiado_usd'
      );
      EXECUTE format(
        'INSERT INTO public.%I (client_name, tipo, accion, registro_id, fecha, monto, datos)
         VALUES ($1, $2, $3, $4, $5, $6, $7)', destino)
      USING
        nombre, tipo, accion, fila->>'id',
        coalesce(fila->>'date', fila->>'created_at', fila->>'updated_at'),
        CASE WHEN monto ~ '^-?[0-9]+(\.[0-9]+)?$' THEN monto::numeric END,
        fila;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'jk_historial_cliente (%): %', TG_TABLE_NAME, SQLERRM;
  END;

  RETURN coalesce(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.jk_historial_cliente() FROM PUBLIC, anon, authenticated;

-- 2. Tablas de historial, triggers y copia inicial
DO $$
DECLARE
  m       text;
  destino text;
  origen  text;
  tipo    text;
  pares   text[][] := ARRAY[
    ['ventas_cripto_dolar', 'venta_cripto_dolar'],
    ['ventas_regionales',   'venta_regional'],
    ['abonos_deudores',     'abono'],
    ['remesas',             'remesa'],
    ['deudores',            'deuda']
  ];
  i int;
BEGIN
  FOREACH m IN ARRAY ARRAY['detal', 'mayor'] LOOP
    destino := m || '_historial_clientes';

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS public.%I (
        id BIGSERIAL PRIMARY KEY,
        registrado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        usuario UUID DEFAULT auth.uid(),
        client_name TEXT NOT NULL,
        tipo TEXT NOT NULL,        -- venta_cripto_dolar, venta_regional, abono, remesa, deuda
        accion TEXT NOT NULL,      -- INICIAL, CREADO, CAMBIADO, BORRADO
        registro_id TEXT,          -- id del registro en su tabla
        fecha TEXT,                -- fecha de la operación
        monto NUMERIC,             -- total a pagar / abono / saldo de la deuda (USD)
        datos JSONB NOT NULL       -- copia completa del registro
      )$f$, destino);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (client_name, registrado_at DESC)',
      destino || '_cliente_idx', destino);

    -- Solo lectura desde la app: sin permisos para agregar, editar ni borrar
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', destino);
    EXECUTE format('DROP POLICY IF EXISTS jk_leer ON public.%I', destino);
    EXECUTE format('DROP POLICY IF EXISTS jk_usuarios_activos ON public.%I', destino);
    EXECUTE format(
      'CREATE POLICY jk_leer ON public.%I FOR SELECT TO authenticated USING (public.jk_puede_modo(%L))',
      destino, m);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', destino);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM authenticated', destino);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', destino);

    FOR i IN 1 .. array_length(pares, 1) LOOP
      origen := m || '_' || pares[i][1];
      tipo := pares[i][2];
      CONTINUE WHEN to_regclass('public.' || origen) IS NULL;

      EXECUTE format('DROP TRIGGER IF EXISTS jk_historial_cliente ON public.%I', origen);
      EXECUTE format(
        'CREATE TRIGGER jk_historial_cliente AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.jk_historial_cliente(%L, %L)',
        origen, destino, tipo);

      -- Copia inicial de lo que ya existe (solo si ese tipo aún no tiene nada respaldado)
      EXECUTE format($f$
        INSERT INTO public.%1$I (usuario, client_name, tipo, accion, registro_id, fecha, monto, datos)
        SELECT NULL, nombre, %2$L, 'INICIAL', fila->>'id',
               coalesce(fila->>'date', fila->>'created_at', fila->>'updated_at'),
               CASE WHEN monto ~ '^-?[0-9]+(\.[0-9]+)?$' THEN monto::numeric END,
               fila
        FROM (
          SELECT fila,
                 upper(trim(coalesce(fila->>'client_name', fila->>'remitente_name',
                                     fila->'data'->>'remitente_name', ''))) AS nombre,
                 coalesce(fila->>'total_to_pay', fila->>'amount', fila->>'current_debt',
                          fila->'data'->>'fiado_usd') AS monto
          FROM (SELECT to_jsonb(t) AS fila FROM public.%3$I t) x
        ) y
        WHERE nombre <> ''
          AND NOT EXISTS (SELECT 1 FROM public.%1$I h WHERE h.tipo = %2$L)
      $f$, destino, tipo, origen);
    END LOOP;
  END LOOP;
END $$;

COMMIT;

-- 3. Comprobación: cuántos movimientos quedaron respaldados por tipo
SELECT 'detal' AS modo, tipo, accion, count(*) FROM public.detal_historial_clientes GROUP BY tipo, accion
UNION ALL
SELECT 'mayor', tipo, accion, count(*) FROM public.mayor_historial_clientes GROUP BY tipo, accion
ORDER BY 1, 2, 3;
