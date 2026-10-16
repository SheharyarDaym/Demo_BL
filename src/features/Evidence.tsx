import { useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import type { Evidence } from '../domain/types';
import { EVIDENCE } from '../data/static';
import { fmtDateTime } from '../utils/format';

/** Local representation of a captured page — shown inline, never a live link. */
export function SamplePage({ evidence }: { evidence: Evidence }) {
  return (
    <div className="sample-page">
      <div className="sp-bar">
        <Icon name="globe" size={14} />
        <span>{evidence.url}</span>
      </div>
      <div className="sp-body">
        <span className="sp-label">Sample page · local representation, not a live website</span>
        <h3>{evidence.page.heading}</h3>
        {evidence.page.lines.map((l, i) => (
          <p key={i} className={l === evidence.page.highlight ? 'sp-hl' : ''}>
            {l}
          </p>
        ))}
        <p className="muted small">Highlighted text is the excerpt used as evidence. Fictional sample content, captured {fmtDateTime(evidence.capturedAt)}.</p>
      </div>
    </div>
  );
}

export function EvidenceItem({ ev, children }: { ev: Evidence; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="evidence">
      <div className="evidence-head">
        <span className="badge tone-gray">{ev.sourceType}</span>
        <span className="muted small">Captured {fmtDateTime(ev.capturedAt)}</span>
      </div>
      <strong>{ev.title}</strong>
      <span className="muted small evidence-url">{ev.url}</span>
      <blockquote>“{ev.excerpt}”</blockquote>
      <p>
        <Icon name="eye" size={14} /> {ev.observation}
      </p>
      <div className="btn-row">
        <button className="btn btn-secondary btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Icon name="file" size={16} /> {open ? 'Hide sample page' : 'View sample page'}
        </button>
        {children}
      </div>
      {open && <SamplePage evidence={ev} />}
    </li>
  );
}

export function EvidenceList({ ids }: { ids: string[] }) {
  const items = ids.map((id) => EVIDENCE.find((e) => e.id === id)).filter((e): e is Evidence => !!e);
  return (
    <ul className="evidence-list">
      {items.map((ev) => (
        <EvidenceItem key={ev.id} ev={ev} />
      ))}
    </ul>
  );
}
