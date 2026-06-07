import { db, schema } from '@/db';
import { eq, sql } from 'drizzle-orm';
import {
  ACCOUNT_TYPES,
  DEFAULT_ACCOUNT_TYPE_ORDER,
  type AccountType,
} from './account-meta';
import { DEFAULT_BASE_CURRENCY, CURRENCIES } from './currency';

export type AIProfile = {
  id: number;
  name: string;
  baseUrl: string;
  apiKey: string | null;
  createdAt: string;
};

export type AIRoute = {
  profile: AIProfile;
  model: string;
};

export type AIRouting = {
  primary: AIRoute | null;
  fallback: AIRoute | null;
};

const KEYS = {
  primaryProfileId: 'ai.primaryProfileId',
  primaryModel: 'ai.primaryModel',
  fallbackProfileId: 'ai.fallbackProfileId',
  fallbackModel: 'ai.fallbackModel',
  // Legacy single-config keys, migrated lazily on first profile read.
  legacyBaseUrl: 'ai.baseUrl',
  legacyModel: 'ai.model',
  legacyApiKey: 'ai.apiKey',
} as const;

export const AI_DEFAULT_PROFILE = {
  name: 'Ollama (local)',
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'ollama',
} as const;

export const AI_DEFAULT_MODEL = 'deepseek-v4-flash:cloud';

function readKey(key: string): string | null {
  const row = db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, key))
    .get();
  return row?.value ?? null;
}

function writeKey(key: string, value: string | null): void {
  db.insert(schema.appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value, updatedAt: new Date().toISOString() },
    })
    .run();
}

function deleteKey(key: string): void {
  db.delete(schema.appSettings).where(eq(schema.appSettings.key, key)).run();
}

// ---------------------------------------------------------------------------
// Base currency — the single currency every balance and cross-account total is
// shown in. Stored in app_settings; the NEXT_PUBLIC_BASE_CURRENCY env var is
// only the initial default before anything is saved. better-sqlite3 is sync, so
// this is a plain sync read usable from server components, actions and scripts.
// Client components receive the resolved code as a prop instead.
// ---------------------------------------------------------------------------

const BASE_CURRENCY_KEY = 'base.currency';

export function getBaseCurrency(): string {
  return (readKey(BASE_CURRENCY_KEY) || DEFAULT_BASE_CURRENCY).toUpperCase();
}

export function setBaseCurrency(code: string): void {
  writeKey(BASE_CURRENCY_KEY, code.trim().toUpperCase());
}

/** Currency codes offered in the picker (known metadata only). */
export function supportedCurrencies(): string[] {
  return Object.keys(CURRENCIES);
}

// ---------------------------------------------------------------------------
// Accounts page: custom ordering of the account-type groups (Bank, Cash, …).
// Stored per-user as a JSON array under app_settings. Always returns every
// type, appending any not yet in the saved order so new enum values surface.
// ---------------------------------------------------------------------------

function typeOrderKey(userId: number): string {
  return `accounts.typeOrder:${userId}`;
}

export function getAccountTypeOrder(userId: number): AccountType[] {
  const raw = readKey(typeOrderKey(userId));
  let saved: AccountType[] = [];
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        saved = parsed.filter(
          (t): t is AccountType =>
            typeof t === 'string' &&
            (ACCOUNT_TYPES as readonly string[]).includes(t),
        );
      }
    } catch {
      // Corrupt value — fall back to default order below.
    }
  }
  const missing = DEFAULT_ACCOUNT_TYPE_ORDER.filter((t) => !saved.includes(t));
  return [...saved, ...missing];
}

export function setAccountTypeOrder(userId: number, order: AccountType[]): void {
  const seen = new Set<AccountType>();
  const clean = order.filter(
    (t) =>
      (ACCOUNT_TYPES as readonly string[]).includes(t) &&
      !seen.has(t) &&
      (seen.add(t), true),
  );
  // Persist a complete order so types with no accounts keep a stable slot.
  const full = [
    ...clean,
    ...DEFAULT_ACCOUNT_TYPE_ORDER.filter((t) => !clean.includes(t)),
  ];
  writeKey(typeOrderKey(userId), JSON.stringify(full));
}

// Lazy migration: if the profiles table is empty, seed it from old single-config
// keys (or built-in defaults), and pick that profile as primary. Also clears
// legacy keys regardless of seeding state so they don't linger after migration.
function ensureSeeded(): void {
  const count =
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(schema.aiProfiles)
      .get()?.n ?? 0;

  if (count === 0) {
    const legacyBase = readKey(KEYS.legacyBaseUrl);
    const legacyModel = readKey(KEYS.legacyModel);
    const legacyKey = readKey(KEYS.legacyApiKey);

    const seedName = legacyBase ? 'Imported' : AI_DEFAULT_PROFILE.name;
    const seedBase = legacyBase ?? AI_DEFAULT_PROFILE.baseUrl;
    const seedKey = legacyKey ?? AI_DEFAULT_PROFILE.apiKey;

    try {
      const inserted = db
        .insert(schema.aiProfiles)
        .values({ name: seedName, baseUrl: seedBase, apiKey: seedKey })
        .returning()
        .get();
      // Only set as primary if nothing is already chosen.
      if (!readKey(KEYS.primaryProfileId)) {
        writeKey(KEYS.primaryProfileId, String(inserted.id));
        writeKey(KEYS.primaryModel, legacyModel ?? AI_DEFAULT_MODEL);
      }
    } catch {
      // Lost the race against a concurrent seeder; fine.
    }
  }

  // Always clean up legacy keys, even when profiles were seeded earlier
  // (older migration runs returned before reaching this cleanup).
  deleteKey(KEYS.legacyBaseUrl);
  deleteKey(KEYS.legacyModel);
  deleteKey(KEYS.legacyApiKey);
}

