import React, { ReactNode } from 'react';

/**
 * ResponsiveFormWrapper renders its children inside a <span> element that:
 *  - Occupies full width on small screens (w-full)
 *  - Has a max‑width of 2xl on larger screens (max-w-2xl)
 *  - Is horizontally centered (mx-auto)
 *  - Provides padding, background, border, rounded corners and a subtle shadow
 *  - Fades in when mounted using the Tailwind `animate-fade-in` utility.
 */
export function ResponsiveFormWrapper({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`block w-full max-w-2xl mx-auto p-4 md:p-6 bg-white rounded-2xl border border-slate-200 shadow-md animate-fade-in ${className ?? ''}`}
    >
      {children}
    </span>
  );
}
