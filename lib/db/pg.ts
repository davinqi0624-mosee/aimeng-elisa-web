import postgres from 'postgres'
import 'server-only'

// 直连 Postgres 数据层（Supabase pooler / 未来 RDS 同一连接串）。
// 只暴露 withUser / withService 两个入口，不导出裸连接池，防止绕过身份注入误用。
//
// withUser：事务内 SET LOCAL ROLE app_user（RLS 生效、无 BYPASSRLS）+
//   set_config('request.jwt.claims', '{"sub":...}', true)（事务级，连接归还池时自动清除）。
//   行级安全由 DB 策略（app_uid() = user_id）强制，应用层过滤仅作展示用途。
// withService：服务端事务（postgres 角色），用于认证流程、令牌等自身表的读写。

let pool: ReturnType<typeof postgres> | null = null

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL 未配置，直连数据层不可用（fail-closed）。')
  }
  if (!pool) {
    pool = postgres(process.env.DATABASE_URL, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
      onnotice: () => {},
    })
  }
  return pool
}

export async function withUser<T>(userId: string, fn: (tx: postgres.Sql) => Promise<T>): Promise<T> {
  const p = getPool()
  const result = await p.begin(async (tx) => {
    await tx.unsafe('SET LOCAL ROLE app_user')
    await tx.unsafe(
      "SELECT set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: userId, role: 'authenticated' })]
    )
    return fn(tx as unknown as postgres.Sql)
  })
  return result as unknown as T
}

export async function withService<T>(fn: (tx: postgres.Sql) => Promise<T>): Promise<T> {
  const p = getPool()
  const result = await p.begin(async (tx) => fn(tx as unknown as postgres.Sql))
  return result as unknown as T
}

// 非事务的服务端查询（只读场景，避免不必要的事务开销）
export function serviceQuery() {
  return getPool()
}
