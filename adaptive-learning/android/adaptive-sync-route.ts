export function validateAdaptiveBatch(value: Record<string, unknown>) {
  const { after, events } = value;
  if (typeof after !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(after) ||
      BigInt(after) > 9223372036854775807n || !Array.isArray(events) || events.length > 32) return null;
  const normalized = [];
  const now = Date.now();
  for (const event of events) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
    const { id, at, item, skill, correct, rating, difficulty, guess, slip, seconds } = event;
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id) ||
        !Number.isSafeInteger(at) || at < 0 || at > now + 86400000 ||
        typeof item !== 'string' || item.length > 128 ||
        !/^N[1-5]:(preview|full):(vocab|grammar|kanji):.+$/.test(item) || item !== skill ||
        typeof correct !== 'boolean' || rating !== (correct ? 3 : 1) ||
        typeof difficulty !== 'number' || !Number.isFinite(difficulty) || Math.abs(difficulty) > 4 ||
        guess !== 0.25 || slip !== 0.05 || typeof seconds !== 'number' || !Number.isFinite(seconds) ||
        seconds < 1 || seconds > 120) return null;
    normalized.push({ id, at, item, skill, correct, rating, difficulty, guess, slip, seconds });
  }
  return { after, events: normalized };
}
