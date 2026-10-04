/**
 * NEXORO — base URL da API (LAN / local server)
 *
 * Prioridade:
 * 1. window.__NEXORO_API_BASE__ (injetado em runtime no painel.html)
 * 2. localStorage 'nexoro_api_base' (configurável no dispositivo)
 * 3. import.meta.env.VITE_API_BASE (build-time)
 * 4. '' → mesmo origin (comportamento clássico / proxy Vite)
 *
 * Nos terminais da rede: use http://IP_DO_SERVIDOR:3080 (sem barra no final).
 * Nunca deixe localhost em tablets/PCs que não sejam o próprio servidor.
 */

declare global {
  interface Window {
    __NEXORO_API_BASE__?: string;
  }
}

const LS_KEY = 'nexoro_api_base';

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

export function getApiBase(): string {
  try {
    if (typeof window !== 'undefined' && window.__NEXORO_API_BASE__) {
      return stripTrailingSlash(String(window.__NEXORO_API_BASE__).trim());
    }
  } catch {
    /* ignore */
  }
  try {
    const fromLs = localStorage.getItem(LS_KEY);
    if (fromLs && fromLs.trim()) return stripTrailingSlash(fromLs.trim());
  } catch {
    /* ignore */
  }
  try {
    const fromEnv = (import.meta as any).env?.VITE_API_BASE;
    if (fromEnv && String(fromEnv).trim()) return stripTrailingSlash(String(fromEnv).trim());
  } catch {
    /* ignore */
  }
  return '';
}

export function setApiBase(url: string): void {
  const v = stripTrailingSlash(url.trim());
  try {
    if (v) localStorage.setItem(LS_KEY, v);
    else localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.__NEXORO_API_BASE__ = v || undefined;
  } catch {
    /* ignore */
  }
}

/** Resolve URL relativa /api/... para absoluta quando há base configurada */
export function resolveApiUrl(input: string): string {
  const base = getApiBase();
  if (!base) return input;
  if (input.startsWith('http://') || input.startsWith('https://')) return input;
  if (input.startsWith('/api/') || input === '/api') return `${base}${input}`;
  // URL absoluta do mesmo origin apontando para /api
  try {
    if (typeof window !== 'undefined' && input.startsWith(window.location.origin + '/api')) {
      return base + input.slice(window.location.origin.length);
    }
  } catch {
    /* ignore */
  }
  return input;
}

export async function probeLocalServer(base?: string): Promise<{
  ok: boolean;
  base: string;
  health?: any;
  error?: string;
}> {
  const b = stripTrailingSlash((base ?? getApiBase()) || '');
  if (!b) return { ok: false, base: b, error: 'API base vazia' };
  try {
    const res = await fetch(`${b}/api/health`, { method: 'GET' });
    const health = await res.json().catch(() => ({}));
    return { ok: res.ok || res.status === 503, base: b, health };
  } catch (e: any) {
    return { ok: false, base: b, error: e?.message || String(e) };
  }
}
