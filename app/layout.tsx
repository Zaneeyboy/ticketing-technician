import type { Metadata } from 'next';
import { Barlow, Geist_Mono, Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { ToastProvider } from '@/lib/providers/toast-provider';
import { AppThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

// Inter — clean geometric sans-serif, closest Google Fonts match to CR's Proxima Nova
const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

// Barlow — semi-condensed bold display, closest match to CR's Placard Next
const barlow = Barlow({
  variable: '--font-playfair-display',
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  style: ['normal'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Caribbean Roasters | Field Service Platform',
  description: 'The unified service operations platform for Caribbean Roasters — manage tickets, technicians, machines, and multi-island reporting from one place.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={`${inter.variable} ${barlow.variable} ${geistMono.variable} antialiased`}>
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
