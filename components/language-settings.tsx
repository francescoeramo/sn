'use client';

import { Languages } from 'lucide-react';
import { LANGUAGE_STORAGE_KEY } from '@/lib/client/i18n';
import { useLanguage } from './language-provider';

export function LanguageSettings() {
  const language = useLanguage();
  const chooseEnglish = (enabled: boolean) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, enabled ? 'en' : 'it');
    dispatchEvent(new Event('sn-language-change'));
  };
  return (
    <section className="panel language-settings">
      <h2>Lingua</h2>
      <p className="muted">Scegli la lingua usata dai menu, dai pulsanti e dai moduli di SN.</p>
      <label className="toggle-label">
        <span>
          <strong>
            <Languages size={18} /> Inglese
          </strong>
          <small>I contenuti scritti dalle persone e i nomi restano nella lingua originale.</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Usa SN in inglese"
          checked={language === 'en'}
          onChange={(event) => chooseEnglish(event.target.checked)}
        />
      </label>
    </section>
  );
}
