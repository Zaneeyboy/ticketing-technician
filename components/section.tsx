'use client';

import { ReactNode } from 'react';
import { useScrollAnimation } from '@/lib/hooks/useScrollAnimation';

interface SectionProps {
  id?: string;
  children: ReactNode;
  className?: string;
}

export function Section({ id, children, className = '' }: SectionProps) {
  const { ref, isVisible } = useScrollAnimation<HTMLElement>();

  return (
    <section ref={ref} id={id} className={`py-16 sm:py-24 lg:py-32 ${className} transition-all duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>{children}</div>
    </section>
  );
}

interface SectionHeadingProps {
  title: string;
  description?: string;
  centered?: boolean;
}

export function SectionHeading({ title, description, centered = true }: SectionHeadingProps) {
  const classes = centered ? 'text-center' : '';
  const maxWidth = centered ? 'mx-auto max-w-2xl' : '';

  return (
    <div className={`${maxWidth} mb-12 ${classes} animate-fade-in`}>
      <h2 className='text-3xl font-bold tracking-tight text-foreground sm:text-4xl bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text hover:text-transparent transition-all duration-300'>
        {title}
      </h2>
      {description && <p className='mt-4 text-lg text-muted-foreground animate-fade-in stagger-1 group-hover:text-foreground/80 transition-colors duration-300'>{description}</p>}
    </div>
  );
}
