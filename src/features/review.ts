import { useLocation, useNavigate } from 'react-router-dom';
import type { DestContent, Destination, Recommendation } from '../domain/types';
import { nowIso } from '../utils/format';

/** The review panel is addressed by `?review=ID` on whichever page is open, so Back closes it
 *  and the page underneath keeps its filters and scroll position. */
export function useReview() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const current = params.get('review');
  const open = (id: string, opts?: { replace?: boolean }) => {
    const p = new URLSearchParams(location.search);
    p.set('review', id);
    navigate({ pathname: location.pathname, search: `?${p}` }, { state: { panel: true }, replace: opts?.replace });
  };
  const close = () => {
    if ((location.state as { panel?: boolean } | null)?.panel) {
      navigate(-1);
      return;
    }
    const p = new URLSearchParams(location.search);
    p.delete('review');
    const q = p.toString();
    navigate({ pathname: location.pathname, search: q ? `?${q}` : '' }, { replace: true });
  };
  return { current, open, close };
}

/** What the destination will look like after applying a recommendation. */
export function proposedPreview(rec: Recommendation, dest: Destination): DestContent {
  if (dest.mode === 'replace') return rec.proposed;
  return { ...dest.content, items: [{ id: 'preview', text: rec.proposed.text, at: nowIso() }, ...(dest.content.items ?? [])] };
}
