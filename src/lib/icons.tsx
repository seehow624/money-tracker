import {
  // Categories — expense
  UtensilsCrossed,
  Bus,
  ShoppingBag,
  RefreshCw,
  Gamepad2,
  Receipt,
  Sparkles,
  ShieldCheck,
  GraduationCap,
  Plane,
  PawPrint,
  Gift,
  House,
  Camera,
  SprayCan,
  Wrench,
  Beer,
  // Categories — income
  Landmark,
  PiggyBank,
  TrendingUp,
  DollarSign,
  // Account types
  Building2,
  CreditCard,
  Smartphone,
  Banknote,
  // Misc
  ArrowLeftRight,
  Tag,
  type LucideIcon,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  // Expense
  'Food & Dining': UtensilsCrossed,
  Transportation: Bus,
  Shopping: ShoppingBag,
  Subscription: RefreshCw,
  Entertainment: Gamepad2,
  'Bills & Utilities': Receipt,
  'Health & Beauty': Sparkles,
  Insurance: ShieldCheck,
  'Self-development': GraduationCap,
  Travel: Plane,
  Pet: PawPrint,
  Gift: Gift,
  Household: House,
  Assets: Camera,
  'Daily Supplies': SprayCan,
  Other: Wrench,
  'Social Life': Beer,
  // Income
  'Interest Earned': Landmark,
  'Cash Back': PiggyBank,
  Bonus: TrendingUp,
  Income: DollarSign,
};

const ACCOUNT_TYPE_ICONS: Record<string, LucideIcon> = {
  bank: Building2,
  credit_card: CreditCard,
  ewallet: Smartphone,
  cash: Banknote,
  investment: TrendingUp,
};

export function CategoryIcon({
  name,
  className = 'w-5 h-5',
  strokeWidth = 2,
}: {
  name?: string | null;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon: LucideIcon = name && CATEGORY_ICONS[name] ? CATEGORY_ICONS[name] : Tag;
  return <Icon className={className} strokeWidth={strokeWidth} />;
}

export function AccountTypeIcon({
  type,
  className = 'w-5 h-5',
  strokeWidth = 2,
}: {
  type: string;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = ACCOUNT_TYPE_ICONS[type] ?? Tag;
  return <Icon className={className} strokeWidth={strokeWidth} />;
}

export { ArrowLeftRight as TransferIcon };
