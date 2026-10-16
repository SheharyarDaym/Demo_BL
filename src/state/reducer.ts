// Pure state transitions. Every action carries its own timestamp so the reducer stays deterministic.
import type {
  ActivityEvent,
  AnalysisSelection,
  ConnectionId,
  Course,
  CourseSession,
  DemoState,
  DestContent,
  Destination,
  Faq,
  Recommendation,
  Settings,
  UiState,
} from '../domain/types';
import { ANALYSIS_CATALOG, AUTOMATION, PRESENTER, makeRecommendation, recTemplate } from '../data/fixtures';
import {
  dependentDestinations,
  destinationSessionIds,
  diffSession,
  regenerateFacts,
  regenerateRecFacts,
} from './facts';
import { CONNECTION_LABEL, getDest, isUnresolved, nextRecId, publishCheck } from './selectors';
import { CITIES, COURSE_NAMES, QUERIES } from '../data/static';

export type Action =
  | { type: 'RESET'; state: DemoState }
  | { type: 'ANALYSIS_COMPLETE'; selection: AnalysisSelection; startedAt: string; now: string }
  | { type: 'ANALYSIS_CANCELLED'; selection: AnalysisSelection; stage: number; startedAt: string; now: string }
  | { type: 'PROFILE_SAVE_FIELDS'; values: Record<string, string>; verifiedIds?: string[]; now: string }
  | { type: 'FAQS_SAVE'; faqs: Faq[]; now: string }
  | { type: 'COURSE_SAVE'; course: Course; now: string }
  | { type: 'SESSION_SAVE'; session: CourseSession; now: string }
  | { type: 'CONFLICT_RESOLVE'; sessionId: string; source: 'odoo' | 'website'; now: string }
  | { type: 'MEDIA_SET'; id: string; dataUrl: string | null; now: string }
  | { type: 'REVIEW_DRAFT_REPLY'; reviewId: string; text: string; now: string }
  | { type: 'POST_CREATE'; text: string; now: string }
  | { type: 'REC_SAVE'; id: string; text: string; now: string }
  | { type: 'REC_SUBMIT'; id: string; now: string }
  | { type: 'REC_APPROVE'; id: string; now: string }
  | { type: 'REC_REJECT'; id: string; reason: string; now: string }
  | { type: 'REC_DEFER'; id: string; now: string }
  | { type: 'REC_REOPEN'; id: string; now: string }
  | { type: 'REC_PROVIDE_FACTS'; id: string; credentials: string; instructors: string; now: string }
  | { type: 'REC_FROM_EVIDENCE'; issueKey: string; now: string }
  | { type: 'PUBLISH_START'; id: string; now: string }
  | { type: 'PUBLISH_SUCCESS'; id: string; key: string; now: string }
  | { type: 'PUBLISH_FAIL'; id: string; key: string; error: string; now: string }
  | { type: 'DEST_RESTORE'; destId: string; version: number; now: string }
  | { type: 'CONNECTION_SET'; id: ConnectionId; status: 'connected' | 'disconnected'; now: string }
  | { type: 'CONNECTION_TESTED'; id: ConnectionId; ok: boolean; now: string }
  | { type: 'SETTINGS_SET'; patch: Partial<Omit<Settings, 'connections' | 'automationPaused'>>; now: string }
  | { type: 'AUTOMATION_PAUSE'; paused: boolean; now: string }
  | { type: 'UI_SET'; patch: Partial<UiState> };

export const publishKey = (rec: Recommendation) => `${rec.id}:r${rec.revision}`;

function log(s: DemoState, e: Omit<ActivityEvent, 'id' | 'actor'> & { actor?: string }) {
  s.seq += 1;
  s.activity.unshift({ actor: PRESENTER, ...e, id: `ACT-${String(s.seq).padStart(4, '0')}` });
}

function sameContent(a: DestContent, b: DestContent) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function currentVersions(s: DemoState, ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) {
    const sess = s.profile.sessions.find((x) => x.id === id);
    if (sess) out[id] = sess.version;
  }
  return out;
}

function clearApproval(rec: Recommendation) {
  rec.approvedRevision = null;
  rec.approvedBy = null;
  rec.approvedAt = null;
}

function hasOpenConflict(s: DemoState, rec: Recommendation) {
  return rec.sessionIds.some((id) => s.profile.sessions.find((x) => x.id === id)?.conflict?.status === 'open');
}

function summarize(c: DestContent): string {
  const parts = [c.text];
  if (c.schedule) parts.push(`${c.schedule.length} class listing(s)`);
  if (c.prices) parts.push(c.prices.map((p) => `${p.label}: ${p.price === null ? 'not shown' : `$${p.price}`}`).join('; '));
  return parts.filter(Boolean).join(' · ');
}

