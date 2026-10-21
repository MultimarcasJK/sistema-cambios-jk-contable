# Seguridad de los datos (Supabase)

La clave pública de Supabase (`sb_publishable_...` / `anon key`) **siempre** viaja dentro de la página publicada en GitHub Pages. Eso es normal: no es un secreto. Lo que protege los datos son las políticas RLS de la base de datos.

## 1. Activar la protección (una sola vez)

1. En Supabase > **Authentication > Users**, confirma que cada persona que usa el sistema tiene su usuario (correo y contraseña).
2. En la tabla `perfiles_usuarios`, cada usuario debe tener una fila con el mismo `id` que en Authentication, `activo = true`, `rol` (`ADMIN` u `OPERADOR`) y `modo_permitido` (`detal`, `mayor` o `ambos`). Tú debes tener `rol = 'ADMIN'`.
3. En Supabase > **Authentication > Sign In / Providers**, desactiva **Allow new users to sign up**, para que nadie pueda crearse una cuenta por su cuenta.
4. En Supabase > **SQL Editor**, pega y ejecuta `supabase-seguridad-rls.sql`. El script se detiene sin cambiar nada si no encuentra un ADMIN activo.
5. Abre el sistema, inicia sesión y comprueba que ves tus datos.

Resultado:

- Sin iniciar sesión no se puede leer ni modificar nada.
- Un usuario con `activo = false` no ve nada.
- Un operador con `modo_permitido = 'detal'` solo accede a las tablas `detal_*` (igual con `mayor`).
- Solo un ADMIN puede crear, editar o borrar perfiles.

Para dar de baja a alguien: pon `activo = false` en su perfil (o bórralo en Authentication).

## 2. Archivos con datos de clientes

Los archivos `clientes_importados.json`, `importar_clientes_consola.js`, `src/lib/clientes-excel-detal.ts` y `MAYOR ENERO 2026 CAMBIOS JK (prueba)claude.xlsm` se quitaron del repositorio y `.gitignore` ahora ignora `*.xlsx`, `*.xlsm`, `*.xls` y `clientes_*.json`. Guarda esas hojas fuera de la carpeta del proyecto.

Quitarlos en un commit nuevo **no** los borra del historial: siguen visibles en commits anteriores y en la rama `gh-pages` (la lista de clientes estaba dentro del JavaScript publicado). Para limpiarlos de verdad:

1. Haz el repositorio **privado** en GitHub (Settings > General > Danger Zone). GitHub Pages en repos privados requiere un plan de pago; si no lo tienes, ve a los pasos 2 a 4.
2. Publica de nuevo el sitio con `npm run deploy` después de fusionar este cambio, para que la página ya no incluya la lista de clientes.
3. Reescribe el historial con [git filter-repo](https://github.com/newren/git-filter-repo) desde una copia nueva:

   ```bash
   git clone --mirror https://github.com/MultimarcasJK/sistema-cambios-jk-contable.git
   cd sistema-cambios-jk-contable.git
   git filter-repo --invert-paths \
     --path clientes_importados.json \
     --path importar_clientes_consola.js \
     --path src/lib/clientes-excel-detal.ts \
     --path "MAYOR ENERO 2026 CAMBIOS JK (prueba)claude.xlsm"
   git push --force --mirror
   ```

   Para la rama `gh-pages` lo más simple es borrarla y volver a publicar: `git push origin --delete gh-pages` y luego `npm run deploy`.
4. Después de reescribir, cualquier otra copia local del proyecto debe clonarse de nuevo (no hagas `pull` sobre una copia vieja, porque volvería a subir el historial antiguo). Si el repositorio tiene forks, GitHub Support puede purgar las copias en caché.

Si el repositorio fue público durante un tiempo, asume que la lista de clientes pudo haber sido copiada: limpiar el historial evita nuevas filtraciones, pero no deshace las anteriores.
