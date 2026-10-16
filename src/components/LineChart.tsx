import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { fmtShortDate } from '../utils/format';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
}

interface Props {
  title: string;
  dates: string[];
  series: ChartSeries[];
  yLabel: string;
  invert?: boolean; // ranks: lower is better, so 1 sits at the top
  format?: (v: number) => string;
  annotations?: { date: string; label: string }[];
  laterFrom?: string; // shade simulated later-snapshot region
  height?: number;
}

const PAD = { l: 46, r: 14, t: 14, b: 30 };

export function LineChart({ title, dates, series, yLabel, invert, format = (v) => String(v), annotations = [], laterFrom, height = 220 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const descId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setW(Math.max(280, Math.round(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;

  const { min, max, ticks } = useMemo(() => {
    const vals = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
    if (!vals.length) return { min: 0, max: 1, ticks: [0, 1] };
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (invert) lo = Math.max(1, Math.floor(lo - 1));
    else lo = Math.min(0, lo);
    if (hi === lo) hi = lo + 1;
    const step = niceStep((hi - lo) / 4);
    hi = Math.ceil(hi / step) * step;
    lo = invert ? lo : Math.floor(lo / step) * step;
    const t: number[] = [];
    for (let v = lo; v <= hi + 1e-9; v += step) t.push(Math.round(v * 100) / 100);
    return { min: lo, max: hi, ticks: t };
  }, [series, invert]);

  const x = (i: number) => PAD.l + (dates.length <= 1 ? iw / 2 : (i / (dates.length - 1)) * iw);
  const y = (v: number) => {
    const r = (v - min) / (max - min || 1);
    return PAD.t + (invert ? r * ih : (1 - r) * ih);
  };

  const paths = series.map((s) => {
    let d = '';
    let pen = false;
    s.values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  });

  const xTickIdx = useMemo(() => {
    const n = dates.length;
    const count = Math.min(W < 480 ? 3 : 6, n);
    return Array.from({ length: count }, (_, k) => Math.round((k / Math.max(1, count - 1)) * (n - 1)));
  }, [dates.length, W]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.l) / iw) * (dates.length - 1));
    setHover(Math.max(0, Math.min(dates.length - 1, i)));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(dates.length - 1, (h ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? dates.length) - 1));
    else if (e.key === 'Escape') setHover(null);
    else return;
    e.preventDefault();
  };

  const laterIdx = laterFrom ? dates.indexOf(laterFrom) : -1;
  const ann = annotations.map((a) => ({ ...a, i: dates.indexOf(a.date) })).filter((a) => a.i >= 0);
  const hoverAnn = hover !== null ? ann.filter((a) => a.i === hover) : [];
  const last = dates.length - 1;

  return (
    <div className="chart">
      <div className="chart-legend" aria-hidden="true">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} className={s.dashed ? 'dashed' : ''} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="chart-wrap" ref={wrapRef}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label={`${title}. ${yLabel}. Use arrow keys for daily values.`}
          aria-describedby={descId}
          tabIndex={0}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover((h) => h ?? last)}
          onBlur={() => setHover(null)}
          onKeyDown={onKey}
        >
          {laterIdx >= 0 && <rect x={x(laterIdx)} y={PAD.t} width={x(last) - x(laterIdx)} height={ih} className="chart-later" />}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="chart-grid" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="chart-tick">
                {format(t)}
              </text>
            </g>
          ))}
          {xTickIdx.map((i) => (
            <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} className="chart-tick">
              {fmtShortDate(dates[i])}
            </text>
          ))}
          <text x={12} y={PAD.t + ih / 2} transform={`rotate(-90 12 ${PAD.t + ih / 2})`} textAnchor="middle" className="chart-axis">
            {yLabel}
          </text>
          {ann.map((a) => (
            <g key={`${a.date}-${a.label}`}>
              <line x1={x(a.i)} x2={x(a.i)} y1={PAD.t} y2={PAD.t + ih} className="chart-ann" />
              <path d={`M${x(a.i)},${PAD.t} l6,4 l-6,4z`} className="chart-ann-flag" />
            </g>
          ))}
          {series.map((s, k) => (
            <path key={s.key} d={paths[k]} fill="none" stroke={s.color} strokeWidth={2.2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" />
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} className="chart-cursor" />
              {series.map((s) =>
                s.values[hover] === null ? null : <circle key={s.key} cx={x(hover)} cy={y(s.values[hover]!)} r={4} fill="#fff" stroke={s.color} strokeWidth={2} />,
              )}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }} role="presentation">
            <strong>
              {fmtShortDate(dates[hover])}
              {laterIdx >= 0 && hover >= laterIdx ? ' · later snapshot' : ''}
            </strong>
            {series.map((s) => (
              <span key={s.key}>
                <i style={{ background: s.color }} />
                {s.label}: {s.values[hover] === null ? 'Not observed' : format(s.values[hover]!)}
              </span>
            ))}
            {hoverAnn.map((a) => (
              <span key={a.label} className="chart-tip-ann">
                {a.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <p id={descId} className="sr-only">
        {series.map((s) => `${s.label}: latest ${s.values[last] === null ? 'not observed' : format(s.values[last]!)}`).join('. ')}
      </p>
      {ann.length > 0 && (
        <ul className="chart-ann-list">
          {ann.map((a) => (
            <li key={`${a.date}-${a.label}`}>
              <span className="ann-mark" aria-hidden="true" />
              {fmtShortDate(a.date)}: {a.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
