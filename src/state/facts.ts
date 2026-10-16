// Deterministic templates that turn course-session facts into destination content.
import type {
  CityId,
  CourseSession,
  DestContent,
  Destination,
  FactField,
  PriceRow,
  Recommendation,
  SessionSnapshot,
} from '../domain/types';
import { CITIES, COURSE_NAMES } from '../data/static';

export function displayPrice(s: CourseSession): number | null {
  return s.conflict?.status === 'open' ? null : s.price;
}

export function snapshotSession(s: CourseSession): SessionSnapshot {
  return {
    sessionId: s.id,
    courseName: COURSE_NAMES[s.courseId],
    cityName: CITIES[s.cityId].name,
    venue: s.venue,
    start: s.start,
    end: s.end,
    deadline: s.deadline,
    available: s.available,
    capacity: s.capacity,
    status: s.status,
    price: displayPrice(s),
  };
}

export function citySessions(sessions: CourseSession[], cityId: CityId): CourseSession[] {
  return sessions.filter((s) => s.cityId === cityId).sort((a, b) => a.start.localeCompare(b.start));
}

export function buildSchedule(sessions: CourseSession[], cityId: CityId): SessionSnapshot[] {
  return citySessions(sessions, cityId).map(snapshotSession);
}

export function buildPrices(sessions: CourseSession[]): PriceRow[] {
  return [...sessions]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => ({ sessionId: s.id, label: `${COURSE_NAMES[s.courseId]} — ${CITIES[s.cityId].name}`, price: displayPrice(s) }));
}

/** Session ids whose facts feed a destination's factual components. */
export function destinationSessionIds(dest: Destination, sessions: CourseSession[]): string[] {
  if (dest.kind === 'pricing') return sessions.map((s) => s.id);
  if ((dest.kind === 'course-page' || dest.kind === 'schema') && dest.cityId) {
    return citySessions(sessions, dest.cityId).map((s) => s.id);
  }
  return [];
}

/** Which destinations depend on a given session, and for which fact fields. */
export function dependentDestinations(destinations: Destination[], session: CourseSession, changed: FactField[]): Destination[] {
  return destinations.filter((d) => {
    if (d.kind === 'pricing') return changed.includes('price');
    if (d.kind === 'course-page' || d.kind === 'schema') return d.cityId === session.cityId;
    return false;
  });
}

/** Regenerate factual components (schedule, prices) that already exist on a content block. */
export function regenerateFacts(content: DestContent, dest: Destination, sessions: CourseSession[]): DestContent {
  const next: DestContent = { ...content };
  if (content.schedule && dest.cityId) next.schedule = buildSchedule(sessions, dest.cityId);
  if (content.prices) next.prices = buildPrices(sessions);
  return next;
}

export function regenerateRecFacts(rec: Recommendation, dest: Destination, sessions: CourseSession[]): DestContent {
  if (rec.factKind === 'text') return rec.proposed;
  return regenerateFacts(rec.proposed, dest, sessions);
}

export function diffSession(before: CourseSession, after: CourseSession): { fields: FactField[]; lines: string[] } {
  const fields = new Set<FactField>();
  const lines: string[] = [];
  const money = (v: number | null) => (v === null ? 'unresolved' : `$${v}`);
  if (before.start !== after.start || before.end !== after.end || before.deadline !== after.deadline) {
    fields.add('dates');
    if (before.start !== after.start) lines.push(`Start: ${before.start.replace('T', ' ')} → ${after.start.replace('T', ' ')}`);
    if (before.end !== after.end) lines.push(`End: ${before.end.replace('T', ' ')} → ${after.end.replace('T', ' ')}`);
    if (before.deadline !== after.deadline) lines.push(`Registration deadline: ${before.deadline} → ${after.deadline}`);
  }
  if (displayPrice(before) !== displayPrice(after)) {
    fields.add('price');
    lines.push(`Price: ${money(displayPrice(before))} → ${money(displayPrice(after))}`);
  }
  if (before.available !== after.available || before.capacity !== after.capacity) {
    fields.add('availability');
    lines.push(`Seats: ${before.available}/${before.capacity} → ${after.available}/${after.capacity}`);
  }
  if (before.venue !== after.venue) {
    fields.add('venue');
    lines.push(`Venue: ${before.venue} → ${after.venue}`);
  }
  if (before.status !== after.status) {
    fields.add('status');
    lines.push(`Status: ${before.status} → ${after.status}`);
  }
  return { fields: [...fields], lines };
}

export function isBookable(s: SessionSnapshot): boolean {
  return s.status === 'scheduled' && s.available > 0;
}

export function sessionStatusLabel(s: { status: string; available: number }): string {
  if (s.status === 'cancelled') return 'Cancelled';
  if (s.status === 'sold-out' || s.available <= 0) return 'Sold out';
  return 'Scheduled';
}
