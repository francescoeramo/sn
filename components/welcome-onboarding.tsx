'use client';

import { Clock3, EyeOff, ShieldCheck } from 'lucide-react';
import type { Action } from '@/lib/core/types';
import { Modal } from './primitives';

export function WelcomeOnboarding({
  firstName,
  onAction,
  onSettings,
}: {
  firstName: string;
  onAction: (action: Action) => Promise<boolean>;
  onSettings: () => void;
}) {
  const finish = async (openSettings = false) => {
    if (await onAction({ type: 'complete-onboarding' })) {
      if (openSettings) onSettings();
    }
  };
  return (
    <Modal title={`Benvenuto, ${firstName}.`} onClose={() => void finish()}>
      <p className="onboarding-intro">
        SN è una beta privata costruita per condividere qualcosa con persone che conosci.
      </p>
      <div className="onboarding-points">
        <div>
          <Clock3 size={20} aria-hidden="true" />
          <p>
            <strong>Il feed ha una fine</strong>
            <span>I post sono in ordine cronologico. Quando sei in pari, puoi uscire.</span>
          </p>
        </div>
        <div>
          <ShieldCheck size={20} aria-hidden="true" />
          <p>
            <strong>Le persone moderano</strong>
            <span>Segnalazioni e note vengono esaminate manualmente, con una motivazione.</span>
          </p>
        </div>
        <div>
          <EyeOff size={20} aria-hidden="true" />
          <p>
            <strong>Nessuna pubblicità</strong>
            <span>Niente tracker pubblicitari o classifiche di popolarità.</span>
          </p>
        </div>
      </div>
      <div className="onboarding-actions">
        <button className="primary" onClick={() => void finish()}>
          Entra nella piazza
        </button>
        <button className="text-button" onClick={() => void finish(true)}>
          Controlla prima la privacy
        </button>
      </div>
    </Modal>
  );
}
