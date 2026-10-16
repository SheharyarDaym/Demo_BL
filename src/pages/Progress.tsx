import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { LineChart } from '../components/LineChart';
import { Disclosure, SampleNote, Segmented, Select } from '../components/ui';
import type { Channel } from '../domain/types';
import { AI_PLATFORMS, AI_PLATFORM_IDS, CITIES } from '../data/static';
import { C, Delta, PLATFORM_COLOR, Tile, useResultsData } from '../features/resultsParts';
import { nowIso, pct } from '../utils/format';

const VIEWS: { value: Channel; label: string }[] = [
  { value: 'organic', label: 'Google Search' },
  { value: 'maps', label: 'Google Maps' },
  { value: 'ai', label: 'AI mentions' },
];

export function ProgressPage() {
  const d = useResultsData();
  const { f, set, snapshot, dispatch, pts, dates, laterFrom, annotations, aiRolling, first, last, queries, aiTotals, aiAll, biz, org, maps, periodLabel, snapLabel } = d;
  const view: Channel = f.channel === 'all' ? 'organic' : f.channel;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Progress</h1>
          <p className="muted">How Lifeguard-Pro shows up over time. All figures are sample data.</p>
        </div>
      </header>

      <div className="filters panel">
        <Select label="City" value={f.city} onChange={(v) => set({ city: v })} options={[{ value: 'boston', label: 'Boston' }, { value: 'miami', label: 'Miami' }]} />
        <div className="field field-inline">
          <span className="field-label">Period</span>
          <Segmented<7 | 30 | 90> label="Period" value={f.range} onChange={(v) => set({ range: v })} options={[7, 30, 90].map((n) => ({ value: n as 7 | 30 | 90, label: `Last ${n} days` }))} />
        </div>
      </div>

      <section className="panel progress-main" aria-labelledby="prog-h">
        <div className="view-choice" role="group" aria-label="What to show">
          {VIEWS.map((v) => (
            <button key={v.value} className={`choice ${view === v.value ? 'on' : ''}`} aria-pressed={view === v.value} onClick={() => set({ channel: v.value })}>
              {v.label}
            </button>
          ))}
        </div>
        <h2 id="prog-h" className="sr-only">
          {VIEWS.find((v) => v.value === view)!.label}
        </h2>
        <p className="metric-explain">
          {view === 'organic' && `Lifeguard-Pro’s average position across ${queries.length} tracked Google searches in ${CITIES[f.city].name}. Lower is better.`}
          {view === 'maps' && `Lifeguard-Pro’s position in Google Maps from one sample point in ${CITIES[f.city].name}, plus actions people took on the profile.`}
          {view === 'ai' && `How often sample answers from each AI tool mention Lifeguard-Pro (7-day rolling share). Mentions and links are counted separately.`}
        </p>
        <div className="tiles">
          {view === 'organic' && (
            <>
              <Tile label="Average position (latest)" value={last.organicRank} note={<Delta from={first.organicRank} to={last.organicRank} lowerIsBetter />} />
              <Tile label="Website clicks" value={org.clicks.toLocaleString('en-US')} note="From search, total for period" />
              <Tile label="Times shown in search" value={org.impressions.toLocaleString('en-US')} note="Impressions, total for period" />
            </>
          )}
          {view === 'maps' && (
            <>
              <Tile label="Maps position (latest)" value={last.mapsPosition ?? 'Not observed'} note={<Delta from={first.mapsPosition} to={last.mapsPosition} lowerIsBetter />} />
              <Tile label="Calls from the profile" value={maps.calls} note="Total for period" />
              <Tile label="Direction requests" value={maps.directions} note="Total for period" />
            </>
          )}
          {view === 'ai' && (
            <>
              <Tile label="Mentioned" value={`${aiAll.mentions} of ${aiAll.samples}`} note={`${pct(aiAll.mentions, aiAll.samples)} of sample answers`} />
              <Tile label="Linked to your site" value={`${aiAll.citations} of ${aiAll.samples}`} note="A mention without a link stays uncited" />
            </>
          )}
        </div>
        {view === 'organic' && (
          <LineChart title="Average Google Search position" dates={dates} yLabel="Avg. position" invert annotations={annotations} laterFrom={laterFrom} series={[{ key: 'r', label: 'Average position (lower is better)', color: C.navy, values: pts.map((p) => p.organicRank) }]} />
        )}
        {view === 'maps' && (
          <LineChart title="Average Google Maps position" dates={dates} yLabel="Maps position" invert annotations={annotations} laterFrom={laterFrom} series={[{ key: 'm', label: 'Maps position (lower is better)', color: C.navy, values: pts.map((p) => p.mapsPosition) }]} />
        )}
        {view === 'ai' && (
          <>
            <LineChart
              title="AI mention rate by platform"
              dates={dates}
              yLabel="% of answers (7-day)"
              format={(v) => `${v}%`}
              annotations={annotations}
              laterFrom={laterFrom}
              series={AI_PLATFORM_IDS.map((p) => ({ key: p, label: AI_PLATFORMS[p], color: PLATFORM_COLOR[p], values: aiRolling(p, 'mentions') }))}
            />
            <p className="muted small">
              {aiTotals.map((x) => `${AI_PLATFORMS[x.p]}: mentioned ${x.mentions} of ${x.samples}, linked ${x.citations} of ${x.samples}`).join(' · ')}
            </p>
          </>
        )}
        <SampleNote>
          {snapLabel} · {periodLabel}.{' '}
          {snapshot === 'later'
            ? 'The shaded part is a simulated later measurement — not a prediction and not proof that a change caused it.'
            : 'Applying demo changes does not move these numbers; real results would need to be measured after a real update.'}
        </SampleNote>
      </section>

      <div className="link-list">
        <Link to="/progress/measurements" className="sec-link">
          <Icon name="chart" />
          <span>
            <strong>View all measurements</strong>
            <span className="muted small">Every chart and table, search-phrase history, impressions, clicks, profile actions and AI details</span>
          </span>
          <Icon name="chevronRight" />
        </Link>
        <Link to="/progress/history" className="sec-link" onClick={() => dispatch({ type: 'UI_SET', patch: { activityFilter: 'all' } })}>
          <Icon name="history" />
          <span>
            <strong>Change history</strong>
            <span className="muted small">Checks, approvals, demo updates, automatic updates and restores, with before and after</span>
          </span>
          <Icon name="chevronRight" />
        </Link>
      </div>

      <Disclosure label="Enquiries & registrations" hint="Sample enquiries, registrations and revenue" className="panel-disclosure">
        <div className="tiles">
          <Tile label="Enquiries" value={biz.enquiries} note="Total for period" />
          <Tile label="Registrations" value={biz.registrations} note={`${pct(biz.registrations, biz.enquiries)} of enquiries`} />
          <Tile label="Revenue (sample)" value={`$${biz.revenue.toLocaleString('en-US')}`} note="Registrations × sample fee" />
        </div>
        <LineChart
          title="Enquiries and registrations"
          dates={dates}
          yLabel="Per day"
          annotations={annotations}
          laterFrom={laterFrom}
          series={[
            { key: 'e', label: 'Enquiries', color: C.blue, values: pts.map((p) => p.enquiries) },
            { key: 'r', label: 'Registrations', color: C.navy, values: pts.map((p) => p.registrations) },
          ]}
        />
      </Disclosure>

      <Disclosure label="Export" hint="Download the data shown for the current city and period" className="panel-disclosure">
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={d.exportCsv}>
            <Icon name="download" /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={d.exportReport}>
            <Icon name="file" /> Export demo report
          </button>
        </div>
        <p className="muted small">Files are labelled as sample data and include the selected city, period and channel{f.channel === 'all' ? 's' : ''}.</p>
      </Disclosure>

      <Disclosure label="Demo controls" hint="Presentation-only options" className="panel-disclosure">
        <button className={`btn ${snapshot === 'later' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => dispatch({ type: 'SETTINGS_SET', patch: { snapshot: snapshot === 'later' ? 'baseline' : 'later' }, now: nowIso() })}>
          <Icon name="clock" /> {snapshot === 'later' ? 'Return to baseline data' : 'Load later demo snapshot'}
        </button>
        <p className="muted small">The later snapshot adds seeded measurements for Oct 17 – Nov 6, 2026. It is a simulated future measurement, clearly shaded on charts.</p>
      </Disclosure>
    </div>
  );
}
