import { openDB, type DBSchema } from "idb";
import { createDefaultWorkspace } from "@/lib/default-data";
import { createId, randomBytes } from "@/lib/ids";
import type {
  LocalProfile,
  SyncCollection,
  SyncTombstone,
  WorkspaceSettings,
  WorkspaceState,
} from "@/lib/types";

interface FocusDb extends DBSchema {
  profiles: { key: string; value: LocalProfile; indexes: { username: string } };
  workspaces: { key: string; value: WorkspaceState };
}

type WorkspaceInput = Partial<Omit<WorkspaceState, "settings">> & {
  settings?: Partial<WorkspaceSettings>;
};

export type DeviceDescriptor = {
  id: string;
  name: string;
  kind: "mobile" | "tablet" | "laptop" | "desktop";
  platform: string;
  appVersion: string;
};

const LEGACY_DEVICE_STORAGE_KEY = "focus-os-device";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SYNC_COLLECTIONS: SyncCollection[] = [
  "tasks",
  "subjects",
  "flashcards",
  "exams",
  "calendar",
  "habits",
  "sessions",
  "materials",
  "studyRuns",
  "reviewActivity",
  "flashcardReviews",
  "projects",
  "quizzes",
  "quizAttempts",
  "mistakes",
  "studyNotes",
  "journalEntries",
  "challenges",
  "rewards",
  "notificationSchedules",
  "trash",
  "activityLog",
];

function numberWithin(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}

const dbPromise =
  typeof window === "undefined"
    ? null
    : openDB<FocusDb>("focus-os", 2, {
        upgrade(db, oldVersion, _newVersion, transaction) {
          if (oldVersion === 0) {
            const profiles = db.createObjectStore("profiles", {
              keyPath: "id",
            });
            profiles.createIndex("username", "username", { unique: true });
            db.createObjectStore("workspaces");
          }
          if (oldVersion > 0 && oldVersion < 2) {
            transaction.objectStore("profiles").clear();
            transaction.objectStore("workspaces").clear();
          }
        },
      });

function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

async function derivePin(pin: string, salt: Uint8Array) {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.subtle) {
    try {
      const material = await cryptoApi.subtle.importKey(
        "raw",
        new TextEncoder().encode(pin),
        "PBKDF2",
        false,
        ["deriveBits"],
      );
      const bits = await cryptoApi.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: salt as BufferSource,
          iterations: 120_000,
          hash: "SHA-256",
        },
        material,
        256,
      );
      return encode(new Uint8Array(bits));
    } catch {
      // Some mobile browsers expose `crypto` over HTTP but deny SubtleCrypto.
    }
  }
  return `compat-v1:${compatibilityPinHash(pin, salt)}`;
}

function compatibilityPinHash(pin: string, salt: Uint8Array) {
  const input = `${pin}:${encode(salt)}`;
  let first = 0x811c9dc5;
  let second = 0x01000193;
  for (let round = 0; round < 18_000; round += 1) {
    for (let index = 0; index < input.length; index += 1) {
      const value = input.charCodeAt(index) + round;
      first = Math.imul(first ^ value, 0x01000193);
      second = Math.imul(second ^ (value + first), 0x45d9f3b);
    }
  }
  return `${(first >>> 0).toString(16)}${(second >>> 0).toString(16)}`;
}

export async function listProfiles() {
  return dbPromise ? (await dbPromise).getAll("profiles") : [];
}

export async function createLocalProfile(input: {
  username: string;
  name: string;
  pin: string;
  serverLinked?: boolean;
  serverUserId?: string;
  role?: "user" | "admin";
}) {
  if (!dbPromise) throw new Error("IndexedDB unavailable");
  const salt = randomBytes(16);
  const profile: LocalProfile = {
    id: createId(),
    username: input.username.trim().toLowerCase(),
    name: input.name.trim(),
    pinSalt: encode(salt),
    pinHash: await derivePin(input.pin, salt),
    role: input.role ?? "user",
    serverLinked: input.serverLinked ?? false,
    serverUserId: input.serverUserId,
    createdAt: new Date().toISOString(),
  };
  const db = await dbPromise;
  await db.put("profiles", profile);
  await db.put("workspaces", createDefaultWorkspace(), profile.id);
  return profile;
}

