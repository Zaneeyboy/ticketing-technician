'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { logoutAction } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import Link from 'next/link';
import { BarChart3, Building2, ChevronDown, LayoutDashboard, Menu, Package, Ticket, Users, X } from 'lucide-react';

interface HQLayoutProps {
  children: ReactNode;
  user: { uid: string; email: string; name: string; role: string };
}

const navItems = [
  { label: 'Dashboard', href: '/hq/dashboard', icon: LayoutDashboard },
  { label: 'Stores', href: '/hq/stores', icon: Building2 },
  { label: 'Users', href: '/hq/users', icon: Users },
  { label: 'Tickets', href: '/hq/tickets', icon: Ticket },
  { label: 'Parts', href: '/hq/parts', icon: Package },
  { label: 'Reports', href: '/hq/reports', icon: BarChart3 },
];

export default function HQLayout({ children, user }: HQLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const activeItem = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  const handleLogout = async () => {
    await logoutAction();
  };

  const handleCloseMobileMenu = () => {
    setIsClosing(true);
    const timer = setTimeout(() => {
      setMobileOpen(false);
      setIsClosing(false);
    }, 400);
    return () => clearTimeout(timer);
  };

  const renderNav = (onNavigate?: () => void) => (
    <nav className='mt-6 flex flex-col gap-1'>
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={
              isActive
                ? 'group rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-semibold'
                : 'group rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors'
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
        <aside className='hidden md:flex md:flex-col md:w-72 lg:w-80 border-r border-sidebar-border bg-sidebar text-sidebar-foreground h-screen'>
          <div className='flex items-center justify-between h-16 px-6 border-b border-sidebar-border'>
            <div>
              <Link href='/hq/dashboard' className='text-lg font-bold text-sidebar-foreground'>
                Caribbean Roasters
              </Link>
              <p className='text-xs text-sidebar-foreground/50 mt-0.5'>Headquarters</p>
            </div>
            <ThemeToggle />
          </div>

          <div className='flex-1 px-4 overflow-y-auto'>{renderNav()}</div>

          <div className='border-t border-sidebar-border px-4 py-4 shrink-0'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' className='w-full justify-between gap-3 cursor-pointer hover:bg-sidebar-accent transition-colors text-sidebar-foreground'>
                  <div className='flex items-center gap-3 min-w-0'>
                    <div className='w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold shrink-0'>{user.name.charAt(0).toUpperCase()}</div>
                    <div className='text-left min-w-0'>
                      <div className='text-sm font-medium truncate'>{user.name}</div>
                      <div className='text-xs text-sidebar-foreground/50 truncate capitalize'>{user.role === 'super_admin' ? 'Super Admin · HQ' : 'Manager · HQ'}</div>
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
                    <p className='text-xs text-muted-foreground'>Super Admin</p>
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
                <span className='text-sm font-semibold'>HQ</span>
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
                        <p className='text-xs text-muted-foreground'>Super Admin</p>
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
                  <span>HQ · {activeItem.label}</span>
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
              <span className='text-sm font-semibold text-sidebar-foreground'>HQ Navigation</span>
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
