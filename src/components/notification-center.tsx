"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Bell,
  BellRing,
  Check,
  Clock3,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PwaInstallButton } from "@/components/pwa-install";
import { createId } from "@/lib/ids";
import { duePushOccurrence } from "@/lib/push-schedule";
import type { NotificationSchedule, WorkspaceState } from "@/lib/types";

type UpdateWorkspace = (recipe: (state: WorkspaceState) => WorkspaceState) => void;

export function NotificationScheduler({
  state,
  onUpdate,
  onSyncRequest,
}: {
  state: WorkspaceState;
  onUpdate: UpdateWorkspace;
  onSyncRequest: () => void;
}) {
  const firing = useRef(new Set<string>());

  const checkSchedules = useCallback(async () => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    // The server owns deliveries for subscribed browsers, including when this tab is open.
    if ("serviceWorker" in navigator && window.isSecureContext) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (await registration.pushManager?.getSubscription()) return;
      } catch { /* Keep in-tab reminders available when Push is unavailable. */ }
    }
    for (const schedule of state.notificationSchedules) {
      const occurrence = duePushOccurrence(schedule);
      if (!occurrence) continue;
      const key = `focus-reminder:${schedule.id}`;
      if (firing.current.has(key) || window.localStorage.getItem(key) === occurrence) continue;
      firing.current.add(key);
      try {
        await showScheduledNotification(schedule);
        window.localStorage.setItem(key, occurrence);
      } catch { /* A later tick may retry when notification APIs recover. */ }
      finally { firing.current.delete(key); }
    }
  }, [state.notificationSchedules]);

  useEffect(() => {
    void checkSchedules();
    const interval = window.setInterval(() => void checkSchedules(), 30_000);
    return () => window.clearInterval(interval);
  }, [checkSchedules]);

  useEffect(() => {
    const dueReviews = state.flashcards.filter((card) => !card.suspended && new Date(card.dueAt).getTime() <= Date.now()).length;
    const overdueTasks = state.tasks.filter((task) => task.status !== "done" && task.deadline && new Date(task.deadline).getTime() < Date.now()).length;
    const badge = dueReviews + overdueTasks;
    const navigatorWithBadge = navigator as Navigator & {
      setAppBadge?: (value?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (badge && navigatorWithBadge.setAppBadge) void navigatorWithBadge.setAppBadge(badge).catch(() => undefined);
    else if (!badge && navigatorWithBadge.clearAppBadge) void navigatorWithBadge.clearAppBadge().catch(() => undefined);
  }, [state.flashcards, state.tasks]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const listener = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === "FOCUS_SYNC_REQUEST") onSyncRequest();
      if (event.data?.type === "FOCUS_CHECK_REMINDERS") void checkSchedules();
    };
    navigator.serviceWorker.addEventListener("message", listener);
    return () => navigator.serviceWorker.removeEventListener("message", listener);
  }, [checkSchedules, onSyncRequest]);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || navigator.onLine) return;
    void navigator.serviceWorker.ready.then((registration) => {
      const background = registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      };
      return background.sync?.register("focus-os-sync");
    }).catch(() => undefined);
  }, [state.version]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const action = url.searchParams.get("notificationAction");
    const id = url.searchParams.get("notificationId");
    if (!action) return;
    if (id && (action === "snooze" || action === "done")) {
      const now = new Date().toISOString();
      onUpdate((current) => ({
        ...current,
        notificationSchedules: current.notificationSchedules.map((schedule) =>
          schedule.id === id
            ? {
                ...schedule,
                enabled: action === "snooze",
                scheduledAt: action === "snooze"
                  ? new Date(Date.now() + 10 * 60_000).toISOString()
                  : schedule.scheduledAt,
                updatedAt: now,
              }
            : schedule,
        ),
      }));
    }
    url.searchParams.delete("notificationAction");
    url.searchParams.delete("notificationId");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [onUpdate]);

  return null;
}