export async function updateProfile(profile: LocalProfile) {
  if (dbPromise) await (await dbPromise).put("profiles", profile);
}

export async function connectLocalProfile(
  profile: LocalProfile,
  pin: string,
  remote: { id: string; name: string; role: "user" | "admin" },
) {
  const salt = randomBytes(16);
  const connected: LocalProfile = {
    ...profile,
    name: remote.name,
    role: remote.role,
    serverLinked: true,
    serverUserId: remote.id,
    pinSalt: encode(salt),
    pinHash: await derivePin(pin, salt),
  };
  await updateProfile(connected);
  return connected;
}

export async function verifyLocalPin(profile: LocalProfile, pin: string) {
  try {
    const raw = Uint8Array.from(atob(profile.pinSalt), (char) =>
      char.charCodeAt(0),
    );
    return (await derivePin(pin, raw)) === profile.pinHash;
  } catch {
    return false;
  }
}

export async function loadWorkspace(profileId: string) {
  if (!dbPromise) return createDefaultWorkspace();
  const db = await dbPromise;
  const stored = await db.get("workspaces", profileId);
  const workspace = stored
    ? migrateWorkspace(stored)
    : createDefaultWorkspace();
  if (stored && workspace.schemaVersion !== stored.schemaVersion) {
    await db.put("workspaces", workspace, profileId);
  }
  return workspace;
}

export async function saveWorkspace(profileId: string, state: WorkspaceState) {
  if (dbPromise) await (await dbPromise).put("workspaces", state, profileId);
}

function deviceStorageKey(accountKey: string) {
  return `focus-os-device:${accountKey}`;
}

function revokedDeviceStorageKey(accountKey: string) {
  return `focus-os-device-revoked:${accountKey}`;
}

function isDeviceDescriptor(value: unknown): value is DeviceDescriptor {
  if (!value || typeof value !== "object") return false;
  const device = value as Partial<DeviceDescriptor>;
  return (
    typeof device.id === "string" &&
    UUID_PATTERN.test(device.id) &&
    typeof device.name === "string" &&
    typeof device.platform === "string" &&
    typeof device.appVersion === "string" &&
    (device.kind === "mobile" ||
      device.kind === "tablet" ||
      device.kind === "laptop" ||
      device.kind === "desktop")
  );
}

export function getDeviceInfo(accountKey: string): DeviceDescriptor {
  if (typeof window === "undefined") {
    return {
      id: "00000000-0000-4000-8000-000000000000",
      name: "Serwer",
      kind: "desktop",
      platform: "server",
      appVersion: "1.1.0",
    };
  }
  const storageKey = deviceStorageKey(accountKey);
  const stored =
    window.localStorage.getItem(storageKey) ??
    window.localStorage.getItem(LEGACY_DEVICE_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as DeviceDescriptor;
      if (isDeviceDescriptor(parsed)) {
        window.localStorage.setItem(storageKey, stored);
        window.localStorage.removeItem(LEGACY_DEVICE_STORAGE_KEY);
        return parsed;
      }
    } catch {
      // Replace malformed data with a fresh valid UUID below.
    }
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(LEGACY_DEVICE_STORAGE_KEY);
  }
  const ua = navigator.userAgent;
  const kind: DeviceDescriptor["kind"] = /iPad|Tablet|PlayBook/i.test(ua)
    ? "tablet"
    : /Android|iPhone|Mobile/i.test(ua)
      ? "mobile"
      : /Macintosh|Windows|Linux/i.test(ua)
        ? "laptop"
        : "desktop";
  const platform = /Windows/i.test(ua)
    ? "Windows"
    : /iPhone|iPad|Macintosh/i.test(ua)
      ? "Apple"
      : /Android/i.test(ua)
        ? "Android"
        : /Linux/i.test(ua)
          ? "Linux"
          : "Przeglądarka";
  const device: DeviceDescriptor = {
    id: createId(),
    name: `${platform} · ${kind === "mobile" ? "telefon" : kind === "tablet" ? "tablet" : kind === "laptop" ? "komputer" : "urządzenie"}`,
    kind,
    platform,
    appVersion: "1.1.0",
  };
  window.localStorage.setItem(storageKey, JSON.stringify(device));
  return device;
}

