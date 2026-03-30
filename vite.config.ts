import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { datenVizPlugin } from './src/preview/vite-plugin.js';

export default defineConfig({
  root: 'src/preview',
  plugins: [
    react(),
    tailwindcss(),
    datenVizPlugin({
      erdFile: process.env.DATEN_VIZ_FILE || './schema.erd.json',
      bpmnFile: process.env.DATEN_VIZ_BPMN_FILE || './process.bpmn.json',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/preview'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5555,
    open: true,
  },
});
