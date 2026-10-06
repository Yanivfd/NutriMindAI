/** Average of each value with up to `window - 1` values before it (input oldest first). */
export function movingAverages(values: number[], window = 7): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    const avg = slice.reduce((sum, v) => sum + v, 0) / slice.length;
    return Math.round(avg * 10) / 10;
  });
}