export function renameCurrentDevice(accountKey: string, name: string) {
  const current = getDeviceInfo(accountKey);
  const device = { ...current, name: name.trim().slice(0, 80) || current.name };
  window.localStorage.setItem(
    deviceStorageKey(accountKey),
    JSON.stringify(device),
  );
  return device;
}

export function reauthorizeCurrentDevice(accountKey: string) {
  const revokedKey = revokedDeviceStorageKey(accountKey);
  if (window.localStorage.getItem(revokedKey)) {
    window.localStorage.removeItem(deviceStorageKey(accountKey));
    window.localStorage.removeItem(revokedKey);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Synchronizacja przekroczyła limit czasu. Sprawdź połączenie z serwerem.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function syncWorkspace(state: WorkspaceState, accountKey: string) {
  let candidate = migrateWorkspace(state);
  const device = getDeviceInfo(accountKey);
  let resolvedConflictId: string | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetchWithTimeout("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({
        device,
        workspace: candidate,
        baseRevision: candidate.syncRevision,
        dirty: candidate.version > candidate.syncedVersion,
        resolvedConflictId,
      }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (response.status === 403) {
        window.localStorage.setItem(revokedDeviceStorageKey(accountKey), "1");
      }
      throw new Error(
        response.status === 401
          ? "Sesja wygasła. Zaloguj się ponownie, aby kontynuować synchronizację."
          : (data.error ?? "Synchronizacja jest chwilowo niedostępna."),
      );
    }
    const data = (await response.json()) as {
      status: "synced" | "conflict";
      workspace: WorkspaceInput;
      revision: number;
      serverUpdatedAt: string;
      conflictId?: string;
    };
    const remote = migrateWorkspace({
      ...data.workspace,
      syncRevision: data.revision,
      lastSyncedAt: data.serverUpdatedAt,
      syncedVersion:
        typeof data.workspace.version === "number"
          ? data.workspace.version
          : candidate.version,
    });
    if (data.status === "synced") return remote;
    if (candidate.version <= candidate.syncedVersion) return remote;
    candidate = mergeWorkspaces(candidate, remote);
    resolvedConflictId = data.conflictId;
  }
  throw new Error("Nie udało się scalić równoczesnych zmian");
}

export async function restoreWorkspaceRevision(
  revision: number,
  accountKey: string,
) {
  const response = await fetchWithTimeout("/api/sync/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({ revision, device: getDeviceInfo(accountKey) }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    workspace?: WorkspaceInput;
    revision?: number;
    serverUpdatedAt?: string;
  };
  if (!response.ok || !data.workspace || !data.revision || !data.serverUpdatedAt) {
    throw new Error(data.error ?? "Nie udało się przywrócić rewizji");
  }
  return migrateWorkspace({
    ...data.workspace,
    syncRevision: data.revision,
    lastSyncedAt: data.serverUpdatedAt,
    syncedVersion:
      typeof data.workspace.version === "number"
        ? data.workspace.version
        : data.revision,
  });
}

export function prepareWorkspaceUpdate(
  current: WorkspaceState,
  next: WorkspaceState,
  updatedAt = new Date().toISOString(),
): WorkspaceState {
  const tombstones = new Map(
    current.tombstones.map((entry) => [
      tombstoneKey(entry.collection, entry.id),
      entry,
    ]),
  );
  for (const collection of SYNC_COLLECTIONS) {
    const before = current[collection] as { id: string }[];
    const after = next[collection] as { id: string }[];
    const beforeIds = new Set(before.map((item) => item.id));
    const afterIds = new Set(after.map((item) => item.id));
    for (const id of beforeIds) {
      if (!afterIds.has(id)) {
        tombstones.set(tombstoneKey(collection, id), {
          collection,
          id,
          deletedAt: updatedAt,
        });
      }
    }
    for (const id of afterIds) {
      if (!beforeIds.has(id)) tombstones.delete(tombstoneKey(collection, id));
    }
  }
  const expiry = Date.now() - 365 * 86_400_000;
  return {
    ...next,
    schemaVersion: 5,
    version: current.version + 1,
    updatedAt,
    tombstones: [...tombstones.values()].filter(
      (entry) => new Date(entry.deletedAt).getTime() >= expiry,
    ),
  };
}

