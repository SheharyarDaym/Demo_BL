import type { DemoState } from '../domain/types';
import { STORAGE_KEY, createInitialState } from '../data/fixtures';

export interface LoadResult {
  state: DemoState;
  notice?: string;
}

function isValid(x: unknown): x is DemoState {
  if (!x || typeof x !== 'object') return false;
  const s = x as Partial<DemoState>;
  return (
    s.schemaVersion === 1 &&
    !!s.profile &&
    Array.isArray(s.profile.fields) &&
    Array.isArray(s.profile.sessions) &&
    Array.isArray(s.profile.media) &&
    Array.isArray(s.profile.reviews) &&
    Array.isArray(s.destinations) &&
    Array.isArray(s.recommendations) &&
    Array.isArray(s.publishJobs) &&
    Array.isArray(s.analysisRuns) &&
    Array.isArray(s.activity) &&
    Array.isArray(s.pendingSync) &&
    !!s.settings?.connections &&
    !!s.ui?.recFilters &&
    typeof s.seq === 'number' &&
    s.recommendations.every((r) => typeof r.id === 'string' && typeof r.status === 'string' && !!r.proposed)
  );
}

/** Operations pending when the page closed cannot complete; make them retryable. */
export function recoverInterrupted(state: DemoState): { state: DemoState; recovered: number } {
  let recovered = 0;
  const s = structuredClone(state);
  for (const r of s.recommendations) {
    if (r.status === 'publishing') {
      r.status = 'failed';
      r.error = 'Interrupted — the page was reloaded while publishing. Nothing was changed. Retry to publish.';
      recovered++;
    }
  }
  for (const j of s.publishJobs) {
    if (j.status === 'pending') {
      j.status = 'interrupted';
      j.error = 'Page reloaded during publishing';
    }
  }
  return { state: s, recovered };
}

export function loadState(storage: Storage | undefined = globalThis.localStorage): LoadResult {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return { state: createInitialState(), notice: 'Browser storage is unavailable. Changes will last until this tab is closed.' };
  }
  if (!raw) return { state: createInitialState() };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) throw new Error('invalid');
    const { state, recovered } = recoverInterrupted(parsed);
    return {
      state,
      notice: recovered ? `${recovered} publish action was interrupted by a reload. It is marked as failed and can be retried.` : undefined,
    };
  } catch {
    return { state: createInitialState(), notice: 'Saved demo data could not be read, so the initial demo was loaded.' };
  }
}

export function saveState(state: DemoState, storage: Storage | undefined = globalThis.localStorage): { ok: true } | { ok: false; error: string } {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (e) {
    const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
    return {
      ok: false,
      error: quota
        ? 'Browser storage is full, so the latest change was not saved. It stays in this session. Try removing an uploaded image.'
        : 'Browser storage is unavailable. Changes stay in this session only.',
    };
  }
}

export function clearState(storage: Storage | undefined = globalThis.localStorage) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
