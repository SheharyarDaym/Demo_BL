// Core typed domain objects for the Lifeguard-Pro visibility demo.
// Every value in the demo is simulated sample data.

export type CityId = 'boston' | 'miami';
export type CourseId = 'cert' | 'recert';
export type CompetitorId = 'harbor' | 'metro' | 'coastal';
export type SearchChannel = 'organic' | 'maps';
export type Channel = SearchChannel | 'ai';
export type AiPlatform = 'chatgpt' | 'gemini' | 'copilot';
export type ConnectionId = 'odoo' | 'website' | 'google' | 'searchConsole' | 'aiMonitoring';
export type SourceId = 'odoo' | 'website' | 'manual' | 'brand';
export type Verification = 'identity' | 'sample' | 'presenter-confirmed' | 'unknown';
export type DestinationTarget = 'Website' | 'Google profile' | 'Internal' | 'Website + Google profile';

export type ProfileSectionId =
  | 'details'
  | 'contact'
  | 'hours'
  | 'courses'
  | 'classes'
  | 'trust'
  | 'media'
  | 'reviews';

export interface ProfileField {
  id: string;
  section: ProfileSectionId;
  label: string;
  value: string;
  kind: 'text' | 'textarea' | 'url' | 'tel' | 'date';
  required?: boolean;
  destination: DestinationTarget;
  source: SourceId;
  updatedAt: string;
  verification: Verification;
  prompt?: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  source: SourceId;
  updatedAt: string;
}

export interface Course {
  id: CourseId;
  name: string;
  description: string;
  prerequisites: string;
  duration: string;
  registrationUrl: string;
  source: SourceId;
  updatedAt: string;
  version: number;
}

export type SessionStatus = 'scheduled' | 'cancelled' | 'sold-out';

export interface PriceConflict {
  status: 'open' | 'resolved';
  values: { odoo: number; website: number };
  odooUpdatedAt: string;
  websiteUpdatedAt: string;
  chosen?: 'odoo' | 'website';
  resolvedAt?: string;
}

export interface CourseSession {
  id: string;
  cityId: CityId;
  courseId: CourseId;
  venue: string;
  start: string; // local wall time, ISO without offset
  end: string;
  timezone: string;
  deadline: string; // yyyy-mm-dd
  capacity: number;
  available: number;
  status: SessionStatus;
  price: number | null; // null while a source conflict is open
  conflict?: PriceConflict;
  source: SourceId;
  updatedAt: string;
  version: number;
}

export type MediaSlot = 'logo' | 'cover' | 'exterior' | 'interior' | 'training' | 'team' | 'video';

export interface MediaItem {
  id: string;
  slot: MediaSlot;
  label: string;
  kind: 'image' | 'video';
  dataUrl?: string; // uploaded local preview (compressed)
  illustration?: 'pool' | 'training' | 'video';
  caption: string;
  sample: boolean;
  updatedAt?: string;
  destination: DestinationTarget;
}

export interface Review {
  id: string;
  cityId: CityId;
  author: string;
  rating: number;
  text: string;
  date: string;
  recommendationId?: string;
  publishedReply?: string;
}

export interface SessionSnapshot {
  sessionId: string;
  courseName: string;
  cityName: string;
  venue: string;
  start: string;
  end: string;
  deadline: string;
  available: number;
  capacity: number;
  status: SessionStatus;
  price: number | null;
}

export interface PriceRow {
  sessionId: string;
  label: string;
  price: number | null;
}

export interface PublishedItem {
  id: string;
  text: string;
  at: string;
  recommendationId?: string;
  reviewId?: string;
}

export interface DestContent {
  title: string;
  text: string;
  schedule?: SessionSnapshot[];
  prices?: PriceRow[];
  items?: PublishedItem[];
}

export interface DestVersion {
  version: number;
  content: DestContent;
  at: string;
  note: string;
  actor: string;
  recommendationId?: string;
  revision?: number;
}

export type DestinationKind = 'course-page' | 'pricing' | 'faq' | 'schema' | 'trust' | 'posts' | 'reviews' | 'profile';

export interface Destination {
  id: string;
  name: string;
  channel: 'Website' | 'Google profile';
  kind: DestinationKind;
  connection: ConnectionId;
  mode: 'replace' | 'append';
  path: string;
  cityId?: CityId;
  content: DestContent;
  version: number;
  history: DestVersion[];
}

export type RecStatus =
  | 'draft'
  | 'awaiting'
  | 'blocked'
  | 'approved'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'rejected'
  | 'deferred';

export type Priority = 'High' | 'Medium' | 'Low';
export type FactField = 'dates' | 'price' | 'availability' | 'venue' | 'status';
export type FactKind = 'schedule' | 'pricing' | 'schema' | 'text';

export interface Recommendation {
  id: string;
  issueKey: string;
  title: string;
  cityId: CityId | null;
  courseId: CourseId | null;
  destinationId: string;
  priority: Priority;
  status: RecStatus;
  blockKind?: 'source-conflict' | 'missing-facts';
  blockedReason?: string;
  finding: string;
  whyItMatters: string;
  evidenceSummary: string;
  evidenceIds: string[];
  action: string;
  benefit: string;
  proposed: DestContent;
  factKind: FactKind;
  sessionIds: string[];
  factFields: FactField[];
  sourceVersions: Record<string, number>;
  changeNote?: string;
  revision: number;
  approvedRevision: number | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectReason?: string;
  createdAt: string;
  updatedAt: string;
  detectedAt: string;
  detectionCount: number;
  lastRunId?: string;
  publishedRevisions: number[];
  reviewId?: string;
  error?: string;
}

