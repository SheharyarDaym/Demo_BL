import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ActivityStatus, Priority, RecStatus, SourceId, Verification } from '../domain/types';
import { STATUS_LABEL } from '../state/selectors';
import { fmtDateTime } from '../utils/format';
import { Icon } from './Icon';

const STATUS_TONE: Record<RecStatus, string> = {
  draft: 'gray',
  awaiting: 'amber',
  blocked: 'pink',
  approved: 'blue',
  publishing: 'blue',
  published: 'green',
  failed: 'red',
  rejected: 'gray',
  deferred: 'purple',
};

const STATUS_ICON: Record<RecStatus, string> = {
  draft: 'edit',
  awaiting: 'clock',
  blocked: 'alert',
  approved: 'check',
  publishing: 'refresh',
  published: 'checkCircle',
  failed: 'alert',
  rejected: 'x',
  deferred: 'pause',
};

export function StatusBadge({ status }: { status: RecStatus }) {
  return (
    <span className={`badge tone-${STATUS_TONE[status]}`}>
      <Icon name={STATUS_ICON[status]} size={14} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge badge-outline prio-${priority.toLowerCase()}`}>{priority} priority</span>;
}

const ACT_TONE: Record<ActivityStatus, [string, string, string]> = {
  success: ['green', 'checkCircle', 'Success'],
  failed: ['red', 'alert', 'Failed'],
  pending: ['amber', 'clock', 'Pending'],
  info: ['blue', 'info', 'Recorded'],
  cancelled: ['gray', 'x', 'Cancelled'],
};

export function ActivityBadge({ status }: { status: ActivityStatus }) {
  const [tone, icon, label] = ACT_TONE[status];
  return (
    <span className={`badge tone-${tone}`}>
      <Icon name={icon} size={14} />
      {label}
    </span>
  );
}

export const SOURCE_LABEL: Record<SourceId, string> = {
  odoo: 'Odoo — demo source',
  website: 'Website — demo source',
  manual: 'Manual entry',
  brand: 'Brand identity',
};

export const VERIFICATION_LABEL: Record<Verification, string> = {
  identity: 'Verified brand identity',
  sample: 'Sample — not verified',
  'presenter-confirmed': 'Confirmed by presenter (demo)',
  unknown: 'Unknown — missing',
};

/** Source tag that opens a small details popover. */
export function SourceTag({ source, updatedAt, verification, extra }: { source: SourceId; updatedAt: string; verification: Verification; extra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return (
    <span className="source-wrap" ref={ref}>
      <button type="button" className={`source-tag src-${source}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {SOURCE_LABEL[source]}
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <span className="popover" id={id} role="dialog" aria-label="Source details">
          <strong>{SOURCE_LABEL[source]}</strong>
          <span>Last updated: {fmtDateTime(updatedAt)}</span>
          <span>Status: {VERIFICATION_LABEL[verification]}</span>
          {extra}
        </span>
      )}
    </span>
  );
}

export function DestinationTag({ children }: { children: ReactNode }) {
  return (
    <span className="dest-tag">
      <Icon name="send" size={12} />
      {children}
    </span>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name="inbox" size={28} />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function SampleNote({ children }: { children: ReactNode }) {
  return (
    <p className="sample-note">
      <Icon name="info" size={14} />
      {children}
    </p>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  id,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  id?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <label className="field field-inline" htmlFor={fid}>
      <span className="field-label">{label}</span>
      <select id={fid} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Local SVG illustrations used as clearly-labelled sample media. */
export function Illustration({ kind }: { kind: 'pool' | 'training' | 'video' }) {
  if (kind === 'video') {
    return (
      <svg viewBox="0 0 320 180" className="illus" role="img" aria-label="Sample video placeholder illustration">
        <rect width="320" height="180" fill="#0a4c8a" />
        <rect x="20" y="120" width="280" height="40" rx="6" fill="#1d63a8" />
        <path d="M20 132c30-10 50 10 80 0s50-10 80 0 50 10 80 0 30-6 40-4" stroke="#9cc7f0" strokeWidth="3" fill="none" />
        <rect x="120" y="50" width="80" height="50" rx="8" fill="none" stroke="#fff" strokeWidth="3" />
        <text x="160" y="80" textAnchor="middle" fill="#fff" fontSize="12" fontFamily="sans-serif">VIDEO</text>
      </svg>
    );
  }
  if (kind === 'training') {
    return (
      <svg viewBox="0 0 320 180" className="illus" role="img" aria-label="Sample training illustration">
        <rect width="320" height="180" fill="#dce9fa" />
        <rect y="100" width="320" height="80" fill="#5b9bd8" />
        <path d="M0 110c40-10 80 10 120 0s80-10 120 0 60 8 80 4" stroke="#cfe5fb" strokeWidth="4" fill="none" />
        <circle cx="110" cy="96" r="12" fill="#f4c7a1" />
        <rect x="140" y="88" width="70" height="16" rx="8" fill="#f00808" />
        <circle cx="230" cy="70" r="10" fill="#f4c7a1" />
        <rect x="222" y="80" width="16" height="22" rx="4" fill="#052f63" />
        <path d="M60 40h70" stroke="#516d8b" strokeWidth="3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 320 180" className="illus" role="img" aria-label="Sample pool illustration">
      <rect width="320" height="180" fill="#eaf0f7" />
      <rect x="20" y="70" width="280" height="90" rx="6" fill="#3d86cc" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M20 ${92 + i * 20}h280`} stroke="#e6f1fc" strokeWidth="2" strokeDasharray="10 8" />
      ))}
      <rect x="250" y="30" width="12" height="40" fill="#052f63" />
      <rect x="238" y="22" width="36" height="12" rx="3" fill="#f00808" />
    </svg>
  );
}

/** Plainly labelled expandable area. */
export function Disclosure({
  label,
  hint,
  children,
  defaultOpen = false,
  open: controlled,
  onToggle,
  id,
  className = '',
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  id?: string;
  className?: string;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const open = controlled ?? own;
  const auto = useId();
  const bodyId = `${id ?? auto}-body`;
  return (
    <div className={`disclosure ${open ? 'open' : ''} ${className}`} id={id}>
      <button
        type="button"
        className="disclosure-btn"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => {
          setOwn(!open);
          onToggle?.(!open);
        }}
      >
        <Icon name="chevronRight" className="disclosure-chev" />
        <span>
          <span className="disclosure-label">{label}</span>
          {hint && <span className="disclosure-hint">{hint}</span>}
        </span>
      </button>
      {open && (
        <div className="disclosure-body" id={bodyId}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Small "i" button that explains a number or rule. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return (
    <span className="source-wrap infotip" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="infotip-btn" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Icon name="info" size={15} />
      </button>
      {open && (
        <span className="popover" id={id} role="note">
          {children}
        </span>
      )}
    </span>
  );
}

/** Back control: returns through browser history (restoring filters and scroll) or to a fallback route. */
export function BackLink({ to, children = 'Back' }: { to: string; children?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="back-link"
      onClick={() => {
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
        if (idx > 0) navigate(-1);
        else navigate(to);
      }}
    >
      <Icon name="arrowRight" size={16} className="flip" />
      {children}
    </button>
  );
}
