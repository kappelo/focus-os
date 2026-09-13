"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ArchiveRestore,
  Check,
  Copy,
  DatabaseBackup,
  Download,
  Fingerprint,
  History,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { decryptWorkspaceBackup, encryptWorkspaceBackup, isEncryptedBackup } from "@/lib/backup-crypto";
import { biometricAvailable, hasBiometricLock, registerBiometricLock, removeBiometricLock } from "@/lib/biometric-lock";
import { migrateWorkspace } from "@/lib/storage";
import type { LocalProfile, TrashItem, WorkspaceState } from "@/lib/types";

type UpdateWorkspace = (recipe: (state: WorkspaceState) => WorkspaceState) => void;

export function SecurityCenter({ state, profile, onUpdate }: { state: WorkspaceState; profile: LocalProfile; onUpdate: UpdateWorkspace }) {
  const [twoFactor, setTwoFactor] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [backupPassword, setBackupPassword] = useState("");
  const [message, setMessage] = useState("");
  const [biometricReady, setBiometricReady] = useState(() => typeof window !== "undefined" && hasBiometricLock(profile.id));
  const [biometricSupported, setBiometricSupported] = useState(false);
  const backupInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetch("/api/auth/two-factor", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, data: await response.json() as { enabled?: boolean } }))
      .then(({ ok, data }) => { if (ok) setTwoFactor(Boolean(data.enabled)); })
      .catch(() => undefined);
    void biometricAvailable().then(setBiometricSupported).catch(() => setBiometricSupported(false));
  }, []);

  function setSetting<K extends keyof WorkspaceState["settings"]>(key: K, value: WorkspaceState["settings"][K]) {
    onUpdate((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  }

  async function beginTwoFactor() {
    setMessage("");
    const response = await fetch("/api/auth/two-factor", { method: "POST", credentials: "same-origin", cache: "no-store" });
    const data = await response.json() as { secret?: string; uri?: string; error?: string };
    if (!response.ok || !data.secret || !data.uri) { setMessage(data.error ?? "Nie udało się rozpocząć konfiguracji 2FA."); return; }
    setSetup({ secret: data.secret, uri: data.uri });
  }

  async function confirmTwoFactor() {
    if (!setup || !/^\d{6}$/.test(code)) return;
    const response = await fetch("/api/auth/two-factor", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify({ secret: setup.secret, code }) });
    const data = await response.json() as { enabled?: boolean; error?: string };
    if (!response.ok) { setMessage(data.error ?? "Nie udało się włączyć 2FA."); return; }
    setTwoFactor(true); setSetup(null); setCode(""); setMessage("Uwierzytelnianie dwuetapowe zostało włączone.");
  }

  async function disableTwoFactor() {
    if (!/^\d{6}$/.test(code)) { setMessage("Podaj aktualny kod 2FA."); return; }
    const response = await fetch("/api/auth/two-factor", { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "same-origin", cache: "no-store", body: JSON.stringify({ code }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setMessage(data.error ?? "Nie udało się wyłączyć 2FA."); return; }
    setTwoFactor(false); setCode(""); setMessage("2FA zostało wyłączone.");
  }

  async function toggleBiometric() {
    setMessage("");
    try {
      if (biometricReady) {
        removeBiometricLock(profile.id);
        setBiometricReady(false);
        setSetting("biometricLockEnabled", false);
      } else {
        await registerBiometricLock(profile);
        setBiometricReady(true);
        setSetting("biometricLockEnabled", true);
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Nie udało się skonfigurować biometrii.");
    }
  }

  async function exportBackup() {
    setMessage("");
    try {
      const payload = state.settings.encryptedBackups
        ? await encryptWorkspaceBackup(state, backupPassword)
        : JSON.stringify(state, null, 2);
      download(payload, `focus-os-account-${new Date().toISOString().slice(0, 10)}.${state.settings.encryptedBackups ? "encrypted.json" : "json"}`);
      setMessage("Eksport całego konta został przygotowany.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Nie udało się utworzyć backupu.");
    }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = await file.text();
      const raw = isEncryptedBackup(payload) ? await decryptWorkspaceBackup(payload, backupPassword) : JSON.parse(payload);
      const restored = migrateWorkspace(raw as Partial<WorkspaceState>);
      onUpdate(() => restored);
      setMessage("Backup przywrócono. Synchronizacja prześle go na pozostałe urządzenia.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Nie udało się odczytać backupu.");
    } finally {
      event.target.value = "";
    }
  }

  async function serverBackup() {
    const response = await fetch("/api/backup", { method: "POST", credentials: "same-origin", cache: "no-store" });
    const data = await response.json() as { name?: string; error?: string };
    setMessage(response.ok ? `Utworzono spójny backup SQLite: ${data.name}.` : data.error ?? "Backup SQLite nie powiódł się.");
  }

  function restore(item: TrashItem) {
    onUpdate((current) => {
      const existing = (current as unknown as Record<string, unknown>)[item.collection];
      if (!Array.isArray(existing) || item.collection === "trash") return current;
      return {
        ...current,
        [item.collection]: [item.snapshot, ...existing],
        trash: current.trash.filter((entry) => entry.id !== item.id),
      } as WorkspaceState;
    });
  }

  return (
    <div className="security-layout page-stack compact-stack">
      <section className="security-hero panel"><span><ShieldCheck size={28} /></span><div><p className="eyebrow">CENTRUM BEZPIECZEŃSTWA</p><h2>Ochrona konta i odzyskiwanie danych</h2><p>PIN jest hashowany, workspace może być szyfrowany na serwerze, a 2FA, blokada lokalna i kopie zapasowe tworzą kolejne warstwy ochrony.</p></div></section>
      <div className="tool-grid two-columns">
        <section className="panel settings-group">
          <div className="panel-heading"><div><p className="eyebrow">BLOKADA LOKALNA</p><h2>PIN i biometria</h2></div><LockKeyhole size={21} /></div>
          <label className="switch-row"><span><strong>Automatycznie blokuj aplikację</strong><small>Sesja pozostaje zalogowana, ale interfejs wymaga lokalnego PIN-u.</small></span><input type="checkbox" checked={state.settings.appLockEnabled} onChange={(event) => setSetting("appLockEnabled", event.target.checked)} /></label>
          {state.settings.appLockEnabled ? <label className="setting-inline-field">Blokuj po <input type="number" min="1" max="240" value={state.settings.lockAfterMinutes} onChange={(event) => setSetting("lockAfterMinutes", Math.min(240, Math.max(1, Number(event.target.value) || 1)))} /> minutach</label> : null}
          <div className="security-action"><Fingerprint size={22} /><div><strong>Biometria / Windows Hello</strong><small>{biometricSupported ? "Dostępna na tym urządzeniu. Jest dodatkiem do lokalnego PIN-u." : "Wymaga HTTPS lub localhost i zgodnego urządzenia."}</small></div><button className="button button-secondary" disabled={!biometricSupported} onClick={() => void toggleBiometric()}>{biometricReady ? "Usuń" : "Skonfiguruj"}</button></div>
        </section>
        <section className="panel settings-group">
          <div className="panel-heading"><div><p className="eyebrow">LOGOWANIE</p><h2>Uwierzytelnianie 2FA</h2></div><KeyRound size={21} /></div>
          <p>{twoFactor ? "2FA jest aktywne. Przy kolejnym logowaniu potrzebny będzie kod z aplikacji uwierzytelniającej." : "Dodaj jednorazowe kody TOTP z aplikacji Authenticator, 1Password lub Bitwarden."}</p>
          {!twoFactor && !setup ? <button className="button button-primary" onClick={() => void beginTwoFactor()}>Włącz 2FA</button> : null}
          {setup ? <div className="totp-setup"><span>Wpisz sekret ręcznie w aplikacji:</span><code>{setup.secret}</code><button className="text-button" onClick={() => void navigator.clipboard.writeText(setup.secret)}><Copy size={14} /> Kopiuj sekret</button><small>Typ: TOTP · 6 cyfr · okres 30 sekund</small></div> : null}
          {setup || twoFactor ? <div className="inline-form"><input aria-label="Kod 2FA" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Kod 6-cyfrowy" /><button className={setup ? "button button-primary" : "button button-secondary"} onClick={() => void (setup ? confirmTwoFactor() : disableTwoFactor())}>{setup ? "Potwierdź" : "Wyłącz 2FA"}</button></div> : null}
        </section>
      </div>
      <section className="panel backup-center">
        <div className="panel-heading"><div><p className="eyebrow">BACKUP 3–2–1</p><h2>Kopie całego konta</h2></div><DatabaseBackup size={22} /></div>
        <div className="backup-options"><label className="switch-row"><span><strong>Szyfruj eksport hasłem</strong><small>AES-256-GCM i PBKDF2; bez hasła nie da się odzyskać pliku.</small></span><input type="checkbox" checked={state.settings.encryptedBackups} onChange={(event) => setSetting("encryptedBackups", event.target.checked)} /></label><label className="switch-row"><span><strong>Automatyczny dzienny backup SQLite</strong><small>Serwer zachowuje ostatnie 14 spójnych kopii.</small></span><input type="checkbox" checked={state.settings.automaticDailyBackup} onChange={(event) => setSetting("automaticDailyBackup", event.target.checked)} /></label></div>
        <label>Hasło pliku backupu<input type="password" value={backupPassword} onChange={(event) => setBackupPassword(event.target.value)} placeholder={state.settings.encryptedBackups ? "Minimum 8 znaków" : "Potrzebne tylko przy imporcie zaszyfrowanego pliku"} autoComplete="new-password" /></label>
        <input hidden ref={backupInput} type="file" accept=".json,application/json" onChange={(event) => void importBackup(event)} />
        <div className="button-group"><button className="button button-primary" onClick={() => void exportBackup()}><Download size={16} /> Eksportuj konto</button><button className="button button-secondary" onClick={() => backupInput.current?.click()}><Upload size={16} /> Przywróć plik</button><button className="button button-quiet" onClick={() => void serverBackup()}><DatabaseBackup size={16} /> Backup SQLite teraz</button></div>
      </section>
      <div className="tool-grid two-columns">
        <section className="panel"><div className="panel-heading"><div><p className="eyebrow">30 DNI</p><h2>Kosz</h2></div><span>{state.trash.length}</span></div>{state.trash.length ? <div className="trash-list">{state.trash.slice().sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)).map((item) => <article key={item.id}><Trash2 size={17} /><div><strong>{item.label}</strong><small>{item.collection} · usunięto {new Date(item.deletedAt).toLocaleString("pl-PL")}</small></div><button className="button button-quiet" onClick={() => restore(item)}><ArchiveRestore size={15} /> Przywróć</button><button className="icon-button danger" aria-label="Usuń bezpowrotnie" onClick={() => onUpdate((current) => ({ ...current, trash: current.trash.filter((entry) => entry.id !== item.id) }))}><Trash2 size={15} /></button></article>)}</div> : <EmptyState icon={Trash2} title="Kosz jest pusty" text="Usunięte zadania, projekty, quizy i fiszki można odzyskać przez 30 dni." />}</section>
        <section className="panel"><div className="panel-heading"><div><p className="eyebrow">HISTORIA ZMIAN</p><h2>Ostatnia aktywność</h2></div><History size={21} /></div>{state.activityLog.length ? <div className="activity-list">{state.activityLog.slice().reverse().slice(0, 30).map((entry) => <article key={entry.id}><span className={`activity-dot ${entry.type}`} /><div><strong>{entry.description}</strong><small>{new Date(entry.createdAt).toLocaleString("pl-PL")} · {entry.xp >= 0 ? "+" : ""}{entry.xp} XP</small></div></article>)}</div> : <EmptyState icon={History} title="Historia jest pusta" text="Sesje, quizy, zadania i nagrody będą zapisywane tutaj." />}</section>
      </div>
      {message ? <p className="security-message" role="status"><Check size={15} /> {message}</p> : null}
    </div>
  );
}

function download(payload: string, name: string) {
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
