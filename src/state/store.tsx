import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { DemoState } from '../domain/types';
import { createInitialState } from '../data/fixtures';
import { reducer, publishKey, type Action } from './reducer';
import { clearState, loadState, saveState } from './storage';
import { getRec, publishCheck } from './selectors';
import { simulatePublish } from '../services/demoService';
import { nowIso } from '../utils/format';
import { useToast } from '../components/Toast';

interface Store {
  state: DemoState;
  dispatch: (a: Action) => void;
  /** Publish a recommendation. With approveFirst, the current revision is approved in the same step,
   *  but only if the publish checks would pass — a blocked or cancelled attempt never records approval. */
  publish: (recId: string, opts?: { approveFirst?: boolean }) => Promise<'ok' | 'failed' | 'blocked'>;
  reset: () => void;
  storageError: string | null;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [init] = useState(loadState);
  const [state, dispatch] = useReducer(reducer, init.state);
  const [storageError, setStorageError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const inflight = useRef(new Set<string>());
  const toast = useToast();

  useEffect(() => {
    if (init.notice) toast(init.notice, 'info');
  }, [init.notice, toast]);

  useEffect(() => {
    const r = saveState(state);
    setStorageError(r.ok ? null : r.error);
  }, [state]);

  const publish = useCallback(
    async (recId: string, opts?: { approveFirst?: boolean }) => {
      let s = stateRef.current;
      const original = getRec(s, recId);
      if (!original) return 'blocked' as const;
      const pre: Action[] = [];
      if (opts?.approveFirst) {
        if (original.status === 'draft') pre.push({ type: 'REC_SUBMIT', id: recId, now: nowIso() });
        if (original.status === 'draft' || original.status === 'awaiting') pre.push({ type: 'REC_APPROVE', id: recId, now: nowIso() });
      }
      for (const a of pre) s = reducer(s, a);
      const rec = getRec(s, recId)!;
      const check = publishCheck(s, rec);
      const key = publishKey(rec);
      if (!check.ok || inflight.current.has(key)) return 'blocked' as const;
      inflight.current.add(key);
      const fail = s.settings.failNextPublish;
      pre.forEach(dispatch);
      dispatch({ type: 'PUBLISH_START', id: recId, now: nowIso() });
      try {
        const res = await simulatePublish({ fail });
        if (res.ok) {
          dispatch({ type: 'PUBLISH_SUCCESS', id: recId, key, now: nowIso() });
          return 'ok' as const;
        }
        dispatch({ type: 'PUBLISH_FAIL', id: recId, key, error: res.error, now: nowIso() });
        return 'failed' as const;
      } finally {
        inflight.current.delete(key);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    clearState();
    dispatch({ type: 'RESET', state: createInitialState() });
  }, []);

  const value = useMemo(() => ({ state, dispatch, publish, reset, storageError }), [state, publish, reset, storageError]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
