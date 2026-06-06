// Vivid 12-color palette — used by Stats pie + category list to keep them visually in sync.
// Slice index is by spending rank (largest first).
export const PIE_PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#84cc16', // lime
  '#f43f5e', // rose
];

export function paletteFor(index: number): string {
  return PIE_PALETTE[index % PIE_PALETTE.length];
}
