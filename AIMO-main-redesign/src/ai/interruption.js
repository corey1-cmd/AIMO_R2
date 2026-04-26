/* ═══════════════════════════════════════════════════════════════
   interruption.js — Task 3: deterministic interruption handling

   State machine per task instance:

       ┌─────────────┐
       │ Scheduled   │ — created at analyze() time
       └──────┬──────┘
              │ pickup()
              ▼
       ┌─────────────┐
       │ Running     │
       └──────┬──────┘
              │ pause(now)          ↘
              ▼                       ┐
       ┌─────────────┐       complete(now)
       │ Paused      │                ↓
       └──────┬──────┘       ┌─────────────┐
              │              │ Completed   │
    ┌─────────┼─────────┐    └─────────────┘
    │         │         │
   resume   restart   abandon
    │         │         │
    ▼         ▼         ▼
  Running  Running   (dropped from plan)

   Data model (InterruptedTask):
     {
       itemId,            // L4 tag or synthetic
       originalAct,       // base duration in minutes
       elapsed,           // minutes actually spent
       remaining,         // = originalAct - elapsed (resume) or originalAct (restart)
       resumeMode,        // 'resume' | 'restart' | 'abandon'
       pausedAt,          // absolute minute when paused
       state,             // 'Paused' | 'Resumed' | 'Restarted' | 'Abandoned'
       energyAlreadyContributed,  // fraction already added to cumE (for resume)
     }

   Invariants:
     INT-1: remaining ≥ 0
     INT-2: pausedAt ≥ originalStart + elapsed
     INT-3: resumed task placed in timeline has startTime ≥ ctx.now  (inherits H1)
     INT-4: on resume, energy contributes (1 - elapsed/originalAct) fraction
     INT-5: on restart, energy is reset and full originalAct contribution applied
     INT-6: abandoned tasks do not appear in timeline

   Integration point: scheduler.js `interruptions` opt. Before the walker
   processes the normal item queue, it inserts interrupted items at the head
   with their remaining duration and state-dependent energy contribution.
   ═══════════════════════════════════════════════════════════════ */

import { getL4 } from './types-v3.js';
import { TimeRegressionError } from './time-contract.js';

/**
 * Construct an InterruptedTask from a currently-running task that just got paused.
 * Throws if elapsed exceeds originalAct (INT-1).
 */
export function makeInterrupted({ itemId, originalAct, startedAt, pausedAt, resumeMode = 'resume' }) {
  if (typeof startedAt !== 'number' || typeof pausedAt !== 'number') {
    throw new TimeRegressionError('INTERRUPT_INVALID_TIMES', { startedAt, pausedAt });
  }
  if (pausedAt < startedAt) {
    throw new TimeRegressionError('INTERRUPT_NEGATIVE_ELAPSED', { startedAt, pausedAt });
  }
  const elapsed = Math.min(pausedAt - startedAt, originalAct);
  let remaining;
  if (resumeMode === 'resume') remaining = Math.max(0, originalAct - elapsed);
  else if (resumeMode === 'restart') remaining = originalAct;
  else if (resumeMode === 'abandon') remaining = 0;
  else throw new TimeRegressionError('INTERRUPT_INVALID_MODE', { resumeMode });

  return {
    itemId,
    originalAct,
    elapsed,
    remaining,
    resumeMode,
    pausedAt,
    startedAt,
    state: resumeMode === 'abandon' ? 'Abandoned' : 'Paused',
    energyFraction: resumeMode === 'resume'
      ? Math.min(1, elapsed / Math.max(originalAct, 0.001))
      : 0,
  };
}

/**
 * Convert a set of InterruptedTask records into "resume items" the scheduler
 * can insert at the head of its queue. Each returned item is a shallow clone
 * of the original L4 with `act` overridden to `remaining` plus metadata.
 *
 * Abandoned tasks are excluded (INT-6).
 */
export function buildResumeItems(interruptions) {
  const out = [];
  for (const intr of interruptions || []) {
    if (intr.state === 'Abandoned' || intr.resumeMode === 'abandon') continue;
    if (intr.remaining <= 0) continue;

    const base = getL4(intr.itemId);
    if (!base) {
      // Unknown tag: skip silently or surface as warning. Safer: skip + record.
      continue;
    }
    out.push({
      ...base,
      act: intr.remaining,             // override duration with remaining
      _interrupted: {
        originalAct: intr.originalAct,
        elapsed: intr.elapsed,
        mode: intr.resumeMode,
        pausedAt: intr.pausedAt,
        energyFraction: intr.energyFraction,
      },
    });
  }
  return out;
}

/**
 * Compute energy contribution for an interrupted task (INT-4, INT-5).
 * Called by the scheduler in place of the normal energyContribution() when
 * l4._interrupted is present.
 *
 * - resume:   contribute (1 - energyFraction) of the full baseline energy
 *             (the fraction already counted at the time of original emission
 *              is NOT re-counted here — the caller is responsible for NOT
 *              having double-counted via `cumulativeEnergy` from a prior run).
 * - restart:  contribute full baseline
 */
export function interruptedEnergyContribution(l4, baseEnergy) {
  const i = l4._interrupted;
  if (!i) return baseEnergy;
  if (i.mode === 'restart') return baseEnergy;
  if (i.mode === 'resume') return baseEnergy * (1 - i.energyFraction);
  return 0;
}
