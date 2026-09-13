export type ThemeMode =
  | "light"
  | "dark"
  | "system"
  | "auto"
  | "sepia"
  | "contrast";
export type AccentColor =
  | "sage"
  | "blue"
  | "indigo"
  | "violet"
  | "pink"
  | "rose"
  | "orange"
  | "teal"
  | "cyan"
  | "mono";
export type FontScale = "normal" | "comfortable" | "large";
export type InterfaceDensity = "compact" | "comfortable" | "spacious";
export type TaskSort = "smart" | "deadline" | "created" | "alphabetical";
export type ReviewOrder = "smart" | "due" | "random";
export type PlannerMode = "day" | "week" | "month";
export type ShortcutLink = {
  id: string;
  label: string;
  kind: "view" | "url";
  view?: ViewId;
  url?: string;
  category?: string;
  openInNewTab?: boolean;
  enabled?: boolean;
};
export type SyncCollection =
  | "tasks"
  | "subjects"
  | "flashcards"
  | "exams"
  | "calendar"
  | "habits"
  | "sessions"
  | "materials"
  | "studyRuns"
  | "reviewActivity"
  | "flashcardReviews"
  | "projects"
  | "quizzes"
  | "quizAttempts"
  | "mistakes"
  | "studyNotes"
  | "journalEntries"
  | "challenges"
  | "rewards"
  | "notificationSchedules"
  | "trash"
  | "activityLog";
export type ViewId = "home" | "tasks" | "focus" | "learn" | "planner" | "more";

