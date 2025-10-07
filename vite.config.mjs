import { defineConfig } from 'vite';

export default defineConfig({
  // Evite toute copie multiple de 'three' si un sous-module en tire aussi
  resolve: { dedupe: ['three'] },
  server: {
    open: true,
    host: '0.0.0.0',        // ← permet d’écouter sur toutes les IP (LAN, ngrok, etc.)
    allowedHosts: [         // ← NEW: autorise les URLs de tunnel
      '.ngrok-free.app',
      '.ngrok-free.dev'
    ]
  }
});
