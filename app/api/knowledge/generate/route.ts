import { NextRequest } from 'next/server';
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { chatCompletion } from '@/lib/ai/llm'
import { getAiModelSettings, getProviderForAiTask, type AiProvider } from '@/lib/ai/model-settings'

type KnowledgeDomain = 'elisa' | 'serum';

interface GeneratedArticle {
  title?: string;
  category?: string;
  tags?: unknown;
  summary?: string;
  content?: string;
  [key: string]: unknown;
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isUsableArticle(article: GeneratedArticle) {
  return cleanText(article.title).length > 0 && cleanText(article.content).length >= 120
}

function detectKnowledgeDomain(topic: string): KnowledgeDomain {
  return /血清|胎牛|FBS|四环素|阴性血清|无外泌体|外泌体|透析血清|活性炭|低IgG|热灭活|内毒素|支原体|动物血|血制品|细胞培养/i.test(topic)
    ? 'serum'
    : 'elisa';
}

function getSystemPrompt(domain: KnowledgeDomain) {
  if (domain === 'serum') {
    return `你是 AIMENG UNING（爱萌优宁）的血清产品与细胞培养应用顾问。请撰写一篇专业、实用、通俗易懂的血清知识文章。

硬性要求：
1. 必须围绕血清产品本身展开，包括胎牛血清、特殊血清、阴性血清、动物血制品、细胞培养应用、批次质控或检测基质。
2. 如果主题包含“四环素阴性血清”，文章必须直接回答它的应用场景：药物残留检测的阴性基质、标准品/质控品配制、加标回收、方法验证、样本稀释或基质匹配等。
3. 不要把文章主线写成 ELISA 教程；不得使用“你的 ELISA 标准曲线总是不准？”这类开头；标题不得出现“ELISA精准定量的关键”这类把血清主题变成 ELISA 的表达。
4. 可以提到血清在免疫检测、药残检测或方法学验证中的作用，但必须服务于“血清应用场景”这个主线。
5. 不涉及其他品牌，不做品牌对比。
6. 不要虚构具体检测限、LC-MS/MS 数值、批次一致性数据、认证参数或保存期限；如需表达，只能写“以实际 COA/检测报告为准”。
7. 文章结构清晰：应用场景 → 选择逻辑 → 使用要点 → 注意事项 → AIMENG UNING 可提供的支持。
8. 语言风格专业但亲切，适合细胞培养、食品安全、药残检测和实验室质控人员阅读。
9. 使用 Markdown 格式，只使用 ## 和 ### 作为标题层级。
10. 文章长度 700-1200 字。`;
  }

  return `你是 AIMENG UNING（爱萌优宁）的 ELISA 技术专家。请撰写一篇专业、实用、通俗易懂的 ELISA 每日知识文章。

要求：
1. 标题简洁有力，20字以内
2. 内容结构清晰：问题场景 → 原理解析 → 操作步骤 → 注意事项
3. 语言风格：专业但亲切，适合科研工作者阅读
4. 必须包含至少一个实用技巧或常见误区提醒
5. 在文章末尾自然植入 AIMENG UNING 试剂盒优势
6. 使用 Markdown 格式，只使用 ## 和 ### 作为标题层级
7. 文章长度 800-1500 字
8. 如果是操作技巧类，必须包含具体数值参数`;
}

function getCategories(domain: KnowledgeDomain) {
  return domain === 'serum'
    ? ['应用场景', '产品指南', '细胞培养', '质量控制', '样本处理']
    : ['操作技巧', 'Troubleshooting', '产品指南', '原理解析', '样本处理'];
}

function fallbackTags(domain: KnowledgeDomain) {
  return domain === 'serum' ? ['血清', '应用场景', '质量控制'] : ['ELISA', '实验技巧'];
}

function normalizeGeneratedArticle(article: GeneratedArticle, domain: KnowledgeDomain, selectedTopic: string) {
  const nextArticle = { ...article };
  if (domain === 'serum') {
    const title = typeof nextArticle.title === 'string' ? nextArticle.title : '';
    const elisaLedTitle = /ELISA|酶联/i.test(title) || (/标准曲线/.test(title) && !/血清|基质|阴性/.test(title));
    if (!title || elisaLedTitle) {
      nextArticle.title = selectedTopic.length <= 24 ? selectedTopic : '血清应用场景解析';
    }
    nextArticle.category = nextArticle.category || '应用场景';
    const tags = Array.isArray(nextArticle.tags) ? nextArticle.tags : [];
    nextArticle.tags = Array.from(new Set(['血清', ...tags.filter((tag: unknown) => typeof tag === 'string')]));
    if (typeof nextArticle.summary === 'string') {
      nextArticle.summary = nextArticle.summary.replace(/ELISA检测中的?|ELISA实验中的?|ELISA精准定量的?/g, '');
    }
  }
  return nextArticle;
}

export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireAdminOrSuper(req)
    if (authError) return authError

