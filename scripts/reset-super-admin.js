/**
 * 重置超级管理员密码脚本
 *
 * 用法:
 *   node scripts/reset-super-admin.js [新密码]
 *
 * 默认重置为: admin123
 */
const { createClient } = require('@supabase/supabase-js')
const bcrypt = require('bcryptjs')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TARGET_USERNAME = 'admin-super1'
const DEFAULT_PASSWORD = 'admin123'

async function main() {
  const newPassword = process.argv[2] || DEFAULT_PASSWORD

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('错误: 缺少环境变量 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
    console.error('请确保在项目根目录运行，或手动导出变量：')
    console.error('  export SUPABASE_URL=https://your-project.supabase.co')
    console.error('  export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 先查询现有超级管理员
  const { data: account, error: fetchErr } = await supabase
    .from('admin_accounts')
    .select('id, username, role, display_name')
    .eq('role', 'super')
    .maybeSingle()

  if (fetchErr) {
    console.error('查询失败:', fetchErr.message)
    process.exit(1)
  }

  if (!account) {
    console.error('错误: 未找到超级管理员账号')
    console.log('尝试查找所有管理员账号...')
    const { data: all } = await supabase.from('admin_accounts').select('id, username, role')
    console.log(all)
    process.exit(1)
  }

  console.log('找到账号:', account.username, '(role:', account.role + ')')

  const passwordHash = await bcrypt.hash(newPassword, 10)

  const { error: updateErr } = await supabase
    .from('admin_accounts')
    .update({ password_hash: passwordHash })
    .eq('id', account.id)

  if (updateErr) {
    console.error('更新密码失败:', updateErr.message)
    process.exit(1)
  }

  console.log('密码重置成功!')
  console.log('  用户名:', account.username)
  console.log('  新密码:', newPassword)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
