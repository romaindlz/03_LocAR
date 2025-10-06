# 1) Projet Vite vanilla
npm create vite@latest .    # choisis: Vanilla (JavaScript)
npm install
npm pkg set type="module"   # évite l’avertissement CJS

# 2) Installe les bonnes versions (évite les doublons de three)
npm i three@0.175.0 locar   # ← la doc LocAR recommande three ^0.175.0

# 3) Créer fichier vite.config.mjs
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

# 4) Place tes fichiers (à la racine du projet)
- remplace/ajoute index.html et main.js avec ceux que tu m’as envoyés (garde le chemin ./main.js dans index.html, c’est OK avec Vite)

- (ton style.css peut rester à la racine si référencé ./style.css)