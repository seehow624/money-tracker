'use server';

import {
  listAIProfiles,
  createAIProfile,
  updateAIProfile,
  deleteAIProfile,
  getAIRouting,
  setAIRouting,
  AI_DEFAULT_MODEL,
  type AIProfile,
  type RoutingPatch,
} from '@/lib/settings';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// Profile shape sent to the client — never include the actual apiKey value,
// only whether one is set, so the page can render a placeholder.
export type ProfileView = {
  id: number;
  name: string;
  baseUrl: string;
  hasApiKey: boolean;
};

export type SettingsView = {
  profiles: ProfileView[];
  primary: { profileId: number; model: string } | null;
  fallback: { profileId: number; model: string } | null;
  defaultModel: string;
};

function toView(p: AIProfile): ProfileView {
  return {
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    hasApiKey: !!p.apiKey,
  };
}

export async function getSettingsView(): Promise<SettingsView> {
  await requireAdmin();
  const profiles = listAIProfiles();
  const routing = getAIRouting();
  return {
    profiles: profiles.map(toView),
    primary: routing.primary
      ? { profileId: routing.primary.profile.id, model: routing.primary.model }
      : null,
    fallback: routing.fallback
      ? { profileId: routing.fallback.profile.id, model: routing.fallback.model }
      : null,
    defaultModel: AI_DEFAULT_MODEL,
  };
}

export async function addProfile(input: {
  name: string;
  baseUrl: string;
  apiKey: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const r = createAIProfile({
    name: input.name,
    baseUrl: input.baseUrl,
    apiKey: input.apiKey || null,
  });
  if (!r.ok) return r;
  revalidatePath('/more/ai');
  return { ok: true };
}

export async function editProfile(
  id: number,
  patch: { name?: string; baseUrl?: string; apiKey?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  // Empty apiKey from the form means "leave alone" (we never round-trip it),
  // so only forward when explicitly cleared. Use a sentinel for clear.
  const cleaned: { name?: string; baseUrl?: string; apiKey?: string | null } = {};
  if (patch.name !== undefined) cleaned.name = patch.name;
  if (patch.baseUrl !== undefined) cleaned.baseUrl = patch.baseUrl;
  if (patch.apiKey !== undefined && patch.apiKey !== '') cleaned.apiKey = patch.apiKey;
  const r = updateAIProfile(id, cleaned);
  if (!r.ok) return r;
  revalidatePath('/more/ai');
  return { ok: true };
}

export async function removeProfile(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const r = deleteAIProfile(id);
  if (!r.ok) return r;
  revalidatePath('/more/ai');
  return { ok: true };
}

export async function saveRouting(patch: RoutingPatch): Promise<{ ok: true }> {
  await requireAdmin();
  setAIRouting(patch);
  revalidatePath('/more/ai');
  return { ok: true };
}