export function mergeWorkspaces(
  local: WorkspaceState,
  remote: WorkspaceState,
): WorkspaceState {
  if (isPristineWorkspace(local)) {
    return {
      ...remote,
      schemaVersion: 5,
      syncRevision: remote.syncRevision,
      lastSyncedAt: remote.lastSyncedAt,
    };
  }

  const localTime = dateValue(local.updatedAt);
  const remoteTime = dateValue(remote.updatedAt);
  const localIsNewer = localTime >= remoteTime;
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);

  return {
    ...(localIsNewer ? local : remote),
    schemaVersion: 5,
    syncId: remote.syncId || local.syncId,
    version: Math.max(local.version, remote.version) + 1,
    syncedVersion: remote.version,
    updatedAt: new Date().toISOString(),
    syncRevision: remote.syncRevision,
    lastSyncedAt: remote.lastSyncedAt,
    tombstones,
    tasks: mergeCollection(
      local.tasks,
      remote.tasks,
      local.updatedAt,
      remote.updatedAt,
      "tasks",
      tombstones,
    ),
    subjects: mergeCollection(
      local.subjects,
      remote.subjects,
      local.updatedAt,
      remote.updatedAt,
      "subjects",
      tombstones,
    ),
    flashcards: mergeCollection(
      local.flashcards,
      remote.flashcards,
      local.updatedAt,
      remote.updatedAt,
      "flashcards",
      tombstones,
    ),
    exams: mergeCollection(
      local.exams,
      remote.exams,
      local.updatedAt,
      remote.updatedAt,
      "exams",
      tombstones,
    ),
    calendar: mergeCollection(
      local.calendar,
      remote.calendar,
      local.updatedAt,
      remote.updatedAt,
      "calendar",
      tombstones,
    ),
    habits: mergeCollection(
      local.habits,
      remote.habits,
      local.updatedAt,
      remote.updatedAt,
      "habits",
      tombstones,
    ),
    sessions: mergeCollection(
      local.sessions,
      remote.sessions,
      local.updatedAt,
      remote.updatedAt,
      "sessions",
      tombstones,
    ),
    materials: mergeCollection(
      local.materials,
      remote.materials,
      local.updatedAt,
      remote.updatedAt,
      "materials",
      tombstones,
    ),
    studyRuns: mergeCollection(
      local.studyRuns,
      remote.studyRuns,
      local.updatedAt,
      remote.updatedAt,
      "studyRuns",
      tombstones,
    ),
    reviewActivity: mergeCollection(
      local.reviewActivity,
      remote.reviewActivity,
      local.updatedAt,
      remote.updatedAt,
      "reviewActivity",
      tombstones,
    ),
    flashcardReviews: mergeCollection(
      local.flashcardReviews,
      remote.flashcardReviews,
      local.updatedAt,
      remote.updatedAt,
      "flashcardReviews",
      tombstones,
    ),
    projects: mergeCollection(
      local.projects,
      remote.projects,
      local.updatedAt,
      remote.updatedAt,
      "projects",
      tombstones,
    ),
    quizzes: mergeCollection(
      local.quizzes,
      remote.quizzes,
      local.updatedAt,
      remote.updatedAt,
      "quizzes",
      tombstones,
    ),
    quizAttempts: mergeCollection(
      local.quizAttempts,
      remote.quizAttempts,
      local.updatedAt,
      remote.updatedAt,
      "quizAttempts",
      tombstones,
    ),
    mistakes: mergeCollection(
      local.mistakes,
      remote.mistakes,
      local.updatedAt,
      remote.updatedAt,
      "mistakes",
      tombstones,
    ),
    studyNotes: mergeCollection(
      local.studyNotes,
      remote.studyNotes,
      local.updatedAt,
      remote.updatedAt,
      "studyNotes",
      tombstones,
    ),
    journalEntries: mergeCollection(
      local.journalEntries,
      remote.journalEntries,
      local.updatedAt,
      remote.updatedAt,
      "journalEntries",
      tombstones,
    ),
    challenges: mergeCollection(
      local.challenges,
      remote.challenges,
      local.updatedAt,
      remote.updatedAt,
      "challenges",
      tombstones,
    ),
    rewards: mergeCollection(
      local.rewards,
      remote.rewards,
      local.updatedAt,
      remote.updatedAt,
      "rewards",
      tombstones,
    ),
    notificationSchedules: mergeCollection(
      local.notificationSchedules,
      remote.notificationSchedules,
      local.updatedAt,
      remote.updatedAt,
      "notificationSchedules",
      tombstones,
    ),
    trash: mergeCollection(
      local.trash,
      remote.trash,
      local.updatedAt,
      remote.updatedAt,
      "trash",
      tombstones,
    ),
    activityLog: mergeCollection(
      local.activityLog,
      remote.activityLog,
      local.updatedAt,
      remote.updatedAt,
      "activityLog",
      tombstones,
    ),
    progress: localIsNewer ? local.progress : remote.progress,
    focusQueue: localIsNewer ? local.focusQueue : remote.focusQueue,
    settings: localIsNewer ? local.settings : remote.settings,
  };
}

