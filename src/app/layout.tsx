import type { Metadata } from "next";
import { Suspense } from "react";
import { Figtree, Nunito_Sans } from "next/font/google";
import localFont from "next/font/local";
import { GlobalNavigationIndicator } from "@/components/ui/navigation-loading-indicator";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

// Glass portals (admin and tutor); applied through .theme-glass in
// globals.css. Not preloaded, so the other portals never download it.
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  preload: false,
});

// Admin portal only (`.theme-admin` in globals.css). Satoshi by Indian Type
// Foundry, from Fontshare (free for commercial use, https://fontshare.com/terms),
// self-hosted as the variable font so every weight from 300 to 900 exists.
const satoshi = localFont({
  src: "../fonts/Satoshi-Variable.woff2",
  variable: "--font-satoshi",
  weight: "300 900",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Taiyo Tuition - Student Portal",
  description:
    "The Taiyo Tuition student portal. Lessons, homework, progress and feedback in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunitoSans.variable} ${figtree.variable} ${satoshi.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-ink">
        <Suspense fallback={null}>
          <GlobalNavigationIndicator />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
