"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare2,
  Cloud,
  CloudOff,
  Command,
  Home,
  Leaf,
  ListTodo,
  LockKeyhole,
  LogOut,
  Menu,
  MoreHorizontal,
  RefreshCw,
  TimerReset,
  Wifi,
} from "lucide-react";
import { AuthScreen } from "@/components/auth-screen";
import { CommandPalette } from "@/components/command-palette";
import { Dashboard } from "@/components/views/dashboard";
import { FocusView } from "@/components/views/focus-view";
import { LearnView } from "@/components/views/learn-view";
import { MoreView } from "@/components/views/more-view";
import { PlannerView } from "@/components/views/planner-view";
import { TasksView } from "@/components/views/tasks-view";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { NotificationScheduler } from "@/components/notification-center";
import { AppLock } from "@/components/app-lock";
import {
  listProfiles,
  connectLocalProfile,
  loadWorkspace,
  mergeWorkspaces,
  prepareWorkspaceUpdate,
  restoreWorkspaceRevision,
  saveWorkspace,
  syncWorkspace,
} from "@/lib/storage";
import type { LocalProfile, ViewId, WorkspaceState } from "@/lib/types";

const navigation: { id: ViewId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Dzisiaj", icon: Home },
  { id: "tasks", label: "Zadania", icon: CheckSquare2 },
  { id: "focus", label: "Skupienie", icon: TimerReset },
  { id: "learn", label: "Nauka", icon: BookOpen },
  { id: "planner", label: "Planer", icon: CalendarDays },
  { id: "more", label: "Więcej", icon: MoreHorizontal },
];
const AUTO_SESSION_BLOCK_KEY = "focus-os-disable-auto-session";

function syncErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return message && message !== "Failed to fetch"
    ? message
    : "Nie można połączyć się z serwerem synchronizacji.";
}