function pushVersion(d: Destination, content: DestContent, at: string, note: string, actor: string, rec?: Recommendation) {
  d.version += 1;
  d.content = content;
  d.history.push({ version: d.version, content, at, note, actor, recommendationId: rec?.id, revision: rec?.revision });
}

function upsertFreshnessRec(s: DemoState, d: Destination, change: string, cityId: Recommendation['cityId'], courseId: Recommendation['courseId'], now: string) {
  const key = `fresh:${d.id}`;
  const existing = s.recommendations.find((r) => r.issueKey === key && isUnresolved(r));
  const proposedBase = existing ? existing.proposed : d.content;
  const proposed = regenerateFacts(proposedBase, d, s.profile.sessions);
  const sessionIds = destinationSessionIds(d, s.profile.sessions);
  if (existing) {
    existing.proposed = proposed;
    existing.sessionIds = sessionIds;
    existing.sourceVersions = currentVersions(s, sessionIds);
    existing.revision += 1;
    existing.changeNote = `${existing.changeNote ?? ''}\n${change}`.trim();
    if (existing.status !== 'awaiting') {
      existing.status = 'awaiting';
      clearApproval(existing);
    }
    existing.updatedAt = now;
    log(s, {
      at: now,
      category: 'sync',
      action: `Course change added to pending update: ${existing.title}`,
      destination: d.name,
      status: 'pending',
      recommendationId: existing.id,
      actor: AUTOMATION,
      after: change,
      details: 'Review required by the freshness policy. The destination was not changed.',
    });
    return;
  }
  const id = nextRecId(s);
  const rec = makeRecommendation(
    {
      id,
      issueKey: key,
      title: `${d.name.replace(/^Website — /, '').replace(/^\w/, (c) => c.toUpperCase())}: class details changed`,
      cityId,
      courseId,
      destinationId: d.id,
      priority: change.includes('Status') || change.includes('Seats') ? 'High' : 'Medium',
      status: 'awaiting',
      finding: `Class details changed in the demo source, but the published ${d.name.replace(/^Website — /, '')} still shows the previous details.`,
      whyItMatters: 'Visitors and search tools should see the same dates, seats, and prices as registration.',
      evidenceSummary: 'Internal freshness check compared the current class list with the published demo page.',
      evidenceIds: [],
      action: 'Update the factual class details on this page from the current class list.',
      benefit: 'Keeps published class details current. Sold-out or cancelled classes stop showing registration buttons.',
      proposed,
      factKind: d.kind === 'pricing' ? 'pricing' : d.kind === 'schema' ? 'schema' : 'schedule',
      sessionIds,
      factFields: d.kind === 'pricing' ? ['price'] : ['dates', 'price', 'availability', 'venue', 'status'],
      changeNote: change,
    },
    s.profile.sessions,
    now,
  );
  s.recommendations.push(rec);
  log(s, {
    at: now,
    category: 'sync',
    action: `Course change detected — review required: ${rec.title}`,
    destination: d.name,
    status: 'pending',
    recommendationId: id,
    actor: AUTOMATION,
    after: change,
    details: 'Freshness policy requires review. A pending update was created; the destination was not changed.',
  });
}

function autoSync(s: DemoState, d: Destination, content: DestContent, change: string, now: string) {
  const before = summarize(d.content);
  pushVersion(d, content, now, 'Automatic factual sync (schedule, availability, price)', AUTOMATION);
  log(s, {
    at: now,
    category: 'sync',
    action: `Automatic factual sync: ${d.name}`,
    destination: d.name,
    status: 'success',
    actor: AUTOMATION,
    before,
    after: `${change} → ${summarize(content)}`,
    details: 'Only preapproved factual components were updated, using a fixed template. Wording was not changed.',
  });
}

function routeDestinationChange(s: DemoState, d: Destination, change: string, cityId: Recommendation['cityId'], courseId: Recommendation['courseId'], sessionId: string, now: string) {
  const content = regenerateFacts(d.content, d, s.profile.sessions);
  if (sameContent(content, d.content)) return;
  if (s.settings.automationPaused) {
    queue(s, d, sessionId, 'Demo automation is paused', change, now);
    return;
  }
  if (s.settings.freshnessPolicy === 'review') {
    upsertFreshnessRec(s, d, change, cityId, courseId, now);
    return;
  }
  if (s.settings.connections[d.connection].status !== 'connected') {
    queue(s, d, sessionId, `${CONNECTION_LABEL[d.connection]} demo connection is disconnected`, change, now);
    return;
  }
  autoSync(s, d, content, change, now);
}

