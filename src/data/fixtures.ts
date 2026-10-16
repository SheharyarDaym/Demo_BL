// Initial mutable demo state. Every operational value here is fictional sample data;
// only the brand name and website are identity context.
import type {
  ActivityEvent,
  CityId,
  Channel,
  CourseId,
  CourseSession,
  DemoState,
  DestContent,
  Destination,
  ProfileField,
  Recommendation,
} from '../domain/types';
import { buildPrices, buildSchedule, displayPrice } from '../state/facts';
import { BASELINE_AT } from './static';

export const STORAGE_KEY = 'lgp-visibility-demo:v1';
export const PRESENTER = 'Demo presenter';
export const AUTOMATION = 'Demo automation';
export const LGP_WEBSITE = 'https://www.lifeguard-pro.org';

const T_SEED = '2026-10-14T10:00:00-04:00';

function field(
  id: string,
  section: ProfileField['section'],
  label: string,
  value: string,
  opts: Partial<ProfileField> = {},
): ProfileField {
  return {
    id,
    section,
    label,
    value,
    kind: 'text',
    destination: 'Website + Google profile',
    source: value ? 'manual' : 'manual',
    updatedAt: T_SEED,
    verification: value ? 'sample' : 'unknown',
    ...opts,
  };
}

function initialFields(): ProfileField[] {
  return [
    field('name', 'details', 'Business name', 'Lifeguard-Pro', { required: true, source: 'brand', verification: 'identity' }),
    field(
      'description',
      'details',
      'Description / about',
      'Lifeguard-Pro offers lifeguard certification and recertification courses with hands-on pool training.',
      { kind: 'textarea', source: 'website' },
    ),
    field('primaryCategory', 'details', 'Primary category', 'Lifeguard training provider', { destination: 'Google profile' }),
    field('additionalCategories', 'details', 'Additional categories', 'First aid training · CPR training', { destination: 'Google profile' }),
    field('openingDate', 'details', 'Opening date', '', { kind: 'date', destination: 'Google profile', prompt: 'Unknown in this demo — add the real opening date if you have it.' }),
    field('website', 'contact', 'Website', LGP_WEBSITE, { kind: 'url', required: true, source: 'brand', verification: 'identity' }),
    field('phone', 'contact', 'Phone', '', { kind: 'tel', prompt: 'Add the main phone number customers should call.' }),
    field('address', 'contact', 'Address', '', { prompt: 'Add a verified business address, or leave empty for a service-area business.' }),
    field('serviceAreas', 'contact', 'Service areas', 'Boston, MA · Miami, FL', { destination: 'Google profile' }),
    field('registrationLink', 'contact', 'Registration link', LGP_WEBSITE, { kind: 'url', destination: 'Website', source: 'website' }),
    field('social', 'contact', 'Social links', '', { kind: 'textarea', destination: 'Website', prompt: 'Add official social profile URLs, one per line.' }),
    field('regularHours', 'hours', 'Regular hours', 'Mon–Fri 9:00 AM – 5:00 PM', { destination: 'Google profile' }),
    field('specialHours', 'hours', 'Holiday / special hours', '', { destination: 'Google profile', prompt: 'Add holiday closures so listings stay accurate.' }),
    field('attributes', 'hours', 'Attributes', 'Online registration · Weekend classes', { destination: 'Google profile' }),
    field('whyChooseUs', 'trust', 'Why choose us', 'Small classes, hands-on pool practice, and clear course information.', { kind: 'textarea', destination: 'Website' }),
    field('credentials', 'trust', 'Credentials', '', {
      kind: 'textarea',
      destination: 'Website',
      prompt: 'Add credentials only after verifying them. This demo never fills them in automatically.',
    }),
    field('instructors', 'trust', 'Instructors', '', { kind: 'textarea', destination: 'Website', prompt: 'Add instructor names and verified qualifications.' }),
  ];
}

