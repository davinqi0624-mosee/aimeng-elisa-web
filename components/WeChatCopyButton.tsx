'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

interface WeChatCopyButtonProps {
  title: string;
  content: string;
  category: string;
  publishDate: string;
  summary?: string;
}

export default function WeChatCopyButton({
  title,
  content,
  category,
  publishDate,
  summary,
}: WeChatCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const formatForWeChat = () => {
    let formatted = content;

    formatted = formatted.replace(/^##\s+(.+)$/gm, '\n🔬 $1\n');
    formatted = formatted.replace(/^###\s+(.+)$/gm, '\n▸ $1\n');
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '$1');
    formatted = formatted.replace(/^-\s+(.+)$/gm, '• $1');
    formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, '• $1');
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    const wechatText = `${title}

📅 ${publishDate} | ${category}
${summary ? `\n${summary}\n` : ''}
${formatted}

——
🧪 本文内容由 AIMENG UNING（爱萌优宁）ELISA 技术团队原创整理
🛒 访问 aimeng-elisa-web.vercel.app 搜索 3,484+ 款试剂盒
📖 每日学习一点 ELISA 专业知识，让实验更精准`;

    return wechatText;
  };

  const handleCopy = async () => {
    try {
      const text = formatForWeChat();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = formatForWeChat();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
        transition-all duration-200 border
        ${
          copied
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm'
        }
      `}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          <span>已复制公众号文案</span>
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          <span>复制公众号文案</span>
        </>
      )}
    </button>
  );
}