export function NotificationCenter({ state, onUpdate }: { state: WorkspaceState; onUpdate: UpdateWorkspace }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("Czas na zaplanowaną naukę.");
  const [scheduledAt, setScheduledAt] = useState(() => localDateTimeValue(new Date(Date.now() + 60 * 60_000)));
  const [repeat, setRepeat] = useState<NotificationSchedule["repeat"]>("none");
  const [kind, setKind] = useState<NotificationSchedule["kind"]>("study");
  const [message, setMessage] = useState("");
  const [pushKey, setPushKey] = useState("");
  const [pushAvailable, setPushAvailable] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const securePushContext = typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window;

  useEffect(() => {
    if (!securePushContext) return;
    let active = true;
    void Promise.all([
      fetch("/api/push", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ available: boolean; publicKey: string }> : null),
      navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()),
    ]).then(([config, subscription]) => {
      if (!active) return;
      setPushAvailable(Boolean(config?.available));
      setPushKey(config?.publicKey ?? "");
      setPushSubscribed(Boolean(subscription));
    }).catch(() => { if (active) setPushAvailable(false); });
    return () => { active = false; };
  }, [securePushContext]);

  async function enablePush() {
    if (!securePushContext || !pushKey || pushBusy) return;
    setPushBusy(true);
    try {
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== "granted") throw new Error("Przeglądarka nie udzieliła zgody.");
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlBytes(pushKey) });
      const response = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
      if (!response.ok) {
        if (!existing) await subscription.unsubscribe();
        throw new Error("Serwer nie zapisał subskrypcji Push.");
      }
      setPushSubscribed(true);
      setMessage("Powiadomienia w tle są włączone na tym urządzeniu.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się włączyć powiadomień Push.");
    } finally { setPushBusy(false); }
  }

  async function disablePush() {
    if (!securePushContext || pushBusy) return;
    setPushBusy(true);
    try {
      const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        if (!response.ok) throw new Error("Serwer nie wyłączył subskrypcji.");
        await subscription.unsubscribe();
      }
      setPushSubscribed(false);
      setMessage("Powiadomienia w tle wyłączono na tym urządzeniu.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się wyłączyć powiadomień Push.");
    } finally { setPushBusy(false); }
  }

  async function requestPermission() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    setMessage(result === "granted" ? "Powiadomienia są aktywne." : "Przeglądarka nie udzieliła zgody na powiadomienia.");
  }

  function add(event: FormEvent) {
    event.preventDefault();
    const parsed = new Date(scheduledAt);
    if (!title.trim() || !Number.isFinite(parsed.getTime())) return;
    const now = new Date().toISOString();
    const schedule: NotificationSchedule = {
      id: createId(),
      title: title.trim(),
      body: body.trim() || "Czas na naukę.",
      scheduledAt: parsed.toISOString(),
      repeat,
      kind,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    onUpdate((current) => ({ ...current, notificationSchedules: [...current.notificationSchedules, schedule] }));
    setTitle("");
    setMessage("Przypomnienie zapisano i zostanie zsynchronizowane.");
  }

  async function testNotification() {
    if (permission !== "granted") {
      await requestPermission();
      return;
    }
    await showScheduledNotification({ id: "test", title: "Focus OS działa", body: "To jest test powiadomienia z akcjami.", scheduledAt: new Date().toISOString(), repeat: "none", kind: "study", enabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  return (
    <div className="notification-layout">
      <section className="panel notification-status">
        <span className={permission === "granted" ? "ready" : ""}><BellRing size={26} /></span>
        <div><p className="eyebrow">POWIADOMIENIA PWA</p><h2>{pushSubscribed ? "Powiadomienia w tle aktywne" : permission === "granted" ? "Powiadomienia w otwartej aplikacji" : permission === "unsupported" ? "Brak obsługi w tej przeglądarce" : "Wymagana zgoda"}</h2><p>{pushSubscribed ? "Serwer wyśle przypomnienia także po zamknięciu aplikacji, jeśli urządzenie ma dostęp do internetu." : "Bez Web Push przypomnienia pojawią się tylko, gdy aplikacja pozostaje otwarta."} Akcje: „Rozpocznij”, „Odłóż” i „Gotowe”.</p></div>
        <div className="button-group"><PwaInstallButton /><button className="button button-secondary" onClick={() => void testNotification()}><Send size={16} /> Test lokalny</button>{permission !== "granted" ? <button className="button button-primary" onClick={() => void requestPermission()}><Bell size={16} /> Włącz lokalne</button> : null}</div>
      </section>
      <section className="panel form-stack" aria-label="Powiadomienia w tle">
        <div><p className="eyebrow">WEB PUSH</p><h2>Po zamknięciu aplikacji</h2></div>
        {!securePushContext ? <p className="inline-notice">Na zwykłym HTTP z adresu sieci lokalnej przeglądarka blokuje Web Push. Użyj HTTPS; wyjątkiem do testów jest localhost na tym samym urządzeniu.</p> : !pushAvailable ? <p className="inline-notice">Serwer Push jest niedostępny lub nie ma skonfigurowanych kluczy VAPID.</p> : <><p>Włącz osobno na każdym urządzeniu. Zaplanowane terminy są wspólne dla konta.</p><div className="button-group">{pushSubscribed ? <button className="button button-secondary" disabled={pushBusy} onClick={() => void disablePush()}>Wyłącz na tym urządzeniu</button> : <button className="button button-primary" disabled={pushBusy} onClick={() => void enablePush()}><BellRing size={16} /> Włącz powiadomienia w tle</button>}</div></>}
      </section>
      <div className="tool-grid two-columns">
        <form className="panel form-stack" onSubmit={add}>
          <div><p className="eyebrow">NOWE PRZYPOMNIENIE</p><h2>Zaplanuj naukę</h2></div>
          <label>Tytuł<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="np. Powtórz biologię" /></label>
          <label>Treść<input value={body} onChange={(event) => setBody(event.target.value)} /></label>
          <div className="form-grid"><label>Data i godzina<input type="datetime-local" required value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label><label>Powtarzanie<select value={repeat} onChange={(event) => setRepeat(event.target.value as NotificationSchedule["repeat"])}><option value="none">Jednorazowo</option><option value="daily">Codziennie</option><option value="weekly">Co tydzień</option></select></label><label>Typ<select value={kind} onChange={(event) => setKind(event.target.value as NotificationSchedule["kind"])}><option value="study">Nauka</option><option value="review">Fiszki</option><option value="exam">Egzamin</option></select></label></div>
          <button className="button button-primary"><Plus size={16} /> Dodaj przypomnienie</button>
          {message ? <p className="inline-notice" role="status">{message}</p> : null}
        </form>
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">HARMONOGRAM</p><h2>Zaplanowane</h2></div><span>{state.notificationSchedules.filter((item) => item.enabled).length}</span></div>
          {state.notificationSchedules.length ? <div className="schedule-list">{state.notificationSchedules.slice().sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)).map((schedule) => <article className={schedule.enabled ? "" : "disabled"} key={schedule.id}><span><Clock3 size={18} /></span><div><strong>{schedule.title}</strong><small>{new Date(schedule.scheduledAt).toLocaleString("pl-PL")} · {repeatLabel(schedule.repeat)}</small></div><label className="mini-check"><input type="checkbox" checked={schedule.enabled} onChange={(event) => onUpdate((current) => ({ ...current, notificationSchedules: current.notificationSchedules.map((item) => item.id === schedule.id ? { ...item, enabled: event.target.checked, updatedAt: new Date().toISOString() } : item) }))} />Aktywne</label><button className="icon-button danger" aria-label="Usuń przypomnienie" onClick={() => onUpdate((current) => ({ ...current, notificationSchedules: current.notificationSchedules.filter((item) => item.id !== schedule.id) }))}><Trash2 size={15} /></button></article>)}</div> : <EmptyState icon={Bell} title="Brak przypomnień" text="Dodaj termin nauki, powtórek albo egzaminu." />}
        </section>
      </div>
      <p className="platform-note"><Check size={14} /> Android, Windows i większość komputerów obsługują akcje powiadomień. Na iOS powiadomienia wymagają instalacji PWA na ekranie głównym; dokładność wybudzania zależy od systemu.</p>
    </div>
  );
}

async function showScheduledNotification(schedule: NotificationSchedule) {
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(schedule.title, {
      body: schedule.body,
      icon: "/icons/icon.svg",
      badge: "/icons/icon.svg",
      tag: `focus-os-${schedule.id}`,
      data: { id: schedule.id, url: "/" },
      actions: [
        { action: "start", title: "Rozpocznij" },
        { action: "snooze", title: "Odłóż 10 min" },
        { action: "done", title: "Gotowe" },
      ],
    } as NotificationOptions);
    return;
  }
  if ("Notification" in window && Notification.permission === "granted") new Notification(schedule.title, { body: schedule.body });
}

function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function repeatLabel(value: NotificationSchedule["repeat"]) {
  return value === "daily" ? "codziennie" : value === "weekly" ? "co tydzień" : "jednorazowo";
}

function base64UrlBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}
