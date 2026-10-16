import { useMemo, useState, type ReactNode } from 'react';
import { Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { LineChart, type ChartSeries } from '../components/LineChart';
import { useToast } from '../components/Toast';
import { SampleNote, Segmented, Select } from '../components/ui';
import type { AiPlatform, Channel, CityId, ResultsFilters } from '../domain/types';
import { ALL_DATES, BASELINE_DAYS, BASELINE_END, SEEDED_ANNOTATIONS, SERIES, rangeIndices, type DayPoint } from '../data/series';
import { AI_PLATFORMS, AI_PLATFORM_IDS, CHANNEL_LABELS, CITIES, DATASET_LABEL, QUERIES } from '../data/static';
import { useStore } from '../state/store';
import { overviewCounts } from '../state/selectors';
import { BackLink } from '../components/ui';
import { download, toCsv, type Cell } from '../utils/csv';
import { fmtDate, fmtShortDate, nowIso, pct } from '../utils/format';

export const C = { navy: '#052f63', blue: '#3d86cc', teal: '#1b7a5c', purple: '#7a4fc4', amber: '#b07c10', red: '#d42a2a' };
export const PLATFORM_COLOR: Record<AiPlatform, string> = { chatgpt: C.teal, gemini: C.blue, copilot: C.purple };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

interface Ctx {
  city: CityId;
  pts: DayPoint[];
  dates: string[];
  a: number;
  b: number;
}

export function Tile({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {note && <span className="tile-note">{note}</span>}
    </div>
  );
}

export function Delta({ from, to, lowerIsBetter, unit = '' }: { from: number | null; to: number | null; lowerIsBetter?: boolean; unit?: string }) {
  if (from === null || to === null) return <span className="muted">—</span>;
  const d = Math.round((to - from) * 10) / 10;
  if (d === 0) return <span className="muted">no change over period</span>;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return (
    <span className={good ? 'up' : 'down'}>
      {d > 0 ? '+' : ''}
      {d}
      {unit} over period {lowerIsBetter ? '(lower is better)' : ''}
    </span>
  );
}

export function DataTable({ caption, dates, cols }: { caption: string; dates: string[]; cols: { label: string; values: (number | string | null)[] }[] }) {
  return (
    <div className="table-scroll table-tall">
      <table className="table table-compact">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky-col">
              Date
            </th>
            {cols.map((c) => (
              <th key={c.label} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((d, i) => (
            <tr key={d}>
              <th scope="row" className="sticky-col">
                {fmtDate(d)}
              </th>
              {cols.map((c) => (
                <td key={c.label}>{c.values[i] === null ? 'Not observed' : c.values[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartPanel({
  id,
  title,
  subtitle,
  tiles,
  views,
  annotations,
  laterFrom,
  dates,
  extra,
}: {
  id: string;
  title: string;
  subtitle: string;
  tiles: ReactNode;
  views: { key: string; label: string; series: ChartSeries[]; yLabel: string; invert?: boolean; format?: (v: number) => string }[];
  annotations: { date: string; label: string }[];
  laterFrom?: string;
  dates: string[];
  extra?: ReactNode;
}) {
  const [view, setView] = useState(views[0].key);
  const [table, setTable] = useState(false);
  const v = views.find((x) => x.key === view) ?? views[0];
  return (
    <section className="panel" aria-labelledby={`${id}-h`}>
      <div className="panel-head">
        <div>
          <h2 id={`${id}-h`}>{title}</h2>
          <p className="muted small">{subtitle}</p>
        </div>
        <div className="btn-row">
          {views.length > 1 && <Segmented label={`${title} measure`} value={view} onChange={setView} options={views.map((x) => ({ value: x.key, label: x.label }))} />}
          <button className="btn btn-ghost btn-sm" aria-pressed={table} onClick={() => setTable((t) => !t)}>
            <Icon name={table ? 'chart' : 'list'} size={16} /> {table ? 'Show chart' : 'Show table'}
          </button>
        </div>
      </div>
      <div className="tiles">{tiles}</div>
      {table ? (
        <DataTable caption={`${title}: ${v.label}`} dates={dates} cols={v.series.map((s) => ({ label: s.label, values: s.values.map((x) => (x === null ? null : v.format ? v.format(x) : x)) }))} />
      ) : (
        <LineChart title={`${title}: ${v.label}`} dates={dates} series={v.series} yLabel={v.yLabel} invert={v.invert} format={v.format} annotations={annotations} laterFrom={laterFrom} />
      )}
      {extra}
    </section>
  );
}

/** All Results calculations and exports, from one filtered dataset shared by Progress and All measurements. */
export function useResultsData() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const f = state.ui.resultsFilters;
  const snapshot = state.settings.snapshot;
  const set = (patch: Partial<ResultsFilters>) => dispatch({ type: 'UI_SET', patch: { resultsFilters: { ...f, ...patch } } });

  const [a, b] = rangeIndices(f.range, snapshot);
  const ctx: Ctx = { city: f.city, pts: SERIES[f.city].points.slice(a, b + 1), dates: ALL_DATES.slice(a, b + 1), a, b };
  const { pts, dates } = ctx;
  const laterFrom = snapshot === 'later' ? ALL_DATES[BASELINE_DAYS] : undefined;
  const show = (c: Channel) => f.channel === 'all' || f.channel === c;

  const annotations = useMemo(() => {
    const seeded = SEEDED_ANNOTATIONS.filter((x) => x.cityId === null || x.cityId === f.city).map((x) => ({ date: x.date, label: x.label }));
    const session = state.activity
      .filter((e) => e.category === 'publishing' && e.status === 'success' && !e.sample && e.recommendationId)
      .filter((e) => {
        const r = state.recommendations.find((x) => x.id === e.recommendationId);
        return r && (r.cityId === null || r.cityId === f.city);
      })
      .map((e) => ({ date: BASELINE_END, label: `Published in this demo session: ${e.action.replace(/^Published demo: /, '')}` }));
    return [...seeded, ...session].filter((x) => dates.includes(x.date));
  }, [state.activity, state.recommendations, f.city, dates]);

  // Rolling 7-day AI mention rate, computed from the same daily sample counts shown in the table.
  const aiRolling = (p: AiPlatform | 'all', key: 'mentions' | 'citations') =>
    dates.map((_, i) => {
      const idx = a + i;
      const win = SERIES[f.city].points.slice(Math.max(0, idx - 6), idx + 1);
      const plats = p === 'all' ? AI_PLATFORM_IDS : [p];
      const n = sum(win.flatMap((d) => plats.map((x) => d.ai[x][key])));
      const dd = sum(win.flatMap((d) => plats.map((x) => d.ai[x].samples)));
      return dd ? Math.round((n / dd) * 100) : null;
    });

  const first = pts[0];
  const last = pts[pts.length - 1];
  const queries = QUERIES.filter((q) => q.cityId === f.city);
  const aiTotals = AI_PLATFORM_IDS.map((p) => ({
    p,
    samples: sum(pts.map((d) => d.ai[p].samples)),
    mentions: sum(pts.map((d) => d.ai[p].mentions)),
    citations: sum(pts.map((d) => d.ai[p].citations)),
  }));
  const aiAll = { samples: sum(aiTotals.map((x) => x.samples)), mentions: sum(aiTotals.map((x) => x.mentions)), citations: sum(aiTotals.map((x) => x.citations)) };
  const biz = { enquiries: sum(pts.map((d) => d.enquiries)), registrations: sum(pts.map((d) => d.registrations)), revenue: sum(pts.map((d) => d.revenue)) };
  const org = { impressions: sum(pts.map((d) => d.impressions)), clicks: sum(pts.map((d) => d.clicks)) };
  const maps = { calls: sum(pts.map((d) => d.calls)), directions: sum(pts.map((d) => d.directions)), visits: sum(pts.map((d) => d.websiteVisits)) };
  const periodLabel = `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`;
  const snapLabel = snapshot === 'later' ? 'Later demo snapshot (simulated future measurement)' : 'Baseline sample';

  const exportCsv = () => {
    const header = ['date', 'city', 'dataset', 'snapshot', 'observation_date'];
    const rows: Cell[][] = pts.map((d) => [d.date, CITIES[f.city].name, 'Sample data (simulated)', d.later ? 'Later demo snapshot (simulated)' : 'Baseline sample', d.date]);
    const add = (h: string, vals: Cell[]) => {
      header.push(h);
      rows.forEach((r, i) => r.push(vals[i]));
    };
    if (show('organic')) {
      add('organic_avg_position', pts.map((d) => d.organicRank));
      add('impressions', pts.map((d) => d.impressions));
      add('clicks', pts.map((d) => d.clicks));
    }
    if (show('maps')) {
      add('maps_avg_position_sample_point', pts.map((d) => d.mapsPosition));
      add('profile_calls', pts.map((d) => d.calls));
      add('direction_requests', pts.map((d) => d.directions));
      add('website_visits_from_profile', pts.map((d) => d.websiteVisits));
    }
    if (show('ai')) {
      for (const p of AI_PLATFORM_IDS) {
        add(`${p}_sample_responses`, pts.map((d) => d.ai[p].samples));
        add(`${p}_mentions`, pts.map((d) => d.ai[p].mentions));
        add(`${p}_citations`, pts.map((d) => d.ai[p].citations));
      }
    }
    add('enquiries', pts.map((d) => d.enquiries));
    add('registrations', pts.map((d) => d.registrations));
    add('revenue_usd', pts.map((d) => d.revenue));
    const name = `lifeguard-pro-results-${f.city}-${f.channel}-${f.range}d-${snapshot}-SAMPLE.csv`;
    download(name, toCsv(header, rows), 'text/csv;charset=utf-8');
    toast(`Downloaded ${name}`);
  };

  const exportReport = () => {
    const publishes = state.activity.filter((e) => e.category === 'publishing' && e.status === 'success');
    const lines = [
      `# Lifeguard-Pro Google + AI Visibility — demo report`,
      '',
      `> **Simulated demo data.** Every metric below is fictional sample data from the ${DATASET_LABEL.replace('Demo dataset: ', '')} demo dataset. Nothing was published to Google or any AI system, and these figures do not show the effect of any real change.`,
      '',
      `- Generated: ${new Date().toLocaleString('en-US')}`,
      `- City: ${CITIES[f.city].name}`,
      `- Channel: ${f.channel === 'all' ? 'All channels' : CHANNEL_LABELS[f.channel]}`,
      `- Period: ${periodLabel} (${f.range} days)`,
      `- Data: ${snapLabel}`,
      '',
      '## Metrics (sample)',
      '',
    ];
    if (show('organic'))
      lines.push(
        `### Google Search`,
        `- Average position across ${queries.length} tracked searches: ${first.organicRank} → ${last.organicRank} (lower is better)`,
        `- Impressions: ${org.impressions.toLocaleString('en-US')}`,
        `- Clicks: ${org.clicks.toLocaleString('en-US')}`,
        '',
      );
    if (show('maps'))
      lines.push(
        `### Google Maps (sample point: ${CITIES[f.city].samplePoint})`,
        `- Average Maps position: ${first.mapsPosition ?? 'Not observed'} → ${last.mapsPosition ?? 'Not observed'}`,
        `- Calls ${maps.calls}, direction requests ${maps.directions}, website visits ${maps.visits}`,
        '',
      );
    if (show('ai'))
      lines.push(
        `### AI responses`,
        ...aiTotals.map((x) => `- ${AI_PLATFORMS[x.p]}: mentioned in ${x.mentions} of ${x.samples} sample responses (${pct(x.mentions, x.samples)}), cited in ${x.citations} of ${x.samples}`),
        `- All platforms: mentioned ${aiAll.mentions} of ${aiAll.samples}, cited ${aiAll.citations} of ${aiAll.samples}`,
        '',
      );
    lines.push(`### Business outcomes`, `- Enquiries: ${biz.enquiries}`, `- Registrations: ${biz.registrations}`, `- Revenue: $${biz.revenue.toLocaleString('en-US')}`, '');
    lines.push('## Changes published in the demo', '');
    if (publishes.length) publishes.forEach((e) => lines.push(`- ${e.at.slice(0, 10)} — ${e.action.replace(/^Published demo: /, '')} → ${e.destination ?? ''}${e.sample ? ' (sample record)' : ''}`));
    else lines.push('- None');
    lines.push('', '---', 'Results after a real deployment would need to be measured over time. This demo makes no claim that any change caused a ranking or business outcome.');
    const name = `lifeguard-pro-demo-report-${f.city}-${f.range}d-${snapshot}.md`;
    download(name, lines.join('\n'), 'text/markdown;charset=utf-8');
    toast(`Downloaded ${name}`);
  };

  return { f, set, snapshot, dispatch, a, b, pts, dates, laterFrom, show, annotations, aiRolling, first, last, queries, aiTotals, aiAll, biz, org, maps, periodLabel, snapLabel, exportCsv, exportReport };
}

export function MeasurementsView() {
  const { state } = useStore();
  const counts = overviewCounts(state);
  const { f, set, snapshot, dispatch, a, b, pts, dates, laterFrom, show, annotations, aiRolling, first, last, queries, aiTotals, aiAll, biz, org, maps, periodLabel, snapLabel, exportCsv, exportReport } = useResultsData();
  const [keyword, setKeyword] = useState<string | null>(null);
  return (
    <div className="page">
      <BackLink to="/progress">Back to Progress</BackLink>
      <header className="page-head">
        <div>
          <h1>All measurements</h1>
          <p className="muted">Every sample measurement by channel. The filters change every chart, number and table on this page.</p>
        </div>
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={exportCsv}>
            <Icon name="download" /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={exportReport}>
            <Icon name="file" /> Export demo report
          </button>
        </div>
      </header>

      <div className="filters panel">
        <Select label="City" value={f.city} onChange={(v) => set({ city: v })} options={[{ value: 'boston', label: 'Boston' }, { value: 'miami', label: 'Miami' }]} />
        <div className="field field-inline">
          <span className="field-label">Channel</span>
          <Segmented<Channel | 'all'>
            label="Channel"
            value={f.channel}
            onChange={(v) => set({ channel: v })}
            options={[{ value: 'all', label: 'All' }, ...(['organic', 'maps', 'ai'] as Channel[]).map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))]}
          />
        </div>
        <div className="field field-inline">
          <span className="field-label">Period</span>
          <Segmented<7 | 30 | 90> label="Period" value={f.range} onChange={(v) => set({ range: v })} options={[7, 30, 90].map((n) => ({ value: n as 7 | 30 | 90, label: `${n} days` }))} />
        </div>
        <button
          className={`btn btn-sm ${snapshot === 'later' ? 'btn-secondary' : 'btn-ghost'}`}
          onClick={() => dispatch({ type: 'SETTINGS_SET', patch: { snapshot: snapshot === 'later' ? 'baseline' : 'later' }, now: nowIso() })}
        >
          <Icon name="clock" size={16} /> {snapshot === 'later' ? 'Return to baseline' : 'Load later demo snapshot'}
        </button>
      </div>

      <div className={`callout ${snapshot === 'later' ? 'callout-warn' : 'callout-info'}`} role="status">
        <Icon name="info" />
        <div>
          <strong>
            {snapLabel} · {periodLabel}
          </strong>
          <p>
            {snapshot === 'later'
              ? 'A seeded later observation (Oct 17 – Nov 6, 2026, shaded). It is a simulated future measurement — not a prediction, and not proof that any change caused it.'
              : 'Baseline sample data ends Oct 16, 2026. Publishing in the demo does not change these measurements; real results would need to be measured after deployment.'}
          </p>
        </div>
      </div>

      <section className="panel" aria-labelledby="counts-h">
        <h2 id="counts-h">Suggestion summary</h2>
        <dl className="ai-stats">
          <div>
            <dt>Tracked search phrases</dt>
            <dd>{counts.tracked}</dd>
          </div>
          <div>
            <dt>Open suggestions</dt>
            <dd>{counts.opportunities}</dd>
          </div>
          <div>
            <dt>Awaiting approval</dt>
            <dd>{counts.awaiting}</dd>
          </div>
          <div>
            <dt>Successful demo updates</dt>
            <dd>{counts.published}</dd>
          </div>
        </dl>
      </section>

      {show('organic') && (
        <ChartPanel
          id="org"
          title="Google Search"
          subtitle={`Organic positions across ${queries.length} tracked searches, plus website impressions and clicks (sample)`}
          dates={dates}
          annotations={annotations}
          laterFrom={laterFrom}
          tiles={
            <>
              <Tile label="Avg. position (latest)" value={last.organicRank} note={<Delta from={first.organicRank} to={last.organicRank} lowerIsBetter />} />
              <Tile label="Impressions" value={org.impressions.toLocaleString('en-US')} note="Total for period" />
              <Tile label="Clicks" value={org.clicks.toLocaleString('en-US')} note={`Click rate ${pct(org.clicks, org.impressions)}`} />
            </>
          }
          views={[
            { key: 'pos', label: 'Position', yLabel: 'Avg. position', invert: true, series: [{ key: 'r', label: 'Avg. position (lower is better)', color: C.navy, values: pts.map((d) => d.organicRank) }] },
            { key: 'imp', label: 'Impressions', yLabel: 'Impressions / day', series: [{ key: 'i', label: 'Impressions', color: C.blue, values: pts.map((d) => d.impressions) }] },
            { key: 'clk', label: 'Clicks', yLabel: 'Clicks / day', series: [{ key: 'c', label: 'Clicks', color: C.teal, values: pts.map((d) => d.clicks) }] },
          ]}
          extra={
            <div className="kw">
              <h3 className="section-label">Tracked searches — select one for its history</h3>
              <div className="table-scroll">
                <table className="table table-compact">
                  <thead>
                    <tr>
                      <th scope="col">Search phrase</th>
                      <th scope="col">Position (latest)</th>
                      <th scope="col">Change over period</th>
                      <th scope="col">Best in period</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queries.map((q) => {
                      const s = SERIES[f.city].queryRanks[q.id].organic.slice(a, b + 1);
                      const lastV = s[s.length - 1];
                      const firstV = s[0];
                      const best = Math.min(...s.filter((x): x is number => x !== null));
                      return (
                        <tr key={q.id}>
                          <th scope="row">
                            <button className="btn btn-link" onClick={() => setKeyword(q.id)}>
                              {q.text}
                            </button>
                          </th>
                          <td>{lastV === null ? 'Not observed' : `#${lastV}`}</td>
                          <td>
                            <Delta from={firstV} to={lastV} lowerIsBetter />
                          </td>
                          <td>{Number.isFinite(best) ? `#${best}` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          }
        />
      )}

      {show('maps') && (
        <ChartPanel
          id="maps"
          title="Google Maps"
          subtitle={`Positions from ${CITIES[f.city].samplePoint} and sample profile interactions`}
          dates={dates}
          annotations={annotations}
          laterFrom={laterFrom}
          tiles={
            <>
              <Tile label="Avg. Maps position (latest)" value={last.mapsPosition ?? 'Not observed'} note={<Delta from={first.mapsPosition} to={last.mapsPosition} lowerIsBetter />} />
              <Tile label="Calls" value={maps.calls} note="From profile, total" />
              <Tile label="Direction requests" value={maps.directions} note="Total for period" />
              <Tile label="Website visits" value={maps.visits} note="From profile, total" />
            </>
          }
          views={[
            { key: 'pos', label: 'Position', yLabel: 'Avg. Maps position', invert: true, series: [{ key: 'm', label: 'Avg. Maps position (lower is better)', color: C.navy, values: pts.map((d) => d.mapsPosition) }] },
            {
              key: 'int',
              label: 'Interactions',
              yLabel: 'Interactions / day',
              series: [
                { key: 'calls', label: 'Calls', color: C.red, values: pts.map((d) => d.calls) },
                { key: 'dir', label: 'Directions', color: C.blue, values: pts.map((d) => d.directions) },
                { key: 'web', label: 'Website visits', color: C.teal, values: pts.map((d) => d.websiteVisits), dashed: true },
              ],
            },
          ]}
        />
      )}

      {show('ai') && (
        <ChartPanel
          id="ai"
          title="AI responses"
          subtitle="How often sample AI answers mention or cite Lifeguard-Pro — counted from individual sample responses"
          dates={dates}
          annotations={annotations}
          laterFrom={laterFrom}
          tiles={
            <>
              <Tile label="Mentions" value={`${aiAll.mentions} of ${aiAll.samples}`} note={`${pct(aiAll.mentions, aiAll.samples)} of sample responses`} />
              <Tile label="Citations" value={`${aiAll.citations} of ${aiAll.samples}`} note={`${pct(aiAll.citations, aiAll.samples)} — a mention without a link is uncited`} />
            </>
          }
          views={[
            {
              key: 'mention',
              label: 'Mention rate',
              yLabel: '% of responses (7-day)',
              format: (v) => `${v}%`,
              series: AI_PLATFORM_IDS.map((p) => ({ key: p, label: AI_PLATFORMS[p], color: PLATFORM_COLOR[p], values: aiRolling(p, 'mentions') })),
            },
            {
              key: 'cite',
              label: 'Citation rate',
              yLabel: '% of responses (7-day)',
              format: (v) => `${v}%`,
              series: AI_PLATFORM_IDS.map((p) => ({ key: p, label: AI_PLATFORMS[p], color: PLATFORM_COLOR[p], values: aiRolling(p, 'citations') })),
            },
          ]}
          extra={
            <div className="table-scroll">
              <table className="table table-compact">
                <caption>Period totals by platform (numerator / denominator)</caption>
                <thead>
                  <tr>
                    <th scope="col">Platform</th>
                    <th scope="col">Mentioned</th>
                    <th scope="col">Cited</th>
                  </tr>
                </thead>
                <tbody>
                  {aiTotals.map((x) => (
                    <tr key={x.p}>
                      <th scope="row">{AI_PLATFORMS[x.p]}</th>
                      <td>
                        {x.mentions} / {x.samples} ({pct(x.mentions, x.samples)})
                      </td>
                      <td>
                        {x.citations} / {x.samples} ({pct(x.citations, x.samples)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        />
      )}

      <ChartPanel
        id="biz"
        title="Enquiries, registrations and revenue"
        subtitle="Sample business outcomes — not linked to any real bookings"
        dates={dates}
        annotations={annotations}
        laterFrom={laterFrom}
        tiles={
          <>
            <Tile label="Enquiries" value={biz.enquiries} note="Total for period" />
            <Tile label="Registrations" value={biz.registrations} note={`${pct(biz.registrations, biz.enquiries)} of enquiries`} />
            <Tile label="Revenue (sample)" value={`$${biz.revenue.toLocaleString('en-US')}`} note="Registrations × sample fee" />
          </>
        }
        views={[
          {
            key: 'eng',
            label: 'Enquiries & registrations',
            yLabel: 'Per day',
            series: [
              { key: 'e', label: 'Enquiries', color: C.blue, values: pts.map((d) => d.enquiries) },
              { key: 'r', label: 'Registrations', color: C.navy, values: pts.map((d) => d.registrations) },
            ],
          },
          { key: 'rev', label: 'Revenue', yLabel: 'USD / day', format: (v) => `$${v}`, series: [{ key: 'rev', label: 'Revenue (sample)', color: C.teal, values: pts.map((d) => d.revenue) }] },
        ]}
      />
      <SampleNote>All results are seeded sample data for {CITIES[f.city].name}. Each city and channel has its own dataset.</SampleNote>

      <KeywordDrawer queryId={keyword} onClose={() => setKeyword(null)} a={a} b={b} dates={dates} />
    </div>
  );
}

export function KeywordDrawer({ queryId, onClose, a, b, dates }: { queryId: string | null; onClose: () => void; a: number; b: number; dates: string[] }) {
  const q = QUERIES.find((x) => x.id === queryId);
  const [table, setTable] = useState(false);
  if (!q) return null;
  const s = SERIES[q.cityId].queryRanks[q.id];
  const org = s.organic.slice(a, b + 1);
  const map = s.maps.slice(a, b + 1);
  return (
    <Dialog open onClose={onClose} variant="drawer" size="lg" title={`“${q.text}”`} subtitle={`Position history · ${fmtShortDate(dates[0])} – ${fmtShortDate(dates[dates.length - 1])} · sample data`}>
      <button className="btn btn-ghost btn-sm" aria-pressed={table} onClick={() => setTable((t) => !t)}>
        <Icon name={table ? 'chart' : 'list'} size={16} /> {table ? 'Show chart' : 'Show table'}
      </button>
      {table ? (
        <DataTable caption="Position history" dates={dates} cols={[{ label: 'Google Search', values: org }, { label: 'Google Maps', values: map }]} />
      ) : (
        <LineChart
          title={`Position history for ${q.text}`}
          dates={dates}
          invert
          yLabel="Position"
          series={[
            { key: 'o', label: 'Google Search (organic)', color: C.navy, values: org },
            { key: 'm', label: 'Google Maps (sample point)', color: C.blue, values: map, dashed: true },
          ]}
        />
      )}
      <SampleNote>Lower is better. Gaps mean Lifeguard-Pro was not observed in the sampled results.</SampleNote>
    </Dialog>
  );
}
