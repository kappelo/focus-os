"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Fingerprint, Leaf, LockKeyhole } from "lucide-react";
import { unlockWithBiometric } from "@/lib/biometric-lock";
import { verifyLocalPin } from "@/lib/storage";
import type { LocalProfile, WorkspaceSettings } from "@/lib/types";

export function AppLock({
  profile,
  settings,
  lockSignal,
}: {
  profile: LocalProfile;
  settings: WorkspaceSettings;
  lockSignal: number;
}) {
  const [locked, setLocked] = useState(() => lockSignal > 0);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const lastActivity = useRef(0);

  useEffect(() => {
    if (!settings.appLockEnabled || locked) return;
    lastActivity.current = Date.now();
    const active = () => { lastActivity.current = Date.now(); };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, active, { passive: true }));
    const interval = window.setInterval(() => {
      if (Date.now() - lastActivity.current >= settings.lockAfterMinutes * 60_000) setLocked(true);
    }, 15_000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, active));
      window.clearInterval(interval);
    };
  }, [locked, settings.appLockEnabled, settings.lockAfterMinutes]);

  if (!locked) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await verifyLocalPin(profile, pin)) {
      lastActivity.current = Date.now();
      setPin("");
      setError("");
      setLocked(false);
    } else setError("Nieprawidłowy PIN.");
  }

  async function biometric() {
    setError("");
    try {
      if (await unlockWithBiometric(profile.id)) {
        lastActivity.current = Date.now();
        setLocked(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się użyć biometrii.");
    }
  }

  return (
    <div className="app-lock" role="dialog" aria-modal="true" aria-label="Aplikacja zablokowana">
      <form onSubmit={submit}>
        <span className="brand-mark"><Leaf size={24} /></span>
        <p className="eyebrow">PRYWATNOŚĆ</p>
        <h1>Focus OS jest zablokowany</h1>
        <p>Twoja sesja i dane pozostają bezpieczne. Odblokuj aplikację lokalnym PIN-em.</p>
        <label>PIN<input autoFocus value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 10))} type="password" inputMode="numeric" autoComplete="current-password" /></label>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="button button-primary button-large"><LockKeyhole size={17} /> Odblokuj</button>
        {settings.biometricLockEnabled ? <button type="button" className="button button-secondary" onClick={() => void biometric()}><Fingerprint size={18} /> Użyj biometrii / Windows Hello</button> : null}
      </form>
    </div>
  );
}
