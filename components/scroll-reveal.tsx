'use client';

import { ReactNode } from 'react';
import { useScrollAnimation } from '@/lib/hooks/useScrollAnimation';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  animation?: 'fade-in' | 'slide-in-up' | 'slide-in-left' | 'slide-in-right' | 'scale-in';
  delay?: number;
}

export function ScrollReveal({ children, className = '', animation = 'fade-in', delay = 0 }: ScrollRevealProps) {
  const { ref, isVisible } = useScrollAnimation<HTMLDivElement>();

  const animationClasses = {
    'fade-in': 'animate-fade-in',
    'slide-in-up': 'animate-slide-in-up',
    'slide-in-left': 'animate-slide-in-left',
    'slide-in-right': 'animate-slide-in-right',
    'scale-in': 'animate-scale-in',
  };

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ${isVisible ? animationClasses[animation] : 'opacity-0'} ${className}`}
      style={{
        animationDelay: isVisible ? `${delay}ms` : '0ms',
      }}
    >
      {children}
    </div>
  );
}
