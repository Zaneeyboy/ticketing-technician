'use client';

import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  duration?: number; // ms, default 800
  suffix?: string;
  prefix?: string;
  decimals?: number;
}

export function CountUp({ value, duration = 800, suffix = '', prefix = '', decimals = 0 }: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;

    if (from === to) return;

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = from + (to - from) * eased;
      setDisplay(parseFloat(current.toFixed(decimals)));

      if (progress < 1) {
        raf.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = to;
        startRef.current = null;
      }
    };

    if (raf.current) cancelAnimationFrame(raf.current);
    startRef.current = null;
    raf.current = requestAnimationFrame(animate);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration, decimals]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();
  return <>{`${prefix}${formatted}${suffix}`}</>;
}
