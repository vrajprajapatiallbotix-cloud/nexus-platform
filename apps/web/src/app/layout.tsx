import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { RealtimeProvider } from '@/providers/realtime-provider';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Nexus Platform — AI-Powered Productivity & Collaboration',
    template: '%s | Nexus Platform',
  },
  description: 'The all-in-one AI-powered workspace for modern teams. Tasks, projects, chat, docs, CRM, HR, and more.',
  keywords: ['project management', 'task management', 'AI assistant', 'team collaboration', 'productivity'],
  authors: [{ name: 'Nexus Platform' }],
  creator: 'Nexus Platform',
  metadataBase: new URL(process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://app.nexusplatform.io'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Nexus Platform',
    description: 'AI-Powered Productivity & Collaboration Platform',
    siteName: 'Nexus Platform',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexus Platform',
    description: 'AI-Powered Productivity & Collaboration Platform',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <AuthProvider>
              <RealtimeProvider>
                {children}
                <Toaster
                  position="bottom-right"
                  expand
                  richColors
                  closeButton
                  toastOptions={{
                    duration: 4000,
                    classNames: {
                      toast: 'font-sans',
                    },
                  }}
                />
              </RealtimeProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