export function initialSessions(): CourseSession[] {
  const base = { timezone: 'America/New_York', source: 'odoo' as const, updatedAt: T_SEED, version: 1, status: 'scheduled' as const };
  return [
    {
      ...base,
      id: 'BOS-CERT-01',
      cityId: 'boston',
      courseId: 'cert',
      venue: 'Demo Boston Training Pool',
      start: '2026-10-24T09:00',
      end: '2026-10-25T17:00',
      deadline: '2026-10-21',
      capacity: 20,
      available: 8,
      price: null,
      conflict: {
        status: 'open',
        values: { odoo: 249, website: 229 },
        odooUpdatedAt: '2026-10-14T10:00:00-04:00',
        websiteUpdatedAt: '2026-08-30T09:00:00-04:00',
      },
    },
    {
      ...base,
      id: 'BOS-RECERT-01',
      cityId: 'boston',
      courseId: 'recert',
      venue: 'Demo Boston Training Pool',
      start: '2026-10-31T09:00',
      end: '2026-10-31T15:00',
      deadline: '2026-10-28',
      capacity: 12,
      available: 5,
      price: 149,
    },
    {
      ...base,
      id: 'MIA-CERT-01',
      cityId: 'miami',
      courseId: 'cert',
      venue: 'Demo Miami Training Pool',
      start: '2026-11-07T09:00',
      end: '2026-11-08T17:00',
      deadline: '2026-11-04',
      capacity: 24,
      available: 12,
      price: 259,
    },
    {
      ...base,
      id: 'MIA-RECERT-01',
      cityId: 'miami',
      courseId: 'recert',
      venue: 'Demo Miami Training Pool',
      start: '2026-11-14T09:00',
      end: '2026-11-14T15:00',
      deadline: '2026-11-11',
      capacity: 12,
      available: 0,
      price: 159,
      status: 'sold-out',
    },
  ];
}

const FAQ_BASE =
  'Q: How do I register for a class?\nA: Choose a city and class date on the course page, then use the registration link.\n\nQ: Where are classes held?\nA: Each class listing shows its venue.';

const FAQ_PROPOSED =
  'Q: What are the prerequisites for lifeguard certification?\nA: Requirements depend on the certifying program for each class. Each class listing links to its course page, which lists the prerequisites to check before you register.\n\nQ: How do I know when to recertify?\nA: Check the expiry date on your current certificate, then choose a recertification class before it expires. Contact us if you are unsure which course fits.\n\n' +
  FAQ_BASE;

function dest(d: Omit<Destination, 'version' | 'history'> & { at?: string }): Destination {
  const { at, ...rest } = d;
  return {
    ...rest,
    version: 1,
    history: [{ version: 1, content: rest.content, at: at ?? '2026-08-30T09:00:00-04:00', note: 'Demo baseline snapshot', actor: 'Demo import' }],
  };
}

