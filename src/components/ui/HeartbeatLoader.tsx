import { useEffect, useRef } from 'react';

interface HeartbeatLoaderProps {
  /** Custom label text. If not provided, cycles through default messages */
  label?: string;
  /** Additional className for wrapper styling */
  className?: string;
  /** Size variant - affects SVG dimensions */
  size?: 'sm' | 'md' | 'lg';
}

export function HeartbeatLoader({ label, className = '', size = 'md' }: HeartbeatLoaderProps) {
  const clipRectRef = useRef<SVGRectElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number | null>(null);

  const sizeConfig = {
    sm: { width: 180, height: 60, strokeWidth: 1.8, dotRadius: 3 },
    md: { width: 260, height: 80, strokeWidth: 2.5, dotRadius: 4 },
    lg: { width: 340, height: 100, strokeWidth: 3, dotRadius: 5 }
  };

  const config = sizeConfig[size];
  const totalWidth = config.width;
  const duration = 1600;
  const pauseAt = 800;
  const defaultLabels = ['Loading…', 'Please wait…', 'Almost there…'];

  // Path points scaled to size
  const scaleX = totalWidth / 260;
  const scaleY = config.height / 80;
  const pathPoints: [number, number][] = [
    [0, 40 * scaleY], [60 * scaleX, 40 * scaleY], [72 * scaleX, 40 * scaleY],
    [80 * scaleX, 12 * scaleY], [90 * scaleX, 68 * scaleY], [100 * scaleX, 24 * scaleY],
    [108 * scaleX, 40 * scaleY], [200 * scaleX, 40 * scaleY], [260 * scaleX, 40 * scaleY]
  ];

  const getYAtX = (x: number): number => {
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const [x1, y1] = pathPoints[i];
      const [x2, y2] = pathPoints[i + 1];
      if (x >= x1 && x <= x2) {
        const t = (x - x1) / (x2 - x1);
        return y1 + t * (y2 - y1);
      }
    }
    return 40 * scaleY;
  };

  const pathD = `M${pathPoints.map(([x, y]) => `${x},${y}`).join(' L')}`;

  useEffect(() => {
    if (!clipRectRef.current || !dotRef.current || (!label && !labelRef.current)) return;

    const clipRect = clipRectRef.current;
    const dot = dotRef.current;
    const labelEl = labelRef.current;
    let labelIdx = 0;
    let start: number | null = null;
    let pausing = false;
    let pauseStart: number | null = null;

    const animate = (ts: number) => {
      if (!start) start = ts;

      if (pausing) {
        if (pauseStart && ts - pauseStart >= pauseAt) {
          pausing = false;
          start = ts;
          if (!label && labelEl) {
            labelIdx = (labelIdx + 1) % defaultLabels.length;
            labelEl.textContent = defaultLabels[labelIdx];
          }
        }
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      const x = progress * totalWidth;

      clipRect.setAttribute('width', x.toString());
      dot.setAttribute('cx', x.toString());
      dot.setAttribute('cy', getYAtX(x).toString());
      dot.setAttribute('opacity', '1');

      if (progress >= 1) {
        pausing = true;
        pauseStart = ts;
        clipRect.setAttribute('width', '0');
        dot.setAttribute('opacity', '0');
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [label, totalWidth, duration, pauseAt]);

  return (
    <div className={`flex flex-col items-center justify-center p-12 gap-6 ${className}`}>
      <svg
        width={totalWidth}
        height={config.height}
        viewBox={`0 0 ${totalWidth} ${config.height}`}
        xmlns="http://www.w3.org/2000/svg"
        className="max-w-full"
      >
        <defs>
          <clipPath id="reveal">
            <rect ref={clipRectRef} x="0" y="0" width="0" height={config.height} />
          </clipPath>
        </defs>
        <path
          d={pathD}
          fill="none"
          stroke="var(--color-border-tertiary, #e5e7eb)"
          strokeWidth={config.strokeWidth - 0.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={pathD}
          fill="none"
          stroke="#7F77DD"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath="url(#reveal)"
        />
        <circle ref={dotRef} cx="0" cy={40 * scaleY} r={config.dotRadius} fill="#7F77DD" opacity="0" />
      </svg>
      <span
        ref={labelRef}
        className="text-sm text-muted-foreground tracking-wider"
      >
        {label || defaultLabels[0]}
      </span>
    </div>
  );
}
