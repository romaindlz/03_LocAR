import { defineConfig } from 'vite';

export default defineConfig({
  server: { open: true },
  // Evite toute copie multiple de 'three' si un sous-module en tire aussi
  resolve: { dedupe: ['three'] },
  server: {
    host: '0.0.0.0',        // ← permet d’écouter sur toutes les IP (LAN, ngrok, etc.)
    allowedHosts: [         // ← NEW: autorise les URLs de tunnel
      '.ngrok-free.app',
      '.ngrok-free.dev'
    ]
  }
});
