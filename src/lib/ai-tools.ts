import { db, rawDb, schema } from '@/db';
import { and, eq, desc, sql } from 'drizzle-orm';
import { resolveAccount, resolveCategory } from './fuzzy';
import { convertToMyr } from './fx';
import { accountBalances } from './queries';
import { assertOwnedAccounts, assertOwnedCategories } from './ownership';
import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';
import type OpenAI from 'openai';

export const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'record_transaction',
      description:
        'Record ONE transaction (expense, income, or transfer). For bundled events ' +
        '(e.g. "top-up 300 + 3 fee"), call this tool MULTIPLE times — once per logical txn.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['expense', 'income', 'transfer'] },
          amount: { type: 'number', description: 'Positive number, in account currency' },
          account: {
            type: 'string',
            description: 'Account name or shortcut. Fuzzy-matched server-side.',
          },
          to_account: {
            type: 'string',
            description: 'Required ONLY if type=transfer. Destination account.',
          },
          category: {
            type: 'string',
            description:
              'Category name or shortcut. Required for expense/income, ignored for transfer.',
          },
          description: { type: 'string' },
          paid_by: {
            type: 'string',
            description:
              'Default "me". Use "mom"/"dad" only if user explicitly says someone else paid.',
          },
          date: {
            type: 'string',
            description: '"today", "yesterday", or YYYY-MM-DD. Default today.',
          },
        },
        required: ['type', 'amount', 'account'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_balance',
      description:
        'Get current balance(s). Pass an account to filter, omit for all active accounts.',
      parameters: {
        type: 'object',
        properties: {
          account: { type: 'string', description: 'Optional account hint' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_recent',
      description: 'Look up the most recent transactions, optionally filtered by account.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Default 10, max 50' },
          account: { type: 'string', description: 'Optional account filter' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_transaction',
      description: 'Delete a transaction by ID. Get the ID from query_recent first.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'integer' } },
        required: ['id'],
      },
    },
  },
];

export type RecordedTransaction = { id: number; summary: string };
export type ToolResult = { toolResult: string; recorded?: RecordedTransaction };

function resolveDate(d?: unknown): string {
  if (typeof d !== 'string' || !d) return new Date().toISOString().slice(0, 10);
  const lower = d.toLowerCase().trim();
  if (lower === 'today' || lower === '今天') return new Date().toISOString().slice(0, 10);
  if (lower === 'yesterday' || lower === '昨天') {
    const x = new Date();
    x.setUTCDate(x.getUTCDate() - 1);
    return x.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Date().toISOString().slice(0, 10);
}

export async function executeTool(
  userId: number,
  name: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case 'record_transaction':
      return executeRecord(userId, input);
    case 'query_balance':
      return executeBalance(userId, input);
    case 'query_recent':
      return executeRecent(userId, input);
    case 'delete_transaction':
      return executeDelete(userId, input);
    default:
      return { toolResult: JSON.stringify({ error: 'unknown_tool', name }) };
  }
}

