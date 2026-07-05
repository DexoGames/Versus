import { useEffect, useState } from "react";

interface TyperOptions {
  typeSpeed?: number;
  deleteSpeed?: number;
  pause?: number;
}

/**
 * Cycles the animated nav-brand suffix: holds each word, deletes it, pauses,
 * then types the next one — mirroring the portfolio site's typewriter.
 *
 * @param suffixes  Words to cycle through (display starts on suffixes[0]).
 * @param holdTimes How long (ms) to hold each word, indexed by suffix.
 */
export function useNavBrandTyper(
  suffixes: string[],
  holdTimes: number[],
  { typeSpeed = 100, deleteSpeed = 50, pause = 300 }: TyperOptions = {},
): string {
  const [text, setText] = useState(suffixes[0] ?? "");

  useEffect(() => {
    let index = 0;
    let timer: ReturnType<typeof setTimeout>;
    let interval: ReturnType<typeof setInterval>;
    let cancelled = false;

    const typeText = (word: string, done: () => void) => {
      let i = 0;
      setText("");
      interval = setInterval(() => {
        i++;
        setText(word.slice(0, i));
        if (i >= word.length) {
          clearInterval(interval);
          if (!cancelled) done();
        }
      }, typeSpeed);
    };

    const deleteText = (done: () => void) => {
      let len = suffixes[index].length;
      interval = setInterval(() => {
        len--;
        setText(suffixes[index].slice(0, Math.max(0, len)));
        if (len <= 0) {
          clearInterval(interval);
          if (!cancelled) done();
        }
      }, deleteSpeed);
    };

    const cycle = () => {
      const holdTime = holdTimes[index] ?? 3000;
      timer = setTimeout(() => {
        deleteText(() => {
          index = (index + 1) % suffixes.length;
          timer = setTimeout(() => typeText(suffixes[index], cycle), pause);
        });
      }, holdTime);
    };

    cycle();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [suffixes, holdTimes, typeSpeed, deleteSpeed, pause]);

  return text;
}
