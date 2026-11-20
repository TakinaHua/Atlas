import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type TouchEvent as ReactTouchEvent,
  type RefObject,
} from 'react';
import type { Place, Trip } from '../lib/types';
import type { PlaceAction, PlaceLocation } from './JourneyCard';

type Position = { x: number; y: number };
type Target = { date: PlaceLocation; before?: string };
type Gesture = {
  source: PlaceLocation;
  place: Place;
  kind: 'pointer' | 'touch';
  id: number;
  clearHold?: () => void;
  trackTouch?: (event: TouchEvent) => void;
  finishTouch?: (event: TouchEvent) => void;
  start: Position;
  point: Position;
  lastPreviewPoint?: Position;
  active: boolean;
};

function canPickUp(target: EventTarget) {
  return (
    target instanceof Element &&
    !target.closest(
      'a, button:not(.stop-title), input, select, textarea, label, [contenteditable]',
    )
  );
}

function edgeSpeed(point: number, start: number, end: number) {
  const edge = 40;
  if (point < start + edge) return -Math.ceil((start + edge - point) / 4);
  if (point > end - edge) return Math.ceil((point - end + edge) / 4);
  return 0;
}

export function useJourneyDrag({
  board,
  trip,
  busy,
  move,
  restore,
}: {
  board: RefObject<HTMLDivElement | null>;
  trip: Trip;
  busy: boolean;
  move: PlaceAction;
  restore: () => void;
}) {
  const gesture = useRef<Gesture | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const suppressClick = useRef(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [target, setTarget] = useState<Target>();

  const reset = useCallback(() => {
    cancelAnimationFrame(frame.current);
    gesture.current?.clearHold?.();
    gesture.current = null;
    setPlace(null);
    setTarget(undefined);
  }, []);

  useEffect(() => {
    function cancel(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !gesture.current) return;
      event.preventDefault();
      const wasDragging = gesture.current.active;
      suppressClick.current = wasDragging;
      reset();
      if (wasDragging) restore();
    }
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [reset, restore]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      gesture.current?.clearHold?.();
      gesture.current = null;
    },
    [],
  );

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const track = (event: TouchEvent) => gesture.current?.trackTouch?.(event);
    const finish = (event: TouchEvent) => gesture.current?.finishTouch?.(event);
    // Register before a touch starts so a pickup can claim the gesture without blocking ordinary swipes.
    element.addEventListener('touchmove', track, { passive: false });
    element.addEventListener('touchend', finish, { passive: false });
    element.addEventListener('touchcancel', finish);
    return () => {
      element.removeEventListener('touchmove', track);
      element.removeEventListener('touchend', finish);
      element.removeEventListener('touchcancel', finish);
    };
  }, []);

  function targetAt(entry: Gesture) {
    const { x, y } = entry.point;
    const hit = document.elementFromPoint(x, y);
    const zone = hit?.closest<HTMLElement>('[data-drop-zone]');
    if (!zone || busy) return undefined;
    const date = zone.dataset.dropZone === 'saved' ? null : zone.dataset.dropZone!;
    const places =
      date === null
        ? (trip.savedPlaces ?? [])
        : trip.days.find((day) => day.date === date)?.places;
    if (
      !places ||
      (entry.source === null && date === null) ||
      (entry.source !== date && places.length >= (date === null ? 120 : 30))
    )
      return undefined;

    if (
      hit?.closest<HTMLElement>('[data-drop-stop]')?.dataset.dropStop === entry.place.id
    )
      return undefined;
    const list = hit?.closest('.studio-stops, .studio-saved-cards');
    const cards = list?.querySelectorAll<HTMLElement>('[data-drop-stop]') ?? [];
    const before = Array.from(cards).find((card) => {
      if (card.dataset.dropStop === entry.place.id) return false;
      const rect = card.getBoundingClientRect();
      return y < rect.top + rect.height / 2;
    })?.dataset.dropStop;
    const originalIndex = places.findIndex((item) => item.id === entry.place.id);
    if (entry.source === date && before === places[originalIndex + 1]?.id)
      return undefined;
    return { date, before };
  }

  function updateDrag() {
    const entry = gesture.current;
    if (!entry?.active) return;
    const { x, y } = entry.point;
    frame.current = requestAnimationFrame(updateDrag);
    let scrolled = false;
    const scroller = board.current;
    if (scroller?.clientWidth) {
      const bounds = scroller.getBoundingClientRect();
      if (
        x >= bounds.left &&
        x <= bounds.right &&
        y >= bounds.top &&
        y <= bounds.bottom
      ) {
        const before = scroller.scrollLeft;
        const speed = edgeSpeed(x, bounds.left, bounds.right);
        if (speed) scroller.scrollLeft += speed;
        scrolled = scroller.scrollLeft !== before;
      }
    }
    const hit = document.elementFromPoint(x, y);
    const list = hit
      ?.closest('.studio-day')
      ?.querySelector<HTMLOListElement>('.studio-stops');
    if (list) {
      const bounds = list.getBoundingClientRect();
      if (y >= bounds.top && y <= bounds.bottom) {
        const before = list.scrollTop;
        const speed = edgeSpeed(y, bounds.top, bounds.bottom);
        if (speed) list.scrollTop += speed;
        scrolled ||= list.scrollTop !== before;
      }
    }
    if (!scrolled && entry.point === entry.lastPreviewPoint) return;
    const label = preview.current;
    if (label) {
      const left = Math.max(
        8,
        Math.min(x + 14, window.innerWidth - label.offsetWidth - 8),
      );
      const top = Math.max(
        8,
        Math.min(y + 18, window.innerHeight - label.offsetHeight - 8),
      );
      label.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      label.style.visibility = 'visible';
      entry.lastPreviewPoint = entry.point;
    }
    const next = targetAt(entry);
    setTarget((current) =>
      current?.date === next?.date && current?.before === next?.before ? current : next,
    );
  }

  function pickUp(entry: Gesture) {
    entry.active = true;
    setPlace(entry.place);
    frame.current = requestAnimationFrame(updateDrag);
  }

  function complete(entry: Gesture, cancelled: boolean) {
    const destination = entry.active && !cancelled ? targetAt(entry) : undefined;
    suppressClick.current = entry.active;
    reset();
    if (destination)
      move(entry.source, entry.place, destination.date, destination.before);
    else if (entry.active) restore();
  }

  function start(event: PointerEvent<HTMLLIElement>, source: PlaceLocation, stop: Place) {
    if (
      busy ||
      gesture.current ||
      event.pointerType === 'touch' ||
      !event.isPrimary ||
      event.button !== 0 ||
      event.shiftKey ||
      !canPickUp(event.target)
    )
      return;
    const origin = event.target as Element;
    origin.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    gesture.current = {
      source,
      place: stop,
      kind: 'pointer',
      id: event.pointerId,
      start: point,
      point,
      active: false,
    };
  }

  function track(event: PointerEvent) {
    const entry = gesture.current;
    if (entry?.kind !== 'pointer' || entry.id !== event.pointerId) return;
    entry.point = { x: event.clientX, y: event.clientY };
    if (
      !entry.active &&
      Math.hypot(entry.point.x - entry.start.x, entry.point.y - entry.start.y) >= 5
    ) {
      window.getSelection()?.removeAllRanges();
      pickUp(entry);
    }
    if (entry.active) event.preventDefault();
  }

  function finish(event: PointerEvent) {
    const entry = gesture.current;
    if (entry?.kind !== 'pointer' || entry.id !== event.pointerId) return;
    entry.point = { x: event.clientX, y: event.clientY };
    complete(entry, event.type !== 'pointerup');
  }

  function startTouch(
    event: ReactTouchEvent<HTMLLIElement>,
    source: PlaceLocation,
    stop: Place,
  ) {
    if (busy || gesture.current || event.touches.length !== 1 || !canPickUp(event.target))
      return;
    const touch = event.changedTouches[0];
    const point = { x: touch.clientX, y: touch.clientY };
    const entry: Gesture = {
      source,
      place: stop,
      kind: 'touch',
      id: touch.identifier,
      start: point,
      point,
      active: false,
    };
    gesture.current = entry;
    const hold = window.setTimeout(() => pickUp(entry), 240);

    function trackTouch(event: TouchEvent) {
      if (event.touches.length !== 1) {
        complete(entry, true);
        return;
      }
      const touch = event.touches[0];
      if (touch.identifier !== entry.id) return;
      entry.point = { x: touch.clientX, y: touch.clientY };
      // Before pickup, movement belongs to the browser so the board can still be swiped.
      if (!entry.active) {
        if (Math.hypot(entry.point.x - entry.start.x, entry.point.y - entry.start.y) > 8)
          reset();
        return;
      }
      if (event.cancelable) event.preventDefault();
    }

    function finishTouch(event: TouchEvent) {
      const touch = Array.from(event.changedTouches).find(
        (item) => item.identifier === entry.id,
      );
      if (!touch) return;
      if (entry.active && event.cancelable) event.preventDefault();
      entry.point = { x: touch.clientX, y: touch.clientY };
      complete(entry, event.type === 'touchcancel');
    }

    entry.trackTouch = trackTouch;
    entry.finishTouch = finishTouch;
    entry.clearHold = () => window.clearTimeout(hold);
  }

  return {
    place,
    target,
    surface,
    preview,
    start,
    startTouch,
    track,
    finish,
    suppressClick,
    isActive: () => gesture.current?.active,
  };
}
