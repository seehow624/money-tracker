import { AppBar } from '@/components/AppBar';
import { db, schema } from '@/db';
import { fmtCurrency, currencySymbol, CURRENCY_CODES } from '@/lib/currency';
import { getBaseCurrency } from '@/lib/settings';
import { BaseCurrencySelect } from '@/components/BaseCurrencySelect';
import { sql, eq, and, isNull } from 'drizzle-orm';
import Link from 'next/link';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  Target,
  Database,
  Bell,
  Network,
  ChevronRight,
  Info,
  Heart,
  HardDrive,
  Sparkles,
  LogOut,
  KeyRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { sql as drizzleSql } from 'drizzle-orm';
import { ThemeToggle } from '@/components/ThemeToggle';
import { logout } from '@/app/login/actions';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const APP_VERSION = '0.1.0';
const GIT_SHA = process.env.NEXT_PUBLIC_GIT_SHA ?? 'dev';
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? '';

export default async function MorePage() {
  const session = await requireSession();
  const isAdmin = session.role === 'admin';
  const base = getBaseCurrency();

  const txnCount =
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, session.userId))
      .get()?.n ?? 0;
  const acctActive =
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.userId, session.userId),
          eq(schema.accounts.active, true),
        ),
      )
      .get()?.n ?? 0;

  const incomeCats =
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.userId, session.userId),
          eq(schema.categories.isIncome, true),
          isNull(schema.categories.parentId),
          eq(schema.categories.active, true),
        ),
      )
      .get()?.n ?? 0;
  const expenseCats =
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.userId, session.userId),
          eq(schema.categories.isIncome, false),
          isNull(schema.categories.parentId),
          eq(schema.categories.active, true),
        ),
      )
      .get()?.n ?? 0;

  const month = new Date().toISOString().slice(0, 7);
  const budget = db
    .select()
    .from(schema.monthlyBudgets)
    .where(
      and(
        eq(schema.monthlyBudgets.userId, session.userId),
        eq(schema.monthlyBudgets.month, month),
      ),
    )
    .get();

  const paidByOthers = db
    .select({
      who: schema.transactions.paidBy,
      total: drizzleSql<number>`COALESCE(SUM(${schema.transactions.amountMyr}), 0)`,
      n: drizzleSql<number>`COUNT(*)`,
    })
    .from(schema.transactions)
    .where(
      drizzleSql`${schema.transactions.userId} = ${session.userId} AND ${schema.transactions.paidBy} != 'me' AND ${schema.transactions.type} = 'expense'`,
    )
    .groupBy(schema.transactions.paidBy)
    .orderBy(drizzleSql`SUM(${schema.transactions.amountMyr}) DESC`)
    .all();

  return (
    <div>
      <AppBar
        title="More"
        trailing={
          <span className="text-xs text-zinc-400 tabular-nums">
            {APP_VERSION} · {GIT_SHA}
          </span>
        }
      />

      <div className="max-w-3xl mx-auto px-4 pt-2 pb-32 min-h-[calc(100vh-3.5rem)]">
        <Section title="Data">
          {isAdmin && (
            <Row
              Icon={HardDrive}
              title="Backup & Restore"
              subtitle="Save, export, restore, and manage backups"
              href="/more/backup"
            />
          )}
          <Row
            Icon={Bell}
            title="Scheduled rules"
            subtitle="Auto-create monthly transactions"
            href="/more/scheduled"
          />
          <Row
            Icon={ArrowDownCircle}
            title="Recurring (detected)"
            subtitle="Auto-detected subscriptions and patterns"
            href="/more/recurring"
          />
        </Section>

        {paidByOthers.length > 0 && (
          <Section title="Paid by">
            {paidByOthers.map((p) => (
              <Row
                key={p.who}
                Icon={Heart}
                title={p.who.charAt(0).toUpperCase() + p.who.slice(1)}
                subtitle={`${p.n} transactions · ${fmtCurrency(p.total ?? 0, base)}`}
                href={`/paid-by/${p.who}`}
              />
            ))}
          </Section>
        )}

        <Section title="Categories & Accounts">
          <Row
            Icon={ArrowDownCircle}
            title="Income Categories"
            subtitle={`${incomeCats} active`}
            href="/more/categories?type=income"
          />
          <Row
            Icon={ArrowUpCircle}
            title="Expense Categories"
            subtitle={`${expenseCats} active`}
            href="/more/categories?type=expense"
          />
          <Row
            Icon={Wallet}
            title="Accounts"
            subtitle={`${acctActive} accounts`}
            href="/balances?edit=1"
          />
          <Row
            Icon={Target}
            title="Budget"
            subtitle={
              budget
                ? `${fmtCurrency(budget.totalMyr, base)} for ${month}`
                : 'Not set for this month'
            }
            href="/more/budget"
          />
        </Section>

        <Section title="Display">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
              Theme
            </div>
            <ThemeToggle />
          </div>
          <BaseCurrencySelect
            current={base}
            hasData={txnCount > 0}
            options={CURRENCY_CODES.map((code) => ({
              code,
              symbol: currencySymbol(code),
            }))}
          />
          {isAdmin && (
            <>
              <Row
                Icon={Bell}
                title="Reminders"
                subtitle="Daily entry nudge, bill due alerts"
                href="/more/reminders"
              />
              <Row
                Icon={Sparkles}
                title="AI Assistant"
                subtitle="Provider, model, and API key"
                href="/more/ai"
              />
            </>
          )}
        </Section>

        <Section title="System">
          <Row
            Icon={Network}
            title="Network"
            subtitle={process.env.NEXT_PUBLIC_APP_HOST ?? 'localhost:3000'}
            href="#"
            staticInfo
          />
          <Row
            Icon={Database}
            title="Database"
            subtitle={`${txnCount.toLocaleString()} transactions · ${incomeCats + expenseCats} categories`}
            href="#"
            staticInfo
          />
          <Row
            Icon={Info}
            title="About"
            subtitle={`Money Tracker · v${APP_VERSION} · ${GIT_SHA}${BUILD_TIME ? ` · built ${BUILD_TIME}` : ''}`}
            href="#"
            staticInfo
          />
        </Section>

        <Section title="Account">
          <Row
            Icon={KeyRound}
            title="Change password"
            subtitle={`Signed in · ${session.role}`}
            href="/more/account"
          />
          {isAdmin && (
            <Row
              Icon={Users}
              title="Manage users"
              subtitle="Admin: add, remove, reset passwords"
              href="/more/admin/users"
            />
          )}
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-start gap-3 px-5 py-3.5 active:bg-zinc-100 dark:active:bg-zinc-800 text-left border-t border-zinc-100 dark:border-zinc-800"
            >
              <LogOut
                className="w-6 h-6 mt-0.5 text-zinc-500 shrink-0"
                strokeWidth={1.6}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[15px]">Sign out</div>
              </div>
            </button>
          </form>
        </Section>
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
    <>
      <div className="px-2 pt-5 pb-2 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
        {title}
      </div>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
        {children}
      </div>
    </>
  );
}

