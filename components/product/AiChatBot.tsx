'use client';

import { PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import './AiChatBot.css';

type BeePosition = {
  x: number;
  y: number;
};

const STORAGE_KEY = 'aimeng-ai-bee-position';
const EDGE_PADDING = 12;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function AiChatBot() {
  const router = useRouter();
  const botRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
  });
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState<BeePosition | null>(null);
  const positionRef = useRef<BeePosition | null>(null);

  const getClampedPosition = useCallback((next: BeePosition) => {
    const rect = botRef.current?.getBoundingClientRect();
    const width = rect?.width || 96;
    const height = rect?.height || 96;
    return {
      x: clamp(next.x, EDGE_PADDING, window.innerWidth - width - EDGE_PADDING),
      y: clamp(next.y, EDGE_PADDING, window.innerHeight - height - EDGE_PADDING),
    };
  }, []);

  const getDefaultPosition = useCallback(() => {
    const rect = botRef.current?.getBoundingClientRect();
    const width = rect?.width || 96;
    const height = rect?.height || 96;
    const bottomGap = window.innerWidth < 640 ? 96 : 24;
    return getClampedPosition({
      x: window.innerWidth - width - 24,
      y: window.innerHeight - height - bottomGap,
    });
  }, [getClampedPosition]);

  function savePosition(next: BeePosition) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage failures; dragging should still work for the current session.
    }
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      let next: BeePosition | null = null;
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : null;
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          next = parsed;
        }
      } catch {
        next = null;
      }
      const nextPosition = getClampedPosition(next || getDefaultPosition());
      positionRef.current = nextPosition;
      setPosition(nextPosition);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [getClampedPosition, getDefaultPosition]);

  useEffect(() => {
    if (!position) return;

    function handleResize() {
      setPosition((current) => {
        if (!current) return current;
        const next = getClampedPosition(current);
        positionRef.current = next;
        savePosition(next);
        return next;
      });
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getClampedPosition, position]);

  function openChat() {
    router.push('/chat');
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!position) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const movedDistance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (movedDistance > 5) drag.moved = true;

    const next = getClampedPosition({
      x: event.clientX - drag.offsetX,
      y: event.clientY - drag.offsetY,
    });
    positionRef.current = next;
    setPosition(next);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    drag.active = false;

    if (positionRef.current) savePosition(positionRef.current);
    if (!drag.moved) openChat();
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    drag.active = false;
    if (positionRef.current) savePosition(positionRef.current);
  }

  return (
    <div
      ref={botRef}
      className="fixed z-50 h-16 w-16 sm:h-24 sm:w-24 lg:h-28 lg:w-28"
      style={{
        left: position ? `${position.x}px` : 'auto',
        top: position ? `${position.y}px` : 'auto',
        right: position ? 'auto' : '0.75rem',
        bottom: position ? 'auto' : '5rem',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tooltip */}
      {isHovered && (
        <div className="pointer-events-none absolute bottom-full right-0 mb-3 hidden whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg animate-fadeIn sm:block">
          点击打开客服，按住可拖动
        </div>
      )}

      {/* AI Bot Button */}
      <div
        role="button"
        tabIndex={0}
        aria-label="打开爱萌 AI 客服，按住可拖动位置"
        className="group relative h-16 w-16 cursor-grab touch-none select-none active:cursor-grabbing sm:h-24 sm:w-24 lg:h-28 lg:w-28"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openChat();
          }
        }}
      >
        {/* Glow effect */}
        <div className="absolute inset-4 rounded-full bg-amber-300/30 blur-xl transition-opacity group-hover:opacity-80 sm:inset-5 sm:blur-2xl" />

        {/* Brand IP */}
        <div className="bee-flight absolute inset-0 drop-shadow-[0_14px_24px_rgba(15,23,42,0.22)] transition-transform duration-300 group-hover:scale-105">
          <Image
            src="/brand/aimeng-bee-ip-512.png"
            alt="爱萌优宁 AI 小蜜蜂"
            width={512}
            height={580}
            sizes="(max-width: 640px) 64px, (max-width: 1024px) 96px, 112px"
            className="h-full w-full object-contain"
            draggable={false}
          />
        </div>

        {/* Sparkles */}
        <div className="absolute right-3 top-4 h-2.5 w-2.5 rounded-full bg-amber-300 animate-sparkle" />
        <div className="absolute bottom-5 left-4 h-2 w-2 rounded-full bg-sky-300 animate-sparkle" style={{ animationDelay: '0.5s' }} />
        <div className="absolute left-7 top-2 h-1.5 w-1.5 rounded-full bg-rose-300 animate-sparkle" style={{ animationDelay: '1s' }} />
      </div>
    </div>
  );
}
