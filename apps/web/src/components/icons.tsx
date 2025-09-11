import {
    LucideProps,
    RefreshCw,
    Check,
    X,
    AlertCircle,
    Inbox,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    User,
    UserCircle,
    Wallet,
    LogOut,
    Plus,
    Search,
    Mail,
    Phone,
    Clock,
    Calendar,
    Home,
    Settings,
    Package,
    Truck,
    CreditCard,
    Menu,
    MoreVertical,
    FileText,
  } from "lucide-react";
  
  export type Icon = React.ComponentType<React.SVGProps<SVGSVGElement>>;
  
  export const Icons = {
    inbox: Inbox,
    chevronLeft: ChevronLeft,
    chevronRight: ChevronRight,
    chevronsLeft: ChevronsLeft,
    chevronsRight: ChevronsRight,
    check: Check,
    close: X,
    alert: AlertCircle,
    user: User,
    userCircle: UserCircle,
    wallet: Wallet,
    logout: LogOut,
    plus: Plus,
    search: Search,
    mail: Mail,
    phone: Phone,
    clock: Clock,
    calendar: Calendar,
    home: Home,
    settings: Settings,
    package: Package,
    truck: Truck,
    creditCard: CreditCard,
    menu: Menu,
    moreVertical: MoreVertical,
    fileText: FileText,
    refresh: RefreshCw,
    spinner: ({ ...props }: LucideProps) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    ),
  };