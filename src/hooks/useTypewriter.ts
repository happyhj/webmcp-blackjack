import { useState, useEffect, useRef } from 'react';

/**
 * Typewriter effect — reveals `text` character by character.
 *
 * @param text    Full string to reveal
 * @param active  Start typing when true; reset when text/active changes
 * @param speed   ms per character (default 22)
 * @param onDone  Called once when the full text has been revealed
 * @returns       The portion of text revealed so far
 */
export function useTypewriter(
  text: string,
  active: boolean,
  speed = 22,
  onDone?: () => void,
): string {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);
  const doneCalledRef = useRef(false);

  useEffect(() => {
    if (!active || !text) {
      setDisplayed('');
      indexRef.current = 0;
      doneCalledRef.current = false;
      return;
    }

    // Start fresh for new text
    setDisplayed('');
    indexRef.current = 0;
    doneCalledRef.current = false;

    const interval = setInterval(() => {
      indexRef.current += 1;
      if (indexRef.current >= text.length) {
        setDisplayed(text);
        clearInterval(interval);
        if (!doneCalledRef.current) {
          doneCalledRef.current = true;
          onDone?.();
        }
      } else {
        setDisplayed(text.slice(0, indexRef.current));
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, active, speed, onDone]);

  return active ? displayed : '';
}
