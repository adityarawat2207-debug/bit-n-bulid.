/**
 * ROLE 2: Fractional Indexing Engine
 * 
 * Provides lexicographical midpoint calculation between two arbitrary strings.
 * Solves concurrent list reordering and block insertions without index shifts or collisions.
 */

const BASE_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const START_CHAR = BASE_CHARS[0];
const END_CHAR = BASE_CHARS[BASE_CHARS.length - 1];

export function getInitialOrder(index: number = 0): string {
  const prefix = 'a';
  const padded = index.toString().padStart(4, '0');
  return `${prefix}${padded}`;
}

export function generateBetween(prev: string | null | undefined, next: string | null | undefined): string {
  if (!prev && !next) return 'm';
  if (!prev && next) return getSmaller(next);
  if (prev && !next) return getLarger(prev);

  if (prev && next) {
    if (prev >= next) {
      return prev + 'm';
    }
    return getMidpoint(prev, next);
  }

  return 'm';
}

function getSmaller(str: string): string {
  const first = str[0];
  const idx = BASE_CHARS.indexOf(first);
  if (idx > 0) {
    const midIdx = Math.floor(idx / 2);
    return BASE_CHARS[midIdx];
  }
  return '0' + (str.length > 1 ? getSmaller(str.slice(1)) : 'm');
}

function getLarger(str: string): string {
  const last = str[str.length - 1];
  const idx = BASE_CHARS.indexOf(last);
  if (idx < BASE_CHARS.length - 1) {
    const nextIdx = Math.floor((idx + BASE_CHARS.length) / 2);
    return str.slice(0, -1) + BASE_CHARS[nextIdx];
  }
  return str + 'm';
}

function getMidpoint(low: string, high: string): string {
  let result = '';
  let i = 0;

  while (true) {
    const lowChar = i < low.length ? low[i] : START_CHAR;
    const highChar = i < high.length ? high[i] : END_CHAR;

    const lowIdx = BASE_CHARS.indexOf(lowChar);
    const highIdx = BASE_CHARS.indexOf(highChar);

    if (lowIdx === highIdx) {
      result += lowChar;
      i++;
      continue;
    }

    if (highIdx - lowIdx > 1) {
      const mid = Math.floor((lowIdx + highIdx) / 2);
      result += BASE_CHARS[mid];
      return result;
    }

    result += lowChar;
    i++;
    const nextLow = i < low.length ? low.slice(i) : '';
    return result + getLarger(nextLow || START_CHAR);
  }
}

export function compareBlockOrder(
  a: { order: string; id: string; lamport?: number },
  b: { order: string; id: string; lamport?: number }
): number {
  if (a.order < b.order) return -1;
  if (a.order > b.order) return 1;

  // Deterministic tie-breaker for identical fractional keys
  const lampA = a.lamport || 0;
  const lampB = b.lamport || 0;
  if (lampA !== lampB) return lampA - lampB;

  return a.id.localeCompare(b.id);
}
