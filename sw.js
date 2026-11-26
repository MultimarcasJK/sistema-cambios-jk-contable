// Service Worker ligero para habilitar la instalación como App (PWA)
// No cachea datos ni HTML viejos para no interferir con Supabase ni con las actualizaciones.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Dejar pasar todas las peticiones directamente a la red
});
