// A tiny synchronous mirror of the visual preferences. Settings live in IndexedDB (async), so
// without this the page would paint with defaults first and then jump. The inline script in the
// root layout applies it before first paint.
export interface UiPrefs {
  textScale: number;
  reduceMotion: boolean;
  highContrast: boolean;
}

export const UI_PREFS_KEY = "firenances:ui";

export function applyUiPrefs(prefs: UiPrefs, root: HTMLElement = document.documentElement) {
  root.dataset.reduceMotion = String(prefs.reduceMotion);
  root.dataset.contrast = prefs.highContrast ? "high" : "normal";
  root.style.setProperty("--text-scale", String(prefs.textScale));
}

export function saveUiPrefs(prefs: UiPrefs) {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Private mode / storage disabled: the settings store still holds the truth.
  }
}

export const uiPrefsBootScript = `(function(){try{var p=JSON.parse(localStorage.getItem("${UI_PREFS_KEY}")||"null");if(!p)return;var r=document.documentElement;r.dataset.reduceMotion=String(!!p.reduceMotion);r.dataset.contrast=p.highContrast?"high":"normal";r.style.setProperty("--text-scale",String(p.textScale||1));}catch(e){}})();`;
