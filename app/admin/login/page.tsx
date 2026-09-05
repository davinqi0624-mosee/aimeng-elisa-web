'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, Card, Form, Input, App } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import TurnstileWidget from '@/components/security/TurnstileWidget'

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

interface LoginForm {
  username: string
  password: string
}

export default function AdminLoginPage() {
  const { message } = App.useApp()
  const [turnstileToken, setTurnstileToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<LoginForm>()

  const handleLogin = async (values: LoginForm) => {
    if (turnstileSiteKey && !turnstileToken) {
      message.warning('请先完成人机验证')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, turnstileToken })
      })
      const data = await res.json()
      if (data.success) {
        window.location.href = '/admin'
      } else {
        message.error(data.error || '用户名或密码错误')
      }
    } catch {
      message.error('登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: 'linear-gradient(135deg, #e8f5f8 0%, #f7fafc 55%, #eef7f2 100%)' }}>
      <div className="w-full max-w-md mx-4">
        <Card variant="borderless" className="shadow-lg">
          <div className="mb-8 text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl"
              style={{ background: '#177E97' }}
            >
              <LockOutlined className="text-2xl text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">AIMENG UNING</h1>
            <p className="mt-1 text-sm text-slate-500">管理后台 · 管理员登录</p>
          </div>

          <Form<LoginForm>
            form={form}
            layout="vertical"
            onFinish={handleLogin}
            autoComplete="off"
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input size="large" placeholder="请输入用户名" prefix={<UserOutlined />} />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password size="large" placeholder="请输入密码" prefix={<LockOutlined />} />
            </Form.Item>

            {turnstileSiteKey && (
              <div className="mb-4 flex justify-center">
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  action="admin_login"
                  onTokenChange={setTurnstileToken}
                  className="flex justify-center"
                />
              </div>
            )}

            <Button type="primary" size="large" block htmlType="submit" loading={loading}>
              登录
            </Button>
          </Form>
        </Card>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-slate-500 transition-colors hover:text-slate-700">
            返回网站首页
          </Link>
        </div>
      </div>
    </div>
  )
}