export function migrateWorkspace(input: WorkspaceInput): WorkspaceState {
  const defaults = createDefaultWorkspace();
  const schemaVersion = Number(input.schemaVersion ?? 1);
  const migrated: WorkspaceState = {
    ...defaults,
    ...input,
    schemaVersion: 5,
    syncId: input.syncId ?? defaults.syncId,
    version: input.version ?? 1,
    syncedVersion: input.syncedVersion ?? 0,
    updatedAt: input.updatedAt ?? defaults.updatedAt,
    syncRevision: input.syncRevision ?? 0,
    tombstones: input.tombstones ?? [],
    tasks: (input.tasks ?? []).map((task) => ({
      ...task,
      dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn : [],
      recurring:
        task.recurring === "daily" || task.recurring === "weekly" || task.recurring === "monthly"
          ? task.recurring
          : "none",
    })),
    subjects: input.subjects ?? [],
    flashcards: (input.flashcards ?? []).map((card) => ({
      ...card,
      deck: card.deck ?? "Ogólne",
      tags: card.tags ?? [],
      source: card.source ?? "manual",
      createdAt: card.createdAt ?? input.updatedAt ?? defaults.updatedAt,
      lapses: card.lapses ?? 0,
      correctStreak: card.correctStreak ?? 0,
      kind: card.kind ?? "text",
      fsrs: card.fsrs ?? {
        difficulty: Math.min(10, Math.max(1, 11 - (card.ease ?? 2.5) * 2)),
        stability: Math.max(0.1, card.intervalDays || 0.1),
        state: card.repetitions > 0 ? "review" : "new",
        step: 0,
        scheduledDays: card.intervalDays ?? 0,
        lastReviewAt: card.lastReviewedAt,
      },
      suspended: card.suspended ?? false,
      updatedAt: card.updatedAt ?? card.lastReviewedAt ?? card.createdAt ?? input.updatedAt ?? defaults.updatedAt,
    })),
    exams: input.exams ?? [],
    calendar: input.calendar ?? [],
    habits: input.habits ?? [],
    sessions: input.sessions ?? [],
    materials: input.materials ?? [],
    studyRuns: input.studyRuns ?? [],
    reviewActivity: input.reviewActivity ?? [],
    flashcardReviews: input.flashcardReviews ?? [],
    projects: input.projects ?? [],
    quizzes: input.quizzes ?? [],
    quizAttempts: input.quizAttempts ?? [],
    mistakes: input.mistakes ?? [],
    studyNotes: input.studyNotes ?? [],
    journalEntries: input.journalEntries ?? [],
    challenges: input.challenges ?? [],
    rewards: input.rewards ?? [],
    notificationSchedules: input.notificationSchedules ?? [],
    trash: (input.trash ?? []).filter(
      (item) => new Date(item.expiresAt).getTime() > Date.now(),
    ),
    activityLog: (input.activityLog ?? []).slice(-1000),
    progress: {
      ...defaults.progress,
      ...(input.progress ?? {}),
      unlockedBadges: input.progress?.unlockedBadges ?? [],
    },
    focusQueue: input.focusQueue ?? [],
    settings: {
      ...defaults.settings,
      ...(input.settings ?? {}),
      timerModes: input.settings?.timerModes?.length
        ? input.settings.timerModes.map((mode) => ({
            ...mode,
            label: mode.label?.trim() || "Tryb bez nazwy",
            focus: numberWithin(mode.focus, 0, 360, 25),
            break: numberWithin(mode.break, 0, 120, 5),
            enabled: mode.enabled !== false,
          }))
        : defaults.settings.timerModes,
      timerSoundEnabled: input.settings?.timerSoundEnabled !== false,
      timerSoundVolume: numberWithin(input.settings?.timerSoundVolume, 0, 1, 0.5),
      enabledStudyMethods: input.settings?.enabledStudyMethods?.length
        ? input.settings.enabledStudyMethods
        : defaults.settings.enabledStudyMethods,
      studyMethodMinutes: {
        ...defaults.settings.studyMethodMinutes,
        ...(input.settings?.studyMethodMinutes ?? {}),
      },
      shortcutLinks: (input.settings?.shortcutLinks?.length
        ? input.settings.shortcutLinks
        : defaults.settings.shortcutLinks
      ).map((shortcut) => ({
        id: shortcut.id || createId(),
        label: shortcut.label?.trim() || "Skrót",
        kind: shortcut.kind === "url" ? "url" : "view",
        view: shortcut.view ?? "home",
        url: shortcut.url ?? "",
        category: shortcut.category ?? "Własne",
        openInNewTab: shortcut.openInNewTab ?? shortcut.kind === "url",
        enabled: shortcut.enabled !== false,
      })),
      dashboardShortcutLimit: Math.min(
        24,
        Math.max(1, Number(input.settings?.dashboardShortcutLimit) || defaults.settings.dashboardShortcutLimit),
      ),
      dailyFocusGoalMinutes: Math.min(
        720,
        Math.max(5, Number(input.settings?.dailyFocusGoalMinutes) || defaults.settings.dailyFocusGoalMinutes),
      ),
      longBreakAfter: numberWithin(
        input.settings?.longBreakAfter,
        2,
        12,
        defaults.settings.longBreakAfter,
      ),
      longBreakMinutes: numberWithin(
        input.settings?.longBreakMinutes,
        1,
        90,
        defaults.settings.longBreakMinutes,
      ),
      dailyReviewGoal: numberWithin(
        input.settings?.dailyReviewGoal,
        1,
        500,
        defaults.settings.dailyReviewGoal,
      ),
      reviewLimit: numberWithin(
        input.settings?.reviewLimit,
        1,
        500,
        defaults.settings.reviewLimit,
      ),
      defaultBlockMinutes: numberWithin(
        input.settings?.defaultBlockMinutes,
        5,
        480,
        defaults.settings.defaultBlockMinutes,
      ),
      workdayStartHour: numberWithin(
        input.settings?.workdayStartHour,
        0,
        22,
        defaults.settings.workdayStartHour,
      ),
      workdayEndHour: numberWithin(
        input.settings?.workdayEndHour,
        1,
        23,
        defaults.settings.workdayEndHour,
      ),
      syncIntervalSeconds: numberWithin(
        input.settings?.syncIntervalSeconds,
        15,
        3600,
        defaults.settings.syncIntervalSeconds,
      ),
      idleMinutes: numberWithin(
        input.settings?.idleMinutes,
        1,
        60,
        defaults.settings.idleMinutes,
      ),
      lockAfterMinutes: numberWithin(
        input.settings?.lockAfterMinutes,
        1,
        240,
        defaults.settings.lockAfterMinutes,
      ),
      blockedDomains: Array.isArray(input.settings?.blockedDomains)
        ? input.settings.blockedDomains
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean)
            .slice(0, 100)
        : defaults.settings.blockedDomains,
    },
  };

  if (migrated.settings.workdayEndHour <= migrated.settings.workdayStartHour) {
    migrated.settings.workdayEndHour = Math.min(
      23,
      migrated.settings.workdayStartHour + 1,
    );
  }

  if (schemaVersion <= 2 && isUntouchedLegacyDemo(migrated)) {
    return {
      ...migrated,
      tasks: [],
      subjects: [],
      flashcards: [],
      exams: [],
      focusQueue: [],
      updatedAt: new Date().toISOString(),
      version: migrated.version + 1,
    };
  }
  return migrated;
}

