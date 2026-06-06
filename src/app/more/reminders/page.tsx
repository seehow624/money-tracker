'use client';

import { useState, useEffect } from 'react';
import { AppBar } from '@/components/AppBar';
import {
  Bell,
  BellOff,
  Clock,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  getReminderSettings,
  saveReminderSettings,
  type ReminderSettings,
} from './actions';

export default function RemindersPage() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getReminderSettings().then(setSettings);
  }, []);

  if (!settings) {
    return (
      <div>
        <AppBar title="Reminders" back={{ href: '/more' }} />
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      </div>
    );
  }

  const update = async (patch: Partial<ReminderSettings>) => {
    setSaving(true);
    setMessage(null);
    const result = await saveReminderSettings(patch);
    if (result.ok) {
      setSettings({ ...settings, ...patch });
      setMessage({ ok: true, text: 'Saved' });
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage({ ok: false, text: 'Failed to save' });
    }
    setSaving(false);
  };

  return (
    <div>
      <AppBar title="Reminders" back={{ href: '/more' }} />

      <div className="max-w-3xl mx-auto px-4 pt-2 pb-32 min-h-[calc(100vh-3.5rem)]">
        {message && (
          <div
            className={`mb-3 p-3 rounded-lg text-sm flex items-center gap-2 ${
              message.ok
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
            }`}
          >
            {message.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            {message.text}
          </div>
        )}

        {/* Daily Entry */}
        <Section title="Daily Entry">
          <ToggleRow
            label="Entry Nudge"
            subtitle={`Remind if no transactions entered today at ${settings.dailyEntryTime}`}
            enabled={settings.dailyEntryEnabled}
            onChange={(v) => update({ dailyEntryEnabled: v })}
            disabled={saving}
          />
          {settings.dailyEntryEnabled && (
            <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
              <div className="text-xs text-zinc-500 mb-1.5">Time</div>
              <input
                type="time"
                value={settings.dailyEntryTime}
                onChange={(e) => update({ dailyEntryTime: e.target.value })}
                disabled={saving}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-tangerine/50"
              />
            </div>
          )}
        </Section>

        {/* Bill Due */}
        <Section title="Bill Due">
          <ToggleRow
            label="Payment Due Alerts"
            subtitle={`Notify ${settings.billDueDaysBefore} days before credit card payment due`}
            enabled={settings.billDueEnabled}
            onChange={(v) => update({ billDueEnabled: v })}
            disabled={saving}
          />
          {settings.billDueEnabled && (
            <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
              <div className="text-xs text-zinc-500 mb-1.5">Days before</div>
              <select
                value={settings.billDueDaysBefore}
                onChange={(e) => update({ billDueDaysBefore: Number(e.target.value) })}
                disabled={saving}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-tangerine/50"
              >
                {[1, 2, 3, 5, 7, 10].map((d) => (
                  <option key={d} value={d}>
                    {d} day{d > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </Section>

        {/* Budget Warning */}
        <Section title="Budget">
          <ToggleRow
            label="Budget Warning"
            subtitle={`Warn when monthly spending reaches ${settings.budgetWarningPct}%`}
            enabled={settings.budgetWarningEnabled}
            onChange={(v) => update({ budgetWarningEnabled: v })}
            disabled={saving}
          />
          {settings.budgetWarningEnabled && (
            <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
              <div className="text-xs text-zinc-500 mb-1.5">Warning at</div>
              <select
                value={settings.budgetWarningPct}
                onChange={(e) => update({ budgetWarningPct: Number(e.target.value) })}
                disabled={saving}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-tangerine/50"
              >
                {[50, 60, 70, 80, 90, 100].map((p) => (
                  <option key={p} value={p}>
                    {p}%
                  </option>
                ))}
              </select>
            </div>
          )}
        </Section>

        <p className="text-[11px] text-zinc-500 text-center mt-6">
          Reminders are checked once per day by a scheduled cron job.
          Notifications appear here in Telegram via Luna.
        </p>
      </div>
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

function ToggleRow({
  label,
  subtitle,
  enabled,
  onChange,
  disabled,
}: {
  label: string;
  subtitle: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className="w-full flex items-center justify-between px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0 text-left disabled:opacity-50 active:bg-zinc-100 dark:active:bg-zinc-800"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {enabled ? (
          <Bell className="w-5 h-5 mt-0.5 text-tangerine shrink-0" strokeWidth={1.6} />
        ) : (
          <BellOff className="w-5 h-5 mt-0.5 text-zinc-400 shrink-0" strokeWidth={1.6} />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm">{label}</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</div>
        </div>
      </div>
      <div
        className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${
          enabled ? 'bg-tangerine' : 'bg-zinc-300 dark:bg-zinc-600'
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5.5' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  );
}
