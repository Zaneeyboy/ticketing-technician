'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export function LandingNavbar() {
  return (
    <nav className='sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75 transition-all duration-300'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex h-16 items-center justify-between'>
          <div className='flex items-center gap-2 transition-all duration-300 hover:scale-105'>
            <div className='h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent transition-all duration-300 hover:shadow-md' />
            <span className='text-xl font-bold text-foreground transition-colors duration-300'>Tech Dynamics</span>
          </div>

          <div className='hidden gap-8 md:flex'>
            <Link href='#features' className='text-sm font-medium text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-110 inline-block'>
              Features
            </Link>
            <Link href='#how-it-works' className='text-sm font-medium text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-110 inline-block'>
              How It Works
            </Link>
            <Link href='#preview' className='text-sm font-medium text-muted-foreground hover:text-primary transition-all duration-300 hover:scale-110 inline-block'>
              Dashboard
            </Link>
          </div>

          <div className='flex items-center gap-2'>
            <ThemeToggle />
            <Button variant='outline' asChild className='transition-all duration-300 hover:scale-105 hover:shadow-md'>
              <Link href='/login'>Sign In</Link>
            </Button>
            <Button asChild className='bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-105 hover:shadow-lg'>
              <Link href='/signup'>Get Started</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