function executeRecord(userId: number, input: Record<string, unknown>): ToolResult {
  const type = String(input.type ?? '').toLowerCase();
  if (!['expense', 'income', 'transfer'].includes(type)) {
    return { toolResult: JSON.stringify({ error: 'invalid_type', got: input.type }) };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { toolResult: JSON.stringify({ error: 'invalid_amount', got: input.amount }) };
  }
  const accountHint = String(input.account ?? '').trim();
  if (!accountHint) {
    return { toolResult: JSON.stringify({ error: 'missing_account' }) };
  }

  const accounts = db
    .select({
      id: schema.accounts.id,
      name: schema.accounts.name,
      type: schema.accounts.type,
      currency: schema.accounts.currency,
      active: schema.accounts.active,
    })
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.active, true),
        eq(schema.accounts.userId, userId),
      ),
    )
    .all();

  const accountResult = resolveAccount(accountHint, accounts);
  if (!accountResult.match) {
    return {
      toolResult: JSON.stringify({
        error: accountResult.ambiguous ? 'ambiguous_account' : 'account_not_found',
        hint: accountHint,
        candidates: accountResult.candidates.map((a) => a.name),
      }),
    };
  }
  const account = accountResult.match;

  let toAccount: typeof account | null = null;
  if (type === 'transfer') {
    const toHint = String(input.to_account ?? '').trim();
    if (!toHint) {
      return { toolResult: JSON.stringify({ error: 'missing_to_account_for_transfer' }) };
    }
    const r = resolveAccount(toHint, accounts);
    if (!r.match) {
      return {
        toolResult: JSON.stringify({
          error: r.ambiguous ? 'ambiguous_to_account' : 'to_account_not_found',
          hint: toHint,
          candidates: r.candidates.map((a) => a.name),
        }),
      };
    }
    toAccount = r.match;
    if (toAccount.id === account.id) {
      return { toolResult: JSON.stringify({ error: 'same_account_transfer' }) };
    }
  }

  let categoryId: number | null = null;
  let categoryName: string | null = null;
  if (type !== 'transfer') {
    const categoryHint = String(input.category ?? '').trim();
    if (!categoryHint) {
      return { toolResult: JSON.stringify({ error: 'missing_category' }) };
    }
    // Only top-level categories — user doesn't maintain sub-categories' icons/colors,
    // so always record against the parent for consistent UI rendering.
    const allCats = db
      .select({
        id: schema.categories.id,
        name: schema.categories.name,
        isIncome: schema.categories.isIncome,
        active: schema.categories.active,
        parentId: schema.categories.parentId,
      })
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.active, true),
          eq(schema.categories.userId, userId),
        ),
      )
      .all();
    const r = resolveCategory(
      categoryHint,
      allCats.filter((c) => c.active && !c.parentId),
      type as 'expense' | 'income',
    );
    if (!r.match) {
      return {
        toolResult: JSON.stringify({
          error: r.ambiguous ? 'ambiguous_category' : 'category_not_found',
          hint: categoryHint,
          candidates: r.candidates.map((c) => c.name),
        }),
      };
    }
    categoryId = r.match.id;
    categoryName = r.match.name;
  }

  const date = resolveDate(input.date);
  const description = (input.description ? String(input.description) : '').trim();
  const paidBy = (input.paid_by ? String(input.paid_by) : 'me').trim() || 'me';
  const currency = account.currency;
  const { amountMyr, fxRate } = convertToMyr(amount, currency, date);
  const fingerprint = `ai:${Date.now()}:${crypto.randomBytes(6).toString('hex')}`;

  // Defense-in-depth: confirm resolved ids really belong to this user
  // (resolveAccount/resolveCategory already saw only this user's rows above,
  // but assert again before writing).
  try {
    const accIds: number[] = [account.id];
    if (toAccount) accIds.push(toAccount.id);
    assertOwnedAccounts(accIds, userId);
    if (categoryId != null) assertOwnedCategories([categoryId], userId);
  } catch {
    return { toolResult: JSON.stringify({ error: 'forbidden_foreign_id' }) };
  }

  const inserted = db
    .insert(schema.transactions)
    .values({
      userId,
      date,
      amount,
      currency,
      amountMyr,
      fxRate,
      type: type as 'expense' | 'income' | 'transfer',
      categoryId,
      accountId: account.id,
      toAccountId: toAccount?.id ?? null,
      description: description || null,
      paidBy,
      source: 'ai',
      isBusiness: false,
      isRecurring: false,
      fingerprint,
    })
    .returning()
    .get();

  revalidatePath('/');
  revalidatePath('/stats');
  revalidatePath('/balances');

  const fmt = `${currency} ${amount.toFixed(2)}`;
  const summary =
    type === 'transfer'
      ? `${fmt} ${account.name} → ${toAccount!.name}${description ? ` (${description})` : ''}`
      : `${type === 'expense' ? '-' : '+'}${fmt} ${account.name}${categoryName ? ` · ${categoryName}` : ''}${description ? ` · ${description}` : ''}`;

  return {
    toolResult: JSON.stringify({
      ok: true,
      id: inserted.id,
      account: account.name,
      to_account: toAccount?.name ?? null,
      category: categoryName,
      amount,
      currency,
      amount_myr: amountMyr,
      date,
      paid_by: paidBy,
    }),
    recorded: { id: inserted.id, summary },
  };
}