function queue(s: DemoState, d: Destination, sessionId: string, reason: string, change: string, now: string) {
  s.seq += 1;
  s.pendingSync.push({ id: `PEND-${s.seq}`, sessionId, destinationId: d.id, reason, change, detectedAt: now });
  log(s, {
    at: now,
    category: 'sync',
    action: `Change queued: ${d.name}`,
    destination: d.name,
    status: 'pending',
    actor: AUTOMATION,
    after: change,
    details: `${reason}. The change will be processed when this is resolved.`,
  });
}

function processPending(s: DemoState, now: string) {
  if (s.settings.automationPaused || !s.pendingSync.length) return;
  const items = s.pendingSync;
  s.pendingSync = [];
  const byDest = new Map<string, typeof items>();
  for (const it of items) byDest.set(it.destinationId, [...(byDest.get(it.destinationId) ?? []), it]);
  for (const [destId, list] of byDest) {
    const d = getDest(s, destId);
    const change = list.map((x) => x.change).join('\n');
    const sess = s.profile.sessions.find((x) => x.id === list[0].sessionId);
    routeDestinationChange(s, d, change, d.cityId ?? sess?.cityId ?? null, sess?.courseId ?? null, list[0].sessionId, now);
  }
}

/** Propagate a course-session change to dependent recommendations and destinations. */
function applySessionChange(s: DemoState, before: CourseSession, after: CourseSession, now: string) {
  const { fields, lines } = diffSession(before, after);
  if (!fields.length) return;
  const change = `${after.id} (${COURSE_NAMES[after.courseId]}, ${CITIES[after.cityId].name}): ${lines.join('; ')}`;
  const covered = new Set<string>();

  for (const rec of s.recommendations) {
    if (!rec.sessionIds.includes(after.id) || !isUnresolved(rec)) continue;
    const relevant = rec.factFields.some((f) => fields.includes(f));
    if (!relevant) {
      rec.sourceVersions[after.id] = after.version;
      continue;
    }
    const dest = getDest(s, rec.destinationId);
    const wasApproved = rec.status === 'approved' || rec.status === 'failed' || rec.status === 'publishing';
    if (rec.status === 'publishing') {
      const job = s.publishJobs.find((j) => j.id === publishKey(rec));
      if (job) {
        job.status = 'failed';
        job.error = 'Course facts changed while publishing.';
      }
    }
    rec.proposed = regenerateRecFacts(rec, dest, s.profile.sessions);
    rec.sourceVersions = currentVersions(s, rec.sessionIds);
    rec.revision += 1;
    rec.changeNote = `Source facts changed — ${change}${rec.factKind === 'text' ? '. Check that the wording still matches.' : ''}`;
    rec.updatedAt = now;
    if (rec.factKind !== 'text') covered.add(rec.destinationId);
    if (wasApproved) {
      rec.status = 'awaiting';
      rec.error = undefined;
      clearApproval(rec);
      log(s, {
        at: now,
        category: 'approval',
        action: `Approval revoked — course facts changed: ${rec.title}`,
        destination: dest.name,
        status: 'info',
        recommendationId: rec.id,
        actor: AUTOMATION,
        after: change,
      });
    }
    if (rec.status === 'blocked' && rec.blockKind === 'source-conflict' && !hasOpenConflict(s, rec)) {
      rec.status = 'awaiting';
      rec.blockKind = undefined;
      rec.blockedReason = undefined;
      log(s, {
        at: now,
        category: 'approval',
        action: `Unblocked — source conflict resolved: ${rec.title}`,
        destination: dest.name,
        status: 'info',
        recommendationId: rec.id,
        actor: AUTOMATION,
        details: 'A draft was prepared from the chosen source and is awaiting approval.',
      });
    }
  }

  for (const d of dependentDestinations(s.destinations, after, fields)) {
    // Under "require review", a refreshed pending recommendation already carries the change.
    // Under auto-sync, factual components still sync even if a pending recommendation exists.
    if (covered.has(d.id) && s.settings.freshnessPolicy === 'review') continue;
    routeDestinationChange(s, d, change, d.cityId ?? after.cityId, after.courseId, after.id, now);
  }
}

function revalidateMissingFacts(s: DemoState, now: string) {
  const cred = s.profile.fields.find((f) => f.id === 'credentials');
  const instr = s.profile.fields.find((f) => f.id === 'instructors');
  if (!cred || cred.verification !== 'presenter-confirmed' || !cred.value.trim()) return;
  for (const rec of s.recommendations) {
    if (rec.status !== 'blocked' || rec.blockKind !== 'missing-facts') continue;
    const why = s.profile.fields.find((f) => f.id === 'whyChooseUs')?.value ?? '';
    const team = instr?.value.trim() ? `\n\nOur instructors: ${instr.value.trim()}` : '';
    rec.proposed = { ...rec.proposed, text: `${why}${team}\n\nCredentials: ${cred.value.trim()}` };
    rec.status = 'draft';
    rec.blockKind = undefined;
    rec.blockedReason = undefined;
    rec.revision += 1;
    rec.updatedAt = now;
    rec.changeNote = 'Drafted only from the credential details you confirmed in this demo.';
    log(s, {
      at: now,
      category: 'approval',
      action: `Unblocked — verified facts supplied: ${rec.title}`,
      destination: getDest(s, rec.destinationId).name,
      status: 'info',
      recommendationId: rec.id,
      details: 'A draft was written from presenter-confirmed sample facts only.',
    });
  }
}

