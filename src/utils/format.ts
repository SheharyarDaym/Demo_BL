import { TIMEZONE } from '../data/static';

const dtFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const dFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${dtFmt.format(d)} ET`;
}

/** Date-only strings (yyyy-mm-dd) are wall dates; format without timezone shifts. */
export function fmtDate(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? isoDate : dFmt.format(d);
}

export function fmtShortDate(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? isoDate : shortFmt.format(d);
}

function wallTime(local: string): string {
  const [h, m] = local.slice(11, 16).split(':').map(Number);
  if (Number.isNaN(h)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** "Oct 24–25, 2026" or "Oct 31, 2026" from local wall-time strings. */
export function sessionDateLabel(start: string, end: string): string {
  const s = start.slice(0, 10);
  const e = end.slice(0, 10);
  if (s === e) return fmtDate(s);
  const sd = new Date(`${s}T12:00:00Z`);
  const ed = new Date(`${e}T12:00:00Z`);
  if (sd.getUTCMonth() === ed.getUTCMonth() && sd.getUTCFullYear() === ed.getUTCFullYear()) {
    return `${shortFmt.format(sd)}–${ed.getUTCDate()}, ${ed.getUTCFullYear()}`;
  }
  return `${shortFmt.format(sd)} – ${fmtDate(e)}`;
}

export function sessionTimeLabel(start: string, end: string): string {
  return `${wallTime(start)} – ${wallTime(end)} ET`;
}

export function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'Not shown';
  return `$${v.toLocaleString('en-US')}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function pct(n: number, d: number): string {
  if (!d) return '—';
  return `${Math.round((n / d) * 100)}%`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
