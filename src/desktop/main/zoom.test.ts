import { describe, expect, it, vi } from 'vitest';
import { clampZoom, nextZoom, ZOOM_STEPS, zoomResult } from './zoom';

describe('ZOOM_STEPS', () => {
  it('has the eight steps of 80-200%', () => {
    expect([...ZOOM_STEPS]).toEqual([0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]);
  });
});

describe('nextZoom', () => {
  it('steps in from 100%', () => {
    expect(nextZoom(1, 'in')).toBe(1.1);
  });

  it('steps in and out through every step, clamped at the ends', () => {
    let zoom = 1;
    const seenIn: number[] = [];
    for (let i = 0; i < 8; i++) {
      zoom = nextZoom(zoom, 'in');
      seenIn.push(zoom);
    }
    expect(seenIn).toEqual([1.1, 1.25, 1.5, 1.75, 2, 2, 2, 2]);

    const seenOut: number[] = [];
    for (let i = 0; i < 9; i++) {
      zoom = nextZoom(zoom, 'out');
      seenOut.push(zoom);
    }
    expect(seenOut).toEqual([1.75, 1.5, 1.25, 1.1, 1, 0.9, 0.8, 0.8, 0.8]);
  });

  it('stays at the top and the bottom', () => {
    expect(nextZoom(2, 'in')).toBe(2);
    expect(nextZoom(0.8, 'out')).toBe(0.8);
  });

  it.each([0.8, 1, 1.5, 2])('resets %s to 100%', (current) => {
    expect(nextZoom(current, 'reset')).toBe(1);
  });

  it('moves an off-step value to the next step in that direction', () => {
    expect(nextZoom(1.3, 'in')).toBe(1.5);
    expect(nextZoom(1.3, 'out')).toBe(1.25);
  });

  it('is not thrown off by floating point noise', () => {
    expect(nextZoom(1.1 + 1e-12, 'in')).toBe(1.25);
    expect(nextZoom(1.1 - 1e-12, 'out')).toBe(1);
  });
});

describe('clampZoom', () => {
  it.each([
    [3, 2],
    [0.5, 0.8],
    [1.3, 1.3],
    [0.8, 0.8],
    [2, 2],
  ])('%s gives %s', (value, expected) => {
    expect(clampZoom(value)).toBe(expected);
  });
});

describe('zoomResult', () => {
  const ok = { ok: true, data: null };

  /** Runs the handler logic and returns what apply and record saw, in order. */
  function run(intent: unknown, current: number, failApply = false) {
    const calls: string[] = [];
    const logError = vi.fn();
    const result = zoomResult(
      intent,
      current,
      {
        apply: (next) => {
          if (failApply) throw new Error('boom');
          calls.push(`apply ${next}`);
        },
        record: (next) => calls.push(`record ${next}`),
      },
      logError,
    );
    return { result, calls, logError };
  }

  it('applies and then records a step in', () => {
    const { result, calls } = run('in', 1);
    expect(result).toEqual(ok);
    expect(calls).toEqual(['apply 1.1', 'record 1.1']);
  });

  it('applies and then records a step out', () => {
    const { result, calls } = run('out', 1.5);
    expect(result).toEqual(ok);
    expect(calls).toEqual(['apply 1.25', 'record 1.25']);
  });

  it.each([
    ['in', 2],
    ['out', 0.8],
  ])('does nothing on %s at the end (%s)', (intent, current) => {
    const { result, calls } = run(intent, current);
    expect(result).toEqual(ok);
    expect(calls).toEqual([]);
  });

  it.each([1, 1.5, 0.8])('reset always applies 100%% (from %s)', (current) => {
    const { result, calls } = run('reset', current);
    expect(result).toEqual(ok);
    expect(calls).toEqual(['apply 1', 'record 1']);
  });

  it('steps from an off-step value', () => {
    expect(run('in', 1.3).calls).toEqual(['apply 1.5', 'record 1.5']);
    expect(run('out', 1.3).calls).toEqual(['apply 1.25', 'record 1.25']);
  });

  it.each(['big', 2, undefined, null, ''])(
    'refuses %j with ARGUMENTS_INVALID and changes nothing',
    (intent) => {
      const { result, calls } = run(intent, 1);
      expect(result).toEqual({
        ok: false,
        error: { code: 'ARGUMENTS_INVALID' },
      });
      expect(calls).toEqual([]);
    },
  );

  it('answers INTERNAL, logs, and records nothing when apply throws', () => {
    const { result, calls, logError } = run('in', 1, true);
    expect(result).toEqual({ ok: false, error: { code: 'INTERNAL' } });
    expect(calls).toEqual([]);
    expect(logError).toHaveBeenCalledOnce();
  });
});
