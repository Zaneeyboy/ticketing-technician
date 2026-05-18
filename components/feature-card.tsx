import { ReactNode } from 'react';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  delay?: number;
}

export function FeatureCard({ icon, title, description, delay = 0 }: FeatureCardProps) {
  return (
    <div
      className='group h-full rounded-lg border border-border bg-card p-6 transition-all duration-200 hover:border-primary/40 hover:shadow-md animate-slide-in-up cursor-pointer'
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all duration-200 group-hover:bg-primary/15'>{icon}</div>
      <h3 className='mb-2 text-lg font-semibold text-foreground'>{title}</h3>
      <p className='text-sm text-muted-foreground leading-relaxed'>{description}</p>
    </div>
  );
}