function initialDestinations(sessions: CourseSession[]): Destination[] {
  const websitePrices = buildPrices(sessions).map((p) => (p.sessionId === 'BOS-CERT-01' ? { ...p, price: 229 } : p));
  const miamiOld: DestContent = {
    title: 'Lifeguard Courses in Miami',
    text: 'Register by email or phone. Class schedule available on request.',
  };
  const miamiNew: DestContent = {
    title: 'Lifeguard Courses in Miami',
    text: 'Lifeguard certification and recertification in Miami. Choose a class below and register online.',
    schedule: buildSchedule(sessions, 'miami'),
  };
  const miami = dest({
    id: 'DEST-WEB-MIA-COURSE',
    name: 'Website — Miami course page',
    channel: 'Website',
    kind: 'course-page',
    connection: 'website',
    mode: 'replace',
    path: '/miami/lifeguard-courses (demo path)',
    cityId: 'miami',
    content: miamiOld,
    at: '2026-08-30T09:00:00-04:00',
  });
  miami.content = miamiNew;
  miami.version = 2;
  miami.history.push({
    version: 2,
    content: miamiNew,
    at: '2026-10-02T11:30:00-04:00',
    note: 'Published demo update',
    actor: PRESENTER,
    recommendationId: 'REC-008',
    revision: 1,
  });

  return [
    dest({
      id: 'DEST-WEB-BOS-COURSE',
      name: 'Website — Boston course page',
      channel: 'Website',
      kind: 'course-page',
      connection: 'website',
      mode: 'replace',
      path: '/boston/lifeguard-courses (demo path)',
      cityId: 'boston',
      content: { title: 'Lifeguard Courses in Boston', text: 'Train with Lifeguard-Pro in Boston. Contact us for upcoming class dates.' },
    }),
    miami,
    dest({
      id: 'DEST-WEB-PRICING',
      name: 'Website — pricing section',
      channel: 'Website',
      kind: 'pricing',
      connection: 'website',
      mode: 'replace',
      path: '/pricing (demo path)',
      content: { title: 'Course fees', text: 'Fees per person. Register online to reserve a seat.', prices: websitePrices },
    }),
    dest({
      id: 'DEST-WEB-FAQ',
      name: 'Website — FAQ',
      channel: 'Website',
      kind: 'faq',
      connection: 'website',
      mode: 'replace',
      path: '/faq (demo path)',
      content: { title: 'Frequently asked questions', text: FAQ_BASE },
    }),
    dest({
      id: 'DEST-WEB-SCHEMA',
      name: 'Website — Boston structured data preview',
      channel: 'Website',
      kind: 'schema',
      connection: 'website',
      mode: 'replace',
      path: '/boston/lifeguard-courses (structured data, demo)',
      cityId: 'boston',
      content: {
        title: 'Lifeguard Courses in Boston',
        text: 'Course structured data generated from the class list.',
        schedule: [
          {
            sessionId: 'BOS-CERT-0912',
            courseName: 'Lifeguard certification',
            cityName: 'Boston',
            venue: 'Demo Boston Training Pool',
            start: '2026-09-12T09:00',
            end: '2026-09-13T17:00',
            deadline: '2026-09-09',
            available: 0,
            capacity: 20,
            status: 'scheduled',
            price: 229,
          },
        ],
      },
    }),
    dest({
      id: 'DEST-WEB-TRUST',
      name: 'Website — trust content',
      channel: 'Website',
      kind: 'trust',
      connection: 'website',
      mode: 'replace',
      path: '/about (demo path)',
      content: { title: 'Why train with Lifeguard-Pro', text: 'Small classes, hands-on pool practice, and clear course information.' },
    }),
    dest({
      id: 'DEST-GBP-POSTS',
      name: 'Google profile — posts (demo)',
      channel: 'Google profile',
      kind: 'posts',
      connection: 'google',
      mode: 'append',
      path: 'Google profile demo · Updates',
      content: {
        title: 'Posts',
        text: '',
        items: [{ id: 'POST-0', text: 'Thanks to everyone who trained with us this summer! Fall classes are being scheduled. (sample post)', at: '2026-09-01T10:00:00-04:00' }],
      },
    }),
    dest({
      id: 'DEST-GBP-REVIEWS',
      name: 'Google profile — review replies (demo)',
      channel: 'Google profile',
      kind: 'reviews',
      connection: 'google',
      mode: 'append',
      path: 'Google profile demo · Reviews',
      content: {
        title: 'Review replies',
        text: '',
        items: [{ id: 'REPLY-R-1', text: 'Thank you for training with us, A.M.!', at: '2026-10-04T09:00:00-04:00', reviewId: 'R-1' }],
      },
    }),
    dest({
      id: 'DEST-GBP-PROFILE',
      name: 'Google profile — business description (demo)',
      channel: 'Google profile',
      kind: 'profile',
      connection: 'google',
      mode: 'replace',
      path: 'Google profile demo · About',
      content: {
        title: 'From the business',
        text: 'Lifeguard-Pro offers lifeguard certification and recertification courses with hands-on pool training.',
      },
    }),
  ];
}

type RecSeed = Pick<
  Recommendation,
  | 'id'
  | 'issueKey'
  | 'title'
  | 'cityId'
  | 'courseId'
  | 'destinationId'
  | 'priority'
  | 'status'
  | 'finding'
  | 'whyItMatters'
  | 'evidenceSummary'
  | 'evidenceIds'
  | 'action'
  | 'benefit'
  | 'proposed'
  | 'factKind'
  | 'sessionIds'
  | 'factFields'
> &
  Partial<Recommendation>;

