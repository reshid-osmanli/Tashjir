import type { LineType, ReviewStatus, TashjeerLine } from '@/types';

const TASHJEER_LINES_PREFIX = 'tashjeer-lines:';
const REVIEW_STORAGE_KEY = 'tashjeer-review-statuses';
const READERS_STORAGE_KEY = 'tashjeer-readers';
const SETTINGS_STORAGE_KEY = 'tashjeer-settings';

export type LocalReviewDecision = {
  status: ReviewStatus;
  comment: string;
  reviewer: string;
  updatedAt: string;
};

export type TashjeerLineSummary = {
  key: string;
  storageKey: string;
  surahId: number;
  ayahId: number;
  lineId: string;
  type: LineType;
  qiraahId?: number;
  nodesCount: number;
  color?: string;
  updatedAt: string;
  review: LocalReviewDecision;
};

export type LocalIjazah = {
  id: string;
  qiraahName: string;
  narratorName: string;
  granter: string;
  grantedAt: string;
  paths: string[];
};

export type LocalReader = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  ijazat: LocalIjazah[];
};

export type LocalAppSettings = {
  appName: string;
  fontSize: number;
  defaultZoom: number;
  autoSave: boolean;
  autoSaveInterval: number;
  showGrid: boolean;
  showRulers: boolean;
};

export const DEFAULT_APP_SETTINGS: LocalAppSettings = {
  appName: 'مشروع التشجير',
  fontSize: 24,
  defaultZoom: 1,
  autoSave: true,
  autoSaveInterval: 30,
  showGrid: false,
  showRulers: false,
};

export function readAllTashjeerLineSummaries(): TashjeerLineSummary[] {
  if (!isBrowser()) return [];

  const reviews = readReviewStatuses();
  const summaries: TashjeerLineSummary[] = [];

  for (let index = 0; index < window.localStorage.length; index++) {
    const storageKey = window.localStorage.key(index);
    if (!storageKey?.startsWith(TASHJEER_LINES_PREFIX)) continue;

    const [, surahIdValue, ayahIdValue] = storageKey.split(':');
    const surahId = Number(surahIdValue);
    const ayahId = Number(ayahIdValue);
    const lines = readJsonStorage<TashjeerLine[]>(storageKey, []);

    lines.forEach((line) => {
      const key = createReviewKey(surahId, ayahId, line.id);
      summaries.push({
        key,
        storageKey,
        surahId,
        ayahId,
        lineId: String(line.id),
        type: line.type,
        qiraahId: line.nodes[0]?.qiraahId,
        nodesCount: line.nodes.length,
        color: line.color,
        updatedAt: normalizeDate(line.updatedAt),
        review: reviews[key] ?? createPendingReview(),
      });
    });
  }

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function readReviewStatuses(): Record<string, LocalReviewDecision> {
  return readJsonStorage<Record<string, LocalReviewDecision>>(REVIEW_STORAGE_KEY, {});
}

export function saveReviewDecision(key: string, decision: Omit<LocalReviewDecision, 'updatedAt'>): void {
  const reviews = readReviewStatuses();
  reviews[key] = {
    ...decision,
    updatedAt: new Date().toISOString(),
  };
  writeJsonStorage(REVIEW_STORAGE_KEY, reviews);
}

export function readStoredReaders(): LocalReader[] {
  return readJsonStorage<LocalReader[]>(READERS_STORAGE_KEY, []);
}

export function saveStoredReaders(readers: LocalReader[]): void {
  writeJsonStorage(READERS_STORAGE_KEY, readers);
}

export function readStoredSettings(): LocalAppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...readJsonStorage<Partial<LocalAppSettings>>(SETTINGS_STORAGE_KEY, {}),
  };
}

export function saveStoredSettings(settings: LocalAppSettings): void {
  writeJsonStorage(SETTINGS_STORAGE_KEY, settings);
}

export function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createReviewKey(surahId: number, ayahId: number, lineId: string | number): string {
  return `${surahId}:${ayahId}:${lineId}`;
}

export function formatLocalDate(value?: string): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ar', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function readJsonStorage<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;

  try {
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createPendingReview(): LocalReviewDecision {
  return {
    status: 'PENDING',
    comment: '',
    reviewer: '',
    updatedAt: '',
  };
}

function normalizeDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value || new Date().toISOString();
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}
