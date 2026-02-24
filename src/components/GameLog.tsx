import { useEffect, useRef } from 'react';
import type { LogEntry } from '../game/types';

interface GameLogProps {
  entries: LogEntry[];
}

export function GameLog({ entries }: GameLogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <div className="game-log" ref={ref}>
      {entries.map((entry, i) => (
        <div key={i} className={`log-entry log-${entry.type}`}>
          {entry.message}
        </div>
      ))}
    </div>
  );
}
