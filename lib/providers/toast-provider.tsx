'use client';

import { Toaster } from 'sonner';

export function ToastProvider() {
  return (
    <Toaster
      position='top-right'
      richColors
      closeButton
      expand
      theme='system'
      duration={4000}
      toastOptions={{
        style: {
          borderRadius: '0.5rem',
          padding: '1rem',
          fontSize: '0.875rem',
          border: '1px solid',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        },
        className: 'animate-fade-in',
      }}
      icons={{
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ',
      }}
    />
  );
}
