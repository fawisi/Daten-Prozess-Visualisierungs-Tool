import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visoPlugin } from './src/preview/vite-plugin.js';

// DATEN_VIZ_* env vars are deprecated aliases, removed in v1.1
if (process.env.DATEN_VIZ_FILE && !process.env.VISO_FILE) {
  process.stderr.write('[viso] DATEN_VIZ_FILE is deprecated, use VISO_FILE instead\n');
}
if (process.env.DATEN_VIZ_BPMN_FILE && !process.env.VISO_BPMN_FILE) {
  process.stderr.write('[viso] DATEN_VIZ_BPMN_FILE is deprecated, use VISO_BPMN_FILE instead\n');
}

export default defineConfig({
  root: 'src/preview',
  plugins: [
    react(),
    tailwindcss(),
    visoPlugin({
      erdFile: process.env.VISO_FILE || process.env.DATEN_VIZ_FILE || './schema.erd.json',
      bpmnFile: process.env.VISO_BPMN_FILE || process.env.DATEN_VIZ_BPMN_FILE || './process.bpmn.json',
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
