'use client';

// Theme is handled at layout level:
// - Dashboard layout wraps in class="dark" → always dark
// - Public booking pages have no dark wrapper → always light cream
// No toggle needed per design spec.

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
