'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'system' | 'light' | 'dark';
const applyTheme = (theme: Theme) => {
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
};

export function ThemeSettings() {
  const theme = useSyncExternalStore(
    (notify) => {
      const update = () => {
        const saved = localStorage.getItem('sn-theme');
        if (saved !== 'light' && saved !== 'dark') applyTheme('system');
        notify();
      };
      const media = matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', update);
      addEventListener('storage', update);
      addEventListener('sn-theme-change', update);
      return () => {
        media.removeEventListener('change', update);
        removeEventListener('storage', update);
        removeEventListener('sn-theme-change', update);
      };
    },
    () => {
      const saved = localStorage.getItem('sn-theme');
      return saved === 'light' || saved === 'dark' ? saved : 'system';
    },
    () => 'system',
  );
  const choose = (next: Theme) => {
    if (next === 'system') localStorage.removeItem('sn-theme');
    else localStorage.setItem('sn-theme', next);
    applyTheme(next);
    dispatchEvent(new Event('sn-theme-change'));
  };
  return (
    <section className="panel theme-settings">
      <h2>Aspetto</h2>
      <p className="muted">Scegli il tema oppure segui automaticamente il dispositivo.</p>
      <div className="theme-options" role="group" aria-label="Tema dell’interfaccia">
        <button aria-pressed={theme === 'light'} onClick={() => choose('light')}>
          <Sun size={18} /> Chiaro
        </button>
        <button aria-pressed={theme === 'dark'} onClick={() => choose('dark')}>
          <Moon size={18} /> Scuro
        </button>
        <button aria-pressed={theme === 'system'} onClick={() => choose('system')}>
          Sistema
        </button>
      </div>
    </section>
  );
}
