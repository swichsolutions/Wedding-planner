/**
 * Moves points on a 0–100 axis as little as possible so that neighbours stay at least `gap`
 * apart, keeping their order. Points already far enough apart don't move. Used for the day bar's
 * pins, whose real times bunch up on a narrow screen. `xs` must be sorted.
 *
 * Subtracting i × gap turns "at least gap apart" into "never decreasing", which pool-adjacent-
 * violators solves: a run that breaks the order settles on its average.
 */
export function spreadApart(xs: readonly number[], gap: number): number[] {
  const n = xs.length;
  if (n < 2) return [...xs];
  const step = Math.min(gap, 100 / (n - 1)); // no room for the whole gap: as even as it gets
  const runs: { sum: number; count: number }[] = [];
  xs.forEach((x, i) => {
    let run = { sum: x - i * step, count: 1 };
    while (runs.length) {
      const prev = runs[runs.length - 1];
      if (prev.sum / prev.count <= run.sum / run.count) break;
      run = { sum: run.sum + prev.sum, count: run.count + prev.count };
      runs.pop();
    }
    runs.push(run);
  });
  const max = 100 - (n - 1) * step;
  const out: number[] = [];
  for (const run of runs) {
    const y = Math.min(max, Math.max(0, run.sum / run.count));
    for (let k = 0; k < run.count; k++) out.push(y + out.length * step);
  }
  return out;
}
