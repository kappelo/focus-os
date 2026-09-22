"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BrainCircuit,
  Check,
  Expand,
  FastForward,
  Headphones,
  ListPlus,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  RefreshCcw,
  SkipForward,
  Volume2,
  VolumeX,
  Zap,
  X,
} from "lucide-react";
import { adaptiveFocusMinutes, sessionQuality } from "@/lib/algorithms";
import { DEFAULT_TIMER_MODES } from "@/lib/default-data";
import { createId } from "@/lib/ids";
import { breakMinutesForMode } from "@/lib/timer-phases";
import { playTimerSignal, type TimerSignal } from "@/lib/timer-signal";
import type {
  FocusSession,
  PersistedTimer,
  TimerMode,
  WorkspaceState,
} from "@/lib/types";

function initialTimer(
  mode: TimerMode = DEFAULT_TIMER_MODES[1],
): PersistedTimer {
  const seconds = Math.max(0, mode.focus) * 60;
  return {
    modeId: mode.id,
    phase: "focus",
    durationSeconds: seconds,
    remainingSeconds: mode.countUp ? 0 : seconds,
    startedAt: null,
    pausedAt: null,
    running: false,
    energy: 3,
    distractions: [],
    goal: "",
    idleSeconds: 0,
  };
}

function restoreTimer(
  value: string | null,
  fallbackMode: TimerMode,
): PersistedTimer {
  if (!value) return initialTimer(fallbackMode);
  try {
    const stored = JSON.parse(value) as Partial<PersistedTimer>;
    const fallback = initialTimer(fallbackMode);
    const durationSeconds = Number.isFinite(stored.durationSeconds)
      ? Math.max(0, Number(stored.durationSeconds))
      : fallback.durationSeconds;
    return {
      ...fallback,
      modeId: typeof stored.modeId === "string" ? stored.modeId : fallback.modeId,
      phase: stored.phase === "break" ? "break" : "focus",
      durationSeconds,
      remainingSeconds: Number.isFinite(stored.remainingSeconds)
        ? Math.max(0, Number(stored.remainingSeconds))
        : fallback.remainingSeconds,
      startedAt:
        typeof stored.startedAt === "number" && Number.isFinite(stored.startedAt)
          ? stored.startedAt
          : null,
      pausedAt:
        typeof stored.pausedAt === "number" && Number.isFinite(stored.pausedAt)
          ? stored.pausedAt
          : null,
      running: Boolean(stored.running && stored.startedAt),
      taskId: typeof stored.taskId === "string" ? stored.taskId : undefined,
      energy: [1, 2, 3, 4, 5].includes(Number(stored.energy))
        ? (Number(stored.energy) as 1 | 2 | 3 | 4 | 5)
        : 3,
      distractions: Array.isArray(stored.distractions)
        ? stored.distractions.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
      sessionStartedAt:
        typeof stored.sessionStartedAt === "string"
          ? stored.sessionStartedAt
          : undefined,
      goal: typeof stored.goal === "string" ? stored.goal.slice(0, 240) : "",
      idleSeconds: Number.isFinite(stored.idleSeconds)
        ? Math.max(0, Number(stored.idleSeconds))
        : 0,
    };
  } catch {
    return initialTimer(fallbackMode);
  }
}