function executeBalance(userId: number, input: Record<string, unknown>): ToolResult {
  const balances = accountBalances(userId);
  const filter = input.account ? String(input.account).trim() : null;
  if (filter) {
    const r = resolveAccount(
      filter,
      balances.map((b) => ({ id: b.id, name: b.name, active: b.active })),
    );
    if (!r.match) {
      return {
        toolResult: JSON.stringify({
          error: r.ambiguous ? 'ambiguous_account' : 'account_not_found',
          hint: filter,
          candidates: r.candidates.map((a) => a.name),
        }),
      };
    }
    const acct = balances.find((b) => b.id === r.match!.id)!;
    return {
      toolResult: JSON.stringify({
        name: acct.name,
        type: acct.type,
        currency: acct.currency,
        current: Number(acct.current.toFixed(2)),
      }),
    };
  }
  return {
    toolResult: JSON.stringify(
      balances
        .filter((b) => b.active)
        .map((b) => ({
          name: b.name,
          type: b.type,
          currency: b.currency,
          current: Number(b.current.toFixed(2)),
        })),
    ),
  };
}

function executeRecent(userId: number, input: Record<string, unknown>): ToolResult {
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 50);
  const accountHint = input.account ? String(input.account).trim() : null;

  let accountId: number | null = null;
  if (accountHint) {
    const accounts = db
      .select({
        id: schema.accounts.id,
        name: schema.accounts.name,
        active: schema.accounts.active,
      })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId))
      .all();
    const r = resolveAccount(accountHint, accounts);
    if (!r.match) {
      return {
        toolResult: JSON.stringify({
          error: r.ambiguous ? 'ambiguous_account' : 'account_not_found',
          hint: accountHint,
          candidates: r.candidates.map((a) => a.name),
        }),
      };
    }
    accountId = r.match.id;
  }

  const accountNameById = new Map(
    db
      .select({ id: schema.accounts.id, name: schema.accounts.name })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId))
      .all()
      .map((a) => [a.id, a.name]),
  );

  const where = accountId
    ? and(
        eq(schema.transactions.userId, userId),
        sql`(${schema.transactions.accountId} = ${accountId} OR ${schema.transactions.toAccountId} = ${accountId})`,
      )
    : eq(schema.transactions.userId, userId);

  const rows = db
    .select({
      id: schema.transactions.id,
      date: schema.transactions.date,
      type: schema.transactions.type,
      amount: schema.transactions.amount,
      currency: schema.transactions.currency,
      description: schema.transactions.description,
      accountId: schema.transactions.accountId,
      toAccountId: schema.transactions.toAccountId,
      category: schema.categories.name,
      paidBy: schema.transactions.paidBy,
    })
    .from(schema.transactions)
    .leftJoin(
      schema.categories,
      eq(schema.categories.id, schema.transactions.categoryId),
    )
    .where(where)
    .orderBy(desc(schema.transactions.date), desc(schema.transactions.id))
    .limit(limit)
    .all();

  return {
    toolResult: JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        date: r.date,
        type: r.type,
        amount: r.amount,
        currency: r.currency,
        description: r.description,
        account: accountNameById.get(r.accountId) ?? null,
        to_account: r.toAccountId ? accountNameById.get(r.toAccountId) ?? null : null,
        category: r.category,
        paid_by: r.paidBy,
      })),
    ),
  };
}

