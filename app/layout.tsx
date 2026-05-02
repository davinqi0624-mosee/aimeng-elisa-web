import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/ui/Navbar";

export const metadata: Metadata = {
  title: "爱萌优宁 - AI 驱动的 ELISA 试剂盒平台",
  description: "专业 ELISA 试剂盒搜索、AI 实验设计与数据分析平台",
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
      <body className="h-[100dvh] flex flex-col font-sans overflow-hidden">
        <Navbar user={user} isAdmin={isAdmin} />
        <div className="flex-1 min-h-0 overflow-auto bg-white">
          {children}
        </div>
      </body>
    </html>
  );
}
