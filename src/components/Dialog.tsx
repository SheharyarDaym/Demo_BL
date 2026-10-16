import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

let openCount = 0;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'modal' | 'drawer';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Prevent Escape/backdrop close (e.g. while an operation runs). */
  locked?: boolean;
}

/** Accessible modal/drawer: focus trap, Escape to close, focus restoration. */
export function Dialog({ open, onClose, title, subtitle, children, footer, variant = 'modal', size = 'md', locked }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current!;
    const first = node.querySelector<HTMLElement>('[data-autofocus]');
    (first ?? node).focus();
    const onKey = (e: KeyboardEvent) => {
      // Only the top-most dialog handles keys.
      const all = document.querySelectorAll('.dialog');
      if (all[all.length - 1] !== node) return;
      if (e.key === 'Escape' && !lockedRef.current) {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab') {
        const els = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!els.length) return;
        const f = els[0];
        const l = els[els.length - 1];
        if (e.shiftKey && (document.activeElement === f || document.activeElement === node)) {
          e.preventDefault();
          l.focus();
        } else if (!e.shiftKey && document.activeElement === l) {
          e.preventDefault();
          f.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    openCount++;
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      openCount = Math.max(0, openCount - 1);
      if (!openCount) document.body.classList.remove('no-scroll');
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className={`dialog-backdrop backdrop-${variant}`} onMouseDown={(e) => e.target === e.currentTarget && !locked && onClose()}>
      <div ref={ref} className={`dialog dialog-${variant} dialog-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header className="dialog-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <div className="dialog-sub">{subtitle}</div>}
          </div>
          <button className="icon-btn" aria-label="Close" onClick={onClose} disabled={locked}>
            <Icon name="x" size={20} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  danger,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel} data-autofocus>
            Cancel
          </button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
