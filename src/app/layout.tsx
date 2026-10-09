import type { Metadata } from "next";
import { Suspense } from "react";
import { Nunito_Sans } from "next/font/google";
import { GlobalNavigationIndicator } from "@/components/ui/navigation-loading-indicator";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
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
      className={`${nunitoSans.variable} h-full antialiased`}
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
