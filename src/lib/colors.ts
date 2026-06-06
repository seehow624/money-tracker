// Tailwind v4 doesn't auto-extract dynamic class names like `bg-${color}-500`,
// so we map our category color tokens to hex values and use inline styles.

const PALETTE: Record<string, { bg: string; text: string; tint: string }> = {
  amber:    { bg: '#f59e0b', text: '#92400e', tint: '#fef3c7' },
  blue:     { bg: '#3b82f6', text: '#1e40af', tint: '#dbeafe' },
  pink:     { bg: '#ec4899', text: '#9d174d', tint: '#fce7f3' },
  violet:   { bg: '#8b5cf6', text: '#5b21b6', tint: '#ede9fe' },
  fuchsia:  { bg: '#d946ef', text: '#86198f', tint: '#fae8ff' },
  slate:    { bg: '#64748b', text: '#334155', tint: '#e2e8f0' },
  rose:     { bg: '#f43f5e', text: '#9f1239', tint: '#ffe4e6' },
  teal:     { bg: '#14b8a6', text: '#115e59', tint: '#ccfbf1' },
  indigo:   { bg: '#6366f1', text: '#3730a3', tint: '#e0e7ff' },
  sky:      { bg: '#0ea5e9', text: '#075985', tint: '#e0f2fe' },
  orange:   { bg: '#f97316', text: '#9a3412', tint: '#ffedd5' },
  red:      { bg: '#ef4444', text: '#991b1b', tint: '#fee2e2' },
  stone:    { bg: '#78716c', text: '#44403c', tint: '#e7e5e4' },
  zinc:     { bg: '#71717a', text: '#3f3f46', tint: '#e4e4e7' },
  lime:     { bg: '#84cc16', text: '#3f6212', tint: '#ecfccb' },
  gray:     { bg: '#6b7280', text: '#374151', tint: '#e5e7eb' },
  emerald:  { bg: '#10b981', text: '#065f46', tint: '#d1fae5' },
};

const FALLBACK = { bg: '#a1a1aa', text: '#3f3f46', tint: '#e4e4e7' };

export function colorFor(token: string | null | undefined) {
  if (!token) return FALLBACK;
  return PALETTE[token] ?? FALLBACK;
}
