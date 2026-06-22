"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface MobileMenuContextValue {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  /** DOM element inside the drawer where page-specific content can portal into */
  portalTarget: HTMLDivElement | null;
  setPortalTarget: (el: HTMLDivElement | null) => void;
}

const MobileMenuContext = createContext<MobileMenuContextValue>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
  portalTarget: null,
  setPortalTarget: () => {},
});

export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <MobileMenuContext.Provider
      value={{ isOpen, toggle, close, portalTarget, setPortalTarget }}
    >
      {children}
    </MobileMenuContext.Provider>
  );
}

export function useMobileMenu() {
  return useContext(MobileMenuContext);
}
