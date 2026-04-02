import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import { SessionProvider } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',   // non-blocking font load
  preload: true,
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'TravelAI – AI-Powered Trip Planner',
  description: 'Plan your perfect trip with AI-generated itineraries, real-time weather, route maps, and travel news.',
  keywords: ['travel planner', 'AI trip planner', 'itinerary generator', 'route map', 'travel AI'],
  openGraph: {
    title: 'TravelAI – AI-Powered Trip Planner',
    description: 'Plan your perfect trip with AI-generated itineraries.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        <SessionProvider>
          <Navbar />
          <main>{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
