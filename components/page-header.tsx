import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'animate-fade-in flex flex-col sm:flex-row sm:items-center justify-between gap-4',
        'rounded-2xl border border-border/60 bg-linear-to-r from-primary/8 via-background to-background',
        'px-6 py-5',
        className,
      )}
    >
      <div className='flex items-center gap-4'>
        {Icon && (
          <div className='rounded-xl bg-primary/10 p-2.5 shrink-0'>
            <Icon className='h-6 w-6 text-primary' />
          </div>
        )}
        <div>
          <h1 className='text-2xl font-bold text-foreground leading-tight'>{title}</h1>
          {description && <p className='text-sm text-muted-foreground mt-0.5'>{description}</p>}
        </div>
      </div>
      {actions && <div className='flex flex-wrap items-center gap-2 shrink-0'>{actions}</div>}
    </div>
  );
}
