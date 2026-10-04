# PDV MULTIRESTAURANTE — Build Completo Offline-First

Base: V9 PLUS ULTRA 06  
Patches aplicados:

- **07** Caixa unificado + ferramentas Salão/Mesas + Placas QR no menu Caixa
- **08** API_BASE LAN (`src/config/apiBase.ts`) + authFetch rewrite
- **09** Fila offline IndexedDB + PWA (manifest, service worker, ícones)
- **Integração** com NEXORO LOCAL SERVER v1.8 (pasta `../local-server`)

## Modo LAN
```js
localStorage.setItem('nexoro_api_base', 'http://IP_SERVIDOR:3080')
```
ou em painel.html: `window.__NEXORO_API_BASE__ = 'http://...'`

## Dev com proxy
```bash
# terminal 1 — local server
cd ../local-server && npm start
# terminal 2 — PDV
VITE_DEV_PROXY=http://127.0.0.1:3080 npm run dev
```
