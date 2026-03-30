import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { datenVizPlugin } from './src/preview/vite-plugin.js';

export default defineConfig({
  root: 'src/preview',
  plugins: [
    react(),
    datenVizPlugin(process.env.DATEN_VIZ_FILE || './schema.erd.json'),
  ],
  server: {
    host: '127.0.0.1',
    port: 5555,
    open: true,
  },
});
