import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../utils/index.css';
import { installStaffAuthFetch } from './authFetch';
import { ensureOfflineQueueReady } from '../utils/offlineQueueManager';
import { StoreProvider } from '../context/StoreContext';
import { CustomerAuthProvider } from '../context/CustomerAuthContext';
import { PainelApp } from './PainelApp';

installStaffAuthFetch();
ensureOfflineQueueReady().catch(() => {});

// PWA: registra service worker (não bloqueia a UI)
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PWA] SW registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider mode="staff">
      <CustomerAuthProvider>
        <PainelApp />
      </CustomerAuthProvider>
    </StoreProvider>
  </StrictMode>
);