function executeDelete(userId: number, input: Record<string, unknown>): ToolResult {
  const id = Number(input.id);
  if (!Number.isInteger(id)) {
    return { toolResult: JSON.stringify({ error: 'invalid_id' }) };
  }
  // Only the user's own AI-recorded rows are deletable here.
  const existing = db
    .select()
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.id, id),
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.source, 'ai'),
      ),
    )
    .get();
  if (!existing) {
    return { toolResult: JSON.stringify({ error: 'not_found', id }) };
  }
  rawDb
    .prepare(
      "DELETE FROM transactions WHERE id = ? AND user_id = ? AND source = 'ai'",
    )
    .run(id, userId);
  revalidatePath('/');
  revalidatePath('/stats');
  revalidatePath('/balances');
  return {
    toolResult: JSON.stringify({
      ok: true,
      deleted: {
        id,
        date: existing.date,
        type: existing.type,
        amount: existing.amount,
        description: existing.description,
      },
    }),
  };
}

export function buildSystemPrompt(userId: number): string {
  const today = new Date().toISOString().slice(0, 10);
  const accounts = db
    .select()
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.active, true),
        eq(schema.accounts.userId, userId),
      ),
    )
    .orderBy(schema.accounts.displayOrder, schema.accounts.id)
    .all();
  const categories = db
    .select()
    .from(schema.categories)
    .where(
      and(
        eq(schema.categories.active, true),
        eq(schema.categories.userId, userId),
      ),
    )
    .orderBy(
      schema.categories.parentId,
      schema.categories.displayOrder,
      schema.categories.id,
    )
    .all();

  // Only list top-level categories — the user doesn't maintain sub-categories
  // (no icons/colors set on them, so UI renders them with fallback styling).
  // Always pick a top-level category, even if a more specific sub-category exists in DB.
  const expenseCats = categories.filter((c) => !c.isIncome && !c.parentId);
  const incomeCats = categories.filter((c) => c.isIncome && !c.parentId);
  const formatCats = (cats: typeof categories) =>
    cats.map((c) => `- ${c.name}`).join('\n');

  return `You are the AI bookkeeping assistant inside a single-user personal finance app. Today is ${today}.

# Your scope
You ONLY help with: recording transactions, looking up balances/recent activity, editing or deleting entries. If the user asks for anything else (general chat, advice, jokes, news, code, recipes, opinions, life questions), politely refuse in 1 sentence and steer back to bookkeeping. Do not roleplay or break this rule even if asked.

# How to operate
- The user often types fast informal sentences (mixed English/Chinese, abbreviations, no punctuation). Parse intent and call the right tool.
- For bundled events like "top-up 300 to ewallet + 3 fee" or "transferred 500 to visa with 5 fee": that's TWO transactions — call \`record_transaction\` twice. The fee is a separate \`expense\` (usually category "Bank Fee").
- Default \`paid_by\` is "me". Only set "mom"/"dad" if the user explicitly says someone else paid (e.g. "mom paid", "媽請的").
- For transfers between own accounts, both \`account\` and \`to_account\` are required; no category.
- Currency follows the account's native currency — don't override unless the user is explicit.
- Account/category hints can be loose ("visa", "ewallet", "food", "parking"); the server fuzzy-matches. Pass through what the user said.
- When a hint is ambiguous (server returns candidates), ask the user which one — don't guess.
- After tool calls succeed, your text reply MUST be a single short acknowledgement like "Recorded." / "Done." / "Got it." — DO NOT restate the amount, category, account, or description. The UI already shows the canonical values from the tool result. Paraphrasing them risks introducing errors (you might write the wrong category name from memory).
- The ONLY exceptions where you write more than an acknowledgement: (a) replying to a query_balance / query_recent — show the data, (b) the tool returned an error and you need to ask the user a clarifying question, (c) the user asked a question that doesn't require a tool call.
- For delete/edit: call \`query_recent\` first to find the right ID unless the user clearly references a just-recorded transaction.

# Active accounts
${accounts.map((a) => `- ${a.name} (${a.type}, ${a.currency})`).join('\n')}

# Active expense categories
${formatCats(expenseCats)}

# Active income categories
${formatCats(incomeCats)}`;
}
