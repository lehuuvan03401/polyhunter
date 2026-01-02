import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Polymarket Pro - Advanced Trading Dashboard",
  description: "Professional trading dashboard for Polymarket prediction markets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} elegant-grid min-h-screen`}>
        <Providers>
          <Navbar />
          <main className="pt-20 px-4 md:px-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