function editRecText(s: DemoState, rec: Recommendation, text: string, now: string) {
  if (rec.proposed.text === text) return;
  const prev = rec.status;
  rec.proposed = { ...rec.proposed, text };
  rec.revision += 1;
  rec.updatedAt = now;
  rec.error = undefined;
  let note = 'Draft saved';
  if (prev === 'approved' || prev === 'failed') {
    rec.status = 'awaiting';
    clearApproval(rec);
    note = 'Edited after approval — approval revoked and returned for review';
  } else if (prev === 'published') {
    rec.status = 'awaiting';
    clearApproval(rec);
    note = `New revision ${rec.revision} created — published revision kept in history`;
  }
  log(s, {
    at: now,
    category: 'approval',
    action: `${note}: ${rec.title}`,
    destination: getDest(s, rec.destinationId).name,
    status: 'info',
    recommendationId: rec.id,
    after: `Revision ${rec.revision}`,
  });
}

function runAnalysis(s: DemoState, sel: AnalysisSelection, startedAt: string, now: string) {
  s.seq += 1;
  const runId = `RUN-${s.seq}`;
  const findingIds: string[] = [];
  let newCount = 0;
  let updatedCount = 0;
  const matches = ANALYSIS_CATALOG.filter(
    (c) =>
      (sel.cityId === 'all' || c.cityId === null || c.cityId === sel.cityId) &&
      (sel.courseId === 'all' || c.courseId === null || c.courseId === sel.courseId) &&
      c.channels.some((ch) => sel.platforms.includes(ch)),
  );
  for (const m of matches) {
    const existing = s.recommendations.find((r) => r.issueKey === m.issueKey);
    if (existing) {
      existing.detectedAt = now;
      existing.detectionCount += 1;
      existing.lastRunId = runId;
      findingIds.push(existing.id);
      updatedCount++;
      continue;
    }
    const tpl = recTemplate(m.issueKey, s.profile.sessions, s.destinations);
    if (!tpl) continue;
    const rec = makeRecommendation({ ...tpl, id: nextRecId(s), lastRunId: runId }, s.profile.sessions, now);
    s.recommendations.push(rec);
    findingIds.push(rec.id);
    newCount++;
  }
  // Freshness check: published factual content that no longer matches the class list.
  if (sel.platforms.includes('organic')) {
    for (const d of s.destinations) {
      if (!['course-page', 'pricing', 'schema'].includes(d.kind)) continue;
      if (sel.cityId !== 'all' && d.cityId && d.cityId !== sel.cityId) continue;
      const content = regenerateFacts(d.content, d, s.profile.sessions);
      if (sameContent(content, d.content)) continue;
      const open = s.recommendations.find((r) => r.destinationId === d.id && isUnresolved(r) && r.factKind !== 'text');
      if (open) {
        if (!findingIds.includes(open.id)) {
          open.lastRunId = runId;
          findingIds.push(open.id);
          updatedCount++;
        }
        continue;
      }
      upsertFreshnessRec(s, d, 'Analysis found published class details that differ from the current class list.', d.cityId ?? null, null, now);
      const created = s.recommendations[s.recommendations.length - 1];
      created.lastRunId = runId;
      findingIds.push(created.id);
      newCount++;
    }
  }
  s.analysisRuns.unshift({ ...sel, id: runId, status: 'completed', stage: 4, startedAt, completedAt: now, findingIds, newCount, updatedCount });
  const scope = `${sel.cityId === 'all' ? 'All cities' : CITIES[sel.cityId].name}, ${sel.courseId === 'all' ? 'all courses' : COURSE_NAMES[sel.courseId].toLowerCase()}`;
  log(s, {
    at: now,
    category: 'analysis',
    action: `Analysis completed — ${scope}`,
    status: 'success',
    after: `${findingIds.length} findings (${newCount} new, ${updatedCount} already tracked and updated)`,
    details: `Channels: ${sel.platforms.map((p) => ({ organic: 'Google Search', maps: 'Google Maps', ai: 'AI responses' })[p]).join(', ')}.${sel.queryId ? ` Search phrase: “${QUERIES.find((q) => q.id === sel.queryId)?.text ?? sel.queryId}”.` : ''} Run ${runId}.`,
  });
}

