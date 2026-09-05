import type { Metadata } from "next";
import "./globals.css";
import AppChrome from "@/components/AppChrome";
import { getCurrentUser } from "@/lib/user-auth";
import { withService } from "@/lib/db/pg";

export const metadata: Metadata = {
  title: "AIMENG UNING | 爱萌优宁 - ELISA 试剂盒专家",
  description: "AIMENG UNING 爱萌优宁 — 专业 ELISA 试剂盒搜索、AI 实验设计与数据分析平台",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  let userRole: string | null = null;
  if (user) {
    try {
      const rows = await withService(async (tx) => {
        return tx<{ role: string | null }[]>`
          SELECT role FROM profiles WHERE id = ${user.id} LIMIT 1
        `
      });
      userRole = rows[0]?.role || null;
    } catch {
      userRole = null;
    }
  }
  const isAdmin = userRole === 'admin_l1' || userRole === 'admin_l2';

  return (
    <html lang="zh-CN" className="h-[100dvh] antialiased">
      <head>
        <link rel="preload" href="/legacy-fallback.css" as="style" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  try {
    var css = window.CSS;
    var supportsModernCss =
      css &&
      css.supports &&
      css.supports("height", "100dvh") &&
      css.supports("color", "oklch(60% 0.12 220)");
    if (supportsModernCss) return;
  } catch (error) {}

  var existing = document.querySelector('link[href="/legacy-fallback.css"][rel="stylesheet"]');
  if (existing) return;

  var link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/legacy-fallback.css";
  document.head.appendChild(link);
})();
            `.trim(),
          }}
        />
      </head>
      <body className="h-[100dvh] flex flex-col font-sans overflow-hidden">
        <AppChrome user={user} isAdmin={isAdmin}>
          {children}
        </AppChrome>
      </body>
    </html>
  );
}