export function FocusView({
  state,
  profileId,
  onUpdate,
}: {
  state: WorkspaceState;
  profileId: string;
  onUpdate: (recipe: (state: WorkspaceState) => WorkspaceState) => void;
}) {
  const availableModes = useMemo(() => {
    const enabled = state.settings.timerModes.filter(
      (item) => item.enabled !== false,
    );
    return enabled.length ? enabled : DEFAULT_TIMER_MODES;
  }, [state.settings.timerModes]);
  const preferredMode =
    availableModes.find(
      (item) => item.id === state.settings.defaultTimerMode,
    ) ?? availableModes[0];
  const storageKey = `focus-os-timer:${profileId}`;
  const [timer, setTimer] = useState<PersistedTimer>(() => {
    if (typeof window === "undefined") return initialTimer();
    try {
      const stored = localStorage.getItem(`focus-os-timer:${profileId}`);
      return restoreTimer(stored, preferredMode);
    } catch {
      return initialTimer(preferredMode);
    }
  });
  const [clock, setClock] = useState(() => Date.now());
  const [distraction, setDistraction] = useState("");
  const [customMinutes, setCustomMinutes] = useState(
    state.settings.timerModes.find((item) => item.id === "custom")?.focus ?? 35,
  );
  const [summary, setSummary] = useState<FocusSession | null>(null);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [fullscreenNotice, setFullscreenNotice] = useState("");
  const [idleNotice, setIdleNotice] = useState("");
  const [pipNotice, setPipNotice] = useState("");
  const completionLock = useRef(false);
  const lastActivity = useRef(0);
  const pipWindow = useRef<Window | null>(null);
  const signalContext = useRef<AudioContext | null>(null);
  const currentTask = state.tasks.find(
    (task) => task.id === (timer.sessionStartedAt ? timer.taskId : state.focusQueue[0]),
  );
  const mode =
    availableModes.find((item) => item.id === timer.modeId) ?? preferredMode;
  const countingUp = Boolean(mode.countUp && timer.phase === "focus");

  const displaySeconds = useMemo(() => {
    if (!timer.running || !timer.startedAt) return timer.remainingSeconds;
    const elapsed = Math.floor((clock - timer.startedAt) / 1000);
    return countingUp
      ? timer.remainingSeconds + elapsed
      : Math.max(0, timer.remainingSeconds - elapsed);
  }, [timer, clock, countingUp]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(timer)); }
    catch {
      const notice = window.setTimeout(() => setIdleNotice("Przeglądarka nie zapisała timera. Pozostaw aplikację otwartą do końca sesji."), 0);
      return () => window.clearTimeout(notice);
    }
  }, [storageKey, timer]);

  useEffect(() => () => { void signalContext.current?.close(); }, []);

  const soundTransition = useCallback((signal: TimerSignal) => {
    if (!state.settings.timerSoundEnabled) return;
    const context = signalContext.current;
    if (!context) {
      setIdleNotice("Przeglądarka zablokowała sygnał. Naciśnij Start/Pauza, aby włączyć dźwięk.");
      return;
    }
    if (context.state === "suspended") {
      void context.resume().then(() => {
        if (!playTimerSignal(context, signal, state.settings.timerSoundVolume))
          setIdleNotice("Przeglądarka zablokowała sygnał. Naciśnij Start/Pauza, aby włączyć dźwięk.");
      }).catch(() => setIdleNotice("Przeglądarka zablokowała sygnał. Naciśnij Start/Pauza, aby włączyć dźwięk."));
      return;
    }
    if (!playTimerSignal(context, signal, state.settings.timerSoundVolume))
      setIdleNotice("Przeglądarka zablokowała sygnał. Naciśnij Start/Pauza, aby włączyć dźwięk.");
  }, [state.settings.timerSoundEnabled, state.settings.timerSoundVolume]);

  useEffect(() => {
    const handleFullscreen = () =>
      setFullscreenActive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  useEffect(() => {
    if (timer.running) document.documentElement.dataset.focusActive = "true";
    else delete document.documentElement.dataset.focusActive;
    return () => {
      delete document.documentElement.dataset.focusActive;
    };
  }, [timer.running]);

  useEffect(() => {
    if (!timer.running || !state.settings.autoPauseWhenIdle) return;
    lastActivity.current = Date.now();
    const active = () => {
      lastActivity.current = Date.now();
      setIdleNotice("");
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, active, { passive: true }));
    const interval = window.setInterval(() => {
      if (Date.now() - lastActivity.current < state.settings.idleMinutes * 60_000) return;
      setTimer((current) => {
        if (!current.running || !current.startedAt) return current;
        const elapsed = Math.floor((Date.now() - current.startedAt) / 1_000);
        const remainingSeconds = countingUp
          ? current.remainingSeconds + elapsed
          : Math.max(0, current.remainingSeconds - elapsed);
        return {
          ...current,
          running: false,
          startedAt: null,
          pausedAt: Date.now(),
          remainingSeconds,
          idleSeconds: (current.idleSeconds ?? 0) + state.settings.idleMinutes * 60,
          distractions: [...current.distractions, "Automatyczna pauza — wykryto bezczynność"],
        };
      });
      setIdleNotice(`Timer zatrzymano po ${state.settings.idleMinutes} min bezczynności.`);
      lastActivity.current = Date.now();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    }, 10_000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, active));
      window.clearInterval(interval);
    };
  }, [countingUp, state.settings.autoPauseWhenIdle, state.settings.idleMinutes, timer.running]);

  useEffect(() => {
    const target = pipWindow.current?.document.querySelector("[data-pip-time]");
    if (target) target.textContent = formatTime(displaySeconds);
  }, [displaySeconds]);

  useEffect(() => {
    if (!timer.running) return;
    const interval = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [timer.running]);

  useEffect(() => {
    if (!timer.running) return;
    const title = `${formatTime(displaySeconds)} • ${currentTask?.title ?? "Focus OS"}`;
    document.title = title;
    return () => {
      document.title = "Focus OS";
    };
  }, [displaySeconds, currentTask?.title, timer.running]);

  useEffect(() => {
    if (
      !state.settings.keepScreenAwake ||
      !timer.running ||
      !("wakeLock" in navigator)
    )
      return;
    let released = false;
    let wakeLock: WakeLockSentinel | null = null;
    void navigator.wakeLock
      .request("screen")
      .then((lock) => {
        if (released) void lock.release();
        else wakeLock = lock;
      })
      .catch(() => undefined);
    return () => {
      released = true;
      if (wakeLock) void wakeLock.release();
    };
  }, [state.settings.keepScreenAwake, timer.running]);

  const finishFocus = useCallback(
    (goalCompleted = false, selfRating: 1 | 2 | 3 | 4 | 5 = 3) => {
      const activeMode =
        availableModes.find((item) => item.id === timer.modeId) ??
        preferredMode;
      const elapsedSeconds = activeMode.countUp
        ? displaySeconds
        : Math.max(0, timer.durationSeconds - displaySeconds);
      if (!timer.sessionStartedAt || elapsedSeconds < 30) {
        setTimer(initialTimer(activeMode));
        return;
      }
      const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
      const plannedMinutes = activeMode.countUp
        ? durationMinutes
        : Math.max(1, Math.round(timer.durationSeconds / 60));
      const sessionBase = {
        id: createId(),
        taskId: currentTask?.id,
        subjectId: currentTask?.subjectId,
        startedAt:
          timer.sessionStartedAt ??
          new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        durationMinutes,
        plannedMinutes,
        energy: timer.energy,
        distractions: timer.distractions,
        goalCompleted,
        selfRating,
        method: activeMode.label,
        goal: timer.goal?.trim() || currentTask?.title,
        idleSeconds: timer.idleSeconds ?? 0,
      };
      const session: FocusSession = {
        ...sessionBase,
        quality: sessionQuality(sessionBase),
      };
      onUpdate((current) => {
        const xp = Math.max(2, Math.round(durationMinutes / 5));
        return {
        ...current,
        sessions: [...current.sessions, session],
        focusQueue: currentTask
          ? current.focusQueue.filter((id) => id !== currentTask.id)
          : current.focusQueue,
        tasks: current.tasks.map((task) =>
          task.id === currentTask?.id
            ? {
                ...task,
                actualMinutes: task.actualMinutes + durationMinutes,
                completedPomodoros: task.completedPomodoros + 1,
                status: task.status === "done" ? "done" : "doing",
                updatedAt: new Date().toISOString(),
              }
            : task,
        ),
        progress: { ...current.progress, xp: current.progress.xp + xp },
        activityLog: [
          ...current.activityLog,
          {
            id: createId(),
            type: "focus" as const,
            description: `${durationMinutes} min skupienia · ${activeMode.label}`,
            xp,
            entityId: session.id,
            createdAt: session.endedAt,
          },
        ].slice(-1000),
      };});
      setSummary(session);
      if (
        state.settings.notifications &&
        "Notification" in window &&
        Notification.permission === "granted"
      )
        new Notification("Sesja ukończona", {
          body: `${durationMinutes} min · jakość ${session.quality}/100`,
        });
      if (state.settings.exitFullscreenOnPause && document.fullscreenElement)
        void document.exitFullscreen().catch(() => undefined);
      const breakMinutes = breakMinutesForMode(
        activeMode, state.sessions.length + 1,
        state.settings.longBreakAfter, state.settings.longBreakMinutes,
      );
      soundTransition(breakMinutes ? "break-start" : "focus-start");
      const autoStart = state.settings.autoStartBreak && Boolean(breakMinutes);
      setTimer({
        ...initialTimer(activeMode),
        phase: breakMinutes ? "break" : "focus",
        durationSeconds: breakMinutes * 60,
        remainingSeconds: breakMinutes * 60,
        startedAt: autoStart ? Date.now() : null,
        running: autoStart,
        taskId: state.focusQueue.find((id) => id !== currentTask?.id),
        energy: timer.energy,
      });
    },
    [
      availableModes,
      currentTask,
      displaySeconds,
      onUpdate,
      preferredMode,
      state.focusQueue,
      state.sessions,
      state.settings.autoStartBreak,
      state.settings.exitFullscreenOnPause,
      state.settings.longBreakAfter,
      state.settings.longBreakMinutes,
      state.settings.notifications,
      soundTransition,
      timer,
    ],
  );

  const finishBreak = useCallback(() => {
    soundTransition("focus-start");
    const nextMode = availableModes.find((item) => item.id === timer.modeId) ?? preferredMode;
    const autoStart = state.settings.autoStartFocus;
    setTimer({
      ...initialTimer(nextMode),
      startedAt: autoStart ? Date.now() : null,
      running: autoStart,
      taskId: timer.taskId,
      energy: timer.energy,
    });
  }, [availableModes, preferredMode, soundTransition, state.settings.autoStartFocus, timer.energy, timer.modeId, timer.taskId]);

  useEffect(() => {
    if (
      !countingUp &&
      timer.running &&
      displaySeconds === 0 &&
      !completionLock.current
    ) {
      completionLock.current = true;
      const timeout = window.setTimeout(() => {
        if (timer.phase === "focus") finishFocus();
        else finishBreak();
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    if (displaySeconds > 0) completionLock.current = false;
  }, [
    displaySeconds,
    finishBreak,
    finishFocus,
    countingUp,
    timer,
  ]);

  async function enterFullscreen() {
    setFullscreenNotice("");
    if (document.fullscreenElement) return;
    if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) {
      setFullscreenNotice(
        "Ta przeglądarka nie udostępnia pełnego ekranu dla stron. Timer nadal działa normalnie.",
      );
      return;
    }
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      setFullscreenNotice(
        "Pełny ekran został zablokowany przez przeglądarkę. Możesz użyć ręcznego przycisku u góry timera.",
      );
    }
  }

  async function leaveFullscreen() {
    if (!document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      setFullscreenNotice("Nie udało się automatycznie zamknąć pełnego ekranu.");
    }
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) await leaveFullscreen();
    else await enterFullscreen();
  }

  async function toggle() {
    const pausing = timer.running;
    if (!pausing && state.settings.timerSoundEnabled) {
      const context = signalContext.current ?? new AudioContext();
      signalContext.current = context;
      void context.resume().catch(() => setIdleNotice("Nie udało się włączyć dźwięku timera."));
    }
    if (!pausing && (state.settings.fullscreenOnTimerStart || state.settings.focusShield))
      await enterFullscreen();
    if (pausing && state.settings.exitFullscreenOnPause)
      await leaveFullscreen();
    setClock(Date.now());
    lastActivity.current = Date.now();
    setTimer((current) =>
      current.running
        ? {
            ...current,
            running: false,
            remainingSeconds: displaySeconds,
            startedAt: null,
            pausedAt: Date.now(),
          }
        : {
            ...current,
            running: true,
            startedAt: Date.now(),
            pausedAt: null,
            sessionStartedAt:
              current.sessionStartedAt ??
              (current.phase === "focus"
                ? new Date().toISOString()
                : undefined),
          },
    );
  }

  async function openPictureInPicture() {
    setPipNotice("");
    const api = (window as unknown as {
      documentPictureInPicture?: { requestWindow: (options: { width: number; height: number }) => Promise<Window> };
    }).documentPictureInPicture;
    if (!api) {
      setPipNotice("Małe okno timera wymaga przeglądarki Chromium z obsługą Document Picture-in-Picture.");
      return;
    }
    try {
      pipWindow.current?.close();
      const target = await api.requestWindow({ width: 330, height: 190 });
      target.document.title = "Focus OS — timer";
      const style = target.document.createElement("style");
      style.textContent = "body{margin:0;display:grid;place-items:center;min-height:100vh;background:#171a16;color:#f8faf4;font-family:system-ui;text-align:center}small{color:#aeb8a8;text-transform:uppercase;letter-spacing:.14em}strong{display:block;font-size:3.3rem;font-variant-numeric:tabular-nums;margin:.25rem}span{font-size:.95rem;color:#d5dbd0;max-width:290px;display:block}";
      const wrap = target.document.createElement("main");
      const phase = target.document.createElement("small");
      phase.textContent = timer.phase === "focus" ? "Skupienie" : "Przerwa";
      const time = target.document.createElement("strong");
      time.dataset.pipTime = "true";
      time.textContent = formatTime(displaySeconds);
      const label = target.document.createElement("span");
      label.textContent = timer.goal?.trim() || currentTask?.title || "Focus OS";
      wrap.append(phase, time, label);
      target.document.head.append(style);
      target.document.body.replaceChildren(wrap);
      target.addEventListener("pagehide", () => { pipWindow.current = null; }, { once: true });
      pipWindow.current = target;
    } catch {
      setPipNotice("Przeglądarka nie pozwoliła otworzyć małego okna timera.");
    }
  }

  function reset() {
    const minutes =
      timer.phase === "focus"
        ? mode.id === "custom"
          ? customMinutes
          : mode.focus
        : mode.break;
    setTimer({
      ...initialTimer(mode),
      phase: timer.phase,
      durationSeconds: minutes * 60,
      remainingSeconds: mode.countUp && timer.phase === "focus" ? 0 : minutes * 60,
      taskId: currentTask?.id,
      energy: timer.energy,
    });
  }

  function selectMode(nextMode: TimerMode) {
    const minutes = nextMode.id === "custom" ? customMinutes : nextMode.focus;
    setTimer({
      ...initialTimer(nextMode),
      durationSeconds: minutes * 60,
      remainingSeconds: nextMode.countUp ? 0 : minutes * 60,
      taskId: currentTask?.id,
      energy: timer.energy,
    });
  }

  function addDistraction() {
    if (!distraction.trim()) return;
    setTimer((current) => ({
      ...current,
      distractions: [...current.distractions, distraction.trim()],
    }));
    setDistraction("");
  }

  async function enableNotifications() {
    if ("Notification" in window) await Notification.requestPermission();
  }

  const progress = countingUp
    ? 0
    : 1 - displaySeconds / Math.max(1, timer.durationSeconds);
  return (
    <div
      className={`focus-page ${state.settings.minimalFocusMode && timer.running ? "minimal-focus" : ""}`}
    >
      <section className="focus-main panel">
        <div className="focus-topline">
          <span className={`phase-pill ${timer.phase}`}>
            {timer.phase === "focus"
              ? "Tryb skupienia"
              : "Przerwa regeneracyjna"}
          </span>
          <div>
            <button
              className="icon-button"
              onClick={enableNotifications}
              aria-label="Włącz powiadomienia"
            >
              <Bell size={18} />
            </button>
            <button
              className="icon-button"
              onClick={() => void toggleFullscreen()}
              aria-label={fullscreenActive ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}
              title={fullscreenActive ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}
            >
              <Expand size={18} />
            </button>
          </div>
        </div>
        <div className="mode-strip">
          {availableModes.map((item) => (
            <button
              key={item.id}
              className={mode.id === item.id ? "active" : ""}
              onClick={() => selectMode(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="focus-break-config">
          <label>Przerwa w trybie {mode.label}
            <span><input type="number" min="0" max="120" step="1" value={mode.break}
              onChange={(event) => {
                const minutes = Math.min(120, Math.max(0, Number(event.target.value) || 0));
                onUpdate((current) => ({ ...current, settings: {
                  ...current.settings,
                  timerModes: current.settings.timerModes.map((item) =>
                    item.id === mode.id ? { ...item, break: minutes } : item),
                } }));
              }} /> min</span>
          </label>
          <small>Po {state.settings.longBreakAfter} sesjach obowiązuje długa przerwa: {state.settings.longBreakMinutes} min. Możesz to zmienić w ustawieniach.</small>
        </div>
        {mode.id === "custom" ? (
          <label className="custom-time">
            Czas sesji{" "}
            <input
              type="number"
              min="1"
              max="240"
              value={customMinutes}
              onChange={(event) => {
                const value = Math.min(
                  240,
                  Math.max(1, Number(event.target.value) || 1),
                );
                setCustomMinutes(value);
                setTimer((current) => ({
                  ...current,
                  durationSeconds: value * 60,
                  remainingSeconds: value * 60,
                }));
              }}
            />{" "}
            min
          </label>
        ) : null}
        {fullscreenNotice ? (
          <p className="focus-browser-notice" role="status">
            {fullscreenNotice}
          </p>
        ) : null}
        {idleNotice || pipNotice ? <p className="focus-browser-notice" role="status">{idleNotice || pipNotice}</p> : null}
        <label className="session-goal">
          Cel tej sesji
          <input
            value={timer.goal ?? ""}
            onChange={(event) => setTimer((current) => ({ ...current, goal: event.target.value.slice(0, 240) }))}
            placeholder={currentTask?.title ?? "Co ma być gotowe po tej sesji?"}
          />
        </label>
        <div className="timer-wrap">
          <svg className="timer-ring" viewBox="0 0 280 280" aria-hidden="true">
            <circle cx="140" cy="140" r="126" />
            <circle
              className="timer-progress"
              cx="140"
              cy="140"
              r="126"
              pathLength="100"
              style={{ strokeDashoffset: 100 - progress * 100 }}
            />
          </svg>
          <div className="timer-copy">
            <small>{timer.phase === "focus" ? "POZOSTAŁO" : "ODPOCZNIJ"}</small>
            <strong>{formatTime(displaySeconds)}</strong>
            <span>
              {currentTask?.title ?? "Sesja bez przypisanego zadania"}
            </span>
          </div>
        </div>
        <div className="timer-actions">
          <button
            className="icon-button"
            onClick={reset}
            aria-label="Resetuj timer"
          >
            <RefreshCcw size={20} />
          </button>
          {state.settings.showPictureInPicture ? (
            <button className="icon-button" onClick={() => void openPictureInPicture()} aria-label="Otwórz mały timer" title="Mały timer Picture-in-Picture">
              <PictureInPicture2 size={20} />
            </button>
          ) : null}
          <button className="timer-primary" onClick={() => void toggle()}>
            {timer.running ? (
              <Pause size={25} fill="currentColor" />
            ) : (
              <Play size={25} fill="currentColor" />
            )}
            <span>{timer.running ? "Pauza" : "Start"}</span>
          </button>
          <button
            className="icon-button"
            onClick={() =>
              setTimer((current) => ({
                ...current,
                remainingSeconds:
                  current.remainingSeconds + (mode.countUp ? 0 : 300),
                durationSeconds:
                  current.durationSeconds + (mode.countUp ? 0 : 300),
              }))
            }
            aria-label="Dodaj pięć minut"
          >
            <Plus size={20} />
          </button>
          <button
            className="icon-button"
            onClick={() =>
              timer.phase === "focus" ? finishFocus(false, 3) : finishBreak()
            }
            aria-label="Pomiń etap"
          >
            <SkipForward size={20} />
          </button>
        </div>
        <div className="energy-select">
          <span>Energia przed sesją</span>
          <div>
            {[1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                className={timer.energy === level ? "active" : ""}
                onClick={() =>
                  setTimer((current) => {
                    const energy = level as 1 | 2 | 3 | 4 | 5;
                    if (!state.settings.adaptiveFocusDuration || current.running || current.phase !== "focus" || mode.countUp)
                      return { ...current, energy };
                    const minutes = adaptiveFocusMinutes(state.sessions, energy, mode.focus || 25);
                    return { ...current, energy, durationSeconds: minutes * 60, remainingSeconds: minutes * 60 };
                  })
                }
              >
                {level}
              </button>
            ))}
          </div>
          {state.settings.adaptiveFocusDuration && !mode.countUp ? (
            <small className="adaptive-hint"><Zap size={13} /> Czas dopasowuje się do energii i jakości ostatnich sesji.</small>
          ) : null}
        </div>
      </section>

      <aside className="focus-sidebar">
        <section className="panel distraction-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">PARKING MYŚLI</p>
              <h2>Rozproszenia</h2>
            </div>
            <span>{timer.distractions.length}</span>
          </div>
          <p>Zapisz myśl i spokojnie wróć do zadania.</p>
          <div className="inline-form">
            <input
              value={distraction}
              onChange={(event) => setDistraction(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addDistraction()}
              placeholder="np. sprawdzić wiadomość"
            />
            <button
              className="icon-button"
              onClick={addDistraction}
              aria-label="Dodaj rozproszenie"
            >
              <ListPlus size={18} />
            </button>
          </div>
          <div className="distraction-list">
            {timer.distractions.map((item, index) => (
              <span key={`${item}-${index}`}>
                {item}
                <button
                  aria-label="Usuń"
                  onClick={() =>
                    setTimer((current) => ({
                      ...current,
                      distractions: current.distractions.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        </section>
        <SoundMixer />
        <section className="panel next-task">
          <p className="eyebrow">NASTĘPNIE</p>
          {state.focusQueue.slice(1, 3).map((id) => {
            const task = state.tasks.find((item) => item.id === id);
            return task ? (
              <div key={id}>
                <FastForward size={16} />
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.estimateMinutes} min</small>
                </span>
              </div>
            ) : null;
          })}
          {state.focusQueue.length <= 1 ? (
            <p>Dodaj kolejne zadania do kolejki Focus.</p>
          ) : null}
        </section>
      </aside>

      {summary ? (
        <div className="session-summary panel">
          <button className="icon-button" aria-label="Zamknij podsumowanie" onClick={() => setSummary(null)}>
            <X size={18} />
          </button>
          <span className="summary-score">{summary.quality}</span>
          <div>
            <p className="eyebrow">JAKOŚĆ SESJI</p>
            <h2>Dobra robota. Sesja zapisana.</h2>
            <p>
              {summary.durationMinutes} min skupienia ·{" "}
              {summary.distractions.length} rozproszeń · energia{" "}
              {summary.energy}/5
            </p>
            {summary.goal ? <small>Cel: {summary.goal}</small> : null}
            <label>Jak oceniasz skupienie?
              <select value={summary.selfRating} onChange={(event) => {
                const selfRating = Number(event.target.value) as FocusSession["selfRating"];
                const updated = { ...summary, selfRating, quality: sessionQuality({ ...summary, selfRating }) };
                setSummary(updated);
                onUpdate((current) => ({ ...current, sessions: current.sessions.map((session) => session.id === updated.id ? updated : session) }));
              }}>{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</select>
            </label>
            <label className="summary-goal-check"><input type="checkbox" checked={summary.goalCompleted} onChange={(event) => {
              const goalCompleted = event.target.checked;
              const updated = { ...summary, goalCompleted, quality: sessionQuality({ ...summary, goalCompleted }) };
              setSummary(updated);
              onUpdate((current) => ({ ...current, sessions: current.sessions.map((session) => session.id === updated.id ? updated : session) }));
            }} />Cel tej sesji został osiągnięty</label>
          </div>
          <Check size={24} />
        </div>
      ) : null}
    </div>
  );
}

function formatTime(seconds: number) {
  const value = Math.max(0, seconds);
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

const SOUNDS = [
  { id: "rain", label: "Deszcz", file: "/audio/rain.ogg" },
  { id: "storm", label: "Deszcz i grzmot", file: "/audio/thunder.wav" },
  { id: "forest", label: "Las", file: "/audio/forest.mp3" },
  { id: "birds", label: "Ptaki", file: "/audio/birds.ogg" },
  { id: "stream", label: "Płynąca woda", file: "/audio/waterflow.mp3" },
  { id: "fireplace", label: "Trzaskający ogień", file: "/audio/fireplace.ogg" },
] as const;
type SoundId = (typeof SOUNDS)[number]["id"];
const PRESETS: { label: string; sounds: SoundId[] }[] = [
  { label: "Deszczowy las", sounds: ["rain", "forest", "birds"] },
  { label: "Leśny strumień", sounds: ["forest", "birds", "stream"] },
  { label: "Deszcz przy kominku", sounds: ["fireplace", "rain"] },
];

function SoundMixer() {
  const live = useRef(new Map<SoundId, HTMLAudioElement>());
  const [active, setActive] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  useEffect(() => () => {
    for (const audio of live.current.values()) audio.pause();
    live.current.clear();
  }, []);

  function stop(name: SoundId) {
    const audio = live.current.get(name);
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    live.current.delete(name);
    setActive((current) => { const next = { ...current }; delete next[name]; return next; });
  }

  function start(name: SoundId, volume = 0.24) {
    const sound = SOUNDS.find((item) => item.id === name)!;
    const audio = new Audio(sound.file);
    audio.loop = true;
    audio.volume = volume;
    live.current.set(name, audio);
    setError("");
    void audio.play().then(() => {
      if (live.current.get(name) === audio) setActive((current) => ({ ...current, [name]: volume }));
    }).catch(() => {
      if (live.current.get(name) === audio) {
        live.current.delete(name);
        setError(`Nie udało się odtworzyć: ${sound.label}. Sprawdź dostępność pliku lub ustawienia dźwięku.`);
      }
    });
  }

  function toggle(name: SoundId, volume = 0.24) {
    if (live.current.has(name)) stop(name);
    else start(name, volume);
  }

  function setVolume(name: SoundId, volume: number) {
    const channel = live.current.get(name);
    if (channel) channel.volume = volume;
    setActive((current) => ({ ...current, [name]: volume }));
  }

  function applyPreset(names: SoundId[]) {
    for (const name of [...live.current.keys()])
      if (!names.includes(name)) stop(name);
    for (const name of names) if (!live.current.has(name)) start(name, 0.18);
  }

  return (
    <section className="panel sound-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            <Headphones size={13} /> SOUNDSCAPE
          </p>
          <h2>Mikser skupienia</h2>
        </div>
        <button
          className="icon-button"
          onClick={() => {
            for (const name of [...live.current.keys()]) stop(name);
          }}
          aria-label="Wycisz wszystko"
        >
          <VolumeX size={18} />
        </button>
      </div>
      <div className="preset-row">
        {PRESETS.map(({ label, sounds }) => (
            <button key={label} onClick={() => applyPreset(sounds)}>
              {label}
            </button>
          ))}
      </div>
      <div className="sound-grid expanded">
        {SOUNDS.map(({ id, label }) => (
          <button
            key={id}
            className={id in active ? "active" : ""}
            onClick={() => toggle(id)}
            aria-pressed={id in active}
          >
            <Volume2 size={15} />
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="focus-browser-notice" role="alert">{error}</p> : null}
      {SOUNDS.filter(({ id }) => id in active).map(({ id, label }) => (
        <label className="volume-row" key={id}>
          <span>{label}</span>
          <input
            aria-label={`Głośność: ${label}`}
            type="range"
            min="0"
            max="0.5"
            step="0.01"
            value={active[id]}
            onChange={(event) => setVolume(id, Number(event.target.value))}
          />
        </label>
      ))}
    </section>
  );
}
