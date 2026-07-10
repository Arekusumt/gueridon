"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A small ⓘ that opens a plain-words explanation. For every place where the
 * house jargon (cutoffs, elasticity, dispersion…) would otherwise gatekeep.
 */
export function InfoDot({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className="relative inline-block align-middle" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className="info-dot"
      >
        i
      </button>
      {open ? (
        <span role="note" className="info-pop">
          {text}
        </span>
      ) : null}
    </span>
  );
}
