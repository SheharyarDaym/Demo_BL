import type { Recommendation } from '../domain/types';
import { Icon } from '../components/Icon';
import { useStore } from '../state/store';
import { plainCopy, targetLabel } from './plain';
import { useReview } from './review';

const HINT: Partial<Record<Recommendation['status'], [string, string]>> = {
  draft: ['Draft', 'tone-gray'],
  blocked: ['Needs one detail', 'tone-pink'],
  approved: ['Ready to apply', 'tone-blue'],
  publishing: ['Applying…', 'tone-blue'],
  failed: ['Apply failed — retry', 'tone-red'],
  published: ['Applied', 'tone-green'],
  deferred: ['Later', 'tone-purple'],
  rejected: ['Rejected', 'tone-gray'],
};

/** Plain-language suggestion card: title, one sentence, where, and Review. */
export function RecCard({ rec, isNew }: { rec: Recommendation; isNew?: boolean }) {
  const { state } = useStore();
  const { open } = useReview();
  const copy = plainCopy(rec, state);
  const hint = HINT[rec.status];
  return (
    <article className="rec-card">
      <div className="rec-card-main">
        <h3>{copy.title}</h3>
        <p className="rec-why">{copy.why}</p>
        <p className="rec-target">
          <Icon name="map" size={14} />
          {targetLabel(rec, state)}
          {hint && <span className={`badge ${hint[1]}`}>{hint[0]}</span>}
          {isNew && <span className="badge tone-amber">New</span>}
        </p>
      </div>
      <button className="btn btn-secondary rec-review" onClick={() => open(rec.id)} aria-label={`Review: ${copy.title}`}>
        Review <Icon name="arrowRight" size={16} />
      </button>
    </article>
  );
}
