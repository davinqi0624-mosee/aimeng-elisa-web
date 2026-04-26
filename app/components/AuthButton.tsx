'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AuthModal from './AuthModal'

interface AuthButtonProps {
  user?: {
    email?: string | null
  } | null
}

export default function AuthButton({ user }: AuthButtonProps) {
  const [showModal, setShowModal] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <>
      <div className="absolute top-6 right-6 flex items-center gap-4">
        {user ? (
          <>
            <span className="text-sm text-gray-600">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            >
              退出
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            登录 / 注册
          </button>
        )}
      </div>
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </>
  )
}
