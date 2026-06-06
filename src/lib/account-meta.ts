// Shared account-type metadata + default ordering. Kept free of any server-only
// imports (no `db`) so client components can use it too.

export const ACCOUNT_TYPES = [
  'bank',
  'credit_card',
  'ewallet',
  'cash',
  'investment',
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

// Fallback order used when the user hasn't customised it yet.
export const DEFAULT_ACCOUNT_TYPE_ORDER: AccountType[] = [
  'bank',
  'cash',
  'ewallet',
  'investment',
  'credit_card',
];

export const ACCOUNT_TYPE_META: Record<
  AccountType,
  { label: string; color: string; tint: string }
> = {
  bank: { label: 'Bank', color: '#3b82f6', tint: '#dbeafe' },
  credit_card: { label: 'Credit Card', color: '#f43f5e', tint: '#ffe4e6' },
  ewallet: { label: 'E-wallet', color: '#8b5cf6', tint: '#ede9fe' },
  cash: { label: 'Cash', color: '#10b981', tint: '#d1fae5' },
  investment: { label: 'Investments', color: '#f59e0b', tint: '#fef3c7' },
};
