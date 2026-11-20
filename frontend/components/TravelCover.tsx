'use client';

import { useEffect, useRef, useState } from 'react';

const editions = [
  {
    name: 'Pittsburgh',
    subtitle: 'by the rivers.',
    image: '/images/pittsburgh-cover.webp',
    preview: 'Preview the walk',
  },
  {
    name: 'Oʻahu',
    subtitle: 'along the shore.',
    image: '/images/oahu-cover.webp',
    preview: 'Preview the coastal itinerary',
  },
];

export default function TravelCover({
  index,
  change,
  active,
  preview,
}: {
  index: number;
  change: (index: number) => void;
  active: boolean;
  preview: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [reduced, setReduced] = useState(true);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const edition = editions[index];
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!active || paused || hovering || reduced) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) change((index + 1) % editions.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [active, paused, hovering, reduced, index, change]);
  function step(direction: number) {
    setPaused(true);
    change((index + direction + editions.length) % editions.length);
  }
  return (
    <section
      className="travel-cover"
      aria-label="Featured sample trips"
      onFocus={() => setPaused(true)}
      onTouchStart={(event) => {
        touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }}
      onTouchCancel={() => {
        touchStart.current = null;
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const dx = event.changedTouches[0].clientX - start.x,
          dy = event.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
      }}
    >
      {editions.map((slide, i) => (
        <img
          key={slide.name}
          className="cover-image"
          data-selected={i === index}
          src={slide.image}
          alt=""
          fetchPriority={i === 0 ? 'high' : 'low'}
        />
      ))}
      <div
        className="cover-copy"
        key={edition.name}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <h1>
          {edition.name}
          <em>{edition.subtitle}</em>
        </h1>
        <button onClick={preview}>
          {edition.preview} <span aria-hidden="true">→</span>
        </button>
      </div>
      <div
        className="cover-controls"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <button aria-label="Previous destination" onClick={() => step(-1)}>
          ←
        </button>
        <span>{String(index + 1).padStart(2, '0')} / 02</span>
        <button aria-label="Next destination" onClick={() => step(1)}>
          →
        </button>
        {!reduced && (
          <button
            aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPaused(!paused)}
          >
            {paused ? '▷' : 'Ⅱ'}
          </button>
        )}
      </div>
    </section>
  );
}
