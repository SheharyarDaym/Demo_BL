import { describe, expect, it } from 'vitest';
import { createInitialState } from '../data/fixtures';
import type { DemoState } from '../domain/types';
import { reducer, publishKey, type Action } from './reducer';
import { getDest, getRec, overviewCounts, publishCheck } from './selectors';
import { loadState, recoverInterrupted } from './storage';
import { csvCell } from '../utils/csv';

const T = '2026-10-17T15:00:00.000Z';
const run = (s: DemoState, ...actions: Action[]) => actions.reduce(reducer, s);
const rec = (s: DemoState, id: string) => getRec(s, id)!;

function publish(s: DemoState, id: string, fail = false): DemoState {
  const key = publishKey(rec(s, id));
  s = reducer(s, { type: 'PUBLISH_START', id, now: T });
  return reducer(s, fail ? { type: 'PUBLISH_FAIL', id, key, error: 'Simulated', now: T } : { type: 'PUBLISH_SUCCESS', id, key, now: T });
}

describe('initial state', () => {
  it('derives the documented overview counts', () => {
    expect(overviewCounts(createInitialState())).toEqual({ tracked: 8, opportunities: 7, awaiting: 3, published: 1 });
  });
});

describe('analysis', () => {
  const boston = { cityId: 'boston' as const, courseId: 'all' as const, platforms: ['organic', 'maps', 'ai'] as const };
  it('upserts findings without duplicates on repeat', () => {
    let s = createInitialState();
    s = reducer(s, { type: 'ANALYSIS_COMPLETE', selection: { ...boston, platforms: [...boston.platforms] }, startedAt: T, now: T });
    const n1 = s.recommendations.length;
    expect(s.analysisRuns[0].newCount).toBe(1); // Google profile description finding
    s = reducer(s, { type: 'ANALYSIS_COMPLETE', selection: { ...boston, platforms: [...boston.platforms] }, startedAt: T, now: T });
    expect(s.recommendations.length).toBe(n1);
    expect(s.analysisRuns[0].newCount).toBe(0);
    expect(new Set(s.recommendations.map((r) => r.issueKey)).size).toBe(s.recommendations.length);
  });
  it('cancel records no findings', () => {
    const s0 = createInitialState();
    const s = reducer(s0, { type: 'ANALYSIS_CANCELLED', selection: { ...boston, platforms: [...boston.platforms] }, stage: 1, startedAt: T, now: T });
    expect(s.recommendations).toEqual(s0.recommendations);
    expect(s.analysisRuns[0].status).toBe('cancelled');
  });
});

describe('approval and publishing', () => {
  it('blocks publishing drafts', () => {
    const s = createInitialState();
    expect(publishCheck(s, rec(s, 'REC-003')).ok).toBe(false);
    expect(reducer(s, { type: 'PUBLISH_START', id: 'REC-003', now: T })).toBe(s);
  });

  it('approve → publish updates destination, history, counters, activity', () => {
    let s = createInitialState();
    s = run(s, { type: 'REC_SAVE', id: 'REC-001', text: 'Edited wording.', now: T }, { type: 'REC_APPROVE', id: 'REC-001', now: T });
    const before = getDest(s, 'DEST-WEB-BOS-COURSE');
    s = publish(s, 'REC-001');
    const d = getDest(s, 'DEST-WEB-BOS-COURSE');
    expect(d.content.text).toBe('Edited wording.');
    expect(d.content.schedule?.length).toBe(2);
    expect(d.history.length).toBe(before.history.length + 1);
    expect(d.history[0].content.text).toBe(before.content.text);
    expect(rec(s, 'REC-001').status).toBe('published');
    expect(overviewCounts(s)).toMatchObject({ opportunities: 6, awaiting: 2, published: 2 });
    expect(s.activity[0].category).toBe('publishing');
  });

  it('double publish creates exactly one revision and event', () => {
    let s = run(createInitialState(), { type: 'REC_APPROVE', id: 'REC-001', now: T });
    const key = publishKey(rec(s, 'REC-001'));
    s = run(
      s,
      { type: 'PUBLISH_START', id: 'REC-001', now: T },
      { type: 'PUBLISH_START', id: 'REC-001', now: T },
      { type: 'PUBLISH_SUCCESS', id: 'REC-001', key, now: T },
      { type: 'PUBLISH_SUCCESS', id: 'REC-001', key, now: T },
      { type: 'PUBLISH_START', id: 'REC-001', now: T },
    );
    expect(getDest(s, 'DEST-WEB-BOS-COURSE').version).toBe(2);
    expect(s.activity.filter((a) => a.category === 'publishing' && a.status === 'success' && a.recommendationId === 'REC-001').length).toBe(1);
    expect(s.publishJobs.filter((j) => j.id === key).length).toBe(1);
  });

  it('editing approved content revokes approval', () => {
    let s = createInitialState();
    expect(publishCheck(s, rec(s, 'REC-004')).ok).toBe(true);
    s = reducer(s, { type: 'REC_SAVE', id: 'REC-004', text: 'New post wording', now: T });
    expect(rec(s, 'REC-004').status).toBe('awaiting');
    expect(rec(s, 'REC-004').approvedRevision).toBeNull();
    expect(publishCheck(s, rec(s, 'REC-004')).ok).toBe(false);
  });

  it('simulated failure leaves preview unchanged, consumes toggle, retry succeeds once', () => {
    let s = run(createInitialState(), { type: 'SETTINGS_SET', patch: { failNextPublish: true }, now: T });
    const posts = getDest(s, 'DEST-GBP-POSTS');
    s = publish(s, 'REC-004', true);
    expect(rec(s, 'REC-004').status).toBe('failed');
    expect(getDest(s, 'DEST-GBP-POSTS')).toEqual(posts);
    expect(s.settings.failNextPublish).toBe(false);
    s = publish(s, 'REC-004');
    s = publish(s, 'REC-004');
    expect(getDest(s, 'DEST-GBP-POSTS').content.items?.length).toBe(2);
    expect(s.publishJobs.find((j) => j.recommendationId === 'REC-004')?.attempts).toBe(2);
  });

  it('disconnected destination blocks publishing with a Settings hint', () => {
    const s = run(createInitialState(), { type: 'CONNECTION_SET', id: 'google', status: 'disconnected', now: T });
    const c = publishCheck(s, rec(s, 'REC-004'));
    expect(c.ok).toBe(false);
    expect(c.needsSettings).toBe(true);
  });

  it('restore website version keeps history and publication record', () => {
    let s = run(createInitialState(), { type: 'REC_APPROVE', id: 'REC-001', now: T });
    s = publish(s, 'REC-001');
    s = reducer(s, { type: 'DEST_RESTORE', destId: 'DEST-WEB-BOS-COURSE', version: 1, now: T });
    const d = getDest(s, 'DEST-WEB-BOS-COURSE');
    expect(d.version).toBe(3);
    expect(d.content.text).toContain('Contact us');
    expect(d.history.length).toBe(3);
    expect(rec(s, 'REC-001').publishedRevisions).toEqual([1]);
  });

  it('reload during publishing recovers as retryable', () => {
    let s = run(createInitialState(), { type: 'PUBLISH_START', id: 'REC-004', now: T });
    s = recoverInterrupted(s).state;
    expect(rec(s, 'REC-004').status).toBe('failed');
    expect(publishCheck(s, rec(s, 'REC-004')).ok).toBe(true);
  });
});

