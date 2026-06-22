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

function getStoredWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return clamp(Number(raw));
  } catch {
    /* SSR or parse error */
  }
  return DEFAULT_WIDTH;
}

// useSyncExternalStore gives us the stored value on the client
// and DEFAULT_WIDTH on the server — no setState-in-effect needed.
function subscribeToStorage(cb: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function getServerWidth(): number {
  return DEFAULT_WIDTH;
}

export function ResizableSidebar({ children }: { children: ReactNode }) {
  const storedWidth = useSyncExternalStore(
    subscribeToStorage,
    getStoredWidth,
    getServerWidth,
  );

  // Track whether the user has dragged in this session.
  // Only persist width changes that come from user interaction,
  // not from hydration (which would overwrite the stored value).
  const hasDraggedRef = useRef(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  // Effective width: use drag override if user has dragged, otherwise stored
  const width = dragWidth ?? storedWidth;

  const startDrag = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsDragging(true);
      hasDraggedRef.current = true;

      const startX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const startWidth = dragWidth ?? storedWidth;

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const currentX =
          "touches" in ev
            ? (ev as TouchEvent).touches[0].clientX
            : (ev as MouseEvent).clientX;
        const newWidth = clamp(startWidth + (currentX - startX));
        setDragWidth(newWidth);
      };

      const onEnd = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onEnd);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onEnd);
        document.removeEventListener("touchcancel", onEnd);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onEnd);
      document.addEventListener("touchmove", onMove);
      document.addEventListener("touchend", onEnd);
      document.addEventListener("touchcancel", onEnd);
    },
    [dragWidth, storedWidth],
  );

  // Persist width to localStorage only after user drag interaction
  useEffect(() => {
    if (!hasDraggedRef.current || dragWidth === null) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(dragWidth));
    } catch {
      /* ignore */
    }
  }, [dragWidth]);

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
