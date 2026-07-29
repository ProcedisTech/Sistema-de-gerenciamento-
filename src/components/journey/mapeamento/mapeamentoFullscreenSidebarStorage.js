export const MAPA_FS_SIDEBAR_COLLAPSED_KEY = 'procedi_mapa_fs_sidebar_collapsed';

const NARROW_MQ = '(max-width: 767px)';

/**
 * Lê se a sidebar do fullscreen deve iniciar recolhida.
 * Sem valor salvo: recolhido em viewport estreito (&lt; 768px), expandido no desktop.
 */
export function readStoredSidebarCollapsed() {
  try {
    const v = localStorage.getItem(MAPA_FS_SIDEBAR_COLLAPSED_KEY);
    if (v === '1' || v === 'true') return true;
    if (v === '0' || v === 'false') return false;
  } catch {
    /* ignore */
  }
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia(NARROW_MQ).matches;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function persistSidebarCollapsed(collapsed) {
  try {
    localStorage.setItem(MAPA_FS_SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore */
  }
}