describe('source facts and freshness', () => {
  it('resolving the price conflict unblocks REC-002 and revalidates dependent drafts', () => {
    let s = run(createInitialState(), { type: 'REC_APPROVE', id: 'REC-001', now: T });
    s = reducer(s, { type: 'CONFLICT_RESOLVE', sessionId: 'BOS-CERT-01', source: 'website', now: T });
    expect(s.profile.sessions.find((x) => x.id === 'BOS-CERT-01')!.price).toBe(229);
    expect(rec(s, 'REC-002').status).toBe('awaiting');
    expect(rec(s, 'REC-002').proposed.prices?.find((p) => p.sessionId === 'BOS-CERT-01')?.price).toBe(229);
    expect(rec(s, 'REC-001').status).toBe('awaiting'); // approval revoked: price now shown
    expect(rec(s, 'REC-001').proposed.schedule?.[0].price).toBe(229);
  });

  it('review policy creates a pending update and leaves the destination unchanged', () => {
    let s = run(createInitialState(), { type: 'REC_APPROVE', id: 'REC-001', now: T });
    s = publish(s, 'REC-001');
    const before = getDest(s, 'DEST-WEB-BOS-COURSE');
    const sess = s.profile.sessions.find((x) => x.id === 'BOS-CERT-01')!;
    s = reducer(s, { type: 'SESSION_SAVE', session: { ...sess, available: 6 }, now: T });
    expect(getDest(s, 'DEST-WEB-BOS-COURSE')).toEqual(before);
    const fresh = s.recommendations.find((r) => r.issueKey === 'fresh:DEST-WEB-BOS-COURSE')!;
    expect(fresh.status).toBe('awaiting');
    expect(fresh.changeNote).toContain('8/20 → 6/20');
  });

  it('auto policy updates only factual components and logs it; pause queues until resumed', () => {
    let s = run(createInitialState(), { type: 'REC_APPROVE', id: 'REC-001', now: T });
    s = publish(s, 'REC-001');
    s = run(s, { type: 'SETTINGS_SET', patch: { freshnessPolicy: 'auto' }, now: T }, { type: 'AUTOMATION_PAUSE', paused: true, now: T });
    const sess = s.profile.sessions.find((x) => x.id === 'BOS-CERT-01')!;
    s = reducer(s, { type: 'SESSION_SAVE', session: { ...sess, available: 6 }, now: T });
    expect(getDest(s, 'DEST-WEB-BOS-COURSE').content.schedule?.[0].available).toBe(8);
    expect(s.pendingSync.length).toBeGreaterThan(0);
    s = reducer(s, { type: 'AUTOMATION_PAUSE', paused: false, now: T });
    const d = getDest(s, 'DEST-WEB-BOS-COURSE');
    expect(d.content.schedule?.[0].available).toBe(6);
    expect(d.content.text).toBe(rec(s, 'REC-001').proposed.text);
    expect(s.pendingSync.length).toBe(0);
    expect(s.activity.some((a) => a.action.startsWith('Automatic factual sync'))).toBe(true);
  });

  it('cancelled class is not bookable in auto-synced preview', () => {
    let s = run(createInitialState(), { type: 'SETTINGS_SET', patch: { freshnessPolicy: 'auto' }, now: T });
    const sess = s.profile.sessions.find((x) => x.id === 'MIA-CERT-01')!;
    s = reducer(s, { type: 'SESSION_SAVE', session: { ...sess, status: 'cancelled' }, now: T });
    const snap = getDest(s, 'DEST-WEB-MIA-COURSE').content.schedule!.find((x) => x.sessionId === 'MIA-CERT-01')!;
    expect(snap.status).toBe('cancelled');
  });

  it('missing-facts recommendation stays blocked until credentials are confirmed', () => {
    let s = createInitialState();
    s = reducer(s, { type: 'PROFILE_SAVE_FIELDS', values: { credentials: 'Sample credential' }, now: T });
    expect(rec(s, 'REC-007').status).toBe('blocked');
    s = reducer(s, { type: 'PROFILE_SAVE_FIELDS', values: { credentials: 'Sample credential' }, verifiedIds: ['credentials'], now: T });
    expect(rec(s, 'REC-007').status).toBe('draft');
    expect(rec(s, 'REC-007').proposed.text).toContain('Sample credential');
  });
});