    const { date, topic } = await req.json();

    const topics = [
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
      '四环素阴性血清的应用场景',
      '低内毒素胎牛血清适合哪些细胞培养',
      '透析胎牛血清的适用实验',
      '活性炭处理胎牛血清的选择要点',
      '无外泌体胎牛血清使用注意事项',
      '胎牛血清批次筛选为什么重要',
    ];

    const selectedTopic = topic || topics[Math.floor(Math.random() * topics.length)];
    const articleDate = date || new Date().toISOString().split('T')[0];
    const domain = detectKnowledgeDomain(selectedTopic);
    const systemPrompt = getSystemPrompt(domain);
    const categories = getCategories(domain);
    const articleTypeLabel = domain === 'serum' ? '血清每日知识文章' : 'ELISA 每日知识文章';

    const userPrompt = `请为 ${articleDate} 撰写一篇 ${articleTypeLabel}。

主题方向：${selectedTopic}

文章分类建议（请从中选择最合适的一个）：
${categories.map((category) => `- ${category}`).join('\n')}

额外约束：
- 标题必须紧扣主题，不要自行改成其他技术方向。
- 如果主题属于血清/胎牛血清/特殊血清，不要用 ELISA 作为标题或开篇主角。
- 只围绕 AIMENG UNING 的知识闭环展开，不涉及其他品牌。
- 不要编造具体检测数据；涉及批次、残留、内毒素、支原体等指标时，写“以实际 COA/检测报告为准”。

请返回以下 JSON 格式（不要包含 markdown 代码块标记，直接返回 JSON）：
{
  "title": "文章标题",
  "category": "分类",
  "tags": ["标签1", "标签2", "标签3"],
  "summary": "100字以内的摘要",
  "content": "完整的 Markdown 格式文章内容"
}`;

    // Refresh once per generation so a setting changed in the admin page is
    // applied immediately, even when this request lands on another server
    // instance whose short-lived settings cache is still warm.
    const aiSettings = await getAiModelSettings({ refresh: true })
    const requestedProvider = getProviderForAiTask(aiSettings, 'longform')
    let usedProvider: AiProvider = requestedProvider
    let usedModel = ''

    const aiContent = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        task: 'longform',
        provider: requestedProvider,
        temperature: 0.7,
        maxTokens: 1500,
        onProviderUsed: (provider, model) => {
          usedProvider = provider
          usedModel = model
        },
      }
    );

    let article;
    try {
      const jsonMatch = aiContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                        aiContent.match(/```\n?([\s\S]*?)\n?```/) ||
                        aiContent.match(/(\{[\s\S]*\})/);
      
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : aiContent;
      article = JSON.parse(jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim());
    } catch {
      const title = selectedTopic;
      article = {
        title,
        category: categories[0],
        tags: fallbackTags(domain),
        summary: '本篇介绍 ' + selectedTopic + ' 的实用技巧与注意事项。',
        content: aiContent,
      };
    }
    article = normalizeGeneratedArticle(article, domain, selectedTopic);

    if (!isUsableArticle(article)) {
      throw new Error('AI 未返回完整正文，已停止保存。请稍后重新生成。')
    }

    return Response.json({
      success: true,
      article: {
        ...article,
        title: cleanText(article.title),
        content: cleanText(article.content),
        summary: cleanText(article.summary) || `本篇介绍 ${selectedTopic} 的实用技巧与注意事项。`,
        category: cleanText(article.category) || categories[0],
        tags: Array.isArray(article.tags)
          ? article.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
          : fallbackTags(domain),
        publish_date: articleDate,
        generated_at: new Date().toISOString(),
      },
      topic: selectedTopic,
      domain,
      ai: {
        provider: usedProvider,
        model: usedModel || undefined,
        fallback_used: usedProvider !== requestedProvider,
      },
    });

  } catch (error: unknown) {
    console.error('Generate knowledge error:', error);
    return Response.json(
      { error: '生成失败', message: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
