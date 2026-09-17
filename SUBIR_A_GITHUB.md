# Guía Rápida para Subir a GitHub

Tu proyecto contable ya tiene Git inicializado y su primer commit limpio listo. Para vincularlo a tu cuenta u organización de GitHub (por ejemplo en `grupojk-cambios`), sigue estos 3 pasos:

### Paso 1: Crear el repositorio en GitHub
1. Ve a [GitHub](https://github.com/new) o a tu organización `grupojk-cambios`.
2. Crea un nuevo repositorio (ej. nombre: `sistema-cambios-jk-contable`).
3. Déjalo **vacío** (NO selecciones crear README ni .gitignore porque este proyecto ya los tiene listos).

### Paso 2: Vincular y Subir
Abre tu terminal en esta carpeta y ejecuta:

```bash
git remote add origin https://github.com/grupojk-cambios/sistema-cambios-jk-contable.git
git push -u origin main
```
*(Reemplaza la URL con la que te dé GitHub si usas otro nombre de repo).*

---

### ¿Cómo funciona la sincronización en la Nube?
- **En tu PC**: Lee `constants.js` directamente del disco local.
- **En la Nube (Vercel, Render, VPS)**: Si no encuentra el disco `C:\`, consulta automáticamente en tiempo real la rama `main` del conversor en GitHub (`https://raw.githubusercontent.com/grupojk-cambios/grupojk-conversor/main/src/constants.js`).
- **Google Sheets**: Sigue leyendo en vivo cada minuto o al recargar la página.
