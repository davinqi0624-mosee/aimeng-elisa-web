import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import AppChrome from "@/components/AppChrome";

export const metadata: Metadata = {
  title: "AIMENG UNING | 爱萌优宁 - ELISA 试剂盒专家",
  description: "AIMENG UNING 爱萌优宁 — 专业 ELISA 试剂盒搜索、AI 实验设计与数据分析平台",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userRole: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    userRole = profile?.role || null;
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
