'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { logoutAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
import { BarChart3, Calendar, ChevronDown, ClipboardList, FileText, Headphones, LayoutDashboard, Menu, Settings, UserCheck, Users, Wrench, X } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const navItems = useMemo(
    () => [
      {
        label: 'Dashboard',
        href: '/dashboard',
        roles: ['admin', 'call_admin', 'technician', 'management'],
        icon: LayoutDashboard,
      },
      {
        label: 'Tickets',
        href: '/tickets',
        roles: ['admin', 'call_admin', 'technician', 'management'],
        icon: ClipboardList,
      },
      {
        label: 'Schedule',
        href: '/schedule',
        roles: ['admin', 'management', 'technician', 'call_admin'],
        icon: Calendar,
      },
      {
        label: 'Customers',
        href: '/customers',
        roles: ['admin', 'management', 'call_admin'],
        icon: Users,
      },
      {
        label: 'Technicians',
        href: '/technicians',
        roles: ['admin', 'management'],
        icon: UserCheck,
      },
      {
        label: 'Call Admins',
        href: '/call-admins',
        roles: ['admin'],
        icon: Headphones,
      },
      {
        label: 'Machines',
        href: '/machines',
        roles: ['admin', 'management', 'call_admin'],
        icon: Wrench,
      },
      {
        label: 'Parts',
        href: '/parts',
        roles: ['admin', 'management'],
        icon: Settings,
      },
      {
        label: 'Reports',
        href: '/reports',
        roles: ['admin', 'management'],
        icon: BarChart3,
      },
      {
        label: 'Users',
        href: '/users',
        roles: ['admin'],
        icon: FileText,
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
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto'></div>
          <p className='mt-4 text-gray-600 dark:text-gray-400'>Loading...</p>
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

  const visibleItems = navItems.filter((item) => (user ? item.roles.includes(user.role) : false));
  const activeItem = visibleItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  const renderNav = (onNavigate?: () => void) => (
    <nav className='mt-6 flex flex-col gap-1'>
      {visibleItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={
              isActive
                ? 'group rounded-lg bg-primary/10 text-primary px-3 py-2 text-sm font-semibold shadow-sm'
                : 'group rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors'
            }
          >
            <span className='flex items-center gap-2 transition-transform duration-200 ease-out group-hover:translate-x-0.5'>
              <Icon className='h-4 w-4' />
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
        <aside className='hidden md:flex md:flex-col md:w-72 lg:w-80 border-r border-border bg-card/80 backdrop-blur h-screen'>
          <div className='flex items-center justify-between h-16 px-6 border-b border-border'>
            <Link href='/dashboard' className='text-lg font-bold'>
              Tech Dynamics
            </Link>
            <ThemeToggle />
          </div>

          <div className='flex-1 px-4 overflow-y-auto'>{renderNav()}</div>

          <div className='border-t border-border px-4 py-4 shrink-0'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' className='w-full justify-between gap-3 cursor-pointer hover:bg-muted/80 transition-colors'>
                  <div className='flex items-center gap-3 min-w-0'>
                    <div className='w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0'>{user.name.charAt(0).toUpperCase()}</div>
                    <div className='text-left min-w-0'>
                      <div className='text-sm font-medium truncate'>{user.name}</div>
                      <div className='text-xs text-muted-foreground capitalize truncate'>{user.role.replace('_', ' ')}</div>
                    </div>
                  </div>
                  <ChevronDown className='h-4 w-4 text-muted-foreground shrink-0' />
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

          <main className='flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 2xl:px-12 py-8 animate-fade-in'>
            {activeItem && (
              <div className='mb-8'>
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
            className={`absolute left-0 top-0 h-full w-72 bg-card border-r border-border shadow-xl ${isClosing ? 'animate-slide-out-left' : 'animate-slide-in-left'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className='flex items-center justify-between h-14 px-4 border-b border-border'>
              <span className='text-sm font-semibold'>Navigation</span>
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
