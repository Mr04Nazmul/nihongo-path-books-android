const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function resample(path, count = 24) {
  if (path.length < 2) return null;
  const lengths = [0];
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + distance(path[i - 1], path[i]));
  const length = lengths.at(-1);
  if (!Number.isFinite(length) || length <= 1e-6) return null;
  const result = [path[0]];
  let next = 1;
  for (let i = 1; i < count - 1; i++) {
    const target = length * i / (count - 1);
    while (lengths[next] < target) next++;
    const fraction = (target - lengths[next - 1]) / (lengths[next] - lengths[next - 1]);
    result.push(path[next - 1].map((coordinate, axis) =>
      coordinate + fraction * (path[next][axis] - coordinate)));
  }
  return [...result, path.at(-1)];
}

// Both paths use normalized board coordinates. This preserves position, scale
// and direction, so mirrored or reversed strokes are not treated as identical.
export function strokeDistance(actual, reference) {
  const observed = resample(actual);
  const expected = resample(reference);
  if (!observed || !expected) return null;
  let previous = Array(expected.length + 1).fill(Infinity);
  previous[0] = 0;
  for (const point of observed) {
    const current = [Infinity];
    for (let j = 1; j <= expected.length; j++) {
      current[j] = distance(point, expected[j - 1]) +
        Math.min(previous[j], current[j - 1], previous[j - 1]);
    }
    previous = current;
  }
  return previous[expected.length] / observed.length;
}

export function compareWriting(actual, reference) {
  if (!reference.length || actual.length !== reference.length) return null;
  const distances = actual.map((path, index) => strokeDistance(path, reference[index]));
  return distances.some(value => value === null) ? null : distances;
}
