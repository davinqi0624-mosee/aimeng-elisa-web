'use client';

import { useEffect, useState } from 'react';
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
  ai?: {
    provider: 'deepseek' | 'kimi';
    model?: string;
    fallback_used?: boolean;
  };
  error?: string;
}

interface ApiErrorResponse {
  error?: string;
  message?: string;
  details?: string;
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function isCompleteArticle(article: GenerateResult['article']) {
  return Boolean(
    article &&
      article.title?.trim() &&
      article.publish_date?.trim() &&
      article.content?.trim().length >= 120
  );
}

export default function AdminKnowledgePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [longformProvider, setLongformProvider] = useState<'deepseek' | 'kimi'>('deepseek');

  useEffect(() => {
    fetch('/api/admin/ai-model-settings')
      .then((res) => res.json())
      .then((data) => {
        const provider = data?.settings?.longform_provider;
        if (provider === 'deepseek' || provider === 'kimi') setLongformProvider(provider);
      })
      .catch(() => {
        // The generation API remains the source of truth if the status read fails.
      });
  }, []);

  useEffect(() => {
    if (!loading) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [loading]);

  const elisaTopics = [
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

  const serumTopics = [
    '四环素阴性血清的应用场景',
    '低内毒素胎牛血清适合哪些细胞培养',
    '透析胎牛血清的适用实验',
    '活性炭处理胎牛血清的选择要点',
    '无外泌体胎牛血清使用注意事项',
    '胎牛血清批次筛选为什么重要',
    '热灭活胎牛血清什么时候需要使用',
    '胎牛血清 COA 重点看哪些指标',
  ];

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    setSaveStatus('idle');
    setElapsedSeconds(0);

    try {
      const res = await fetch('/api/knowledge/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, topic: topic || undefined }),
      });

      const data = await res.json().catch(() => ({})) as GenerateResult & ApiErrorResponse;
      if (!res.ok) {
        setResult({ success: false, error: data.details || data.message || data.error || '生成失败，请稍后重试' });
        return;
      }
      if (!data.success || !isCompleteArticle(data.article)) {
        setResult({
          success: false,
          error: data.error || 'AI 未返回完整正文，未保存到知识库。请重新生成。',
        });
        return;
      }
      setResult(data);
    } catch (err: unknown) {
      setResult({ success: false, error: getErrorMessage(err, '生成失败，请稍后重试') });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!result?.article) return;
    if (!isCompleteArticle(result.article)) {
      setSaveError('生成结果正文为空或不完整，未尝试保存。请重新生成文章。');
      setSaveStatus('error');
      return;
    }
    setSaveStatus('saving');
    setSaveError('');

    try {
      const res = await fetch('/api/knowledge/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.article),
      });

      if (res.ok) {
        setSaveStatus('saved');
      } else {
        const data = await res.json().catch(() => null) as ApiErrorResponse | null;
        setSaveError(data?.details || data?.message || data?.error || '保存失败，请稍后重试');
        setSaveStatus('error');
      }
    } catch (err: unknown) {
      setSaveError(getErrorMessage(err, '保存失败，请稍后重试'));
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
          <p className="text-slate-400">使用 AI 模型自动生成 ELISA 与血清专业知识文章</p>
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

          <div className="mb-4 space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-2">ELISA 主题：</label>
              <div className="flex flex-wrap gap-2">
                {elisaTopics.map((t) => (
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
            <div>
              <label className="block text-xs text-slate-500 mb-2">血清主题：</label>
              <div className="flex flex-wrap gap-2">
                {serumTopics.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      topic === t
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500">
              血清主题会按血清产品、细胞培养、检测基质和 COA 质控闭环生成，不会默认套用 ELISA 文章结构。
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {longformProvider === 'kimi' ? 'Kimi K3' : 'DeepSeek'} 正在生成文章... {elapsedSeconds > 0 ? `${elapsedSeconds}s` : ''}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                生成文章
              </>
            )}
          </button>
          {loading && (
            <p className="mt-3 text-xs text-slate-400">
              正在生成并校验文章结构，长内容通常需要几十秒；无需刷新页面。
            </p>
          )}
        </div>

        {result && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            {result.success ? (
              <>
                {result.ai && (
                  <p className="mb-4 text-xs text-slate-400">
                    本次使用：{result.ai.provider === 'kimi' ? 'Kimi K3' : 'DeepSeek'}{result.ai.model ? `（${result.ai.model}）` : ''}
                    {result.ai.fallback_used ? '；主模型失败后切换了备用模型' : ''}
                  </p>
                )}
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
                      {saveStatus === 'error' && saveError && (
                        <span className="text-sm text-red-400">
                          {saveError}
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
