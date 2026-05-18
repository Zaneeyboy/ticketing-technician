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
    <section className='relative overflow-hidden bg-primary py-16 sm:py-24'>
      <div className='relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8'>
        <h2 className='text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl animate-fade-in'>{title}</h2>
        <p className='mx-auto mt-6 max-w-2xl text-lg text-white/80 animate-fade-in' style={{ animationDelay: '100ms' }}>
          {description}
        </p>

        <div className='mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center animate-fade-in' style={{ animationDelay: '200ms' }}>
          <Button asChild size='lg' className='bg-white text-primary hover:bg-white/90 font-semibold'>
            <Link href={primaryAction.href}>{primaryAction.label}</Link>
          </Button>
          {secondaryAction && (
            <Button asChild size='lg' variant='outline' className='border-white/30 text-white hover:bg-white/10'>
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
