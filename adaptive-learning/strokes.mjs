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

function frame(strokes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const path of strokes) {
    for (const [x, y] of path) {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  const scale = Math.max(maxX - minX, maxY - minY);
  if (!(scale > 1e-6 && Number.isFinite(scale))) return null;
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, scale };
}

export function assessWriting(actual, reference) {
  const count = { actual: actual.length, expected: reference.length };
  if (!actual.length || actual.length !== reference.length) return { count };
  const observedFrame = frame(actual), referenceFrame = frame(reference);
  if (!observedFrame || !referenceFrame) return { count };
  const normalize = (paths, bounds) => paths.map(path =>
    path.map(([x, y]) => [(x - bounds.x) / bounds.scale, (y - bounds.y) / bounds.scale]));
  const observed = normalize(actual, observedFrame);
  const expected = normalize(reference, referenceFrame);
  const strokes = observed.map((path, index) => {
    const forward = strokeDistance(path, expected[index]);
    const reverse = strokeDistance(path.slice().reverse(), expected[index]);
    if (forward === null || reverse === null) return null;
    const strongerMatch = expected.findIndex((candidate, other) => {
      if (other === index) return false;
      const alternate = strokeDistance(path, candidate);
      return alternate !== null && alternate + 0.02 < Math.min(forward, reverse);
    });
    return { shape: Math.min(forward, reverse), reversed: reverse + 0.02 < forward,
      otherStroke: strongerMatch === -1 ? null : strongerMatch + 1 };
  });
  if (strokes.some(stroke => stroke === null)) return { count };
  return {
    count, strokes,
    placement: Math.hypot(observedFrame.x - referenceFrame.x, observedFrame.y - referenceFrame.y),
    scaleRatio: observedFrame.scale / referenceFrame.scale,
  };
}
