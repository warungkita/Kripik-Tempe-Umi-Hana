import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';

interface AnimatedCounterProps {
  value: number;
  durationMs?: number;
  suffix?: string;
  prefix?: string;
  locale?: string;
  className?: string;
}

export function AnimatedCounter({
  value,
  durationMs = 1400,
  suffix = '',
  prefix = '',
  locale = 'id-ID',
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const prefersReducedMotion = useReducedMotion();

  const [displayValue, setDisplayValue] = useState<number>(() =>
    prefersReducedMotion ? value : 0
  );
  const currentValueRef = useRef<number>(prefersReducedMotion ? value : 0);
  const hasStartedRef = useRef<boolean>(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      currentValueRef.current = value;
      setDisplayValue(value);
      return;
    }

    if (!isInView) return;

    const startValue = hasStartedRef.current ? currentValueRef.current : 0;
    hasStartedRef.current = true;

    if (startValue === value) {
      setDisplayValue(value);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();
    const effectiveDuration = startValue === 0 ? durationMs : Math.min(durationMs, 650);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / effectiveDuration);
      // Cubic ease-out for crisp, smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextVal = Math.round(startValue + (value - startValue) * eased);

      currentValueRef.current = nextVal;
      setDisplayValue(nextVal);

      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        currentValueRef.current = value;
        setDisplayValue(value);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [value, durationMs, isInView, prefersReducedMotion]);

  const finalText = `${prefix}${value.toLocaleString(locale)}${suffix}`;
  const renderedText = `${prefix}${displayValue.toLocaleString(locale)}${suffix}`;

  return (
    <span
      ref={ref}
      aria-label={finalText}
      className={className ? `font-mono-tabular ${className}` : 'font-mono-tabular'}
    >
      <span aria-hidden="true">{renderedText}</span>
    </span>
  );
}