function mergeCollection<T extends { id: string }>(
  local: T[],
  remote: T[],
  localParentUpdatedAt: string,
  remoteParentUpdatedAt: string,
  collection: SyncCollection,
  tombstones: SyncTombstone[],
) {
  const merged = new Map<string, { item: T; updatedAt: number }>();
  for (const item of remote) {
    merged.set(item.id, {
      item,
      updatedAt: entityUpdatedAt(item, remoteParentUpdatedAt),
    });
  }
  for (const item of local) {
    const updatedAt = entityUpdatedAt(item, localParentUpdatedAt);
    const existing = merged.get(item.id);
    if (!existing || updatedAt >= existing.updatedAt)
      merged.set(item.id, { item, updatedAt });
  }
  const deleted = new Map(
    tombstones
      .filter((entry) => entry.collection === collection)
      .map((entry) => [entry.id, dateValue(entry.deletedAt)]),
  );
  return [...merged.values()]
    .filter(({ item, updatedAt }) => (deleted.get(item.id) ?? 0) < updatedAt)
    .map(({ item }) => item);
}

function entityUpdatedAt(entity: { id: string }, fallback: string) {
  const record = entity as unknown as Record<string, unknown>;
  for (const key of ["updatedAt", "endedAt", "lastReviewedAt", "createdAt"]) {
    if (typeof record[key] === "string")
      return dateValue(record[key] as string);
  }
  return dateValue(fallback);
}