export function makeRecommendation(seed: RecSeed, sessions: CourseSession[], at: string): Recommendation {
  const sourceVersions: Record<string, number> = {};
  for (const id of seed.sessionIds) {
    const s = sessions.find((x) => x.id === id);
    if (s) sourceVersions[id] = s.version;
  }
  return {
    revision: 1,
    approvedRevision: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: at,
    updatedAt: at,
    detectedAt: at,
    detectionCount: 1,
    publishedRevisions: [],
    sourceVersions,
    ...seed,
  };
}

const ALL_FACTS: Recommendation['factFields'] = ['dates', 'price', 'availability', 'venue', 'status'];

/** Recommendation templates, keyed by issue. Used for seeding and for analysis upserts. */
export function recTemplate(issueKey: string, sessions: CourseSession[], destinations: Destination[]): RecSeed | null {
  const destContent = (id: string) => destinations.find((d) => d.id === id)!.content;
  const bos = sessions.filter((s) => s.cityId === 'boston').map((s) => s.id);
  const mia = sessions.filter((s) => s.cityId === 'miami').map((s) => s.id);
  const bosCert = sessions.find((s) => s.id === 'BOS-CERT-01')!;
  switch (issueKey) {
    case 'bos-dates':
      return {
        id: 'REC-001',
        issueKey,
        title: 'Boston page lacks October dates and availability',
        cityId: 'boston',
        courseId: 'cert',
        destinationId: 'DEST-WEB-BOS-COURSE',
        priority: 'High',
        status: 'awaiting',
        finding: 'The sample Boston course page says “Contact us for upcoming class dates” and shows no dates, seats, or venue.',
        whyItMatters:
          'Someone searching for a class this month wants a date they can book. If the page doesn’t show one, they may pick a provider that does.',
        evidenceSummary: 'Harbor Aquatic Training shows two October dates with seat counts; our sample page shows none.',
        evidenceIds: ['EV-001', 'EV-002'],
        action: 'Add upcoming Boston class dates, available seats, venue, and a registration link.',
        benefit: 'Visitors can see and book the next class without contacting us. This may help the page answer “this month” searches; no ranking change is guaranteed.',
        proposed: {
          title: 'Lifeguard Courses in Boston',
          text: 'Train with Lifeguard-Pro in Boston. Pick an upcoming class below and register online — seats are limited for each class.',
          schedule: buildSchedule(sessions, 'boston'),
        },
        factKind: 'schedule',
        sessionIds: bos,
        factFields: ALL_FACTS,
      };
    case 'bos-price':
      return {
        id: 'REC-002',
        issueKey,
        title: 'Boston price differs between sources',
        cityId: 'boston',
        courseId: 'cert',
        destinationId: 'DEST-WEB-PRICING',
        priority: 'High',
        status: displayPrice(bosCert) === null ? 'blocked' : 'awaiting',
        blockKind: 'source-conflict',
        blockedReason:
          'Odoo demo source shows $249; an older website snapshot shows $229. Choose the authoritative source before this update can be drafted.',
        finding: 'Two sources disagree on the Boston lifeguard certification price.',
        whyItMatters: 'If a visitor sees one price on the website and another at registration, they may lose trust or abandon the booking.',
        evidenceSummary: 'Internal check found $249 in the Odoo demo source and $229 in an older website snapshot.',
        evidenceIds: ['EV-003', 'EV-011'],
        action: 'Confirm the correct Boston certification price, then update the website pricing section.',
        benefit: 'One consistent price across the website and registration. Clear pricing can also help visitors searching for affordable courses.',
        proposed: { title: 'Course fees', text: 'Fees per person. Register online to reserve a seat.', prices: buildPrices(sessions) },
        factKind: 'pricing',
        sessionIds: sessions.map((s) => s.id),
        factFields: ['price'],
      };
    case 'faq-prereq':
      return {
        id: 'REC-003',
        issueKey,
        title: 'Prerequisites and renewal FAQs need clearer answers',
        cityId: null,
        courseId: null,
        destinationId: 'DEST-WEB-FAQ',
        priority: 'Medium',
        status: 'draft',
        finding: 'The sample FAQ doesn’t explain where to find prerequisites or when to recertify.',
        whyItMatters: 'People compare providers by how easily they can answer “Am I eligible?” and “When do I renew?”.',
        evidenceSummary: 'Metro Swim Academy answers prerequisite and renewal questions on a dedicated FAQ page.',
        evidenceIds: ['EV-004'],
        action: 'Add two plain-language answers that point people to course-specific requirements.',
        benefit: 'Fewer pre-registration questions and clearer answers for search and AI tools to reference. Not a guaranteed ranking change.',
        proposed: { title: 'Frequently asked questions', text: FAQ_PROPOSED },
        factKind: 'text',
        sessionIds: [],
        factFields: [],
      };
    case 'bos-post':
      return {
        id: 'REC-004',
        issueKey,
        title: 'Upcoming Boston course announcement',
        cityId: 'boston',
        courseId: 'cert',
        destinationId: 'DEST-GBP-POSTS',
        priority: 'Medium',
        status: 'approved',
        approvedRevision: 1,
        approvedBy: PRESENTER,
        approvedAt: '2026-10-15T16:20:00-04:00',
        finding: 'The sample Google profile has no post about upcoming Boston classes.',
        whyItMatters: 'A recent update on the profile tells people that classes are actively scheduled.',
        evidenceSummary: 'Harbor Aquatic Training’s sample listing shows an announcement from 3 days before capture.',
        evidenceIds: ['EV-009'],
        action: 'Post a short announcement for the Oct 24–25 Boston certification class.',
        benefit: 'Profile visitors see a current class and a clear next step.',
        proposed: {
          title: 'Post',
          text: 'Lifeguard certification in Boston: Oct 24–25, 2026 at Demo Boston Training Pool. Seats are limited — register on our website.',
        },
        factKind: 'text',
        sessionIds: ['BOS-CERT-01'],
        factFields: ['dates', 'venue', 'status'],
      };
    case 'review-r2':
      return {
        id: 'REC-005',
        issueKey,
        title: 'One sample review needs a response',
        cityId: 'boston',
        courseId: null,
        destinationId: 'DEST-GBP-REVIEWS',
        priority: 'Medium',
        status: 'awaiting',
        reviewId: 'R-2',
        finding: 'A 4-star sample review mentions difficulty finding the next class date and has no reply.',
        whyItMatters: 'Thoughtful replies show future customers that feedback is read and acted on.',
        evidenceSummary: 'Sample review from J.R. has been unanswered for 9 days.',
        evidenceIds: ['EV-005'],
        action: 'Reply with thanks and point to where class dates are listed.',
        benefit: 'Shows responsiveness to prospective students reading reviews.',
        proposed: {
          title: 'Reply to J.R.',
          text: 'Thank you for the feedback, J.R.! We’re glad you enjoyed the instructors. Upcoming Boston class dates are listed on our Boston course page.',
        },
        factKind: 'text',
        sessionIds: [],
        factFields: [],
      };
    case 'bos-schema':
      return {
        id: 'REC-006',
        issueKey,
        title: 'Course structured data differs from visible text',
        cityId: 'boston',
        courseId: 'cert',
        destinationId: 'DEST-WEB-SCHEMA',
        priority: 'Medium',
        status: 'awaiting',
        finding: 'Structured data describes a Sep 12 class that has passed; the visible page lists no dates.',
        whyItMatters: 'Search tools read structured data. Out-of-date details can surface old or confusing class information.',
        evidenceSummary: 'Internal check compared the demo structured data with the visible page text.',
        evidenceIds: ['EV-006'],
        action: 'Generate structured data from the current class list so it matches what visitors see.',
        benefit: 'Consistent, current class details for search tools. The price is left out until the source conflict is resolved.',
        proposed: { title: 'Lifeguard Courses in Boston', text: 'Course structured data generated from the class list.', schedule: buildSchedule(sessions, 'boston') },
        factKind: 'schema',
        sessionIds: bos,
        factFields: ['dates', 'price', 'availability', 'status'],
      };
    case 'trust-credentials':
      return {
        id: 'REC-007',
        issueKey,
        title: 'Instructor/trust section needs verified credentials',
        cityId: null,
        courseId: null,
        destinationId: 'DEST-WEB-TRUST',
        priority: 'Medium',
        status: 'blocked',
        blockKind: 'missing-facts',
        blockedReason: 'No verified instructor credentials are on file. Add them before a draft can be written — the system never invents credentials.',
        finding: 'The sample trust section has no instructor or credential details.',
        whyItMatters: 'People choosing safety training look for who teaches the course and what qualifies them.',
        evidenceSummary: 'Coastal Safety School’s sample page lists instructors with their credentials.',
        evidenceIds: ['EV-007'],
        action: 'Add verified instructor and credential details to the trust section.',
        benefit: 'Visitors can see who teaches the course. Content is only drafted from facts you supply.',
        proposed: destContent('DEST-WEB-TRUST'),
        factKind: 'text',
        sessionIds: [],
        factFields: [],
      };
    case 'mia-register':
      return {
        id: 'REC-008',
        issueKey,
        title: 'Miami schedule needs a clearer registration link',
        cityId: 'miami',
        courseId: null,
        destinationId: 'DEST-WEB-MIA-COURSE',
        priority: 'Low',
        status: 'published',
        revision: 1,
        approvedRevision: 1,
        approvedBy: PRESENTER,
        approvedAt: '2026-10-01T15:00:00-04:00',
        publishedRevisions: [1],
        finding: 'The sample Miami page asked people to register by email or phone, with no registration link next to class dates.',
        whyItMatters: 'A direct registration link removes a step between finding a class and booking it.',
        evidenceSummary: 'Demo snapshot from Sep 28 showed no registration link beside the schedule.',
        evidenceIds: ['EV-008'],
        action: 'List Miami classes with a registration link beside each available class.',
        benefit: 'Fewer steps to register. Sold-out classes show no registration button.',
        proposed: {
          title: 'Lifeguard Courses in Miami',
          text: 'Lifeguard certification and recertification in Miami. Choose a class below and register online.',
          schedule: buildSchedule(sessions, 'miami'),
        },
        factKind: 'schedule',
        sessionIds: mia,
        factFields: ALL_FACTS,
      };
    case 'bos-gbp-desc':
      return {
        id: '',
        issueKey,
        title: 'Google profile description doesn’t mention Boston classes',
        cityId: 'boston',
        courseId: null,
        destinationId: 'DEST-GBP-PROFILE',
        priority: 'Medium',
        status: 'awaiting',
        finding: 'The sample profile description doesn’t say where classes are offered.',
        whyItMatters: 'People viewing the profile from Maps want to know quickly whether classes run in their city.',
        evidenceSummary: 'Harbor Aquatic Training’s sample listing names Boston and its current classes.',
        evidenceIds: ['EV-009'],
        action: 'Update the profile description to name Boston and Miami class locations.',
        benefit: 'Clearer local relevance for profile visitors. No ranking change is guaranteed.',
        proposed: {
          title: 'From the business',
          text: 'Lifeguard-Pro offers lifeguard certification and recertification courses in Boston and Miami, with hands-on pool training and online registration.',
        },
        factKind: 'text',
        sessionIds: [],
        factFields: [],
      };
    case 'mia-ai': {
      const cur = destContent('DEST-WEB-MIA-COURSE');
      return {
        id: '',
        issueKey,
        title: 'AI answers for Miami recertification mention competitors only',
        cityId: 'miami',
        courseId: 'recert',
        destinationId: 'DEST-WEB-MIA-COURSE',
        priority: 'Medium',
        status: 'awaiting',
        finding: 'Several simulated AI answers about Miami recertification name competitors but not Lifeguard-Pro.',
        whyItMatters: 'People increasingly ask AI tools where to train. Clear, quotable page text gives those tools accurate information to use.',
        evidenceSummary: 'Simulated Copilot and ChatGPT answers mention Coastal Safety School and Metro Swim Academy only.',
        evidenceIds: ['EV-010', 'EV-012'],
        action: 'Add a short, factual recertification summary to the Miami page.',
        benefit: 'Gives AI tools and visitors a clear statement about Miami recertification. Mentions are not guaranteed.',
        proposed: {
          ...cur,
          text: `${cur.text}\n\nLifeguard recertification in Miami: a one-day class for current lifeguards. Check the class list below for availability.`,
          schedule: buildSchedule(sessions, 'miami'),
        },
        factKind: 'schedule',
        sessionIds: mia,
        factFields: ALL_FACTS,
      };
    }
    default:
      return null;
  }
}

