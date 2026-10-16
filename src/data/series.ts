// Deterministic sample measurement series for the Results view.
// Generated once at module load from fixed seeds — never randomized on render.
import type { AiPlatform, CityId, SearchChannel } from '../domain/types';
import { AI_PLATFORM_IDS, OBSERVATIONS, QUERIES } from './static';

export const BASELINE_DAYS = 90;
export const LATER_DAYS = 21;
export const BASELINE_END = '2026-10-16';
export const LATER_END = '2026-11-06';

export interface AiDay {
  samples: number;
  mentions: number;
  citations: number;
}

export interface DayPoint {
  date: string;
  later: boolean;
  organicRank: number;
  impressions: number;
  clicks: number;
  mapsPosition: number | null;
  calls: number;
  directions: number;
  websiteVisits: number;
  ai: Record<AiPlatform, AiDay>;
  enquiries: number;
  registrations: number;
  revenue: number;
}

export interface CitySeries {
  points: DayPoint[];
  queryRanks: Record<string, Record<SearchChannel, (number | null)[]>>;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const TOTAL = BASELINE_DAYS + LATER_DAYS;
const START = addDays(BASELINE_END, -(BASELINE_DAYS - 1));
export const ALL_DATES: string[] = Array.from({ length: TOTAL }, (_, i) => addDays(START, i));

// Later-snapshot drift per query (positive = moves down / worse, negative = better). Fixed, not causal.
const LATER_DRIFT: Record<string, number> = {
  'Q-BOS-CERT': -2,
  'Q-BOS-LOW': 1,
  'Q-BOS-MONTH': -4,
  'Q-BOS-RECERT': 0,
  'Q-MIA-CERT': -1,
  'Q-MIA-LOW': 2,
  'Q-MIA-MONTH': -2,
  'Q-MIA-RECERT': 1,
};

function rankSeries(key: string, target: number | null, laterDrift: number): (number | null)[] {
  if (target === null) return ALL_DATES.map(() => null);
  const rnd = mulberry32(hash(key));
  const slope = 0.03 + rnd() * 0.06; // ranks were slightly worse in summer
  const out: (number | null)[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const fromEnd = BASELINE_DAYS - 1 - i;
    let v: number;
    if (i < BASELINE_DAYS) {
      const wave = Math.sin(i / 6.5 + rnd()) * 1.2;
      const noise = fromEnd === 0 ? 0 : (rnd() - 0.5) * 2;
      v = target + slope * fromEnd + (fromEnd === 0 ? 0 : wave + noise);
    } else {
      const k = (i - BASELINE_DAYS + 1) / LATER_DAYS;
      v = target + laterDrift * k + (rnd() - 0.5) * 1.2;
    }
    out.push(Math.max(1, Math.round(v)));
  }
  return out;
}

const AI_RATES: Record<CityId, Record<AiPlatform, number>> = {
  boston: { chatgpt: 0.45, gemini: 0.55, copilot: 0.35 },
  miami: { chatgpt: 0.25, gemini: 0.4, copilot: 0.3 },
};

function buildCity(cityId: CityId): CitySeries {
  const queries = QUERIES.filter((q) => q.cityId === cityId);
  const queryRanks: CitySeries['queryRanks'] = {};
  for (const q of queries) {
    const org = OBSERVATIONS.find((o) => o.queryId === q.id && o.channel === 'organic')!;
    const map = OBSERVATIONS.find((o) => o.queryId === q.id && o.channel === 'maps')!;
    queryRanks[q.id] = {
      organic: rankSeries(`${q.id}-org`, org.positions.lgp, LATER_DRIFT[q.id] ?? 0),
      maps: rankSeries(`${q.id}-map`, map.positions.lgp, Math.round((LATER_DRIFT[q.id] ?? 0) / 2)),
    };
  }
  const rnd = mulberry32(hash(`${cityId}-daily`));
  const baseImpr = cityId === 'boston' ? 430 : 310;
  const avgPrice = cityId === 'boston' ? 215 : 225;
  const points: DayPoint[] = ALL_DATES.map((date, i) => {
    const orgVals = queries.map((q) => queryRanks[q.id].organic[i]).filter((v): v is number => v !== null);
    const mapVals = queries.map((q) => queryRanks[q.id].maps[i]).filter((v): v is number => v !== null);
    const season = 1 - (i / TOTAL) * 0.35 + Math.sin(i / 3.5) * 0.06; // summer demand fades into autumn
    const impressions = Math.round(baseImpr * season * (0.85 + rnd() * 0.3));
    const clicks = Math.round(impressions * (0.026 + rnd() * 0.012));
    const ai = {} as Record<AiPlatform, AiDay>;
    for (const p of AI_PLATFORM_IDS) {
      const samples = 2;
      let mentions = 0;
      let citations = 0;
      for (let s = 0; s < samples; s++) {
        if (rnd() < AI_RATES[cityId][p]) {
          mentions++;
          if (rnd() < 0.5) citations++;
        }
      }
      ai[p] = { samples, mentions, citations };
    }
    const enquiries = Math.round(2 + season * 3 * rnd() + (i % 7 === 1 ? 2 : 0));
    const registrations = Math.min(enquiries, Math.round(rnd() * 2.4 * season));
    return {
      date,
      later: i >= BASELINE_DAYS,
      organicRank: Math.round((orgVals.reduce((a, b) => a + b, 0) / orgVals.length) * 10) / 10,
      impressions,
      clicks,
      mapsPosition: mapVals.length ? Math.round((mapVals.reduce((a, b) => a + b, 0) / mapVals.length) * 10) / 10 : null,
      calls: Math.round(rnd() * 4 * season),
      directions: Math.round(1 + rnd() * 5 * season),
      websiteVisits: Math.round(2 + rnd() * 7 * season),
      ai,
      enquiries,
      registrations,
      revenue: registrations * avgPrice,
    };
  });
  return { points, queryRanks };
}

export const SERIES: Record<CityId, CitySeries> = {
  boston: buildCity('boston'),
  miami: buildCity('miami'),
};

/** Indices [start, end] inclusive for the selected range and snapshot. */
export function rangeIndices(range: number, snapshot: 'baseline' | 'later'): [number, number] {
  const end = snapshot === 'later' ? TOTAL - 1 : BASELINE_DAYS - 1;
  return [end - range + 1, end];
}

export interface Annotation {
  date: string;
  cityId: CityId | null;
  label: string;
}

export const SEEDED_ANNOTATIONS: Annotation[] = [
  { date: '2026-10-02', cityId: 'miami', label: 'Demo publish: Miami registration link (REC-008)' },
];
