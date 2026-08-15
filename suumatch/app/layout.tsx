import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SUUMATCH",
  description: "Find Tokyo stations within your ideal commute time.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
