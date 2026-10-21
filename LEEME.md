# Sistema Contable y Mesa de Cambio: CAMBIOS JK

Aplicación web y móvil (PWA) de tesorería multimoneda, control operativo y cuadre de caja diario diseñada a medida según el modelo contable de **CAMBIOS JK**.

---

## 🚀 Cómo iniciar el sistema en tu computadora

Abre una terminal en esta carpeta y ejecuta:

```bash
npm run dev
```

Luego abre tu navegador en:
👉 **`http://localhost:3000`**

---

## 📱 Cómo abrir el sistema desde tu Celular (en la misma red WiFi)

1. En tu computadora, averigua tu dirección IP local (ej. ejecutando `ipconfig` en la terminal; suele ser algo como `192.168.1.50`).
2. En tu celular (conectado al mismo WiFi de la oficina o casa), abre el navegador y escribe:
   `http://TU-IP-LOCAL:3000` (ejemplo: `http://192.168.1.50:3000`).
3. En el menú del navegador del teléfono selecciona **"Agregar a la pantalla de inicio"** para tener la aplicación instalada como una app nativa.

---

## 📊 Módulos Incluidos

1. **Panel Principal (Dashboard):**
   * Saldos consolidados en USD, USDT (Cripto), Bolívares (VES) y Pesos (COP).
   * Ganancia Neta del día calculada en tiempo real.
   * Accesos directos para registrar operaciones en 1 clic.

2. **Venta al Detal (Retail):**
   * Formulario ágil para ventas de USDT con cálculo de margen en vivo:
     `Ganancia = (Precio Venta - Precio Compra) * Cantidad - Comisiones`.
   * Selección de cuenta de cobro y wallet de desembolso (Binance, Tron, etc.).
   * Historial con búsqueda de clientes y filtros.

3. **Venta al Mayor:**
   * Monitoreo de stock disponible de Bolívares en cuentas venezolanas (Banesco, BDV).
   * Registro de ventas mayoristas y cálculo de beneficio comercial.

4. **Traspasos / Cambio de Saldo:**
   * Movimientos y transferencias entre cuentas propias con deducción y abono automático.
   * Cobro de porcentaje o comisión de puente.

5. **Gastos y Otros:**
   * Registro de egresos clasificados por moneda (USD, USDT, VES, COP, EUR).
   * Conversión automática a USD y descuento de la cuenta pagadora.

6. **Arqueo de Cuentas:**
   * Todas tus cuentas pre-cargadas directamente desde tu archivo Excel (Bancos de Ecuador, Banesco, Venezuela, Binance, Zelle, etc.).
   * Ajuste de saldos en tiempo real y opción de crear nuevas cuentas.

7. **Cierre Diario de Caja:**
   * Cuadre oficial diario: `Ganancia Detal + Ganancia Mayor - Gastos = Total Neto Ganado`.
   * Histórico persistente de cierres diarios.

8. **Cuentas por Cobrar (Deudores):**
   * Control de saldo de deudas de clientes y registro de abonos.

9. **Exportación a Excel:**
   * Botón en la barra superior para descargar el libro contable completo en formato `.xlsx` con todas las hojas operativas.

---

## ☁️ Conexión a Supabase (Base de Datos en la Nube)

El sistema funciona de forma inmediata y automática con almacenamiento local seguro sin requerir configuración previa.

Si deseas sincronizarlo en la nube con Supabase para compartir datos entre múltiples usuarios en distintas ciudades o conexiones:
1. Crea un proyecto gratuito en [Supabase](https://supabase.com).
2. Ve al **SQL Editor** en Supabase y pega el contenido del archivo `supabase_schema.sql` (creará todas las tablas y cuentas iniciales).
3. Renombra el archivo `.env.local.example` a `.env.local` y coloca tu URL y clave anónima (`anon key`).
4. **Obligatorio:** crea tu usuario ADMIN en `perfiles_usuarios` y luego ejecuta `supabase-seguridad-rls.sql` en el SQL Editor. Sin este paso cualquiera con la clave pública puede leer y borrar los datos. Detalles en [SEGURIDAD.md](SEGURIDAD.md).
