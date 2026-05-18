'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'Platform', href: '/#preview' },
];

export function LandingNavbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Add shadow when user scrolls
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    closeMobile();
  }, [pathname]);

  // Trap focus / close on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        closeMobile();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileOpen]);

  const openMobile = () => {
    setClosing(false);
    setMobileOpen(true);
  };

  const closeMobile = () => {
    setClosing(true);
    setTimeout(() => {
      setMobileOpen(false);
      setClosing(false);
    }, 250);
  };

  const isOnHome = pathname === '/';

  return (
    <>
      <nav className={`sticky top-0 z-50 border-b border-border bg-background transition-shadow duration-200 ${scrolled ? 'shadow-sm' : ''}`}>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <div className='flex h-16 items-center justify-between'>
            {/* Brand */}
            <Link href='/' className='flex items-center gap-2.5 shrink-0'>
              <div className='flex h-8 w-8 items-center justify-center rounded-md bg-primary shadow-sm'>
                <span className='text-xs font-black text-white tracking-tight leading-none'>CR</span>
              </div>
              <div className='flex flex-col leading-none'>
                <span className='text-sm font-black tracking-tight text-foreground' style={{ fontFamily: 'var(--font-playfair-display)' }}>
                  CARIBBEAN ROASTERS
                </span>
                <span className='text-[10px] font-medium text-muted-foreground tracking-widest uppercase'>Field Service Platform</span>
              </div>
            </Link>

            {/* Desktop nav links — always use absolute /#hash so they work from any page */}
            <div className='hidden gap-8 md:flex'>
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className='text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200'>
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Desktop CTAs */}
            <div className='hidden md:flex items-center gap-2'>
              <ThemeToggle />
              <Button variant='outline' asChild>
                <Link href='/login'>Sign In</Link>
              </Button>
              <Button asChild>
                <Link href='/login'>Access Dashboard</Link>
              </Button>
            </div>

            {/* Mobile: theme + hamburger */}
            <div className='flex items-center gap-1 md:hidden'>
              <ThemeToggle />
              <Button variant='ghost' size='icon' onClick={openMobile} aria-label='Open menu'>
                <Menu className='h-5 w-5' />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile drawer overlay */}
      {(mobileOpen || closing) && <div className={`fixed inset-0 z-50 bg-black/40 md:hidden ${closing ? 'animate-fade-out' : 'animate-overlay-fade-in'}`} aria-hidden='true' />}

      {/* Mobile drawer panel */}
      {(mobileOpen || closing) && (
        <div
          ref={drawerRef}
          className={`fixed top-0 right-0 z-50 h-full w-72 bg-background border-l border-border shadow-xl flex flex-col md:hidden ${closing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
        >
          <div className='flex items-center justify-between h-16 px-5 border-b border-border'>
            <Link href='/' className='flex items-center gap-2.5' onClick={closeMobile}>
              <div className='flex h-7 w-7 items-center justify-center rounded-md bg-primary'>
                <span className='text-[10px] font-black text-white tracking-tight'>CR</span>
              </div>
              <div className='flex flex-col leading-none'>
                <span className='text-xs font-black tracking-tight text-foreground' style={{ fontFamily: 'var(--font-playfair-display)' }}>
                  CARIBBEAN ROASTERS
                </span>
                <span className='text-[9px] font-medium text-muted-foreground tracking-widest uppercase'>Field Service Platform</span>
              </div>
            </Link>
            <Button variant='ghost' size='icon' onClick={closeMobile} aria-label='Close menu'>
              <X className='h-5 w-5' />
            </Button>
          </div>

          <div className='flex-1 flex flex-col gap-1 px-4 py-6'>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMobile}
                className='rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors'
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className='px-4 pb-8 flex flex-col gap-2 border-t border-border pt-4'>
            <Button variant='outline' asChild className='w-full'>
              <Link href='/login' onClick={closeMobile}>
                Sign In
              </Link>
            </Button>
            <Button asChild className='w-full'>
              <Link href='/signup' onClick={closeMobile}>
                Get Started
              </Link>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
