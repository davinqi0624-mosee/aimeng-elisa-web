import 'server-only'

// 可插拔邮件层：EMAIL_PROVIDER = 'smtp' | 缺省 'none'
// - none：不发邮件。注册自动完成验证；密码重置走管理员后台设置初始密码。
// - smtp：配置 SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM 后自动生效。
// - directmail（阿里云邮件推送）：预留，凭据就绪后补驱动。

export type EmailSendResult = { sent: boolean; reason?: string }

const SITE_NAME = '爱萌优宁 ELISA 科研平台'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://animaluni.com'

export function isEmailEnabled(): boolean {
  return process.env.EMAIL_PROVIDER === 'smtp'
}

async function sendViaSmtp(to: string, subject: string, html: string): Promise<EmailSendResult> {
  try {
    const nodemailer = (await import('nodemailer')).default
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    })
    return { sent: true }
  } catch (error) {
    console.error('[email] smtp send failed', error)
    return { sent: false, reason: 'smtp_error' }
  }
}

function wrap(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f2f6fa;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:8px;padding:32px;color:#1e293b;">
    <p style="font-size:12px;letter-spacing:.28em;color:#0f766e;font-weight:600;margin:0 0 16px;">${SITE_NAME}</p>
    <h2 style="font-size:18px;margin:0 0 16px;">${title}</h2>
    ${bodyHtml}
    <p style="font-size:12px;color:#64748b;margin-top:32px;">若非本人操作，请忽略本邮件。链接过期后自动失效。</p>
  </div></body></html>`
}

export async function sendVerificationEmail(
  to: string,
  fullName: string,
  token: string
): Promise<EmailSendResult> {
  if (!isEmailEnabled()) return { sent: false, reason: 'email_disabled' }
  const link = `${SITE_URL}/auth/verify?token=${encodeURIComponent(token)}`
  const name = fullName ? `${fullName}，您好` : '您好'
  return sendViaSmtp(
    to,
    `【${SITE_NAME}】请完成邮箱验证`,
    wrap(
      '完成邮箱验证',
      `<p>${name}：</p>
       <p>感谢注册${SITE_NAME}。点击下方按钮完成邮箱验证，验证后将获得 50 积分：</p>
       <p style="margin:24px 0;"><a href="${link}" style="background:#0f766e;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;display:inline-block;">验证邮箱</a></p>
       <p style="font-size:13px;color:#64748b;">链接 24 小时内有效。如按钮无法点击，请复制：<br>${link}</p>`
    )
  )
}

export async function sendPasswordResetEmail(
  to: string,
  fullName: string,
  token: string
): Promise<EmailSendResult> {
  if (!isEmailEnabled()) return { sent: false, reason: 'email_disabled' }
  const link = `${SITE_URL}/reset-password?token=${encodeURIComponent(token)}`
  const name = fullName ? `${fullName}，您好` : '您好'
  return sendViaSmtp(
    to,
    `【${SITE_NAME}】重置密码`,
    wrap(
      '重置您的密码',
      `<p>${name}：</p>
       <p>我们收到了重置密码的请求。点击下方按钮设置新密码：</p>
       <p style="margin:24px 0;"><a href="${link}" style="background:#0f766e;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;display:inline-block;">重置密码</a></p>
       <p style="font-size:13px;color:#64748b;">链接 30 分钟内有效、仅可使用一次。如按钮无法点击，请复制：<br>${link}</p>`
    )
  )
}
