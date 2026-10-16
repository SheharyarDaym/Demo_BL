// Mock service layer. Every "external" operation is simulated locally with deterministic timing.
// Nothing here makes a network request.

export const ANALYSIS_STAGES = [
  'Checking business information',
  'Comparing competitors',
  'Reviewing AI mentions',
  'Preparing recommendations',
] as const;

const STAGE_MS = [950, 1050, 950, 850];
export const PUBLISH_MS = 1300;
export const CONNECTION_TEST_MS = 800;

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/** Runs the visible analysis stages. Rejects with AbortError when cancelled. */
export async function runAnalysisStages(onStage: (i: number) => void, signal: AbortSignal): Promise<void> {
  for (let i = 0; i < ANALYSIS_STAGES.length; i++) {
    onStage(i);
    await wait(STAGE_MS[i], signal);
  }
}

export type PublishOutcome = { ok: true } | { ok: false; error: string };

/** Simulated publish. Fails deterministically when the presenter enabled "fail next publish". */
export async function simulatePublish(opts: { fail: boolean }): Promise<PublishOutcome> {
  await wait(PUBLISH_MS);
  if (opts.fail) return { ok: false, error: 'Simulated error: the demo destination did not respond.' };
  return { ok: true };
}

export async function testConnection(connected: boolean): Promise<boolean> {
  await wait(CONNECTION_TEST_MS);
  return connected;
}