function automaticSessionRestoreBlocked() {
  try {
    return window.localStorage.getItem(AUTO_SESSION_BLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function clearAutomaticSessionRestoreBlock() {
  try {
    window.localStorage.removeItem(AUTO_SESSION_BLOCK_KEY);
  } catch {
    // Storage can be unavailable in restrictive browser modes.
  }
}

function blockAutomaticSessionRestore() {
  try {
    window.localStorage.setItem(AUTO_SESSION_BLOCK_KEY, "1");
  } catch {
    // The server-side logout below still clears the cookie when reachable.
  }
}

function viewFromUrl(fallback: ViewId) {
  if (typeof window === "undefined") return fallback;
  const requested = new URLSearchParams(window.location.search).get("view");
  return navigation.some((item) => item.id === requested)
    ? (requested as ViewId)
    : fallback;
}

export function AppShell() {
  const [profiles, setProfiles] = useState<LocalProfile[] | null>(null);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [view, setView] = useState<ViewId>("home");
  const [palette, setPalette] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [now, setNow] = useState(() => Date.now());
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "synced" | "error"
  >("idle");
  const [syncError, setSyncError] = useState("");
  const [notice, setNotice] = useState("");
  const [lockSignal, setLockSignal] = useState(0);
  const workspaceRef = useRef<WorkspaceState | null>(null);
  const profileRef = useRef<LocalProfile | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    const restoreView = () => { setView(viewFromUrl("home")); setSidebarOpen(false); };
    window.addEventListener("popstate", restoreView);
    return () => { window.clearInterval(tick); window.removeEventListener("popstate", restoreView); };
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, select, [contenteditable='true']");
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((open) => !open);
      } else if (!typing && event.key === "/") {
        event.preventDefault();
        setPalette(true);
      } else if (!typing && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setPalette(true);
      } else if (!typing && event.key.toLowerCase() === "f") {
        event.preventDefault();
        const url = new URL(window.location.href);
        url.searchParams.set("view", "focus");
        url.hash = "";
        window.history.pushState({}, "", url);
        setView("focus");
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!profile || !workspace) return;
    const timeout = window.setTimeout(
      () => void saveWorkspace(profile.id, workspace).catch(() => setNotice("Nie udało się zapisać danych na urządzeniu. Sprawdź wolne miejsce i ustawienia pamięci przeglądarki.")),
      180,
    );
    return () => window.clearTimeout(timeout);
  }, [profile, workspace]);

  useEffect(() => {
    workspaceRef.current = workspace;
    profileRef.current = profile;
  }, [profile, workspace]);

  const theme = workspace?.settings.theme;
  const accent = workspace?.settings.accent;
  const fontScale = workspace?.settings.fontScale;
  const density = workspace?.settings.density;
  const reducedMotion = workspace?.settings.reducedMotion;
  useEffect(() => {
    if (!theme) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const hour = new Date().getHours();
      const resolved =
        theme === "auto"
          ? hour >= 20 || hour < 7
            ? "dark"
            : "light"
          : theme === "system"
            ? media.matches
              ? "dark"
              : "light"
            : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.accent = accent ?? "sage";
      document.documentElement.dataset.fontScale = fontScale ?? "comfortable";
      document.documentElement.dataset.density = density ?? "comfortable";
      document.documentElement.dataset.reducedMotion = String(
        reducedMotion ?? false,
      );
      document.documentElement.style.colorScheme =
        resolved === "dark" || resolved === "contrast" ? "dark" : "light";
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [accent, density, fontScale, reducedMotion, theme]);

  const updateWorkspace = useCallback(
    (recipe: (current: WorkspaceState) => WorkspaceState) => {
      setWorkspace((current) => {
        if (!current) return current;
        const next = recipe(current);
        const prepared = prepareWorkspaceUpdate(current, next);
        workspaceRef.current = prepared;
        return prepared;
      });
    },
    [],
  );

  const authenticate = useCallback(async (nextProfile: LocalProfile, nextNotice?: string) => {
    clearAutomaticSessionRestoreBlock();
    let nextWorkspace = await loadWorkspace(nextProfile.id);
    let syncFailure = "";
    if (nextProfile.serverLinked && navigator.onLine) {
      try {
        setSyncStatus("syncing");
        setSyncError("");
        nextWorkspace = await syncWorkspace(
          nextWorkspace,
          nextProfile.serverUserId ?? nextProfile.id,
        );
        await saveWorkspace(nextProfile.id, nextWorkspace);
        setSyncStatus("synced");
      } catch (error) {
        syncFailure = syncErrorMessage(error);
        setSyncStatus("error");
        setSyncError(syncFailure);
      }
    }
    profileRef.current = nextProfile;
    workspaceRef.current = nextWorkspace;
    setProfile(nextProfile);
    setWorkspace(nextWorkspace);
    setView(viewFromUrl(nextWorkspace.settings.defaultView));
    setProfiles((current) =>
      current?.some((item) => item.id === nextProfile.id)
        ? current
        : [...(current ?? []), nextProfile],
    );
    const messages = [nextNotice, syncFailure ? `Synchronizacja oczekuje: ${syncFailure}` : ""]
      .filter(Boolean)
      .join(" ");
    if (messages) setNotice(messages);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);

    async function restoreSession() {
      let savedProfiles: LocalProfile[] = [];
      try {
        savedProfiles = await listProfiles();
      } catch {
        // A login can still explain a storage problem to the user.
      }
      if (!active) return;

      if (!automaticSessionRestoreBlocked()) {
        try {
          const response = await fetch("/api/auth/me", {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          });
          const data = (await response.json().catch(() => ({}))) as {
            user?: { id: string; username: string; name: string; role: "user" | "admin" };
          };
          const matchingProfile = data.user
            ? savedProfiles.find(
                (candidate) =>
                  candidate.serverLinked &&
                  (candidate.serverUserId === data.user?.id ||
                    candidate.username === data.user?.username),
              )
            : undefined;
          if (response.ok && data.user && matchingProfile && active) {
            await authenticate(
              {
                ...matchingProfile,
                name: data.user.name,
                role: data.user.role,
                serverUserId: data.user.id,
              },
            );
            return;
          }
        } catch {
          // Offline mode is supported; show the local profile chooser below.
        }
      }

      if (active) setProfiles(savedProfiles);
    }

    void restoreSession();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [authenticate]);

  const syncNow = useCallback(
    async (announce = true) => {
      const snapshot = workspaceRef.current;
      const activeProfile = profileRef.current;
      if (
        !snapshot ||
        !activeProfile ||
        !activeProfile.serverLinked ||
        !online ||
        syncingRef.current
      )
        return;
      syncingRef.current = true;
      setSyncing(true);
      setSyncStatus("syncing");
      setSyncError("");
      try {
        const cloudResult = await syncWorkspace(
          snapshot,
          activeProfile.serverUserId ?? activeProfile.id,
        );
        const latest = workspaceRef.current;
        const result =
          latest && latest.version > snapshot.version
            ? mergeWorkspaces(latest, cloudResult)
            : cloudResult;
        workspaceRef.current = result;
        setWorkspace(result);
        await saveWorkspace(activeProfile.id, result);
        setSyncStatus("synced");
        if (announce) setNotice("Dane zapisano w SQLite i zsynchronizowano.");
      } catch (error) {
        const message = syncErrorMessage(error);
        setSyncStatus("error");
        setSyncError(message);
        if (announce)
          setNotice(`Zmiany są bezpieczne lokalnie. Synchronizacja oczekuje: ${message}`);
      } finally {
        syncingRef.current = false;
        setSyncing(false);
      }
    },
    [online],
  );

  const restoreRevision = useCallback(
    async (revision: number) => {
      const activeProfile = profileRef.current;
      if (!activeProfile?.serverLinked) throw new Error("Profil nie jest połączony z serwerem");
      setSyncing(true);
      setSyncStatus("syncing");
      setSyncError("");
      try {
        const restored = await restoreWorkspaceRevision(
          revision,
          activeProfile.serverUserId ?? activeProfile.id,
        );
        workspaceRef.current = restored;
        setWorkspace(restored);
        await saveWorkspace(activeProfile.id, restored);
        setSyncStatus("synced");
        setNotice(`Przywrócono rewizję #${revision}.`);
      } catch (error) {
        setSyncStatus("error");
        setSyncError(syncErrorMessage(error));
        throw error;
      } finally {
        setSyncing(false);
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    blockAutomaticSessionRestore();
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
    } finally {
      profileRef.current = null;
      workspaceRef.current = null;
      setProfile(null);
      setWorkspace(null);
      setSyncStatus("idle");
      setSyncError("");
      setSidebarOpen(false);
    }
  }, []);

  const persistChangedPin = useCallback(async (pin: string) => {
    const activeProfile = profileRef.current;
    if (!activeProfile?.serverLinked || !activeProfile.serverUserId) {
      throw new Error("Nie udało się zaktualizować lokalnego profilu");
    }
    const updated = await connectLocalProfile(activeProfile, pin, {
      id: activeProfile.serverUserId,
      name: activeProfile.name,
      role: activeProfile.role,
    });
    profileRef.current = updated;
    setProfile(updated);
    setProfiles((current) => current?.map((item) => item.id === updated.id ? updated : item) ?? [updated]);
  }, []);

  const autoSync = workspace?.settings.autoSync ?? false;
  const syncIntervalSeconds = workspace?.settings.syncIntervalSeconds ?? 30;
  const workspaceVersion = workspace?.version ?? 0;
  const serverLinked = profile?.serverLinked ?? false;

  useEffect(() => {
    if (!autoSync || !serverLinked || !online) return;
    const timeout = window.setTimeout(() => void syncNow(false), 1_200);
    return () => window.clearTimeout(timeout);
  }, [autoSync, online, serverLinked, syncNow, workspaceVersion]);

  useEffect(() => {
    if (!autoSync || !serverLinked || !online) return;
    const interval = window.setInterval(
      () => void syncNow(false),
      Math.max(15, syncIntervalSeconds) * 1_000,
    );
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void syncNow(false);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [autoSync, online, serverLinked, syncIntervalSeconds, syncNow]);

  function navigate(next: ViewId) {
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    if (next !== "more") url.hash = "";
    if (url.href !== window.location.href) window.history.pushState(null, "", url);
    setView(next);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  const dueReviews = useMemo(
    () =>
      workspace?.flashcards.filter(
        (card) => !card.suspended && new Date(card.dueAt).getTime() <= now,
      ).length ?? 0,
    [workspace, now],
  );

  if (profiles === null)
    return (
      <div className="boot-screen">
        <span className="brand-mark">
          <Leaf size={24} />
        </span>
        <p>Przygotowujemy Twój workspace…</p>
      </div>
    );
  if (!profile || !workspace)
    return <AuthScreen profiles={profiles} onSuccess={authenticate} />;

  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">Przejdź do treści</a>
      <ServiceWorkerRegistration />
      <NotificationScheduler
        state={workspace}
        onUpdate={updateWorkspace}
        onSyncRequest={() => void syncNow(false)}
      />
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">
            <Leaf size={20} />
          </span>
          <span>Focus OS</span>
        </div>
        <nav className="side-nav" aria-label="Główna nawigacja">
          {navigation.slice(0, 5).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                aria-current={view === item.id ? "page" : undefined}
                className={view === item.id ? "active" : ""}
                onClick={() => navigate(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.id === "learn" && dueReviews ? <b>{dueReviews}</b> : null}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-section-label">SYSTEM</div>
        <nav className="side-nav">
          <button
            className={view === "more" ? "active" : ""}
            onClick={() => navigate("more")}
          >
            <BarChart3 size={19} />
            <span>Analityka i więcej</span>
          </button>
          <button onClick={() => setPalette(true)}>
            <Command size={19} />
            <span>Paleta poleceń</span>
            <kbd>⌘K</kbd>
          </button>
        </nav>
        <div className="sidebar-footer">
          <button className="profile-chip" onClick={() => navigate("more")}>
            <span>{profile.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{profile.name}</strong>
              <small>@{profile.username}</small>
            </div>
          </button>
          <button
            className="icon-button"
            aria-label="Wyloguj"
            title="Wyloguj"
            onClick={() => void signOut()}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Otwórz menu"
          >
            <Menu size={20} />
          </button>
          <div className="topbar-title">
            <strong>
              {navigation.find((item) => item.id === view)?.label ?? "Focus OS"}
            </strong>
            <span>
              {new Date().toLocaleDateString("pl-PL", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
          </div>
          <div className="topbar-actions">
            <span className={`connection-pill ${online ? "online" : ""}`}>
              {online ? <Wifi size={14} /> : <CloudOff size={14} />}
              {online ? "Online" : "Offline"}
            </span>
            <button
              className="icon-button"
              aria-label="Zablokuj aplikację"
              title={workspace.settings.appLockEnabled ? "Zablokuj aplikację" : "Włącz blokadę w ustawieniach"}
              disabled={!workspace.settings.appLockEnabled}
              onClick={() => setLockSignal((value) => value + 1)}
            >
              <LockKeyhole size={17} />
            </button>
            <button
              className="sync-button"
              onClick={() => void syncNow(true)}
              disabled={!profile.serverLinked || !online || syncing}
              title={
                !profile.serverLinked
                  ? "Profil działa tylko lokalnie"
                  : syncStatus === "error" && syncError
                    ? syncError
                    : "Synchronizuj"
              }
            >
              {syncing ? (
                <RefreshCw className="spin" size={17} />
              ) : (
                <Cloud size={17} />
              )}
              <span>
                {syncing
                  ? "Synchronizacja"
                  : syncStatus === "synced"
                    ? "Zapisano"
                    : syncStatus === "error"
                      ? "Oczekuje"
                      : "Synchronizuj"}
              </span>
            </button>
            <button
              className="command-trigger"
              aria-label="Szukaj w aplikacji"
              onClick={() => setPalette(true)}
            >
              <Command size={17} /> <span>Szukaj</span>
              <kbd>⌘K</kbd>
            </button>
            <button
              className="icon-button topbar-logout"
              aria-label="Wyloguj"
              title="Wyloguj"
              onClick={() => void signOut()}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <main className="view-container" id="main-content" tabIndex={-1}>
          {view === "home" ? (
            <Dashboard
              state={workspace}
              name={profile.name}
              onNavigate={navigate}
              onEditShortcuts={() => {
                window.location.hash = "shortcuts";
                navigate("more");
              }}
              onUpdate={updateWorkspace}
            />
          ) : null}
          {view === "tasks" ? (
            <TasksView
              state={workspace}
              onUpdate={updateWorkspace}
              onStart={(taskId) => {
                updateWorkspace((state) => ({
                  ...state,
                  focusQueue: [
                    taskId,
                    ...state.focusQueue.filter((id) => id !== taskId),
                  ],
                  tasks: state.tasks.map((task) =>
                    task.id === taskId
                      ? {
                          ...task,
                          status: "doing",
                          updatedAt: new Date().toISOString(),
                        }
                      : task,
                  ),
                }));
                navigate("focus");
              }}
            />
          ) : null}
          <div hidden={view !== "focus"}>
            <FocusView
              state={workspace}
              profileId={profile.id}
              onUpdate={updateWorkspace}
            />
          </div>
          {view === "learn" ? (
            <LearnView state={workspace} onUpdate={updateWorkspace} />
          ) : null}
          {view === "planner" ? (
            <PlannerView state={workspace} onUpdate={updateWorkspace} />
          ) : null}
          {view === "more" ? (
            <MoreView
              state={workspace}
              profile={profile}
              onUpdate={updateWorkspace}
              syncing={syncing}
              syncStatus={syncStatus}
              syncError={syncError}
              onSync={() => void syncNow(true)}
              onRestoreRevision={restoreRevision}
              onPinChanged={persistChangedPin}
            />
          ) : null}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Nawigacja mobilna">
        {navigation
          .filter((item) => item.id !== "planner")
          .map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={view === item.id ? "active" : ""}
                onClick={() => navigate(item.id)}
              >
                <Icon size={21} />
                <span>
                  {item.id === "home"
                    ? "Dzisiaj"
                    : item.id === "tasks"
                      ? "Zadania"
                      : item.id === "focus"
                        ? "Skupienie"
                        : item.id === "learn"
                          ? "Nauka"
                          : "Więcej"}
                </span>
              </button>
            );
          })}
      </nav>
      {sidebarOpen ? (
        <button
          className="sidebar-scrim"
          aria-label="Zamknij menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      {palette ? (
        <CommandPalette
          state={workspace}
          onUpdate={updateWorkspace}
          onClose={() => setPalette(false)}
          onNavigate={navigate}
        />
      ) : null}
      {notice ? (
        <div className="toast" role="status">
          <ListTodo size={18} />
          {notice}
        </div>
      ) : null}
      <AppLock key={lockSignal} profile={profile} settings={workspace.settings} lockSignal={lockSignal} />
    </div>
  );
}
