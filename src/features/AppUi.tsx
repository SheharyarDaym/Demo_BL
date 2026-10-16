import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AnalysisRun, AnalysisSelection } from '../domain/types';
import { runAnalysisStages } from '../services/demoService';
import { useStore } from '../state/store';
import { nowIso } from '../utils/format';

export type AnalysisPhase = 'idle' | 'running' | 'done' | 'cancelled';

export interface AnalysisRunner {
  phase: AnalysisPhase;
  stage: number;
  run: AnalysisRun | null;
  start: (sel: AnalysisSelection) => void;
  cancel: () => void;
  dismiss: () => void;
}

export interface AppUi {
  openSettings: (section?: string) => void;
  analysis: AnalysisRunner;
}

const noop = () => {};
export const AppUiContext = createContext<AppUi>({
  openSettings: noop,
  analysis: { phase: 'idle', stage: 0, run: null, start: noop, cancel: noop, dismiss: noop },
});
export const useAppUi = () => useContext(AppUiContext);

/** Runs the visible "Check competitors" stages; cancelling stops cleanly with no late findings. */
export function useAnalysisRunner(): AnalysisRunner {
  const { state, dispatch } = useStore();
  const [phase, setPhase] = useState<AnalysisPhase>('idle');
  const [stage, setStage] = useState(0);
  const [run, setRun] = useState<AnalysisRun | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const meta = useRef({ stage: 0, startedAt: '', sel: null as AnalysisSelection | null, runs: 0 });

  const start = useCallback(
    async (sel: AnalysisSelection) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      meta.current = { stage: 0, startedAt: nowIso(), sel, runs: state.analysisRuns.length };
      setRun(null);
      setStage(0);
      setPhase('running');
      try {
        await runAnalysisStages((i) => {
          meta.current.stage = i;
          setStage(i);
        }, ctrl.signal);
        if (ctrl.signal.aborted) return;
        dispatch({ type: 'ANALYSIS_COMPLETE', selection: sel, startedAt: meta.current.startedAt, now: nowIso() });
        setPhase('done');
      } catch {
        /* cancelled */
      }
    },
    [dispatch, state.analysisRuns.length],
  );

  // Pick up the run recorded by the reducer.
  useEffect(() => {
    if (phase === 'done' && !run && state.analysisRuns[0]?.status === 'completed') setRun(state.analysisRuns[0]);
  }, [phase, run, state.analysisRuns]);

  const cancel = useCallback(() => {
    if (!abortRef.current || phase !== 'running') return;
    abortRef.current.abort();
    abortRef.current = null;
    const m = meta.current;
    if (m.sel) dispatch({ type: 'ANALYSIS_CANCELLED', selection: m.sel, stage: m.stage, startedAt: m.startedAt, now: nowIso() });
    setPhase('cancelled');
  }, [dispatch, phase]);

  const dismiss = useCallback(() => {
    setPhase('idle');
    setRun(null);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);
  return { phase, stage, run, start, cancel, dismiss };
}
