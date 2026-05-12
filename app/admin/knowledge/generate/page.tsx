'use client';

import { useState } from 'react';
import { Sparkles, Calendar, Loader2, BookOpen, CheckCircle, AlertCircle } from 'lucide-react';

interface GenerateResult {
  success: boolean;
  article?: {
    title: string;
    category: string;
    tags: string[];
    summary: string;
    content: string;
    publish_date: string;
  };
  topic?: string;
  error?: string;
}

export default function AdminKnowledgePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const presetTopics = [
    'ELISA 标准品稀释技巧与常见错误',
    '夹心法 ELISA 捕获抗体包被条件优化',
    'TMB 显色时间与终止液使用要点',
    'ELISA 样本前处理：血清 vs 血浆 vs 细胞培养上清',
    '标准曲线拟合：4PL vs Linear 的选择策略',
    'ELISA 高背景值的 6 大原因与排查方法',
    '复孔 CV 值超标怎么办？',
    'ELISA 试剂盒开封后的保存期限与注意事项',
    '竞争法 ELISA 的原理与适用场景',
    '间接法 ELISA 的优缺点与优化建议',
    'ELISA 实验中的移液技巧与误差控制',
    '洗涤步骤：为什么是最关键的环节？',
    'ELISA 结果判读：OD 值异常的处理方法',
    '96T vs 48T 试剂盒：如何选择更经济？',
  ];

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    setSaveStatus('idle');

    try {
      const res = await fetch('/api/knowledge/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, topic: topic || undefined }),
      });

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!result?.article) return;
    setSaveStatus('saving');

    try {
      const res = await fetch('/api/knowledge/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.article),
      });

      if (res.ok) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      setSaveStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-400" />
            每日知识生成
          </h1>
          <p className="text-slate-400">使用 DeepSeek AI 自动生成 ELISA 专业知识文章</p>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                发布日期
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Sparkles className="w-4 h-4 inline mr-1" />
                自定义主题（可选）
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="留空则 AI 自动选择主题"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-slate-500 mb-2">快速选择主题：</label>
            <div className="flex flex-wrap gap-2">
              {presetTopics.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    topic === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                生成文章
              </>
            )}
          </button>
        </div>

        {result && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            {result.success ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-medium">生成成功</span>
                  <span className="text-slate-500 text-sm">({result.topic})</span>
                </div>

                {result.article && (
                  <div className="space-y-4">
                    <div className="bg-slate-800 rounded-lg p-4">
                      <h3 className="text-lg font-bold text-white mb-2">{result.article.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                        <span className="px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 text-xs">
                          {result.article.category}
                        </span>
                        <span>{result.article.publish_date}</span>
                      </div>
                      <p className="text-slate-300 text-sm mb-4">{result.article.summary}</p>
                      
                      <details className="group">
                        <summary className="text-sm text-blue-400 cursor-pointer hover:text-blue-300 transition-colors">
                          查看完整内容
                        </summary>
                        <div className="mt-3 p-3 bg-slate-950 rounded-lg overflow-auto max-h-96">
                          <pre className="text-xs text-slate-300 whitespace-pre-wrap">{result.article.content}</pre>
                        </div>
                      </details>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleSaveToDatabase}
                        disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                        className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors ${
                          saveStatus === 'saved'
                            ? 'bg-green-600 text-white'
                            : saveStatus === 'error'
                            ? 'bg-red-600 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saveStatus === 'saved' && <CheckCircle className="w-4 h-4" />}
                        {saveStatus === 'error' && <AlertCircle className="w-4 h-4" />}
                        {saveStatus === 'idle' && '保存到数据库'}
                        {saveStatus === 'saving' && '保存中...'}
                        {saveStatus === 'saved' && '已保存'}
                        {saveStatus === 'error' && '保存失败'}
                      </button>

                      {saveStatus === 'saved' && (
                        <span className="text-sm text-green-400">
                          文章已发布到每日知识日历
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>生成失败：{result.error || '未知错误'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}