/** Which issues an analysis can detect, scoped by city, course, and channel. */
export const ANALYSIS_CATALOG: { issueKey: string; cityId: CityId | null; courseId: CourseId | null; channels: Channel[] }[] = [
  { issueKey: 'bos-dates', cityId: 'boston', courseId: 'cert', channels: ['organic', 'maps'] },
  { issueKey: 'bos-price', cityId: 'boston', courseId: 'cert', channels: ['organic'] },
  { issueKey: 'faq-prereq', cityId: null, courseId: null, channels: ['organic', 'ai'] },
  { issueKey: 'bos-post', cityId: 'boston', courseId: 'cert', channels: ['maps'] },
  { issueKey: 'review-r2', cityId: 'boston', courseId: null, channels: ['maps'] },
  { issueKey: 'bos-schema', cityId: 'boston', courseId: 'cert', channels: ['organic'] },
  { issueKey: 'trust-credentials', cityId: null, courseId: null, channels: ['organic', 'ai'] },
  { issueKey: 'mia-register', cityId: 'miami', courseId: null, channels: ['organic'] },
  { issueKey: 'bos-gbp-desc', cityId: 'boston', courseId: null, channels: ['maps'] },
  { issueKey: 'mia-ai', cityId: 'miami', courseId: 'recert', channels: ['ai'] },
];

