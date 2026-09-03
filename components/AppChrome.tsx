'use client'

import { usePathname } from 'next/navigation'
import Navbar from '@/components/ui/Navbar'
import AiChatBot from '@/components/product/AiChatBot'
import DailyCheckIn from '@/components/points/DailyCheckIn'

interface AppChromeProps {
  children: React.ReactNode
  user?: {
    id?: string
    email?: string
    user_metadata?: {
      full_name?: string
    }
  } | null
  isAdmin?: boolean
}

export default function AppChrome({ children, user, isAdmin }: AppChromeProps) {
  const pathname = usePathname()
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
  const hideFloatingAssistant =
    pathname === '/chat' ||
    pathname.startsWith('/chat/') ||
    pathname === '/ai-chat' ||
    pathname.startsWith('/ai-chat/')

  if (isAdminRoute) {
    return (
      <div className="flex-1 min-h-0 overflow-hidden bg-slate-950">
        {children}
        <DailyCheckIn userId={user?.id} />
      </div>
    )
  }

  return (
    <>
      <Navbar user={user} isAdmin={isAdmin} />
      <div className="flex-1 min-h-0 overflow-auto bg-white">
        {children}
      </div>
      {!hideFloatingAssistant && <AiChatBot />}
      <DailyCheckIn userId={user?.id} />
    </>
  )
}
