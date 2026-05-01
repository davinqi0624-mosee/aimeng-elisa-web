'use client'

import { LogOut } from 'lucide-react'

export default function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      onClick={async () => {
        await fetch('/api/auth/signout', { method: 'POST' })
        window.location.href = '/'
      }}
      className={className}
    >
      <LogOut className="w-3 h-3" />
      退出
    </button>
  )
}