const SEEDED_ISSUES = ['bos-dates', 'bos-price', 'faq-prereq', 'bos-post', 'review-r2', 'bos-schema', 'trust-credentials', 'mia-register'];

function seedActivity(): ActivityEvent[] {
  const events: ActivityEvent[] = [
    {
      id: 'ACT-0006',
      at: BASELINE_AT,
      category: 'analysis',
      action: 'Analysis completed — Boston and Miami, all courses',
      status: 'success',
      actor: 'Demo schedule',
      details: 'Sample observations captured for 8 tracked searches across Google Search, Google Maps, and AI responses.',
    },
    {
      id: 'ACT-0005',
      at: '2026-10-16T08:00:00-04:00',
      category: 'sync',
      action: 'Odoo demo source synced — 4 class sessions',
      destination: 'Business Profile',
      status: 'success',
      actor: AUTOMATION,
      details: 'Found a price difference for BOS-CERT-01 between Odoo ($249) and the website snapshot ($229). Flagged for a person to resolve.',
    },
    {
      id: 'ACT-0004',
      at: '2026-10-15T16:20:00-04:00',
      category: 'approval',
      action: 'Approved: Upcoming Boston course announcement',
      destination: 'Google profile — posts (demo)',
      status: 'success',
      actor: PRESENTER,
      recommendationId: 'REC-004',
      after: 'Revision 1 approved',
    },
    {
      id: 'ACT-0003',
      at: '2026-10-02T11:30:00-04:00',
      category: 'publishing',
      action: 'Published demo: Miami schedule needs a clearer registration link',
      destination: 'Website — Miami course page',
      status: 'success',
      actor: PRESENTER,
      recommendationId: 'REC-008',
      before: 'Register by email or phone. Class schedule available on request.',
      after: 'Lifeguard certification and recertification in Miami. Choose a class below and register online. (+ class list with registration links)',
    },
    {
      id: 'ACT-0002',
      at: '2026-10-01T15:00:00-04:00',
      category: 'approval',
      action: 'Approved: Miami schedule needs a clearer registration link',
      destination: 'Website — Miami course page',
      status: 'success',
      actor: PRESENTER,
      recommendationId: 'REC-008',
      after: 'Revision 1 approved',
    },
  ];
  return events.map((e) => ({ ...e, sample: true }));
}

