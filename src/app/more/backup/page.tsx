import { AppBar } from '@/components/AppBar';
import { BackupButton } from '@/components/BackupButton';
import {
  Download,
  RotateCcw,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

export default function BackupPage() {
  return (
    <div>
      <AppBar title="Backup & Restore" back={{ href: '/more' }} />

      <div className="max-w-3xl mx-auto px-4 pt-2 pb-32 min-h-[calc(100vh-3.5rem)]">
        <Section title="Actions">
          <BackupButton />
          <Row
            Icon={Download}
            title="Export CSV"
            subtitle="All transactions as spreadsheet"
            href="/api/export"
            external
            download
          />
        </Section>

        <Section title="Restore">
          <Row
            Icon={RotateCcw}
            title="View Backups"
            subtitle="Restore, download, or delete saved backups"
            href="/more/backup/restore"
          />
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
  external,
  download,
}: {
  Icon: LucideIcon;
  title: string;
  subtitle?: string;
  href: string;
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
        <div className="font-medium text-[15px]">{title}</div>
        {subtitle && (
          <div className="text-xs text-zinc-500 mt-0.5 truncate">
            {subtitle}
          </div>
        )}
      </div>
      {external ? (
        <ChevronRight
          className="w-5 h-5 text-zinc-400 mt-1 shrink-0"
          strokeWidth={2}
        />
      ) : (
        <ChevronRight
          className="w-5 h-5 text-zinc-400 mt-1 shrink-0"
          strokeWidth={2}
        />
      )}
    </>
  );

  const cls =
    'flex items-start gap-3 px-5 py-3.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0';

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
