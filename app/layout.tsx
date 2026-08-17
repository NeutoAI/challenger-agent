import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FrontDeskProvider } from "@/lib/store";
import { TopNav } from "@/components/TopNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Challenger School Berryessa — AI Front Desk (unofficial)",
  description: "Unofficial AI Front Desk prototype grounded in Challenger School Berryessa's published policies — not affiliated with Challenger School",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <FrontDeskProvider>
          <TopNav />
          <div className="flex-1 flex flex-col min-h-0">{children}</div>
        </FrontDeskProvider>
      </body>
    </html>
  );
}
