import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { ToastProvider } from '@/lib/providers/toast-provider';
import { AppThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Tech Dynamics Ticketing System',
  description: 'Technician ticketing and service management system',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppThemeProvider>
          <TooltipProvider>
            <AuthProvider>
              <ToastProvider />
              {children}
            </AuthProvider>
          </TooltipProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
