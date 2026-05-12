import type { Metadata } from "next";
import "./globals.css";
import Web3ProviderWrapper from "../components/Web3Provider";

export const metadata: Metadata = {
  title: "The Iron Ledger",
  description: "Autonomous Arbitration and Escrow Protocol",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Web3ProviderWrapper>{children}</Web3ProviderWrapper>
      </body>
    </html>
  );
}