export function createInitialState(): DemoState {
  const sessions = initialSessions();
  const destinations = initialDestinations(sessions);
  const recommendations = SEEDED_ISSUES.map((k) => makeRecommendation(recTemplate(k, sessions, destinations)!, sessions, BASELINE_AT));
  return {
    schemaVersion: 1,
    profile: {
      fields: initialFields(),
      faqs: [
        { id: 'FAQ-1', question: 'How do I register for a class?', answer: 'Choose a city and class date on the course page, then use the registration link.', source: 'website', updatedAt: T_SEED },
        { id: 'FAQ-2', question: 'Where are classes held?', answer: 'Each class listing shows its venue.', source: 'website', updatedAt: T_SEED },
      ],
      courses: [
        {
          id: 'cert',
          name: 'Lifeguard certification',
          description: 'Classroom and in-water training leading to lifeguard certification.',
          prerequisites: 'Requirements vary by certifying program. Check the course page for this class before registering.',
          duration: '2 days',
          registrationUrl: LGP_WEBSITE,
          source: 'odoo',
          updatedAt: T_SEED,
          version: 1,
        },
        {
          id: 'recert',
          name: 'Lifeguard recertification',
          description: 'A refresher class for current lifeguards renewing their certification.',
          prerequisites: 'Bring your current certificate. Check the course page for this class before registering.',
          duration: '1 day',
          registrationUrl: LGP_WEBSITE,
          source: 'odoo',
          updatedAt: T_SEED,
          version: 1,
        },
      ],
      sessions,
      media: [
        { id: 'M-logo', slot: 'logo', label: 'Logo', kind: 'image', caption: 'Upload the official logo file.', sample: false, destination: 'Website + Google profile' },
        { id: 'M-cover', slot: 'cover', label: 'Cover photo', kind: 'image', illustration: 'pool', caption: 'Sample illustration — not a real photo', sample: true, destination: 'Google profile' },
        { id: 'M-exterior', slot: 'exterior', label: 'Exterior', kind: 'image', caption: 'Add a photo of the building entrance.', sample: false, destination: 'Google profile' },
        { id: 'M-interior', slot: 'interior', label: 'Interior / pool', kind: 'image', illustration: 'pool', caption: 'Sample illustration — not a real photo', sample: true, destination: 'Google profile' },
        { id: 'M-training', slot: 'training', label: 'Training in action', kind: 'image', illustration: 'training', caption: 'Sample illustration — not a real photo', sample: true, destination: 'Website + Google profile' },
        { id: 'M-team', slot: 'team', label: 'Instructors / team', kind: 'image', caption: 'Add a team photo once instructors approve it.', sample: false, destination: 'Website' },
        { id: 'M-video', slot: 'video', label: 'Course video', kind: 'video', illustration: 'video', caption: 'Sample video placeholder · 1:45 · metadata only (no playable file in demo)', sample: true, destination: 'Google profile' },
      ],
      reviews: [
        { id: 'R-1', cityId: 'boston', author: 'A.M.', rating: 5, text: 'Clear instruction and a well-organized pool session.', date: '2026-10-03', publishedReply: 'Thank you for training with us, A.M.!' },
        { id: 'R-2', cityId: 'boston', author: 'J.R.', rating: 4, text: 'Good instructors, but it was hard to find the next class date online.', date: '2026-10-07', recommendationId: 'REC-005' },
        { id: 'R-3', cityId: 'miami', author: 'S.T.', rating: 5, text: 'Easy registration and helpful staff.', date: '2026-10-05' },
      ],
      version: 1,
    },
    destinations,
    recommendations,
    publishJobs: [
      { id: 'REC-008:r1', recommendationId: 'REC-008', revision: 1, status: 'succeeded', attempts: 1, startedAt: '2026-10-02T11:29:58-04:00', finishedAt: '2026-10-02T11:30:00-04:00', destinationVersion: 2 },
    ],
    analysisRuns: [],
    activity: seedActivity(),
    pendingSync: [],
    settings: {
      connections: {
        odoo: { status: 'connected' },
        website: { status: 'connected' },
        google: { status: 'connected' },
        searchConsole: { status: 'connected' },
        aiMonitoring: { status: 'connected' },
      },
      cadence: 'weekly',
      freshnessPolicy: 'review',
      automationPaused: false,
      failNextPublish: false,
      snapshot: 'baseline',
      noteDismissed: false,
    },
    ui: {
      recFilters: { city: 'all', destination: 'all', priority: 'all', status: 'unresolved', q: '' },
      compFilters: { city: 'boston', course: 'all', queryId: 'all', channel: 'organic' },
      resultsFilters: { city: 'boston', channel: 'all', range: 30 },
      activityFilter: 'all',
    },
    seq: 100,
  };
}
