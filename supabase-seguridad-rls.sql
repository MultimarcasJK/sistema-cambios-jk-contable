-- =========================================================================
-- CAMBIOS JK - SEGURIDAD DE LA BASE DE DATOS (RLS)
-- =========================================================================
-- Antes: cada tabla tenía una política "allow_all_for_anon_*" con USING (true),
-- así que cualquiera con la clave pública (visible en la página publicada)
-- podía leer, modificar y borrar todo sin iniciar sesión.
--
-- Después de ejecutar este script:
--   * Sin iniciar sesión no se puede leer ni escribir ninguna tabla.
--   * Solo usuarios con sesión Y con una fila ACTIVA en perfiles_usuarios
--     pueden operar.
--   * Las tablas detal_* solo son accesibles a perfiles con modo 'detal' o
--     'ambos'; las tablas mayor_* a perfiles con modo 'mayor' o 'ambos'.
--   * detal_/mayor_auditoria solo admiten leer y agregar; detal_/mayor_ajustes_saldo
--     leer, agregar y borrar (se respeta el diseño de supabase-contabilidad.sql).
--   * perfiles_usuarios: cada usuario ve su propio perfil; solo un ADMIN
--     puede ver todos, crear, cambiar o borrar perfiles.
--
-- Cómo usarlo: Supabase > SQL Editor > pegar todo > Run.
-- Es seguro ejecutarlo varias veces. Ejecútalo DESPUÉS de cualquier otro .sql
-- del proyecto (schema, nómina, contabilidad, remesas), y de nuevo si vuelves a correr
-- alguno de ellos, porque esos archivos crean sus propias políticas.
-- IMPORTANTE: antes de ejecutarlo, tu usuario debe existir en
-- perfiles_usuarios con rol = 'ADMIN' y activo = true (el script se detiene
-- si no encuentra ningún ADMIN activo, para que no te quedes sin acceso).
-- =========================================================================

BEGIN;

-- 0. Verificación de seguridad: debe existir al menos un ADMIN activo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.perfiles_usuarios WHERE rol = 'ADMIN' AND activo = true
  ) THEN
    RAISE EXCEPTION 'No hay ningún ADMIN activo en perfiles_usuarios. Crea tu perfil ADMIN antes de ejecutar este script.';
  END IF;
END $$;

-- 1. Funciones auxiliares (SECURITY DEFINER para poder leer perfiles sin recursión de RLS)
CREATE OR REPLACE FUNCTION public.jk_usuario_activo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles_usuarios
    WHERE id = auth.uid() AND activo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.jk_es_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles_usuarios
    WHERE id = auth.uid() AND activo = true AND rol = 'ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION public.jk_puede_modo(modo text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles_usuarios
    WHERE id = auth.uid()
      AND activo = true
      AND (rol = 'ADMIN' OR COALESCE(modo_permitido, 'ambos') IN ('ambos', modo))
  );
$$;

REVOKE ALL ON FUNCTION public.jk_usuario_activo() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.jk_es_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.jk_puede_modo(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.jk_usuario_activo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.jk_es_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.jk_puede_modo(text) TO authenticated;

-- 2. Tablas de datos: quitar TODAS las políticas existentes y dejar solo la restrictiva.
--    Se recorren todas las tablas del esquema public (así se cubren también
--    tablas creadas a mano en el panel y no listadas en los .sql del repo).
DO $$
DECLARE
  tbl  text;
  pol  text;
  cond text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'perfiles_usuarios'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol, tbl);
    END LOOP;

    IF tbl LIKE 'detal\_%' THEN
      cond := 'public.jk_puede_modo(''detal'')';
    ELSIF tbl LIKE 'mayor\_%' THEN
      cond := 'public.jk_puede_modo(''mayor'')';
    ELSE
      cond := 'public.jk_usuario_activo()';
    END IF;

    IF tbl LIKE '%\_auditoria' THEN
      -- Bitácora (supabase-contabilidad.sql): solo leer y agregar, nunca editar ni borrar
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', 'jk_leer', tbl, cond);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', 'jk_crear', tbl, cond);
    ELSIF tbl LIKE '%\_historial\_clientes' THEN
      -- Historial por cliente (supabase-historial-clientes.sql): lo llenan los triggers, la app solo lee
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', 'jk_leer', tbl, cond);
    ELSIF tbl LIKE '%\_ajustes\_saldo' THEN
      -- Ajustes de saldo: leer, agregar y borrar (reseteo maestro), sin editar
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', 'jk_leer', tbl, cond);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', 'jk_crear', tbl, cond);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)', 'jk_borrar', tbl, cond);
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
        'jk_usuarios_activos', tbl, cond, cond
      );
    END IF;

    -- Sin sesión (rol anon) no hay ningún permiso sobre la tabla
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);
  END LOOP;
END $$;

-- 3. perfiles_usuarios: cada uno ve su perfil; solo ADMIN administra
ALTER TABLE public.perfiles_usuarios ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol text;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'perfiles_usuarios'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.perfiles_usuarios', pol);
  END LOOP;
END $$;

CREATE POLICY jk_perfil_propio_o_admin_lee ON public.perfiles_usuarios
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.jk_es_admin());

CREATE POLICY jk_admin_crea_perfiles ON public.perfiles_usuarios
  FOR INSERT TO authenticated
  WITH CHECK (public.jk_es_admin());

CREATE POLICY jk_admin_edita_perfiles ON public.perfiles_usuarios
  FOR UPDATE TO authenticated
  USING (public.jk_es_admin())
  WITH CHECK (public.jk_es_admin());

CREATE POLICY jk_admin_borra_perfiles ON public.perfiles_usuarios
  FOR DELETE TO authenticated
  USING (public.jk_es_admin());

REVOKE ALL ON public.perfiles_usuarios FROM anon;

COMMIT;

-- 4. Comprobación: lista las políticas que quedaron (no debe aparecer ninguna "allow_all")
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
