'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { logoutAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
import { BarChart3, Calendar, ChevronDown, ClipboardList, FileText, Headphones, LayoutDashboard, Menu, Settings, Settings2, UserCheck, Users, Wrench, X } from 'lucide-react';
import { useStore } from '@/lib/providers/store-context';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const { store } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Clear the optimistic active state once the route actually changes
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const navItems = useMemo(
    () => [
      {
        label: 'Dashboard',
        href: '/dashboard',
        roles: ['store_admin', 'store_manager', 'call_admin', 'technician'],
        icon: LayoutDashboard,
        module: null,
      },
      {
        label: 'Tickets',
        href: '/tickets',
        roles: ['store_admin', 'store_manager', 'call_admin', 'technician'],
        icon: ClipboardList,
        module: 'tickets' as const,
      },
      {
        label: 'Schedule',
        href: '/schedule',
        roles: ['store_admin', 'store_manager', 'technician', 'call_admin'],
        icon: Calendar,
        module: 'tickets' as const,
      },
      {
        label: 'Customers',
        href: '/customers',
        roles: ['store_admin', 'store_manager', 'call_admin'],
        icon: Users,
        module: 'customers' as const,
      },
      {
        label: 'Technicians',
        href: '/technicians',
        roles: ['store_admin'],
        icon: UserCheck,
        module: null,
      },
      {
        label: 'Call Admins',
        href: '/call-admins',
        roles: ['store_admin'],
        icon: Headphones,
        module: null,
      },
      {
        label: 'Machines',
        href: '/machines',
        roles: ['store_admin', 'store_manager', 'call_admin'],
        icon: Wrench,
        module: 'machines' as const,
      },
      {
        label: 'Parts',
        href: '/parts',
        roles: ['store_admin', 'store_manager', 'call_admin'],
        icon: Settings,
        module: 'parts' as const,
      },
      {
        label: 'Reports',
        href: '/reports',
        roles: ['store_admin', 'store_manager'],
        icon: BarChart3,
        module: 'reports' as const,
      },
      {
        label: 'Users',
        href: '/users',
        roles: ['store_admin'],
        icon: FileText,
        module: null,
      },
      {
        label: 'Store Settings',
        href: '/settings',
        roles: ['store_admin'],
        icon: Settings2,
        module: null,
      },
    ],
    [],
  );

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto'></div>
          <p className='mt-4 text-muted-foreground'>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    await logoutAction();
  };

  const handleCloseMobileMenu = () => {
    setIsClosing(true);
    // Wait for animation to complete before closing (400ms matches animation duration)
    const timer = setTimeout(() => {
      setMobileOpen(false);
      setIsClosing(false);
    }, 400);
    return () => clearTimeout(timer);
  };

  const visibleItems = navItems.filter((item) => {
    if (!user) return false;
    if (!item.roles.includes(user.role)) return false;
    // Module guard: if store has this module disabled, hide the nav item
    if (item.module && store?.modules && store.modules[item.module] === false) return false;
    return true;
  });
  const activeItem = visibleItems.find((item) => {
    const href = pendingHref ?? pathname;
    return href === item.href || href.startsWith(`${item.href}/`);
  });

  const renderNav = (onNavigate?: () => void) => (
    <nav className='mt-6 flex flex-col gap-1'>
      {visibleItems.map((item, index) => {
        const isActive = pendingHref === item.href || (!pendingHref && (pathname === item.href || pathname.startsWith(`${item.href}/`)));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => {
              setPendingHref(item.href);
              onNavigate?.();
            }}
            style={{ animationDelay: `${index * 35}ms` }}
            className={
              isActive
                ? 'group rounded-lg bg-primary text-primary-foreground px-3 py-2 pl-4 text-sm font-semibold border-l-[3px] border-l-white/40 animate-fade-in'
                : 'group rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-pointer animate-fade-in'
            }
          >
            <span className='flex items-center gap-2 transition-transform duration-200 ease-out group-hover:translate-x-1'>
              <Icon className='h-4 w-4 transition-transform duration-200 group-hover:scale-110' />
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className='h-screen bg-background text-foreground overflow-hidden'>
      <div className='flex h-full'>
        <aside className='hidden md:flex md:flex-col md:w-72 lg:w-80 border-r border-sidebar-border bg-sidebar text-sidebar-foreground h-screen'>
          <div className='flex items-center justify-between h-16 px-6 border-b border-sidebar-border animate-slide-in-down'>
            <Link href='/dashboard' className='text-lg font-bold text-sidebar-foreground hover:text-primary transition-colors duration-200'>
              {store?.name ?? 'Caribbean Roasters'}
            </Link>
            <ThemeToggle />
          </div>

          <div className='flex-1 px-4 overflow-y-auto'>{renderNav()}</div>

          <div className='border-t border-sidebar-border px-4 py-4 shrink-0 animate-slide-in-up' style={{ animationDelay: '200ms' }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' className='w-full justify-between gap-3 cursor-pointer hover:bg-sidebar-accent transition-colors text-sidebar-foreground'>
                  <div className='flex items-center gap-3 min-w-0'>
                    <div className='w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold shrink-0'>{user.name.charAt(0).toUpperCase()}</div>
                    <div className='text-left min-w-0'>
                      <div className='text-sm font-medium truncate'>{user.name}</div>
                      <div className='text-xs text-sidebar-foreground/50 capitalize truncate'>{user.role.replace('_', ' ')}</div>
                    </div>
                  </div>
                  <ChevronDown className='h-4 w-4 text-sidebar-foreground/50 shrink-0' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start' className='w-56'>
                <DropdownMenuLabel>
                  <div className='flex flex-col space-y-1'>
                    <p className='text-sm font-medium'>{user.name}</p>
                    <p className='text-xs text-muted-foreground'>{user.email}</p>
                    <p className='text-xs text-muted-foreground capitalize'>{user.role.replace('_', ' ')}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        <div className='flex-1 min-w-0 flex flex-col h-full overflow-hidden'>
          <header className='md:hidden sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur'>
            <div className='flex items-center justify-between h-14 px-4'>
              <div className='flex items-center gap-2'>
                <Button variant='ghost' size='icon' onClick={() => setMobileOpen(true)} aria-label='Open menu'>
                  <Menu className='h-5 w-5' />
                </Button>
                <span className='text-sm font-semibold'>Tech Dynamics</span>
              </div>
              <div className='flex items-center gap-2'>
                <ThemeToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon'>
                      <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold'>{user.name.charAt(0).toUpperCase()}</div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='w-56'>
                    <DropdownMenuLabel>
                      <div className='flex flex-col space-y-1'>
                        <p className='text-sm font-medium'>{user.name}</p>
                        <p className='text-xs text-muted-foreground'>{user.email}</p>
                        <p className='text-xs text-muted-foreground capitalize'>{user.role.replace('_', ' ')}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main className='flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 2xl:px-12 py-8'>
            {activeItem && (
              <div className='mb-8 animate-fade-in'>
                <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                  <activeItem.icon className='h-4 w-4' />
                  <span>{activeItem.label}</span>
                </div>
                <h1 className='text-2xl font-semibold text-foreground mt-1'>{activeItem.label}</h1>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>

      {mobileOpen && (
        <div className={`fixed inset-0 z-40 md:hidden ${isClosing ? 'animate-fade-out' : 'animate-overlay-fade-in'}`} onClick={() => handleCloseMobileMenu()} role='button' tabIndex={-1}>
          <div className='absolute inset-0 bg-background/80 backdrop-blur' />
          <aside
            className={`absolute left-0 top-0 h-full w-72 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-xl ${isClosing ? 'animate-slide-out-left' : 'animate-slide-in-left'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className='flex items-center justify-between h-14 px-4 border-b border-sidebar-border'>
              <span className='text-sm font-semibold text-sidebar-foreground'>Navigation</span>
              <Button variant='ghost' size='icon' onClick={() => handleCloseMobileMenu()} aria-label='Close menu'>
                <X className='h-5 w-5' />
              </Button>
            </div>
            <div className='px-4 py-4'>{renderNav(() => handleCloseMobileMenu())}</div>
          </aside>
        </div>
      )}
    </div>
  );
}
