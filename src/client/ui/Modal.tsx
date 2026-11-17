// A modal dialog frame: the focus goes in, the keyboard stays inside, Escape closes it (never while sending), and
// the focus goes back to the opener. Shared by the practice, team and warm gestures' dialogs.
import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex='0']";

export function Modal({ labelledBy, onEscape, busy, className, focus, children }: {
  labelledBy: string; onEscape: () => void; busy?: { current: boolean }; className?: string;
  /** Where the focus goes first (a selector); by default the first field or button. */
  focus?: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const escape = useRef(onEscape);
  useEffect(() => { escape.current = onEscape; });
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>(focus ?? "input, textarea, select, button")?.focus();
    return () => { if (opener?.isConnected) opener.focus(); };
  }, [focus]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy?.current) escape.current();
      if (e.key !== "Tab" || !ref.current) return;
      const all = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (all.length === 0) return;
      const first = all[0];
      const last = all[all.length - 1];
      const inside = ref.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [busy]);
  return <div ref={ref} className={className ?? "confirm"} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>{children}</div>;
}
