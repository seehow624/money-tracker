// Common shorthand → canonical account name. Run hint through this first.
// These are EXAMPLES that match the seed accounts in scripts/seed.ts — edit them
// to match your own account names.
const ACCOUNT_ALIASES: Record<string, string> = {
  checking: 'Main Checking',
  main: 'Main Checking',
  savings: 'Savings',
  save: 'Savings',
  foreign: 'Foreign Account',
  visa: 'Visa Card',
  mc: 'Mastercard',
  mastercard: 'Mastercard',
  wallet: 'E-Wallet',
  ewallet: 'E-Wallet',
  cash: 'Cash',
};

// Common shorthand / merchant keyword → category name. Edit to taste.
const CATEGORY_ALIASES: Record<string, string> = {
  food: 'Food & Dining',
  eat: 'Food & Dining',
  dining: 'Food & Dining',
  meal: 'Food & Dining',
  drink: 'Food & Dining',
  petrol: 'Transportation',
  fuel: 'Transportation',
  transport: 'Transportation',
  parking: 'Transportation',
  toll: 'Transportation',
  shop: 'Shopping',
  shopping: 'Shopping',
  cloth: 'Shopping',
  clothing: 'Shopping',
  sub: 'Subscription',
  subs: 'Subscription',
  subscription: 'Subscription',
  netflix: 'Subscription',
  spotify: 'Subscription',
  adobe: 'Subscription',
  chatgpt: 'Subscription',
  ai: 'Subscription',
  bill: 'Bills & Utilities',
  bills: 'Bills & Utilities',
  utility: 'Bills & Utilities',
  utilities: 'Bills & Utilities',
  internet: 'Bills & Utilities',
  phone: 'Bills & Utilities',
  water: 'Bills & Utilities',
  electricity: 'Bills & Utilities',
  health: 'Health & Beauty',
  beauty: 'Health & Beauty',
  gym: 'Health & Beauty',
  hair: 'Health & Beauty',
  medicine: 'Health & Beauty',
  insurance: 'Insurance',
  course: 'Self-development',
  book: 'Self-development',
  'self-dev': 'Self-development',
  'self dev': 'Self-development',
  travel: 'Travel',
  flight: 'Travel',
  hotel: 'Travel',
  pet: 'Pet',
  vet: 'Pet',
  household: 'Household',
  appliance: 'Household',
  furniture: 'Household',
  asset: 'Assets',
  assets: 'Assets',
  electronics: 'Assets',
  daily: 'Daily Supplies',
  toilet: 'Daily Supplies',
  cleaning: 'Daily Supplies',
  ent: 'Entertainment',
  entertainment: 'Entertainment',
  game: 'Entertainment',
  movie: 'Entertainment',
  // Income
  interest: 'Interest Earned',
  cashback: 'Cash Back',
  'cash back': 'Cash Back',
  bonus: 'Bonus',
  income: 'Income',
  salary: 'Income',
  gift: 'Gift',
};

export type ResolveResult<T> = {
  match: T | null;
  candidates: T[];
  ambiguous: boolean;
};

export function resolveAccount<T extends { id: number; name: string; active?: boolean }>(
  hint: string,
  items: T[],
): ResolveResult<T> {
  return resolveWithAliases(hint, items, (i) => i.name, ACCOUNT_ALIASES);
}

export function resolveCategory<T extends { id: number; name: string; isIncome?: boolean }>(
  hint: string,
  items: T[],
  type?: 'income' | 'expense',
): ResolveResult<T> {
  // Filter to matching income/expense first
  const filtered =
    type === undefined
      ? items
      : items.filter(
          (c) => Boolean(c.isIncome) === (type === 'income'),
        );
  return resolveWithAliases(hint, filtered, (i) => i.name, CATEGORY_ALIASES);
}

function resolveWithAliases<T>(
  hint: string,
  items: T[],
  getName: (t: T) => string,
  aliases: Record<string, string>,
): ResolveResult<T> {
  const q = hint.toLowerCase().trim();
  if (!q) return { match: null, candidates: [], ambiguous: false };

  // Apply alias if available
  const expanded = (aliases[q] ?? hint).toLowerCase();

  const lowered = items.map((i) => ({ item: i, name: getName(i).toLowerCase() }));

  // 1. Exact match (case-insensitive)
  const exact = lowered.filter((i) => i.name === expanded);
  if (exact.length === 1) return { match: exact[0].item, candidates: [exact[0].item], ambiguous: false };
  if (exact.length > 1)
    return { match: null, candidates: exact.map((i) => i.item), ambiguous: true };

  // 2. Starts-with
  const starts = lowered.filter((i) => i.name.startsWith(expanded));
  if (starts.length === 1) return { match: starts[0].item, candidates: [starts[0].item], ambiguous: false };
  if (starts.length > 1)
    return { match: null, candidates: starts.map((i) => i.item), ambiguous: true };

  // 3. Substring
  const incl = lowered.filter((i) => i.name.includes(expanded));
  if (incl.length === 1) return { match: incl[0].item, candidates: [incl[0].item], ambiguous: false };
  if (incl.length > 1)
    return { match: null, candidates: incl.map((i) => i.item), ambiguous: true };

  // 4. Token-wise match (each query word appears anywhere in name)
  const qTokens = expanded.split(/\s+/).filter(Boolean);
  if (qTokens.length > 1) {
    const tokenMatch = lowered.filter((i) =>
      qTokens.every((t) => i.name.includes(t)),
    );
    if (tokenMatch.length === 1)
      return { match: tokenMatch[0].item, candidates: [tokenMatch[0].item], ambiguous: false };
    if (tokenMatch.length > 1)
      return { match: null, candidates: tokenMatch.map((i) => i.item), ambiguous: true };
  }

  return { match: null, candidates: [], ambiguous: false };
}
