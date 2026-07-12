import { createContext, useContext, useState, useMemo, type ReactNode } from "react";

interface ShellHeaderContextValue {
  setHeaderExtras: (node: ReactNode | null) => void;
  headerExtras: ReactNode | null;
}

const ShellHeaderContext = createContext<ShellHeaderContextValue | null>(null);

export function ShellHeaderProvider({ children }: { children: ReactNode }) {
  const [headerExtras, setHeaderExtras] = useState<ReactNode | null>(null);
  const value = useMemo(
    () => ({ headerExtras, setHeaderExtras }),
    [headerExtras]
  );
  return (
    <ShellHeaderContext.Provider value={value}>{children}</ShellHeaderContext.Provider>
  );
}

export function useShellHeader() {
  const ctx = useContext(ShellHeaderContext);
  if (!ctx) {
    throw new Error("useShellHeader must be used within ShellHeaderProvider");
  }
  return ctx;
}
