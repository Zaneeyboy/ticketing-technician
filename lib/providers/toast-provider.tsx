'use client';

import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position='top-right'
      closeButton
      theme='system'
      duration={4000}
      toastOptions={{
        classNames: {
          toast: 'bg-card text-card-foreground border border-border shadow-sm rounded-lg text-sm font-sans',
          title: 'font-medium text-card-foreground',
          description: 'text-muted-foreground text-xs mt-0.5',
          closeButton: 'bg-card border border-border text-muted-foreground hover:text-foreground',
          success: 'border-l-4 border-l-emerald-500',
          error: 'border-l-4 border-l-destructive',
          warning: 'border-l-4 border-l-amber-500',
          info: 'border-l-4 border-l-primary',
          loading: 'border-l-4 border-l-muted-foreground',
        },
      }}
      icons={{
        success: <CheckCircle2 className='h-4 w-4 text-emerald-500' />,
        error: <XCircle className='h-4 w-4 text-destructive' />,
        warning: <AlertTriangle className='h-4 w-4 text-amber-500' />,
        info: <Info className='h-4 w-4 text-primary' />,
        loading: <Loader2 className='h-4 w-4 text-muted-foreground animate-spin' />,
      }}
    />
  );
}
