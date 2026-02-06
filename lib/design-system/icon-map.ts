/**
 * Icon Mapping System
 *
 * Centralized icon mapping for consistent usage across dashboard
 * All icons are from Lucide React
 */

import {
  // Navigation & Layout
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  Wallet,
  History,
  Clock,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  QrCode,
  FileSpreadsheet,
  Layers,
  Users,
  Tag,
  Bot,
  Sparkles,
  Repeat,
  ArrowLeftRight,
  Settings,
  User,
  Bell,

  // Status & Feedback
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  AlertCircle,
  HelpCircle,
  Loader2,

  // Actions
  Plus,
  Minus,
  Edit,
  Trash2,
  Download,
  Upload,
  Copy,
  Share2,
  ExternalLink,
  Search,
  Filter,
  MoreHorizontal,
  MoreVertical,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
  Check,

  // Finance & Crypto
  DollarSign,
  TrendingDown,
  PieChart,
  Activity,
  CreditCard,
  Coins,
  Receipt,
  Banknote,

  // Communication
  Mail,
  MessageSquare,
  Phone,

  // Files & Documents
  File,
  FileText,
  Folder,
  FileX2,

  // Time
  Calendar,

  // Security
  Lock,
  Unlock,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Eye,
  EyeOff,

  // Network & Connection
  Wifi,
  WifiOff,
  Link,
  Unlink,
  Globe,

  // Misc
  Star,
  Heart,
  Bookmark,
  Flag,
  Home,
  Building2,

  type LucideIcon,
} from "lucide-react"

/**
 * Dashboard page icons
 */
export const pageIcons = {
  dashboard: LayoutDashboard,
  analytics: TrendingUp,
  analyticsChart: BarChart3,
  balances: Wallet,
  history: History,
  transactions: Clock,
  pay: Send,
  send: ArrowUpRight,
  receive: ArrowDownLeft,
  qrCode: QrCode,
  batchPayment: FileSpreadsheet,
  batch: Layers,
  vendors: Users,
  tags: Tag,
  agents: Bot,
  aiAgents: Sparkles,
  swap: Repeat,
  exchange: ArrowLeftRight,
  settings: Settings,
  profile: User,
  notifications: Bell,
} as const

/**
 * Status indicator icons
 */
export const statusIcons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  alert: AlertCircle,
  help: HelpCircle,
  loading: Loader2,
} as const

/**
 * Action icons
 */
export const actionIcons = {
  add: Plus,
  remove: Minus,
  edit: Edit,
  delete: Trash2,
  download: Download,
  upload: Upload,
  copy: Copy,
  share: Share2,
  external: ExternalLink,
  search: Search,
  filter: Filter,
  more: MoreHorizontal,
  moreVertical: MoreVertical,
  next: ChevronRight,
  previous: ChevronLeft,
  expand: ChevronDown,
  collapse: ChevronUp,
  close: X,
  confirm: Check,
} as const

/**
 * Financial icons
 */
export const financeIcons = {
  dollar: DollarSign,
  trendUp: TrendingUp,
  trendDown: TrendingDown,
  chart: PieChart,
  activity: Activity,
  card: CreditCard,
  coins: Coins,
  receipt: Receipt,
  money: Banknote,
} as const

/**
 * Communication icons
 */
export const communicationIcons = {
  email: Mail,
  message: MessageSquare,
  phone: Phone,
} as const

/**
 * File icons
 */
export const fileIcons = {
  file: File,
  document: FileText,
  folder: Folder,
  empty: FileX2,
} as const

/**
 * Time icons
 */
export const timeIcons = {
  calendar: Calendar,
  clock: Clock,
  history: History,
} as const

/**
 * Security icons
 */
export const securityIcons = {
  lock: Lock,
  unlock: Unlock,
  shield: Shield,
  shieldCheck: ShieldCheck,
  shieldAlert: ShieldAlert,
  key: Key,
  visible: Eye,
  hidden: EyeOff,
} as const

/**
 * Network icons
 */
export const networkIcons = {
  online: Wifi,
  offline: WifiOff,
  link: Link,
  unlink: Unlink,
  globe: Globe,
} as const

/**
 * Misc icons
 */
export const miscIcons = {
  star: Star,
  favorite: Heart,
  bookmark: Bookmark,
  flag: Flag,
  home: Home,
  business: Building2,
} as const

/**
 * All icons combined
 */
export const icons = {
  ...pageIcons,
  ...statusIcons,
  ...actionIcons,
  ...financeIcons,
  ...communicationIcons,
  ...fileIcons,
  ...timeIcons,
  ...securityIcons,
  ...networkIcons,
  ...miscIcons,
} as const

/**
 * Icon size presets (Tailwind classes)
 */
export const iconSizes = {
  xs: "size-3",  // 12px
  sm: "size-4",  // 16px
  md: "size-5",  // 20px
  lg: "size-6",  // 24px
  xl: "size-8",  // 32px
  "2xl": "size-10", // 40px
} as const

/**
 * Helper type: Get icon by name
 */
export type IconName = keyof typeof icons

/**
 * Helper: Get icon component by name
 */
export function getIcon(name: IconName): LucideIcon {
  return icons[name]
}

/**
 * Export type for icon components
 */
export type { LucideIcon }
