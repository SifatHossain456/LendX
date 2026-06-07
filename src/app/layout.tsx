import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "LendX — Collateralized Lending Protocol",
  description:
    "Supply WETH collateral, borrow USDC, and earn yield on Base Sepolia. " +
    "A production-grade DeFi lending protocol for learning.",
  keywords: ["DeFi", "lending", "collateral", "WETH", "USDC", "Base Sepolia"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <Navbar />
          {/* Page content offset for fixed navbar */}
          <main className="pt-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
