import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface CTASectionProps {
  title: string;
  description: string;
  primaryAction: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
}

export function CTASection({ title, description, primaryAction, secondaryAction }: CTASectionProps) {
  return (
    <section className='relative overflow-hidden bg-linear-to-r from-primary to-primary/80 py-16 sm:py-24 transition-all duration-300'>
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -right-40 -top-40 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-float' />
        <div className='absolute -bottom-32 -left-40 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-float' style={{ animationDelay: '-1s' }} />
      </div>

      <div className='relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8'>
        <h2 className='text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl animate-fade-in transition-all duration-300'>{title}</h2>
        <p className='mx-auto mt-6 max-w-2xl text-lg text-white/90 animate-fade-in transition-all duration-300' style={{ animationDelay: '100ms' }}>
          {description}
        </p>

        <div className='mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center animate-fade-in' style={{ animationDelay: '200ms' }}>
          <Button asChild size='lg' className='bg-white text-primary hover:bg-white/90 font-semibold transition-all duration-300 hover:scale-105 hover:shadow-xl'>
            <Link href={primaryAction.href}>{primaryAction.label}</Link>
          </Button>
          {secondaryAction && (
            <Button asChild size='lg' variant='outline' className='border-white/30 text-white hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:shadow-xl'>
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