function mergeTombstones(local: SyncTombstone[], remote: SyncTombstone[]) {
  const merged = new Map<string, SyncTombstone>();
  for (const entry of [...remote, ...local]) {
    const key = tombstoneKey(entry.collection, entry.id);
    const current = merged.get(key);
    if (!current || dateValue(entry.deletedAt) >= dateValue(current.deletedAt))
      merged.set(key, entry);
  }
  return [...merged.values()];
}

function tombstoneKey(collection: SyncCollection, id: string) {
  return `${collection}:${id}`;
}

function dateValue(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPristineWorkspace(state: WorkspaceState) {
  return (
    state.syncRevision === 0 &&
    state.version <= 1 &&
    SYNC_COLLECTIONS.every((collection) => state[collection].length === 0)
  );
}

function isUntouchedLegacyDemo(state: WorkspaceState) {
  const taskTitles = new Set(state.tasks.map((task) => task.title));
  const subjectNames = new Set(state.subjects.map((subject) => subject.name));
  const cardFronts = new Set(state.flashcards.map((card) => card.front));
  return (
    state.tasks.length === 2 &&
    taskTitles.has("Powtórz funkcje kwadratowe") &&
    taskTitles.has("Słówka: podróże") &&
    state.subjects.length === 2 &&
    subjectNames.has("Matematyka") &&
    subjectNames.has("Język angielski") &&
    state.flashcards.length === 2 &&
    cardFronts.has("Współrzędna x wierzchołka paraboli") &&
    cardFronts.has("to get away") &&
    state.exams.length === 1 &&
    state.exams[0]?.title === "Matura próbna" &&
    state.sessions.length === 0 &&
    state.materials.length === 0 &&
    state.studyRuns.length === 0
  );
}
