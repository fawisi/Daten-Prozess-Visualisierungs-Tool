import React from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles/globals.css';
import './styles/canvas.css';
import { App } from './App.js';

// Always dark mode
document.documentElement.classList.add('dark');

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