export interface PublishJob {
  id: string; // idempotency key: recommendationId + revision
  recommendationId: string;
  revision: number;
  status: 'pending' | 'succeeded' | 'failed' | 'interrupted';
  attempts: number;
  error?: string;
  startedAt: string;
  finishedAt?: string;
  destinationVersion?: number;
}

export interface AnalysisSelection {
  cityId: CityId | 'all';
  courseId: CourseId | 'all';
  platforms: Channel[];
  queryId?: string; // optional search phrase focus
}

export interface AnalysisRun extends AnalysisSelection {
  id: string;
  status: 'completed' | 'cancelled';
  stage: number;
  startedAt: string;
  completedAt: string;
  findingIds: string[];
  newCount: number;
  updatedCount: number;
}

export type ActivityCategory = 'analysis' | 'approval' | 'publishing' | 'sync' | 'profile' | 'settings';
export type ActivityStatus = 'success' | 'failed' | 'pending' | 'info' | 'cancelled';

export interface ActivityEvent {
  id: string;
  at: string;
  category: ActivityCategory;
  action: string;
  destination?: string;
  status: ActivityStatus;
  actor: string;
  recommendationId?: string;
  before?: string;
  after?: string;
  details?: string;
  sample?: boolean; // seeded fixture record (sample date), not an action from this session
}

export interface PendingSync {
  id: string;
  sessionId: string;
  destinationId: string;
  reason: string;
  change: string;
  detectedAt: string;
}

export interface ConnectionState {
  status: 'connected' | 'disconnected';
  lastTestedAt?: string;
  lastTestResult?: 'ok' | 'failed';
}

export interface Settings {
  connections: Record<ConnectionId, ConnectionState>;
  cadence: 'manual' | 'daily' | 'weekly';
  freshnessPolicy: 'review' | 'auto';
  automationPaused: boolean;
  failNextPublish: boolean;
  snapshot: 'baseline' | 'later';
  noteDismissed: boolean;
}

export interface RecFilters {
  city: CityId | 'all' | 'none';
  destination: string;
  priority: Priority | 'all';
  status: string; // RecStatus | 'all' | 'unresolved'
  q: string;
  runId?: string;
}

export interface CompetitorFilters {
  city: CityId;
  course: CourseId | 'all';
  queryId: string;
  channel: Channel;
}

export interface ResultsFilters {
  city: CityId;
  channel: Channel | 'all';
  range: 7 | 30 | 90;
}

export interface UiState {
  recFilters: RecFilters;
  compFilters: CompetitorFilters;
  resultsFilters: ResultsFilters;
  activityFilter: string;
}

export interface BusinessProfile {
  fields: ProfileField[];
  faqs: Faq[];
  courses: Course[];
  sessions: CourseSession[];
  media: MediaItem[];
  reviews: Review[];
  version: number;
}

export interface DemoState {
  schemaVersion: 1;
  profile: BusinessProfile;
  destinations: Destination[];
  recommendations: Recommendation[];
  publishJobs: PublishJob[];
  analysisRuns: AnalysisRun[];
  activity: ActivityEvent[];
  pendingSync: PendingSync[];
  settings: Settings;
  ui: UiState;
  seq: number;
}

// ---------- Static (read-only) fixture types ----------

export interface TrackedQuery {
  id: string;
  cityId: CityId;
  courseId: CourseId;
  text: string;
}

export type Positions = Record<'lgp' | CompetitorId, number | null>;

export interface SearchObservation {
  id: string;
  queryId: string;
  channel: SearchChannel;
  observedAt: string;
  location: string;
  device: 'Mobile' | 'Desktop';
  positions: Positions;
  previous: Positions;
  resultUrl: string;
  evidenceIds: string[];
}

export interface Evidence {
  id: string;
  title: string;
  url: string;
  sourceType: 'Competitor page' | 'Demo website snapshot' | 'Internal data check' | 'Google profile demo' | 'AI response sample';
  capturedAt: string;
  excerpt: string;
  observation: string;
  cityId: CityId | null;
  competitorId?: CompetitorId;
  issueKey?: string;
  page: { heading: string; lines: string[]; highlight: string };
}

export interface Competitor {
  id: CompetitorId;
  name: string;
  domain: string;
}

export type ComparisonDimension = 'pricing' | 'schedules' | 'faqs' | 'reviews' | 'freshness' | 'structuredData';

export interface ComparisonCell {
  ours: string;
  theirs: string;
  evidenceId?: string;
}

export interface Comparison {
  competitorId: CompetitorId;
  cityId: CityId;
  capturedAt: string;
  dims: Record<ComparisonDimension, ComparisonCell>;
}

export interface AiResponse {
  id: string;
  platform: AiPlatform;
  cityId: CityId;
  courseId: CourseId;
  prompt: string;
  response: string;
  mentionedBrands: string[];
  citations: string[];
  mentionsLgp: boolean;
  recommendsLgp: boolean;
  citesLgp: boolean;
  factsCorrect: boolean | null;
  accuracyNote: string;
  capturedAt: string;
}
