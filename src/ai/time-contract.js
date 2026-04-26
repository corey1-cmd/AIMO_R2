/* ═══════════════════════════════════════════════════════════════
   time-contract.js — enforce H1..H4 at every scheduler entry

   H1: ∀ step: step.startTime ≥ now
   H2: timeline is monotonically non-decreasing
   H3: placed anchors satisfy fixedAt ≥ now
   H4: now is monotonically non-decreasing across calls
   ═══════════════════════════════════════════════════════════════ */

export class TimeRegressionError extends Error {
  constructor(kind, detail) {
    super(`TimeRegressionError[${kind}]: ${JSON.stringify(detail)}`);
    this.name = 'TimeRegressionError';
    this.kind = kind;
    this.detail = detail;
  }
}

/**
 * TimeContext is the ONE source of truth for "what time is it now?"
 * - `now`: real execution time in absolute minutes (since local midnight)
 * - `epoch`: monotonic integer, incremented on each replan; detects stale contexts
 *
 * Rules:
 *   - Every scheduler entry point must be handed a TimeContext.
 *   - `now` is never derived from `opts.currentTime` — the caller is responsible
 *     for passing real wall-clock time.
 *   - `assertMonotonic(prev)` must be called on every replan to detect regression.
 */
export class TimeContext {
  constructor({ now, epoch = 0, source = 'caller' }) {
    if (typeof now !== 'number' || !Number.isFinite(now) || now < 0) {
      throw new TimeRegressionError('INVALID_NOW', { now, source });
    }
    this.now = now;
    this.epoch = epoch;
    this.source = source;
    Object.freeze(this);
  }

  /** Build next context for a replan; enforces H4 */
  advance({ now, source = 'replan' }) {
    if (now < this.now) {
      throw new TimeRegressionError('NOW_WENT_BACKWARD', {
        prev: this.now, next: now, prevEpoch: this.epoch, source,
      });
    }
    return new TimeContext({ now, epoch: this.epoch + 1, source });
  }

  /** Validate that a proposed start time satisfies H1 with small tolerance */
  assertFuture(startTime, label) {
    const TOLERANCE_MIN = 0.1;  // 6 seconds — accounts for compute time itself
    if (startTime + TOLERANCE_MIN < this.now) {
      throw new TimeRegressionError('H1_VIOLATION', {
        label, startTime, now: this.now, deficit: this.now - startTime,
      });
    }
  }

  /** Validate step ordering (H2) against the previous step */
  assertMonotonic(prevEndTime, step) {
    const TOLERANCE = 0.1;
    if (step.startTime + TOLERANCE < prevEndTime) {
      throw new TimeRegressionError('H2_VIOLATION', {
        step: step.tag, startTime: step.startTime, prevEndTime,
      });
    }
  }

  /** Validate anchor placement (H3) */
  assertAnchorFuture(anchor) {
    if (anchor.fixedAt < this.now) {
      throw new TimeRegressionError('H3_VIOLATION', {
        anchor: anchor.tag ?? anchor.itemId, fixedAt: anchor.fixedAt, now: this.now,
      });
    }
  }
}

/**
 * Parse a "HH:MM" string into absolute minutes-since-midnight.
 * Shared helper so the scheduler can accept either representation.
 */
export function parseTime(s) {
  if (typeof s === 'number') return s;
  if (typeof s !== 'string' || !/^\d{2}:\d{2}$/.test(s)) {
    throw new TimeRegressionError('INVALID_TIME_FORMAT', { value: s });
  }
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

/** Build a TimeContext from either a string or from Date.now() */
export function nowContext(nowOrString) {
  if (nowOrString == null) {
    const d = new Date();
    return new TimeContext({
      now: d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60,
      source: 'wallclock',
    });
  }
  return new TimeContext({ now: parseTime(nowOrString), source: 'explicit' });
}
