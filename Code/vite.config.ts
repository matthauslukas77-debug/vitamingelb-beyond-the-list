import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Auf allen Interfaces hören, damit Handy und Tailnet zugreifen können.
    host: true,
    // Vite blockt fremde Host-Header. `.ts.net` erlaubt den Zugriff über
    // Tailscale/MagicDNS — das Netz bleibt privat, der Host eingeschränkt.
    allowedHosts: ['.ts.net', '.local'],
  },
})
