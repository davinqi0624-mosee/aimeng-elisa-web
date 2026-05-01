import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogOut, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "ELISA 生态网站 - 专业试剂盒搜索平台",
  description: "ELISA 试剂盒搜索、采购与技术服务平台",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 查询用户角色（如果有）
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
        {/* Global Navigation */}
        <header className="shrink-0 bg-white border-b border-gray-200 px-4 py-2.5 z-30">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-blue-600 font-bold text-base shrink-0">
              <span>爱萌优宁</span>
            </Link>
            <nav className="flex items-center gap-4 overflow-x-auto whitespace-nowrap">
              <Link href="/" className="text-sm text-gray-600 hover:text-blue-600 transition-colors shrink-0">
                首页
              </Link>
              <Link href="/knowledge" className="text-sm text-gray-600 hover:text-blue-600 transition-colors shrink-0">
                每日知识
              </Link>
              <Link href="/lab/experiment" className="text-sm text-gray-600 hover:text-blue-600 transition-colors shrink-0">
                实验方案
              </Link>
              <Link href="/lab/analysis" className="text-sm text-gray-600 hover:text-blue-600 transition-colors shrink-0">
                数据分析
              </Link>
              <Link href="/citations" className="text-sm text-gray-600 hover:text-blue-600 transition-colors shrink-0">
                文献
              </Link>
              {user && (
                <Link href="/user/citations/submit" className="text-sm text-indigo-600 hover:text-indigo-700 transition-colors shrink-0 font-medium">
                  + 投稿
                </Link>
              )}
              <Link href="/store" className="text-sm text-gray-600 hover:text-blue-600 transition-colors shrink-0">
                积分商城
              </Link>
              <Link href="/datasheet" className="text-sm text-gray-600 hover:text-blue-600 transition-colors shrink-0">
                说明书
              </Link>
              {user ? (
                <div className="flex items-center gap-3 ml-2 pl-3 border-l border-gray-200">
                  <Link
                    href="/chat"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 shrink-0"
                  >
                    AI 客服
                  </Link>
                  <Link
                    href="/member"
                    className="text-sm text-gray-600 hover:text-blue-600 transition-colors hidden sm:inline"
                  >
                    会员中心
                  </Link>
                  <Link
                    href="/leaderboard"
                    className="text-sm text-gray-600 hover:text-blue-600 transition-colors hidden sm:inline"
                  >
                    排行榜
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 transition-colors shrink-0"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      后台
                    </Link>
                  )}
                  <span className="text-xs text-gray-500 hidden sm:inline">{(user.user_metadata as any)?.full_name || user.email}</span>
                  <button
                    onClick={async () => {
                      await fetch('/api/auth/signout', { method: 'POST' })
                      window.location.href = '/'
                    }}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors shrink-0"
                  >
                    <LogOut className="w-3 h-3" />
                    退出
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-200">
                  <Link
                    href="/login"
                    className="text-sm text-gray-700 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
                  >
                    登录
                  </Link>
                  <Link
                    href="/register"
                    className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                  >
                    注册
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 min-h-0 overflow-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
