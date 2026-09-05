'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Alert, Button, Card, Form, Input, Spin } from 'antd'
import { ArrowLeftOutlined, EyeInvisibleOutlined, EyeOutlined, KeyOutlined } from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

interface ChangePasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export default function AdminChangePasswordPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form] = Form.useForm<ChangePasswordForm>()

  useEffect(() => {
    fetch('/api/admin/me')
      .then((res) => {
        if (!res.ok) router.replace('/admin/login')
      })
      .catch(() => router.replace('/admin/login'))
      .finally(() => setLoading(false))
  }, [router])

  async function handleSubmit(values: ChangePasswordForm) {
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
          confirmPassword: values.confirmPassword,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || '修改密码失败')
        return
      }

      setSuccess(data.message || '密码已修改，请重新登录')
      form.resetFields()
      window.setTimeout(() => router.replace('/admin/login'), 1200)
    } catch {
      setError('无法连接服务器，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Link href="/admin" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700">
        <ArrowLeftOutlined />
        返回后台
      </Link>

      <PageHeader icon={<KeyOutlined />} title="修改管理员密码" description="修改后需要使用新密码重新登录后台。" />

      <Card>
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
        {success && <Alert type="success" showIcon message={success} style={{ marginBottom: 16 }} />}

        <Form<ChangePasswordForm>
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            name="currentPassword"
            label="当前密码"
            rules={[
              { required: true, message: '请输入当前密码' },
              { min: 8, message: '密码长度不能少于 8 位' },
            ]}
          >
            <Input size="large" type={showPassword ? 'text' : 'password'} placeholder="请输入当前密码" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码长度不能少于 8 位' },
            ]}
          >
            <Input size="large" type={showPassword ? 'text' : 'password'} placeholder="请输入新密码" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            rules={[
              { required: true, message: '请再次输入新密码' },
              { min: 8, message: '密码长度不能少于 8 位' },
            ]}
          >
            <Input size="large" type={showPassword ? 'text' : 'password'} placeholder="请再次输入新密码" />
          </Form.Item>

          <Button
            type="text"
            size="small"
            icon={showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setShowPassword((value) => !value)}
            style={{ marginBottom: 16 }}
          >
            {showPassword ? '隐藏密码' : '显示密码'}
          </Button>

          <Button type="primary" size="large" block htmlType="submit" loading={submitting}>
            确认修改
          </Button>
        </Form>
      </Card>
    </div>
  )
}