function Row({
  Icon,
  title,
  subtitle,
  href,
  comingSoon,
  staticInfo,
  external,
  download,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle?: string;
  href: string;
  comingSoon?: boolean;
  staticInfo?: boolean;
  external?: boolean;
  download?: boolean;
}) {
  const inner = (
    <>
      <Icon
        className="w-6 h-6 mt-0.5 text-zinc-500 shrink-0"
        strokeWidth={1.6}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[15px] flex items-center gap-2">
          {title}
          {comingSoon && (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-semibold">
              Soon
            </span>
          )}
        </div>
        {subtitle && (
          <div className="text-xs text-zinc-500 mt-0.5 truncate">
            {subtitle}
          </div>
        )}
      </div>
      {!staticInfo && !comingSoon && (
        <ChevronRight
          className="w-5 h-5 text-zinc-400 mt-1 shrink-0"
          strokeWidth={2}
        />
      )}
    </>
  );

  const cls =
    'flex items-start gap-3 px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0';

  if (comingSoon || staticInfo) {
    return <div className={cls + ' opacity-90'}>{inner}</div>;
  }

  if (external) {
    return (
      <a
        href={href}
        download={download}
        className={cls + ' active:bg-zinc-100 dark:active:bg-zinc-800'}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={cls + ' active:bg-zinc-100 dark:active:bg-zinc-800'}
    >
      {inner}
    </Link>
  );
}
