import React from 'react';
import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles/canvas.css';
import { App } from './App.js';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
