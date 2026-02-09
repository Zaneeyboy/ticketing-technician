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
      className='group h-full rounded-lg border border-border bg-card p-6 transition-all duration-300 hover:border-accent hover:shadow-lg hover:shadow-primary/20 animate-slide-in-up hover:-translate-y-1 cursor-pointer'
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 text-accent transition-all duration-300 group-hover:scale-110 group-hover:rotate-6'>
        {icon}
      </div>
      <h3 className='mb-2 text-lg font-semibold text-foreground group-hover:text-accent transition-colors duration-300'>{title}</h3>
      <p className='text-sm text-muted-foreground leading-relaxed group-hover:text-foreground/80 transition-colors duration-300'>{description}</p>
    </div>
  );
}
