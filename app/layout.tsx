import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELISA 生态网站 - 专业试剂盒搜索平台",
  description: "ELISA 试剂盒搜索、采购与技术服务平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
