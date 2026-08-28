"use client";

export function OdooFormToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="toolbar"
      aria-label="Form actions"
      className="mb-3 flex flex-wrap items-center gap-2"
    >
      {children}
    </div>
  );
}
