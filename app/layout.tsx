import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Notes",
  description: "面向大学生的生长式 AI 知识系统校赛 Demo",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
