import React from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles/globals.css';
import './styles/canvas.css';
import { App } from './App.js';
import { ThemeProvider } from './state/useTheme.js';

const root = createRoot(document.getElementById('root')!);
root.render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
