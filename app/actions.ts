'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addUser(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('请先登录')
  }

  const email = formData.get('email') as string
  const name = formData.get('name') as string

  const { error } = await supabase.from('users').insert({
    id: user.id,
    email,
    name,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/')
}
