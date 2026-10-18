import type { Metadata } from "next";
import "./globals.css";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Project M — Indian market intelligence, powered by NSE data and AI",
  description:
    "AI-native Indian stock market intelligence platform. Live NSE market data, stock analysis, comparisons, quant screens and an AI analyst.",
};

const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('nsei-theme');document.documentElement.dataset.theme=(t==='light')?'light':'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-screen">
        <AppShell>
          <Sidebar />
          <div className="md:pl-56">{children}</div>
          <MobileNav />
        </AppShell>
      </body>
    </html>
  );
}
