'use client';

import { useState, useEffect, useRef } from 'react';
import { AppBar } from '@/components/AppBar';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Plus,
  X,
  Server,
  Key,
} from 'lucide-react';
import {
  getSettingsView,
  addProfile,
  editProfile,
  removeProfile,
  saveRouting,
  type SettingsView,
  type ProfileView,
} from './actions';

type Toast = { ok: boolean; text: string };
type EditState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; profile: ProfileView };

export default function AISettingsPage() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [editor, setEditor] = useState<EditState>({ mode: 'closed' });
  const [busy, setBusy] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = async () => setView(await getSettingsView());

  useEffect(() => {
    refresh();
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const flash = (ok: boolean, text: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ ok, text });
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  };

  if (!view) {
    return (
      <div>
        <AppBar title="AI Assistant" back={{ href: '/more' }} />
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      </div>
    );
  }

  const updateRouting = async (
    role: 'primary' | 'fallback',
    field: 'profileId' | 'model',
    value: string,
  ) => {
    setBusy(true);
    const patch: Record<string, number | string | null> = {};
    if (role === 'primary' && field === 'profileId') {
      patch.primaryProfileId = value === '' ? null : Number(value);
    } else if (role === 'primary' && field === 'model') {
      patch.primaryModel = value || null;
    } else if (role === 'fallback' && field === 'profileId') {
      patch.fallbackProfileId = value === '' ? null : Number(value);
      // If clearing the fallback profile, clear the model too.
      if (value === '') patch.fallbackModel = null;
    } else if (role === 'fallback' && field === 'model') {
      patch.fallbackModel = value || null;
    }
    await saveRouting(patch);
    await refresh();
    setBusy(false);
  };

  const onDelete = async (p: ProfileView) => {
    if (!confirm(`Delete profile "${p.name}"?`)) return;
    setBusy(true);
    const r = await removeProfile(p.id);
    setBusy(false);
    if (r.ok) {
      await refresh();
      flash(true, 'Profile deleted');
    } else {
      flash(false, r.error);
    }
  };

  return (
    <div>
      <AppBar title="AI Assistant" back={{ href: '/more' }} />

      <div className="max-w-3xl mx-auto px-4 pt-2 pb-32 min-h-[calc(100vh-3.5rem)]">
        {toast && (
          <div
            className={`mb-3 p-3 rounded-lg text-sm flex items-center gap-2 ${
              toast.ok
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
            }`}
          >
            {toast.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="break-words">{toast.text}</span>
          </div>
        )}

        {/* Routing */}
        <Section title="Routing">
          <RoutingRow
            label="Primary"
            sublabel="Used for every request"
            profileId={view.primary?.profileId ?? null}
            model={view.primary?.model ?? ''}
            modelPlaceholder={view.defaultModel}
            profiles={view.profiles}
            disabled={busy}
            onProfileChange={(v) => updateRouting('primary', 'profileId', v)}
            onModelChange={(v) => updateRouting('primary', 'model', v)}
            allowNone={false}
          />
          <RoutingRow
            label="Fallback"
            sublabel="Tried automatically if primary errors"
            profileId={view.fallback?.profileId ?? null}
            model={view.fallback?.model ?? ''}
            modelPlaceholder="Optional"
            profiles={view.profiles}
            disabled={busy}
            onProfileChange={(v) => updateRouting('fallback', 'profileId', v)}
            onModelChange={(v) => updateRouting('fallback', 'model', v)}
            allowNone
            last
          />
        </Section>

        {/* Profiles */}
        <div className="mb-5 mt-6">
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
              Profiles
            </div>
            <button
              type="button"
              onClick={() => setEditor({ mode: 'add' })}
              className="flex items-center gap-1 text-xs text-tangerine font-medium active:opacity-70"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Add
            </button>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
            {view.profiles.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-zinc-500">
                No profiles yet. Tap "Add" to create one.
              </div>
            ) : (
              view.profiles.map((p, i) => (
                <ProfileRow
                  key={p.id}
                  profile={p}
                  isPrimary={view.primary?.profileId === p.id}
                  isFallback={view.fallback?.profileId === p.id}
                  onEdit={() => setEditor({ mode: 'edit', profile: p })}
                  onDelete={() => onDelete(p)}
                  last={i === view.profiles.length - 1}
                />
              ))
            )}
          </div>
        </div>

        <p className="text-[11px] text-zinc-500 mt-6 leading-relaxed">
          Profiles store provider configs (Base URL + API key) and are saved locally in
          <code> data/money.db</code>. Endpoint must be OpenAI-compatible and the model must
          support tool calling. Common Base URLs:
          <br />
          <span className="font-mono text-zinc-600 dark:text-zinc-400">
            • Ollama local: http://localhost:11434/v1
            <br />
            • Ollama Cloud: https://ollama.com/v1
            <br />
            • OpenAI: https://api.openai.com/v1
            <br />
            • OpenRouter: https://openrouter.ai/api/v1
            <br />
            • MiniMax (intl): https://api.minimax.io/v1
          </span>
        </p>
      </div>

      {editor.mode !== 'closed' && (
        <ProfileEditor
          state={editor}
          onClose={() => setEditor({ mode: 'closed' })}
          onSaved={async (msg) => {
            setEditor({ mode: 'closed' });
            await refresh();
            flash(true, msg);
          }}
          onError={(msg) => flash(false, msg)}
        />
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="px-2 pb-2 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
        {title}
      </div>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function RoutingRow({
  label,
  sublabel,
  profileId,
  model,
  modelPlaceholder,
  profiles,
  disabled,
  onProfileChange,
  onModelChange,
  allowNone,
  last,
}: {
  label: string;
  sublabel: string;
  profileId: number | null;
  model: string;
  modelPlaceholder: string;
  profiles: ProfileView[];
  disabled: boolean;
  onProfileChange: (value: string) => void;
  onModelChange: (value: string) => void;
  allowNone: boolean;
  last?: boolean;
}) {
  const [draftModel, setDraftModel] = useState(model);
  useEffect(() => setDraftModel(model), [model]);

  return (
    <div
      className={`px-5 py-4 ${
        last ? '' : 'border-b border-zinc-100 dark:border-zinc-800'
      }`}
    >
      <div className="mb-2">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-zinc-500 mt-0.5">{sublabel}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={profileId ?? ''}
          onChange={(e) => onProfileChange(e.target.value)}
          disabled={disabled || profiles.length === 0}
          className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-tangerine/50"
        >
          {allowNone && <option value="">— None —</option>}
          {!allowNone && profileId === null && <option value="">— Select —</option>}
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={draftModel}
          onChange={(e) => setDraftModel(e.target.value)}
          onBlur={() => {
            if (draftModel !== model) onModelChange(draftModel);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          placeholder={modelPlaceholder}
          disabled={disabled || profileId === null}
          spellCheck={false}
          autoCapitalize="none"
          className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-tangerine/50 disabled:opacity-50"
        />
      </div>
    </div>
  );
}

function ProfileRow({
  profile,
  isPrimary,
  isFallback,
  onEdit,
  onDelete,
  last,
}: {
  profile: ProfileView;
  isPrimary: boolean;
  isFallback: boolean;
  onEdit: () => void;
  onDelete: () => void;
  last: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-5 py-3.5 ${
        last ? '' : 'border-b border-zinc-100 dark:border-zinc-800'
      }`}
    >
      <Server className="w-5 h-5 text-zinc-500 shrink-0" strokeWidth={1.6} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{profile.name}</span>
          {isPrimary && (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-tangerine/15 text-tangerine font-semibold">
              Primary
            </span>
          )}
          {isFallback && (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold">
              Fallback
            </span>
          )}
          {profile.hasApiKey && (
            <Key className="w-3 h-3 text-zinc-400" strokeWidth={2} />
          )}
        </div>
        <div className="text-[11px] text-zinc-500 mt-0.5 truncate font-mono">
          {profile.baseUrl}
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="p-2 text-zinc-500 active:bg-zinc-100 dark:active:bg-zinc-800 rounded-lg"
        aria-label="Edit"
      >
        <Pencil className="w-4 h-4" strokeWidth={1.6} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="p-2 text-rose-500 active:bg-rose-50 dark:active:bg-rose-950/40 rounded-lg"
        aria-label="Delete"
      >
        <Trash2 className="w-4 h-4" strokeWidth={1.6} />
      </button>
    </div>
  );
}

function ProfileEditor({
  state,
  onClose,
  onSaved,
  onError,
}: {
  state: { mode: 'add' } | { mode: 'edit'; profile: ProfileView };
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const isEdit = state.mode === 'edit';
  const initial = isEdit ? state.profile : null;
  const [name, setName] = useState(initial?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    setSaving(true);
    let r: { ok: true } | { ok: false; error: string };
    if (isEdit && initial) {
      const patch: { name?: string; baseUrl?: string; apiKey?: string } = {};
      if (name !== initial.name) patch.name = name;
      if (baseUrl !== initial.baseUrl) patch.baseUrl = baseUrl;
      if (apiKey) patch.apiKey = apiKey;
      r = await editProfile(initial.id, patch);
    } else {
      r = await addProfile({ name, baseUrl, apiKey });
    }
    setSaving(false);
    if (r.ok) {
      onSaved(isEdit ? 'Profile updated' : 'Profile added');
    } else {
      onError(r.error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="font-medium">{isEdit ? 'Edit profile' : 'Add profile'}</div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-500 active:opacity-70"
            aria-label="Close"
          >
            <X className="w-5 h-5" strokeWidth={1.6} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Name
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. OpenAI, MiniMax, Ollama Cloud"
              disabled={saving}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-tangerine/50"
            />
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Base URL
            </div>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              disabled={saving}
              spellCheck={false}
              autoCapitalize="none"
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-tangerine/50"
            />
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              API Key
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  isEdit && initial?.hasApiKey ? '•••••• (leave blank to keep)' : 'sk-…'
                }
                disabled={saving}
                spellCheck={false}
                autoCapitalize="none"
                className="w-full pr-10 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-tangerine/50"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" strokeWidth={1.6} />
                ) : (
                  <Eye className="w-4 h-4" strokeWidth={1.6} />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-medium text-sm active:bg-zinc-100 dark:active:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || !name.trim() || !baseUrl.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-tangerine text-white font-medium text-sm disabled:opacity-50 active:opacity-80"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" strokeWidth={1.6} />
            )}
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
