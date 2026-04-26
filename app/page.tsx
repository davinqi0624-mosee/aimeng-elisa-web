import { createClient } from '@/lib/supabase/server'
import { addUser } from './actions'
import AuthButton from './components/AuthButton'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let users = null
  if (user) {
    const { data } = await supabase.from('users').select('*')
    users = data
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 gap-8 relative">
      <AuthButton user={user} />

      <h1 className="text-4xl font-bold">Users</h1>

      {!user ? (
        <div className="text-center text-gray-500">
          <p className="text-lg">请先登录以查看和添加用户</p>
        </div>
      ) : (
        <>
          <div className="w-full max-w-md">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2">Email</th>
                  <th className="border p-2">Name</th>
                  <th className="border p-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id}>
                    <td className="border p-2">{u.email}</td>
                    <td className="border p-2">{u.name || '-'}</td>
                    <td className="border p-2">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {(!users || users.length === 0) && (
                  <tr>
                    <td colSpan={3} className="border p-4 text-center text-gray-500">
                      暂无数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <form action={addUser} className="w-full max-w-md flex flex-col gap-4">
            <h2 className="text-xl font-semibold">添加 User</h2>
            <input
              name="email"
              type="email"
              placeholder="Email"
              required
              className="border p-2 rounded"
            />
            <input
              name="name"
              placeholder="Name"
              className="border p-2 rounded"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
            >
              添加
            </button>
          </form>
        </>
      )}
    </main>
  )
}
