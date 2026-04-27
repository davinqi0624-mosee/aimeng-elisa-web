import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogOut, User } from "lucide-react";

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

  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="h-screen flex flex-col font-sans overflow-hidden">
        {/* Global Navigation */}
        <header className="shrink-0 bg-white border-b border-gray-200 px-4 py-2.5 z-30">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-blue-600 font-bold text-base">
              <span>艾萌 ELISA</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                首页
              </Link>
              <Link href="/knowledge" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                每日知识
              </Link>
              <Link href="/lab/experiment" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                实验方案
              </Link>
              <Link href="/lab/analysis" className="text-sm text-gray-600 hover:text-blue-600 transition-colors">
                数据分析
              </Link>
              {user ? (
                <div className="flex items-center gap-3 ml-2 pl-3 border-l border-gray-200">
                  <Link
                    href="/chat"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    AI 客服
                  </Link>
                  <span className="text-xs text-gray-500 hidden sm:inline">{user.email}</span>
                  <form action="/api/auth/signout" method="post">
                    <button
                      type="submit"
                      className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-3 h-3" />
                      退出
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-200">
                  <Link
                    href="/login"
                    className="text-sm text-gray-700 hover:text-blue-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    登录
                  </Link>
                  <Link
                    href="/register"
                    className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    注册
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