describe('persistence and exports', () => {
  it('falls back to fixtures on invalid JSON', () => {
    const fake = { getItem: () => '{not json', setItem() {}, removeItem() {} } as unknown as Storage;
    const r = loadState(fake);
    expect(r.notice).toBeTruthy();
    expect(overviewCounts(r.state).opportunities).toBe(7);
  });
  it('csv cells neutralize formulas and quote commas', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell(-3)).toBe('-3');
  });
});

describe('auto-sync with an existing pending update', () => {
  it('still syncs the destination when the policy switches to auto', () => {
    let s = run(createInitialState(), { type: 'REC_APPROVE', id: 'REC-001', now: T });
    s = publish(s, 'REC-001');
    const sess = () => s.profile.sessions.find((x) => x.id === 'BOS-CERT-01')!;
    s = reducer(s, { type: 'SESSION_SAVE', session: { ...sess(), available: 6 }, now: T });
    expect(s.recommendations.some((r) => r.issueKey === 'fresh:DEST-WEB-BOS-COURSE' && r.status === 'awaiting')).toBe(true);
    s = reducer(s, { type: 'SETTINGS_SET', patch: { freshnessPolicy: 'auto' }, now: T });
    s = reducer(s, { type: 'SESSION_SAVE', session: { ...sess(), available: 4 }, now: T });
    expect(getDest(s, 'DEST-WEB-BOS-COURSE').content.schedule?.[0].available).toBe(4);
  });
});

describe('simplified UI rules', () => {
  it('dashboard groups match the documented initial state', async () => {
    const { dashboardCounts, filterRecs } = await import('./selectors');
    const s = createInitialState();
    // To review: REC-001,002,003,005,006,007 · Ready: REC-004 · Applied: REC-008
    expect(dashboardCounts(s)).toEqual({ review: 6, ready: 1, applied: 1, later: 0 });
    const f = { city: 'all' as const, destination: 'all', priority: 'all' as const, q: '' };
    expect(filterRecs(s, { ...f, status: 'review' }).length).toBe(6);
    expect(filterRecs(s, { ...f, status: 'ready' }).length).toBe(1);
    // A city filter includes items for all cities.
    expect(filterRecs(s, { ...f, city: 'miami', status: 'unresolved' }).map((r) => r.id).sort()).toEqual(['REC-003', 'REC-007']);
  });

  it('“Not now” on a blocked item returns it to blocked on reopen until resolved', () => {
    let s = run(createInitialState(), { type: 'REC_DEFER', id: 'REC-002', now: T });
    expect(rec(s, 'REC-002').status).toBe('deferred');
    s = reducer(s, { type: 'REC_REOPEN', id: 'REC-002', now: T });
    expect(rec(s, 'REC-002').status).toBe('blocked');
    s = run(s, { type: 'REC_DEFER', id: 'REC-002', now: T }, { type: 'CONFLICT_RESOLVE', sessionId: 'BOS-CERT-01', source: 'odoo', now: T }, { type: 'REC_REOPEN', id: 'REC-002', now: T });
    expect(rec(s, 'REC-002').status).toBe('draft');
    expect(rec(s, 'REC-002').proposed.prices?.find((p) => p.sessionId === 'BOS-CERT-01')?.price).toBe(249);
  });

  it('deferring an approved item clears its approval', () => {
    const s = run(createInitialState(), { type: 'REC_DEFER', id: 'REC-004', now: T }, { type: 'REC_REOPEN', id: 'REC-004', now: T });
    expect(rec(s, 'REC-004').status).toBe('draft');
    expect(rec(s, 'REC-004').approvedRevision).toBeNull();
  });
});
