import type { Metadata } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { GlobalNavigationIndicator } from "@/components/ui/navigation-loading-indicator";
import "./globals.css";

// Satoshi by Indian Type Foundry, from Fontshare (free for commercial use,
// https://fontshare.com/terms): the font of every portal and the sign-in
// pages. Self-hosted as the variable font so every weight from 300 to 900
// exists.
const satoshi = localFont({
  src: "../fonts/Satoshi-Variable.woff2",
  variable: "--font-satoshi",
  weight: "300 900",
  display: "swap",
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
      className={`${satoshi.variable} h-full antialiased`}
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