export function reducer(state: DemoState, action: Action): DemoState {
  if (action.type === 'RESET') return action.state;
  if (action.type === 'UI_SET') return { ...state, ui: { ...state.ui, ...action.patch } };

  const s: DemoState = structuredClone(state);
  const now = action.now;
  const rec = 'id' in action && typeof action.id === 'string' ? s.recommendations.find((r) => r.id === action.id) : undefined;

  switch (action.type) {
    case 'ANALYSIS_COMPLETE':
      runAnalysis(s, action.selection, action.startedAt, now);
      return s;

    case 'ANALYSIS_CANCELLED': {
      s.seq += 1;
      s.analysisRuns.unshift({ ...action.selection, id: `RUN-${s.seq}`, status: 'cancelled', stage: action.stage, startedAt: action.startedAt, completedAt: now, findingIds: [], newCount: 0, updatedCount: 0 });
      log(s, { at: now, category: 'analysis', action: 'Analysis cancelled', status: 'cancelled', details: `Stopped at stage ${action.stage + 1} of 4. No findings were changed.` });
      return s;
    }

    case 'PROFILE_SAVE_FIELDS': {
      const changes: string[] = [];
      const befores: string[] = [];
      for (const f of s.profile.fields) {
        if (!(f.id in action.values)) continue;
        const v = action.values[f.id].trim();
        const confirm = action.verifiedIds?.includes(f.id) ?? false;
        if (v === f.value && !(confirm && f.verification !== 'presenter-confirmed')) continue;
        befores.push(`${f.label}: ${f.value || '(empty)'}`);
        changes.push(`${f.label}: ${v || '(empty)'}`);
        f.value = v;
        f.source = 'manual';
        f.updatedAt = now;
        f.verification = !v ? 'unknown' : confirm ? 'presenter-confirmed' : 'sample';
      }
      if (!changes.length) return state;
      s.profile.version += 1;
      log(s, { at: now, category: 'profile', action: 'Business information updated', destination: 'Business Profile', status: 'success', before: befores.join('\n'), after: changes.join('\n') });
      revalidateMissingFacts(s, now);
      return s;
    }

    case 'FAQS_SAVE':
      s.profile.faqs = action.faqs.map((f) => ({ ...f, source: 'manual', updatedAt: now }));
      s.profile.version += 1;
      log(s, { at: now, category: 'profile', action: 'FAQs updated', destination: 'Business Profile', status: 'success', after: `${action.faqs.length} questions` });
      return s;

    case 'COURSE_SAVE': {
      const i = s.profile.courses.findIndex((c) => c.id === action.course.id);
      if (i < 0) return state;
      const before = s.profile.courses[i];
      s.profile.courses[i] = { ...action.course, source: 'manual', updatedAt: now, version: before.version + 1 };
      log(s, { at: now, category: 'profile', action: `Course updated: ${action.course.name}`, destination: 'Business Profile', status: 'success', before: before.description, after: action.course.description });
      return s;
    }

    case 'SESSION_SAVE': {
      const i = s.profile.sessions.findIndex((x) => x.id === action.session.id);
      if (i < 0) return state;
      const before = s.profile.sessions[i];
      const { fields } = diffSession(before, action.session);
      if (!fields.length) return state;
      const after: CourseSession = { ...action.session, version: before.version + 1, updatedAt: now, source: 'manual' };
      s.profile.sessions[i] = after;
      log(s, {
        at: now,
        category: 'profile',
        action: `Class updated: ${after.id}`,
        destination: 'Business Profile',
        status: 'success',
        after: diffSession(before, after).lines.join('\n'),
      });
      applySessionChange(s, before, after, now);
      return s;
    }

    case 'CONFLICT_RESOLVE': {
      const i = s.profile.sessions.findIndex((x) => x.id === action.sessionId);
      const before = s.profile.sessions[i];
      if (!before?.conflict || before.conflict.status !== 'open') return state;
      const price = before.conflict.values[action.source];
      const after: CourseSession = {
        ...before,
        price,
        source: action.source,
        conflict: { ...before.conflict, status: 'resolved', chosen: action.source, resolvedAt: now },
        version: before.version + 1,
        updatedAt: now,
      };
      s.profile.sessions[i] = after;
      log(s, {
        at: now,
        category: 'sync',
        action: `Price conflict resolved for ${after.id}`,
        destination: 'Business Profile',
        status: 'success',
        before: `Odoo demo source $${before.conflict.values.odoo} vs website snapshot $${before.conflict.values.website}`,
        after: `${action.source === 'odoo' ? 'Odoo demo source' : 'Website snapshot'} chosen: $${price}`,
      });
      applySessionChange(s, before, after, now);
      return s;
    }

    case 'MEDIA_SET': {
      const m = s.profile.media.find((x) => x.id === action.id);
      if (!m) return state;
      const had = Boolean(m.dataUrl || m.illustration);
      m.dataUrl = action.dataUrl ?? undefined;
      if (action.dataUrl) {
        m.illustration = undefined;
        m.sample = false;
        m.caption = 'Uploaded in this demo session (stored locally in this browser)';
      } else {
        m.illustration = undefined;
        m.sample = false;
        m.caption = 'Removed in this demo session.';
      }
      m.updatedAt = now;
      log(s, { at: now, category: 'profile', action: `${action.dataUrl ? (had ? 'Media replaced' : 'Media added') : 'Media removed'}: ${m.label}`, destination: 'Business Profile', status: 'success' });
      return s;
    }

    case 'REVIEW_DRAFT_REPLY': {
      const review = s.profile.reviews.find((r) => r.id === action.reviewId);
      if (!review) return state;
      const existing = review.recommendationId ? s.recommendations.find((r) => r.id === review.recommendationId) : undefined;
      if (existing) {
        editRecText(s, existing, action.text, now);
        return s;
      }
      const id = nextRecId(s);
      s.recommendations.push(
        makeRecommendation(
          {
            id,
            issueKey: `review-${review.id}`,
            title: `Reply to ${review.author}’s review`,
            cityId: review.cityId,
            courseId: null,
            destinationId: 'DEST-GBP-REVIEWS',
            priority: 'Low',
            status: 'draft',
            reviewId: review.id,
            finding: `${review.author} left a ${review.rating}-star sample review.`,
            whyItMatters: 'Replies show future customers that feedback is read.',
            evidenceSummary: `Sample review: “${review.text}”`,
            evidenceIds: [],
            action: 'Reply to the review.',
            benefit: 'Shows responsiveness to prospective students.',
            proposed: { title: `Reply to ${review.author}`, text: action.text },
            factKind: 'text',
            sessionIds: [],
            factFields: [],
          },
          s.profile.sessions,
          now,
        ),
      );
      review.recommendationId = id;
      log(s, { at: now, category: 'approval', action: `Review reply drafted: ${review.author}`, destination: 'Google profile — review replies (demo)', status: 'info', recommendationId: id });
      return s;
    }

    case 'POST_CREATE': {
      const id = nextRecId(s);
      s.recommendations.push(
        makeRecommendation(
          {
            id,
            issueKey: `post-${id}`,
            title: `Google post: ${action.text.slice(0, 48)}${action.text.length > 48 ? '…' : ''}`,
            cityId: null,
            courseId: null,
            destinationId: 'DEST-GBP-POSTS',
            priority: 'Low',
            status: 'draft',
            finding: 'Presenter-created post draft.',
            whyItMatters: 'Recent posts show that the business is active.',
            evidenceSummary: 'Created manually in Business Profile.',
            evidenceIds: [],
            action: 'Review and publish the post.',
            benefit: 'Profile visitors see current news.',
            proposed: { title: 'Post', text: action.text },
            factKind: 'text',
            sessionIds: [],
            factFields: [],
          },
          s.profile.sessions,
          now,
        ),
      );
      log(s, { at: now, category: 'approval', action: 'Google post drafted', destination: 'Google profile — posts (demo)', status: 'info', recommendationId: id });
      return s;
    }

    case 'REC_SAVE':
      if (!rec || ['blocked', 'rejected', 'deferred', 'publishing'].includes(rec.status)) return state;
      editRecText(s, rec, action.text, now);
      return s;

    case 'REC_SUBMIT':
      if (!rec || rec.status !== 'draft') return state;
      rec.status = 'awaiting';
      rec.updatedAt = now;
      log(s, { at: now, category: 'approval', action: `Submitted for approval: ${rec.title}`, destination: getDest(s, rec.destinationId).name, status: 'info', recommendationId: rec.id });
      return s;

    case 'REC_APPROVE':
      if (!rec || rec.status !== 'awaiting') return state;
      rec.status = 'approved';
      rec.approvedRevision = rec.revision;
      rec.approvedBy = PRESENTER;
      rec.approvedAt = now;
      rec.updatedAt = now;
      log(s, { at: now, category: 'approval', action: `Approved: ${rec.title}`, destination: getDest(s, rec.destinationId).name, status: 'success', recommendationId: rec.id, after: `Revision ${rec.revision} approved` });
      return s;

    case 'REC_REJECT':
      if (!rec || !['draft', 'awaiting', 'approved', 'failed'].includes(rec.status)) return state;
      clearApproval(rec);
      rec.status = 'rejected';
      rec.rejectReason = action.reason.trim() || undefined;
      rec.updatedAt = now;
      log(s, { at: now, category: 'approval', action: `Rejected: ${rec.title}`, destination: getDest(s, rec.destinationId).name, status: 'info', recommendationId: rec.id, details: rec.rejectReason ? `Reason: ${rec.rejectReason}` : 'No reason given.' });
      return s;

    case 'REC_DEFER':
      if (!rec || !['draft', 'awaiting', 'blocked', 'approved', 'failed'].includes(rec.status)) return state;
      clearApproval(rec);
      rec.status = 'deferred';
      rec.updatedAt = now;
      log(s, { at: now, category: 'approval', action: `Deferred: ${rec.title}`, destination: getDest(s, rec.destinationId).name, status: 'info', recommendationId: rec.id });
      return s;

    case 'REC_REOPEN': {
      if (!rec || (rec.status !== 'rejected' && rec.status !== 'deferred')) return state;
      rec.rejectReason = undefined;
      rec.updatedAt = now;
      // An item deferred while blocked returns to blocked unless its facts were resolved meanwhile.
      if (rec.blockKind === 'source-conflict' && hasOpenConflict(s, rec)) rec.status = 'blocked';
      else if (rec.blockKind === 'missing-facts') rec.status = 'blocked';
      else {
        if (rec.blockKind === 'source-conflict') {
          rec.blockKind = undefined;
          rec.blockedReason = undefined;
          rec.proposed = regenerateRecFacts(rec, getDest(s, rec.destinationId), s.profile.sessions);
          rec.sourceVersions = currentVersions(s, rec.sessionIds);
        }
        rec.status = 'draft';
      }
      log(s, { at: now, category: 'approval', action: `Reopened: ${rec.title}`, destination: getDest(s, rec.destinationId).name, status: 'info', recommendationId: rec.id });
      if (rec.blockKind === 'missing-facts') revalidateMissingFacts(s, now);
      return s;
    }

    case 'REC_PROVIDE_FACTS': {
      if (!rec || rec.blockKind !== 'missing-facts') return state;
      for (const f of s.profile.fields) {
        const v = f.id === 'credentials' ? action.credentials.trim() : f.id === 'instructors' ? action.instructors.trim() : null;
        if (v === null || !v) continue;
        f.value = v;
        f.source = 'manual';
        f.verification = 'presenter-confirmed';
        f.updatedAt = now;
      }
      log(s, { at: now, category: 'profile', action: 'Credential details confirmed (demo)', destination: 'Business Profile', status: 'success', after: action.credentials.trim() });
      revalidateMissingFacts(s, now);
      return s;
    }

    case 'REC_FROM_EVIDENCE': {
      if (s.recommendations.some((r) => r.issueKey === action.issueKey)) return state;
      const tpl = recTemplate(action.issueKey, s.profile.sessions, s.destinations);
      if (!tpl) return state;
      const id = nextRecId(s);
      s.recommendations.push(makeRecommendation({ ...tpl, id }, s.profile.sessions, now));
      log(s, { at: now, category: 'analysis', action: `Recommendation created from evidence: ${tpl.title}`, status: 'info', recommendationId: id });
      return s;
    }

    case 'PUBLISH_START': {
      if (!rec) return state;
      const key = publishKey(rec);
      const job = s.publishJobs.find((j) => j.id === key);
      if (job?.status === 'succeeded' || job?.status === 'pending') return state;
      if (!publishCheck(state, state.recommendations.find((r) => r.id === rec.id)!).ok) return state;
      if (job) {
        job.status = 'pending';
        job.attempts += 1;
        job.error = undefined;
      } else {
        s.publishJobs.push({ id: key, recommendationId: rec.id, revision: rec.revision, status: 'pending', attempts: 1, startedAt: now });
      }
      rec.status = 'publishing';
      rec.error = undefined;
      return s;
    }

    case 'PUBLISH_SUCCESS': {
      const job = s.publishJobs.find((j) => j.id === action.key);
      if (!rec || !job || job.status !== 'pending' || rec.status !== 'publishing' || publishKey(rec) !== action.key) return state;
      const d = getDest(s, rec.destinationId);
      const before = d.mode === 'replace' ? summarize(d.content) : `${d.content.items?.length ?? 0} item(s)`;
      let content: DestContent;
      if (d.mode === 'replace') {
        content = { ...rec.proposed };
      } else {
        content = {
          ...d.content,
          items: [{ id: `ITEM-${action.key}`, text: rec.proposed.text, at: now, recommendationId: rec.id, reviewId: rec.reviewId }, ...(d.content.items ?? [])],
        };
      }
      pushVersion(d, content, now, `Published demo update (${rec.id} revision ${rec.revision})`, PRESENTER, rec);
      if (rec.reviewId) {
        const review = s.profile.reviews.find((r) => r.id === rec.reviewId);
        if (review) review.publishedReply = rec.proposed.text;
      }
      job.status = 'succeeded';
      job.finishedAt = now;
      job.destinationVersion = d.version;
      rec.status = 'published';
      rec.publishedRevisions.push(rec.revision);
      rec.updatedAt = now;
      rec.error = undefined;
      log(s, {
        at: now,
        category: 'publishing',
        action: `Published demo: ${rec.title}`,
        destination: d.name,
        status: 'success',
        recommendationId: rec.id,
        before,
        after: d.mode === 'replace' ? summarize(content) : rec.proposed.text,
        details: `Simulated publish — nothing was sent to Google or any external service. Destination version ${d.version}. Attempt ${job.attempts}.`,
      });
      return s;
    }

    case 'PUBLISH_FAIL': {
      const job = s.publishJobs.find((j) => j.id === action.key);
      if (!rec || !job || job.status !== 'pending') return state;
      job.status = 'failed';
      job.error = action.error;
      job.finishedAt = now;
      rec.status = 'failed';
      rec.error = action.error;
      rec.updatedAt = now;
      s.settings.failNextPublish = false;
      log(s, {
        at: now,
        category: 'publishing',
        action: `Publish failed (simulated): ${rec.title}`,
        destination: getDest(s, rec.destinationId).name,
        status: 'failed',
        recommendationId: rec.id,
        details: `${action.error} The destination preview was not changed. Retry is available.`,
      });
      return s;
    }

    case 'DEST_RESTORE': {
      const d = getDest(s, action.destId);
      const v = d.history.find((h) => h.version === action.version);
      if (!v || d.mode !== 'replace' || v.version === d.version) return state;
      const before = summarize(d.content);
      pushVersion(d, v.content, now, `Restored version ${v.version}`, PRESENTER);
      log(s, {
        at: now,
        category: 'publishing',
        action: `Restored previous version: ${d.name}`,
        destination: d.name,
        status: 'success',
        before,
        after: summarize(v.content),
        details: `Restored version ${v.version} as new version ${d.version}. Earlier publication records are kept. Demo website restore only.`,
      });
      return s;
    }

    case 'CONNECTION_SET': {
      s.settings.connections[action.id].status = action.status;
      log(s, {
        at: now,
        category: 'settings',
        action: `${CONNECTION_LABEL[action.id]} demo connection ${action.status === 'connected' ? 'connected' : 'disconnected'}`,
        status: 'info',
        destination: CONNECTION_LABEL[action.id],
      });
      if (action.status === 'connected') processPending(s, now);
      return s;
    }

    case 'CONNECTION_TESTED': {
      const c = s.settings.connections[action.id];
      c.lastTestedAt = now;
      c.lastTestResult = action.ok ? 'ok' : 'failed';
      log(s, {
        at: now,
        category: 'settings',
        action: `Demo connection test ${action.ok ? 'passed' : 'failed'}: ${CONNECTION_LABEL[action.id]}`,
        status: action.ok ? 'success' : 'failed',
        destination: CONNECTION_LABEL[action.id],
        details: action.ok ? 'Simulated check only.' : 'The demo connection is disconnected. Connect it to pass the test.',
      });
      return s;
    }

    case 'SETTINGS_SET': {
      const p = action.patch;
      const notes: string[] = [];
      if (p.cadence && p.cadence !== s.settings.cadence) notes.push(`Monitoring cadence: ${p.cadence} (demo schedule only)`);
      if (p.freshnessPolicy && p.freshnessPolicy !== s.settings.freshnessPolicy)
        notes.push(p.freshnessPolicy === 'auto' ? 'Freshness policy: automatically sync approved factual fields' : 'Freshness policy: require review');
      if (p.failNextPublish !== undefined && p.failNextPublish !== s.settings.failNextPublish)
        notes.push(p.failNextPublish ? 'Next demo publish will fail (simulation)' : 'Publishing failure simulation turned off');
      if (p.snapshot && p.snapshot !== s.settings.snapshot)
        notes.push(p.snapshot === 'later' ? 'Loaded later demo snapshot (simulated future measurement)' : 'Returned to baseline demo snapshot');
      s.settings = { ...s.settings, ...p };
      for (const n of notes) log(s, { at: now, category: 'settings', action: n, status: 'info' });
      return s;
    }

    case 'AUTOMATION_PAUSE': {
      if (s.settings.automationPaused === action.paused) return state;
      s.settings.automationPaused = action.paused;
      log(s, {
        at: now,
        category: 'settings',
        action: action.paused ? 'Demo automation paused' : 'Demo automation resumed',
        status: 'info',
        details: action.paused
          ? 'Detected changes will be queued as pending.'
          : `${s.pendingSync.length} queued change(s) processed according to the freshness policy.`,
      });
      if (!action.paused) processPending(s, now);
      return s;
    }
  }
  return state;
}
