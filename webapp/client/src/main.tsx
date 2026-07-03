import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { useStore } from './state/store';

// Kick off data loading + WebSocket connection once, outside React's lifecycle.
useStore.getState().init();

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
