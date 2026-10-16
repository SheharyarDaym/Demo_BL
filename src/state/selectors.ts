import type { ConnectionId, DemoState, Destination, RecFilters, RecStatus, Recommendation } from '../domain/types';
import { QUERIES } from '../data/static';

export const UNRESOLVED: RecStatus[] = ['draft', 'awaiting', 'blocked', 'approved', 'publishing', 'failed'];

/** The single rule for "unresolved opportunity" used everywhere in the app. */
export function isUnresolved(rec: Recommendation): boolean {
  return UNRESOLVED.includes(rec.status);
}

export const STATUS_LABEL: Record<RecStatus, string> = {
  draft: 'Draft',
  awaiting: 'Awaiting approval',
  blocked: 'Blocked',
  approved: 'Approved — ready to apply',
  publishing: 'Applying…',
  published: 'Applied (demo)',
  failed: 'Apply failed',
  rejected: 'Rejected',
  deferred: 'Later',
};

export const CONNECTION_LABEL: Record<ConnectionId, string> = {
  odoo: 'Odoo',
  website: 'Website',
  google: 'Google profile',
  searchConsole: 'Search Console',
  aiMonitoring: 'AI monitoring',
};

/** Plain-language status groups used by the Dashboard cards and the improvement list. */
export const STATUS_GROUPS: Record<string, { label: string; statuses: RecStatus[] }> = {
  review: { label: 'To review', statuses: ['draft', 'awaiting', 'blocked', 'failed'] },
  ready: { label: 'Ready to apply', statuses: ['approved', 'publishing'] },
  applied: { label: 'Applied', statuses: ['published'] },
  later: { label: 'Later', statuses: ['deferred', 'rejected'] },
  unresolved: { label: 'All open', statuses: UNRESOLVED },
};

export function inGroup(rec: Recommendation, group: string): boolean {
  return STATUS_GROUPS[group]?.statuses.includes(rec.status) ?? false;
}

export function dashboardCounts(state: DemoState) {
  const n = (g: string) => state.recommendations.filter((r) => inGroup(r, g)).length;
  return { review: n('review'), ready: n('ready'), applied: n('applied'), later: n('later') };
}

export function overviewCounts(state: DemoState) {
  return {
    tracked: QUERIES.length,
    opportunities: state.recommendations.filter(isUnresolved).length,
    awaiting: state.recommendations.filter((r) => r.status === 'awaiting').length,
    published: state.publishJobs.filter((j) => j.status === 'succeeded').length,
  };
}

export function getDest(state: DemoState, id: string): Destination {
  const d = state.destinations.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown destination ${id}`);
  return d;
}

export function getRec(state: DemoState, id: string): Recommendation | undefined {
  return state.recommendations.find((r) => r.id === id);
}

export interface PublishCheck {
  ok: boolean;
  reason?: string;
  needsSettings?: boolean;
}

export function publishCheck(state: DemoState, rec: Recommendation): PublishCheck {
  switch (rec.status) {
    case 'publishing':
      return { ok: false, reason: 'Publishing is in progress.' };
    case 'draft':
      return { ok: false, reason: 'Drafts can’t be published. Submit it for approval, then approve it first.' };
    case 'awaiting':
      return { ok: false, reason: 'Approve this revision before publishing.' };
    case 'blocked':
      return { ok: false, reason: rec.blockedReason ?? 'Blocked until required facts are resolved.' };
    case 'published':
      return { ok: false, reason: 'This revision is already published. Edit the proposal to create a new revision.' };
    case 'rejected':
    case 'deferred':
      return { ok: false, reason: 'Reopen this recommendation before publishing.' };
  }
  if (rec.approvedRevision !== rec.revision) {
    return { ok: false, reason: 'The content changed after approval. Approve the current revision first.' };
  }
  for (const sid of rec.sessionIds) {
    const s = state.profile.sessions.find((x) => x.id === sid);
    if (!s) continue;
    if (rec.sourceVersions[sid] !== s.version) {
      return { ok: false, reason: 'Course facts changed after approval. Review and approve the updated revision.' };
    }
    // Schedule/schema proposals omit unresolved prices; only a pricing update needs the conflict resolved.
    if (rec.factKind === 'pricing' && s.conflict?.status === 'open') {
      return { ok: false, reason: 'A price conflict is still open for this class.' };
    }
  }
  const dest = getDest(state, rec.destinationId);
  if (state.settings.connections[dest.connection].status !== 'connected') {
    return {
      ok: false,
      needsSettings: true,
      reason: `The ${CONNECTION_LABEL[dest.connection]} demo connection is disconnected, so this can’t be published. Reconnect it in Settings.`,
    };
  }
  return { ok: true };
}

export function filterRecs(state: DemoState, f: RecFilters): Recommendation[] {
  const q = f.q.trim().toLowerCase();
  return state.recommendations
    .filter((r) => {
      if (f.runId) {
        const run = state.analysisRuns.find((x) => x.id === f.runId);
        if (run && !run.findingIds.includes(r.id)) return false;
      }
      if (f.city !== 'all') {
        // A city filter includes items that apply to every city.
        if (f.city === 'none' ? r.cityId !== null : r.cityId !== null && r.cityId !== f.city) return false;
      }
      if (f.destination !== 'all' && r.destinationId !== f.destination) return false;
      if (f.priority !== 'all' && r.priority !== f.priority) return false;
      if (STATUS_GROUPS[f.status] ? !inGroup(r, f.status) : f.status !== 'all' && r.status !== f.status) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort(byPriority);
}

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 } as const;
const STATUS_RANK: Record<RecStatus, number> = {
  failed: 0,
  awaiting: 1,
  approved: 2,
  publishing: 2,
  draft: 3,
  blocked: 4,
  deferred: 5,
  rejected: 6,
  published: 7,
};

export function byPriority(a: Recommendation, b: Recommendation): number {
  return STATUS_RANK[a.status] - STATUS_RANK[b.status] || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.id.localeCompare(b.id);
}

export function attentionList(state: DemoState): Recommendation[] {
  return state.recommendations
    .filter(isUnresolved)
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.id.localeCompare(b.id))
    .slice(0, 3);
}

export interface ChecklistItem {
  id: string;
  label: string;
  section: string;
  filled: boolean;
  verification: 'Verified identity' | 'Presenter-confirmed (demo)' | 'Sample — unverified' | 'Missing';
}

export function profileChecklist(state: DemoState): ChecklistItem[] {
  const items: ChecklistItem[] = state.profile.fields.map((f) => ({
    id: f.id,
    label: f.label,
    section: f.section,
    filled: f.value.trim().length > 0,
    verification: !f.value.trim()
      ? 'Missing'
      : f.verification === 'identity'
        ? 'Verified identity'
        : f.verification === 'presenter-confirmed'
          ? 'Presenter-confirmed (demo)'
          : 'Sample — unverified',
  }));
  for (const m of state.profile.media) {
    const filled = Boolean(m.dataUrl || m.illustration);
    items.push({
      id: m.id,
      label: m.label,
      section: 'media',
      filled,
      verification: !filled ? 'Missing' : m.sample ? 'Sample — unverified' : 'Presenter-confirmed (demo)',
    });
  }
  return items;
}

export function nextRecId(state: DemoState): string {
  const max = state.recommendations.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, '')) || 0), 0);
  return `REC-${String(max + 1).padStart(3, '0')}`;
}
