'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, Collapse, Input, Space, Tag, Typography } from 'antd';
import {
  BookOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import PageHeader from '@/components/admin/PageHeader';

const { Text } = Typography;

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
    <div className="mx-auto max-w-4xl">
      <PageHeader
        icon={<BookOutlined />}
        title="每日知识生成"
        description="使用 AI 模型自动生成 ELISA 与血清专业知识文章"
      />

      <Card className="mb-6">
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              <CalendarOutlined className="mr-1" />
              发布日期
            </label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              <ThunderboltOutlined className="mr-1" />
              自定义主题（可选）
            </label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="留空则 AI 自动选择主题"
            />
          </div>
        </div>

        <div className="mb-4 space-y-4">
          <div>
            <div className="mb-2 text-xs text-slate-500">ELISA 主题：</div>
            <div className="flex flex-wrap gap-2">
              {elisaTopics.map((t) => (
                <Tag.CheckableTag key={t} checked={topic === t} onChange={() => setTopic(t)}>
                  {t}
                </Tag.CheckableTag>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs text-slate-500">血清主题：</div>
            <div className="flex flex-wrap gap-2">
              {serumTopics.map((t) => (
                <Tag.CheckableTag key={t} checked={topic === t} onChange={() => setTopic(t)}>
                  {t}
                </Tag.CheckableTag>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            血清主题会按血清产品、细胞培养、检测基质和 COA 质控闭环生成，不会默认套用 ELISA 文章结构。
          </p>
        </div>

        <Space direction="vertical">
          <Button
            type="primary"
            size="large"
            icon={<ThunderboltOutlined />}
            loading={loading}
            onClick={handleGenerate}
          >
            {loading
              ? `${longformProvider === 'kimi' ? 'Kimi K3' : 'DeepSeek'} 正在生成文章... ${elapsedSeconds > 0 ? `${elapsedSeconds}s` : ''}`
              : '生成文章'}
          </Button>
          {loading && (
            <Text type="secondary" className="text-xs">
              正在生成并校验文章结构，长内容通常需要几十秒；无需刷新页面。
            </Text>
          )}
        </Space>
      </Card>

      {result && (
        <Card>
          {result.success ? (
            <>
              {result.ai && (
                <p className="mb-4 text-xs text-slate-500">
                  本次使用：{result.ai.provider === 'kimi' ? 'Kimi K3' : 'DeepSeek'}{result.ai.model ? `（${result.ai.model}）` : ''}
                  {result.ai.fallback_used ? '；主模型失败后切换了备用模型' : ''}
                </p>
              )}
              <Alert
                className="mb-4"
                type="success"
                showIcon
                message={<>生成成功（{result.topic}）</>}
              />

              {result.article && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-slate-50 p-4">
                    <h3 className="mb-2 text-lg font-bold text-slate-900">{result.article.title}</h3>
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <Tag color="blue">{result.article.category}</Tag>
                      <span>{result.article.publish_date}</span>
                    </div>
                    <p className="mb-4 text-sm text-slate-600">{result.article.summary}</p>

                    <Collapse
                      ghost
                      items={[
                        {
                          key: 'content',
                          label: <span className="text-sm">查看完整内容</span>,
                          children: (
                            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-600">
                              {result.article.content}
                            </pre>
                          ),
                        },
                      ]}
                    />
                  </div>

                  <Space wrap>
                    <Button
                      type="primary"
                      danger={saveStatus === 'error'}
                      loading={saveStatus === 'saving'}
                      disabled={saveStatus === 'saved'}
                      icon={
                        saveStatus === 'saved' ? (
                          <CheckCircleOutlined />
                        ) : saveStatus === 'error' ? (
                          <CloseCircleOutlined />
                        ) : (
                          <SaveOutlined />
                        )
                      }
                      onClick={handleSaveToDatabase}
                    >
                      {saveStatus === 'idle' && '保存到数据库'}
                      {saveStatus === 'saving' && '保存中...'}
                      {saveStatus === 'saved' && '已保存'}
                      {saveStatus === 'error' && '保存失败'}
                    </Button>

                    {saveStatus === 'saved' && (
                      <Text type="success">文章已发布到每日知识日历</Text>
                    )}
                    {saveStatus === 'error' && saveError && (
                      <Text type="danger">{saveError}</Text>
                    )}
                  </Space>
                </div>
              )}
            </>
          ) : (
            <Alert type="error" showIcon message={<>生成失败：{result.error || '未知错误'}</>} />
          )}
        </Card>
      )}
    </div>
  );
}
