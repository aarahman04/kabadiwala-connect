import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building2,
  Camera,
  Check,
  CheckCheck,
  Circle,
  CircleCheck,
  Clock3,
  Factory,
  Fingerprint,
  House,
  IndianRupee,
  LoaderCircle,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  Volume2,
  Wallet,
  Wifi,
  WifiOff,
  Wrench,
  X,
  TriangleAlert,
  Phone,
  Save,
  type LucideProps,
} from 'lucide-react';

const icons = {
  back: ArrowLeft,
  next: ArrowRight,
  cash: Banknote,
  building: Building2,
  camera: Camera,
  check: Check,
  synced: CheckCheck,
  circle: Circle,
  success: CircleCheck,
  clock: Clock3,
  factory: Factory,
  fingerprint: Fingerprint,
  home: House,
  rupee: IndianRupee,
  loading: LoaderCircle,
  location: MapPin,
  package: Package,
  plus: Plus,
  refresh: RefreshCw,
  settings: Settings2,
  search: Search,
  shield: ShieldCheck,
  phone: Phone,
  digital: Smartphone,
  sparkle: Sparkles,
  shop: Store,
  trend: TrendingUp,
  truck: Truck,
  audio: Volume2,
  wallet: Wallet,
  online: Wifi,
  offline: WifiOff,
  tools: Wrench,
  close: X,
  warning: TriangleAlert,
  save: Save,
};
export type IconName = keyof typeof icons;

export function Icon({ name, className = '', ...props }: LucideProps & { name: IconName }) {
  const Symbol = icons[name];
  return (
    <Symbol
      size={22}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
      className={`icon ${className}`}
      {...props}
    />
  );
}