export type Task = {
  id: string;
  title: string;
  description: string;
  subjectId?: string;
  topic: string;
  deadline?: string;
  priority: 1 | 2 | 3;
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimateMinutes: number;
  actualMinutes: number;
  plannedPomodoros: number;
  completedPomodoros: number;
  status: "todo" | "doing" | "done";
  tags: string[];
  subtasks: { id: string; title: string; done: boolean }[];
  recurring: "none" | "daily" | "weekly" | "monthly";
  projectId?: string;
  dependsOn?: string[];
  quadrant?: "do" | "schedule" | "delegate" | "eliminate";
  recurrenceSourceId?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type Subject = {
  id: string;
  name: string;
  color: string;
  mastery: number;
  topics: { id: string; name: string; mastery: number }[];
};

export type Flashcard = {
  id: string;
  subjectId?: string;
  front: string;
  back: string;
  dueAt: string;
  intervalDays: number;
  ease: number;
  repetitions: number;
  lastGrade?: 0 | 1 | 2 | 3;
  deck?: string;
  tags?: string[];
  source?: "manual" | "quizlet" | "file" | "material" | "anki";
  createdAt?: string;
  lastReviewedAt?: string;
  lapses?: number;
  correctStreak?: number;
  kind?: "text" | "image" | "audio" | "multiple-choice";
  frontMedia?: MediaAttachment;
  backMedia?: MediaAttachment;
  choices?: string[];
  correctChoice?: number;
  fsrs?: FsrsMemoryState;
  suspended?: boolean;
  updatedAt?: string;
};

export type MediaAttachment = {
  name: string;
  mimeType: string;
  dataUrl: string;
};

export type FsrsMemoryState = {
  difficulty: number;
  stability: number;
  state: "new" | "learning" | "review" | "relearning";
  step: number;
  scheduledDays: number;
  lastReviewAt?: string;
};

export type FlashcardReview = {
  id: string;
  cardId: string;
  subjectId?: string;
  grade: 0 | 1 | 2 | 3;
  confidence: 1 | 2 | 3 | 4 | 5;
  responseMs: number;
  reviewedAt: string;
  elapsedDays: number;
  scheduledDays: number;
  retrievability: number;
  stateBefore: FsrsMemoryState["state"];
  createdAt: string;
};

export type StudyMethod =
  | "feynman"
  | "blurting"
  | "cornell"
  | "interleaving"
  | "exam-sprint"
  | "leitner";

export type StudyRun = {
  id: string;
  method: StudyMethod;
  subjectId?: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  notes: string;
  score: number;
};

export type ReviewActivity = {
  id: string;
  date: string;
  count: number;
  updatedAt: string;
};

export type Exam = {
  id: string;
  title: string;
  date: string;
  subjectIds: string[];
  topics: string[];
};

export type CalendarBlock = {
  id: string;
  title: string;
  start: string;
  end: string;
  taskId?: string;
  done: boolean;
};

export type Habit = { id: string; name: string; checks: string[] };

export type FocusSession = {
  id: string;
  taskId?: string;
  subjectId?: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  plannedMinutes: number;
  energy: 1 | 2 | 3 | 4 | 5;
  distractions: string[];
  goalCompleted: boolean;
  selfRating: 1 | 2 | 3 | 4 | 5;
  quality: number;
  method: string;
  goal?: string;
  idleSeconds?: number;
};

export type Material = {
  id: string;
  title: string;
  type: "pdf" | "image" | "txt" | "markdown" | "text";
  content: string;
  dataUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt: string;
};

export type StudyChapter = {
  id: string;
  title: string;
  mastery: number;
  completed: boolean;
  checklist: { id: string; label: string; done: boolean }[];
};

export type StudyProject = {
  id: string;
  title: string;
  description: string;
  subjectId?: string;
  goalDate?: string;
  targetMinutes: number;
  status: "active" | "completed" | "archived";
  tags: string[];
  chapters: StudyChapter[];
  createdAt: string;
  updatedAt: string;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  answer: string;
  options?: string[];
  explanation?: string;
  topic?: string;
};

export type StudyQuiz = {
  id: string;
  title: string;
  kind: "practice" | "mock-exam" | "oral";
  subjectId?: string;
  sourceMaterialId?: string;
  questions: QuizQuestion[];
  timeLimitMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type QuizAttempt = {
  id: string;
  quizId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  score: number;
  answers: {
    questionId: string;
    answer: string;
    correct: boolean;
    confidence: 1 | 2 | 3 | 4 | 5;
  }[];
  createdAt: string;
};

export type MistakeEntry = {
  id: string;
  question: string;
  correctAnswer: string;
  userAnswer: string;
  subjectId?: string;
  topic: string;
  sourceId?: string;
  count: number;
  status: "active" | "resolved";
  nextReviewAt: string;
  createdAt: string;
  updatedAt: string;
};

export type StudyNote = {
  id: string;
  type: "cornell" | "mindmap";
  title: string;
  subjectId?: string;
  cues: string;
  notes: string;
  summary: string;
  nodes: { id: string; label: string; parentId?: string }[];
  createdAt: string;
  updatedAt: string;
};

export type JournalEntry = {
  id: string;
  date: string;
  summary: string;
  win: string;
  challenge: string;
  nextStep: string;
  mood: 1 | 2 | 3 | 4 | 5;
  createdAt: string;
  updatedAt: string;
};

export type WeeklyChallenge = {
  id: string;
  title: string;
  metric: "minutes" | "sessions" | "reviews" | "tasks";
  target: number;
  startDate: string;
  endDate: string;
  rewardXp: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PersonalReward = {
  id: string;
  title: string;
  costXp: number;
  claimedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type NotificationSchedule = {
  id: string;
  title: string;
  body: string;
  scheduledAt: string;
  repeat: "none" | "daily" | "weekly";
  kind: "study" | "review" | "exam";
  enabled: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type TrashItem = {
  id: string;
  collection: SyncCollection;
  label: string;
  snapshot: unknown;
  deletedAt: string;
  expiresAt: string;
  createdAt: string;
};

export type ActivityEvent = {
  id: string;
  type: "focus" | "review" | "task" | "quiz" | "project" | "reward" | "system";
  description: string;
  xp: number;
  entityId?: string;
  createdAt: string;
};

export type GamificationProgress = {
  xp: number;
  spentXp: number;
  streakShields: number;
  usedShields: number;
  unlockedBadges: { id: string; unlockedAt: string }[];
};

export type WorkspaceSettings = {
  theme: ThemeMode;
  accent: AccentColor;
  fontScale: FontScale;
  density: InterfaceDensity;
  reducedMotion: boolean;
  defaultView: ViewId;
  shortcutLinks: ShortcutLink[];
  showDashboardShortcuts: boolean;
  dashboardShortcutLimit: number;
  showCompletedTasks: boolean;
  confirmBeforeDelete: boolean;
  taskSort: TaskSort;
  defaultSubjectId: string;
  defaultTaskEstimate: number;
  defaultTaskPriority: 1 | 2 | 3;
  defaultTaskDifficulty: 1 | 2 | 3 | 4 | 5;
  defaultTaskRecurring: Task["recurring"];
  timerModes: TimerMode[];
  defaultTimerMode: string;
  autoStartBreak: boolean;
  autoStartFocus: boolean;
  adaptiveBreaks: boolean;
  fullscreenOnTimerStart: boolean;
  exitFullscreenOnPause: boolean;
  minimalFocusMode: boolean;
  longBreakMinutes: number;
  keepScreenAwake: boolean;
  notifications: boolean;
  adaptiveFocusDuration: boolean;
  autoPauseWhenIdle: boolean;
  idleMinutes: number;
  focusShield: boolean;
  blockedDomains: string[];
  showPictureInPicture: boolean;
  longBreakAfter: number;
  enabledStudyMethods: StudyMethod[];
  studyMethodMinutes: Record<StudyMethod, number>;
  showStudyMethodGuides: boolean;
  dailyFocusGoalMinutes: number;
  dailyReviewGoal: number;
  reviewLimit: number;
  reviewOrder: ReviewOrder;
  defaultDeck: string;
  flipCardOnClick: boolean;
  plannerDefaultMode: PlannerMode;
  defaultBlockMinutes: number;
  workdayStartHour: number;
  workdayEndHour: number;
  weekStartsOn: 0 | 1;
  autoSync: boolean;
  syncIntervalSeconds: number;
  appLockEnabled: boolean;
  lockAfterMinutes: number;
  biometricLockEnabled: boolean;
  encryptedBackups: boolean;
  automaticDailyBackup: boolean;
};

export type SyncTombstone = {
  collection: SyncCollection;
  id: string;
  deletedAt: string;
};

export type WorkspaceState = {
  schemaVersion: 5;
  syncId: string;
  version: number;
  syncedVersion: number;
  updatedAt: string;
  syncRevision: number;
  syncCursor?: string;
  lastSyncedAt?: string;
  tombstones: SyncTombstone[];
  tasks: Task[];
  subjects: Subject[];
  flashcards: Flashcard[];
  exams: Exam[];
  calendar: CalendarBlock[];
  habits: Habit[];
  sessions: FocusSession[];
  materials: Material[];
  studyRuns: StudyRun[];
  reviewActivity: ReviewActivity[];
  flashcardReviews: FlashcardReview[];
  projects: StudyProject[];
  quizzes: StudyQuiz[];
  quizAttempts: QuizAttempt[];
  mistakes: MistakeEntry[];
  studyNotes: StudyNote[];
  journalEntries: JournalEntry[];
  challenges: WeeklyChallenge[];
  rewards: PersonalReward[];
  notificationSchedules: NotificationSchedule[];
  trash: TrashItem[];
  activityLog: ActivityEvent[];
  progress: GamificationProgress;
  focusQueue: string[];
  settings: WorkspaceSettings;
};

export type LocalProfile = {
  id: string;
  username: string;
  name: string;
  pinHash: string;
  pinSalt: string;
  role: "user" | "admin";
  serverLinked: boolean;
  serverUserId?: string;
  createdAt: string;
};

export type CloudDevice = {
  id: string;
  name: string;
  kind: "mobile" | "tablet" | "laptop" | "desktop";
  platform: string;
  lastSeenAt: string;
  createdAt: string;
  current?: boolean;
};

export type TimerMode = {
  id: string;
  label: string;
  focus: number;
  break: number;
  countUp?: boolean;
  enabled?: boolean;
};

export type PersistedTimer = {
  modeId: string;
  phase: "focus" | "break";
  durationSeconds: number;
  remainingSeconds: number;
  startedAt: number | null;
  pausedAt: number | null;
  running: boolean;
  taskId?: string;
  energy: 1 | 2 | 3 | 4 | 5;
  distractions: string[];
  sessionStartedAt?: string;
  goal?: string;
  idleSeconds?: number;
};