export function listAIProfiles(): AIProfile[] {
  ensureSeeded();
  return db
    .select()
    .from(schema.aiProfiles)
    .orderBy(schema.aiProfiles.id)
    .all()
    .map((p) => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      apiKey: p.apiKey,
      createdAt: p.createdAt,
    }));
}

export function createAIProfile(input: {
  name: string;
  baseUrl: string;
  apiKey: string | null;
}): { ok: true; id: number } | { ok: false; error: string } {
  const name = input.name.trim();
  const baseUrl = input.baseUrl.trim();
  if (!name) return { ok: false, error: 'Name required' };
  if (!baseUrl) return { ok: false, error: 'Base URL required' };
  try {
    const inserted = db
      .insert(schema.aiProfiles)
      .values({
        name,
        baseUrl,
        apiKey: input.apiKey?.trim() || null,
      })
      .returning()
      .get();
    return { ok: true, id: inserted.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE')) return { ok: false, error: 'A profile with that name already exists' };
    return { ok: false, error: msg };
  }
}

export function updateAIProfile(
  id: number,
  patch: { name?: string; baseUrl?: string; apiKey?: string | null },
): { ok: true } | { ok: false; error: string } {
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (!n) return { ok: false, error: 'Name required' };
    updates.name = n;
  }
  if (patch.baseUrl !== undefined) {
    const b = patch.baseUrl.trim();
    if (!b) return { ok: false, error: 'Base URL required' };
    updates.baseUrl = b;
  }
  // apiKey: undefined = leave alone, null = clear, string = set (empty string clears)
  if (patch.apiKey !== undefined) {
    const k = patch.apiKey === null ? null : patch.apiKey.trim() || null;
    updates.apiKey = k;
  }
  if (Object.keys(updates).length === 0) return { ok: true };
  try {
    db.update(schema.aiProfiles).set(updates).where(eq(schema.aiProfiles.id, id)).run();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE')) return { ok: false, error: 'A profile with that name already exists' };
    return { ok: false, error: msg };
  }
}

export function deleteAIProfile(id: number): { ok: true } | { ok: false; error: string } {
  // Clear any routing references before deleting.
  if (readKey(KEYS.primaryProfileId) === String(id)) {
    deleteKey(KEYS.primaryProfileId);
    deleteKey(KEYS.primaryModel);
  }
  if (readKey(KEYS.fallbackProfileId) === String(id)) {
    deleteKey(KEYS.fallbackProfileId);
    deleteKey(KEYS.fallbackModel);
  }
  db.delete(schema.aiProfiles).where(eq(schema.aiProfiles.id, id)).run();
  return { ok: true };
}

// Returns a route as long as the profile resolves; model may be an empty
// string when the user has picked a profile but not yet entered a model name.
// The chat route is responsible for refusing to call with an empty model.
function readRoute(profileKey: string, modelKey: string): AIRoute | null {
  const profileId = readKey(profileKey);
  if (!profileId) return null;
  const id = Number(profileId);
  if (!Number.isInteger(id)) return null;
  const profile = db
    .select()
    .from(schema.aiProfiles)
    .where(eq(schema.aiProfiles.id, id))
    .get();
  if (!profile) return null;
  return {
    profile: {
      id: profile.id,
      name: profile.name,
      baseUrl: profile.baseUrl,
      apiKey: profile.apiKey,
      createdAt: profile.createdAt,
    },
    model: readKey(modelKey) ?? '',
  };
}

export function getAIRouting(): AIRouting {
  ensureSeeded();
  return {
    primary: readRoute(KEYS.primaryProfileId, KEYS.primaryModel),
    fallback: readRoute(KEYS.fallbackProfileId, KEYS.fallbackModel),
  };
}

export type RoutingPatch = {
  primaryProfileId?: number | null;
  primaryModel?: string | null;
  fallbackProfileId?: number | null;
  fallbackModel?: string | null;
};

export function setAIRouting(patch: RoutingPatch): void {
  if (patch.primaryProfileId !== undefined) {
    if (patch.primaryProfileId === null) deleteKey(KEYS.primaryProfileId);
    else writeKey(KEYS.primaryProfileId, String(patch.primaryProfileId));
  }
  if (patch.primaryModel !== undefined) {
    const v = patch.primaryModel?.trim();
    if (!v) deleteKey(KEYS.primaryModel);
    else writeKey(KEYS.primaryModel, v);
  }
  if (patch.fallbackProfileId !== undefined) {
    if (patch.fallbackProfileId === null) deleteKey(KEYS.fallbackProfileId);
    else writeKey(KEYS.fallbackProfileId, String(patch.fallbackProfileId));
  }
  if (patch.fallbackModel !== undefined) {
    const v = patch.fallbackModel?.trim();
    if (!v) deleteKey(KEYS.fallbackModel);
    else writeKey(KEYS.fallbackModel, v);
  }
}
