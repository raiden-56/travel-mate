import type { Metadata, Viewport } from "next";
// Fonts are self-hosted from npm: no build-time or runtime requests to third-party font CDNs.
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import { Providers } from "@/components/providers";
import { DemoBanner } from "@/components/layout/demo-banner";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "TravelMate — Your entire journey. One place.", template: "%s · TravelMate" },
  description:
    "Discover destinations, plan day-by-day itineraries, map your route, track your budget and pack smarter — all in one travel companion.",
  openGraph: { siteName: "TravelMate", type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F3EB" },
    { media: "(prefers-color-scheme: dark)", color: "#161A17" },
  ],
};

// Applies the saved theme before paint to avoid a flash. Light is the default.
const themeScript = `try{var t=localStorage.getItem('tm-theme');if(t==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <Providers>
          <DemoBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
