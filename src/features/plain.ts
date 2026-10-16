// Customer-facing wording for recommendations and destinations.
// Derived at display time so saved demo data needs no migration.
import type { DemoState, Destination, Recommendation } from '../domain/types';
import { CITIES, EVIDENCE } from '../data/static';
import { getDest } from '../state/selectors';

const COPY: Record<string, { title: string; why: string }> = {
  'bos-dates': { title: 'Add upcoming Boston class dates', why: 'Customers cannot see when your next class starts.' },
  'bos-price': { title: 'Show one correct Boston course price', why: 'Your records list two different prices for the same class.' },
  'faq-prereq': { title: 'Answer common course questions', why: 'People want to know whether they are eligible and when to renew before they book.' },
  'bos-post': { title: 'Announce the next Boston class on Google', why: 'Your Google profile has no recent update about upcoming classes.' },
  'review-r2': { title: 'Reply to a customer review', why: 'A customer review has been waiting 9 days for a reply.' },
  'bos-schema': { title: 'Fix class details shown to search engines', why: 'Search engines are being told about a class that has already passed.' },
  'trust-credentials': { title: 'Show your instructors’ qualifications', why: 'Visitors cannot see who teaches the course or what qualifies them.' },
  'mia-register': { title: 'Make Miami registration easier', why: 'Miami visitors had no direct way to register next to class dates.' },
  'bos-gbp-desc': { title: 'Mention your class cities on Google', why: 'Your Google description doesn’t say where classes are held.' },
  'mia-ai': { title: 'Help AI tools describe Miami recertification', why: 'Sample AI answers about Miami recertification only name competitors.' },
};

const WHERE: Record<string, string> = {
  'DEST-WEB-BOS-COURSE': 'Boston course page',
  'DEST-WEB-MIA-COURSE': 'Miami course page',
  'DEST-WEB-PRICING': 'Website pricing section',
  'DEST-WEB-FAQ': 'Website questions page (FAQ)',
  'DEST-WEB-SCHEMA': 'Boston page details read by search engines',
  'DEST-WEB-TRUST': 'Website “About us” section',
  'DEST-GBP-POSTS': 'Google business post',
  'DEST-GBP-REVIEWS': 'Google review reply',
  'DEST-GBP-PROFILE': 'Google business description',
};

export function whereLabel(dest: Destination): string {
  return WHERE[dest.id] ?? dest.name;
}

export function plainCopy(rec: Recommendation, state: DemoState): { title: string; why: string } {
  if (COPY[rec.issueKey]) return COPY[rec.issueKey];
  if (rec.issueKey.startsWith('fresh:')) {
    return { title: `Update class details on the ${whereLabel(getDest(state, rec.destinationId))}`, why: 'A class changed, but this page still shows the old details.' };
  }
  if (rec.issueKey.startsWith('post-')) return { title: 'Publish a Google post', why: 'A recent post shows people that classes are running.' };
  if (rec.issueKey.startsWith('review-')) return { title: rec.title, why: 'A reply shows future customers that feedback is read.' };
  return { title: rec.title, why: rec.finding };
}

/** Short target label, e.g. "Website · Boston". */
export function targetLabel(rec: Recommendation, state: DemoState): string {
  const dest = getDest(state, rec.destinationId);
  return `${dest.channel === 'Website' ? 'Website' : 'Google'} · ${rec.cityId ? CITIES[rec.cityId].name : 'All cities'}`;
}

/** How much the evidence supports the finding — a description, not a score. */
export function evidenceConfidence(rec: Recommendation): string {
  const ev = rec.evidenceIds.map((id) => EVIDENCE.find((e) => e.id === id)).filter(Boolean);
  if (!ev.length || ev.some((e) => e!.sourceType === 'Internal data check')) return 'High — based on a direct check of your own demo data.';
  if (ev.length > 1) return `Moderate — ${ev.length} sample observations agree.`;
  return 'Moderate — one sample observation.';
}
