"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const STORAGE_KEY = "threadzy-sidebar-width";
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 320;

function clamp(value: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
}

// Read persisted width via useSyncExternalStore (avoids setState-in-effect)
function subscribeToStorage(cb: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function getStoredWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return clamp(Number(raw));
  } catch {
    /* SSR or parse error */
  }
  return DEFAULT_WIDTH;
}

function getServerWidth(): number {
  return DEFAULT_WIDTH;
}

export function ResizableSidebar({ children }: { children: ReactNode }) {
  const initialWidth = useSyncExternalStore(
    subscribeToStorage,
    getStoredWidth,
    getServerWidth,
  );
  const [width, setWidth] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const startDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const startX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const startWidth = width;

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const currentX =
          "touches" in ev
            ? (ev as TouchEvent).touches[0].clientX
            : (ev as MouseEvent).clientX;
        const newWidth = clamp(startWidth + (currentX - startX));
        setWidth(newWidth);
      };

      const onEnd = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onEnd);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onEnd);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onEnd);
      document.addEventListener("touchmove", onMove);
      document.addEventListener("touchend", onEnd);
    },
    [width],
  );

  // Persist width to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(width));
    } catch {
      /* ignore */
    }
  }, [width]);

  return (
    <aside
      ref={sidebarRef}
      className="hidden md:flex border-r border-[var(--border)] flex-col bg-[var(--background)] shrink-0 overflow-hidden relative"
      style={{ width }}
    >
      {children}

      {/* Drag handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={width}
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-30 group hover:bg-teal-500/40 transition-colors"
        onMouseDown={startDrag}
        onTouchStart={startDrag}
      >
        {/* Wider invisible hit area */}
        <div className="absolute -left-1 -right-1 top-0 bottom-0" />
      </div>

      {/* Full-screen overlay during drag to prevent iframe/selection interference */}
      {isDragging && (
        <div className="fixed inset-0 z-50 cursor-col-resize" />
      )}
    </aside>
  );
}
