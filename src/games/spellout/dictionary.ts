/**
 * Spellout dictionary: a sorted word array queried by prefix via binary
 * search. Cheaper to build than a trie for ~128k words and answers every
 * question the game needs in O(log n): is this a valid prefix, how many words
 * remain, which letters extend it, is the fragment itself the only word left.
 */

export class Dictionary {
  readonly words: string[];
  private readonly common: Set<string>;

  constructor(words: string[], commonWords: string[]) {
    // Assumed lowercase; sort defensively so binary search is always valid.
    this.words = [...words].sort();
    this.common = new Set(commonWords);
  }

  /** Index of the first word >= prefix. */
  private lowerBound(prefix: string): number {
    let lo = 0;
    let hi = this.words.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.words[mid] < prefix) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** [start, end) of words beginning with prefix. */
  range(prefix: string): [number, number] {
    const lo = this.lowerBound(prefix);
    // "￿" sorts after every extension of the prefix.
    const hi = this.lowerBound(prefix + "￿");
    return [lo, hi];
  }

  countWithPrefix(prefix: string): number {
    const [lo, hi] = this.range(prefix);
    return hi - lo;
  }

  isPrefix(prefix: string): boolean {
    return this.countWithPrefix(prefix) > 0;
  }

  isWord(word: string): boolean {
    const lo = this.lowerBound(word);
    return this.words[lo] === word;
  }

  isCommon(word: string): boolean {
    return this.common.has(word);
  }

  /** Letters that keep the fragment a valid prefix. */
  legalLetters(fragment: string): string[] {
    const [lo, hi] = this.range(fragment);
    const letters: string[] = [];
    let i = lo;
    const pos = fragment.length;
    while (i < hi) {
      const word = this.words[i];
      if (word.length <= pos) {
        i++;
        continue;
      }
      const letter = word[pos];
      letters.push(letter);
      // Skip the whole block sharing this next letter.
      i = this.lowerBound(fragment + letter + "￿");
    }
    return letters;
  }

  /**
   * Distinct next letters with how many words each leads to — the AI's
   * branching structure.
   */
  letterCounts(fragment: string): Array<{ letter: string; count: number }> {
    const [lo, hi] = this.range(fragment);
    const result: Array<{ letter: string; count: number }> = [];
    let i = lo;
    const pos = fragment.length;
    while (i < hi) {
      const word = this.words[i];
      if (word.length <= pos) {
        i++;
        continue;
      }
      const letter = word[pos];
      const next = this.lowerBound(fragment + letter + "￿");
      result.push({ letter, count: next - i });
      i = next;
    }
    return result;
  }

  /** A random word starting with the fragment (for "X would've worked"). */
  sampleWithPrefix(fragment: string, excludeExact = true): string | null {
    const [lo, hi] = this.range(fragment);
    const candidates: string[] = [];
    for (let i = lo; i < hi && candidates.length < 200; i++) {
      if (excludeExact && this.words[i] === fragment) continue;
      candidates.push(this.words[i]);
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}

let cached: Promise<Dictionary> | null = null;

/** Fetch + parse the shipped word lists once per session. */
export function loadDictionary(): Promise<Dictionary> {
  if (!cached) {
    cached = Promise.all([
      fetch("/dict/words.txt").then((r) => r.text()),
      fetch("/dict/common.txt").then((r) => r.text()),
    ]).then(
      ([all, common]) =>
        new Dictionary(
          all.split("\n").map((w) => w.trim()).filter(Boolean),
          common.split("\n").map((w) => w.trim()).filter(Boolean),
        ),
    );
  }
  return cached;
}
