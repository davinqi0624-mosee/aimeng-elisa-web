import { NextRequest } from 'next/server';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export async function POST(req: NextRequest) {
  try {
    const { date, topic } = await req.json();

    if (!DEEPSEEK_API_KEY) {
      return Response.json(
        { error: 'DEEPSEEK_API_KEY 未配置' },
        { status: 500 }
      );
    }

    const systemPrompt = `你是 Animal Union（爱萌优宁）的 ELISA 技术专家。请撰写一篇专业、实用、通俗易懂的 ELISA 每日知识文章。

要求：
1. 标题简洁有力，20字以内
2. 内容结构清晰：问题场景 → 原理解析 → 操作步骤 → 注意事项
3. 语言风格：专业但亲切，适合科研工作者阅读
4. 必须包含至少一个实用技巧或常见误区提醒
5. 在文章末尾自然植入 Animal Union 试剂盒优势
6. 使用 Markdown 格式，只使用 ## 和 ### 作为标题层级
7. 文章长度 800-1500 字
8. 如果是操作技巧类，必须包含具体数值参数`;

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
      '96T vs 48T 试剂盒：如何选择更经济？'
    ];

    const selectedTopic = topic || topics[Math.floor(Math.random() * topics.length)];
    const articleDate = date || new Date().toISOString().split('T')[0];

    const userPrompt = `请为 ${articleDate} 撰写一篇 ELISA 每日知识文章。

主题方向：${selectedTopic}

文章分类建议（请从中选择最合适的一个）：
- 操作技巧
- Troubleshooting
- 产品指南
- 原理解析
- 样本处理

请返回以下 JSON 格式（不要包含 markdown 代码块标记，直接返回 JSON）：
{
  "title": "文章标题",
  "category": "分类",
  "tags": ["标签1", "标签2", "标签3"],
  "summary": "100字以内的摘要",
  "content": "完整的 Markdown 格式文章内容"
}`;

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json(
        { error: 'DeepSeek API 调用失败', details: errorText },
        { status: 502 }
      );
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content || '';

    let article;
    try {
      const jsonMatch = aiContent.match(/```json\n?([\s\S]*?)\n?```/) || 
                        aiContent.match(/```\n?([\s\S]*?)\n?```/) ||
                        aiContent.match(/(\{[\s\S]*\})/);
      
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : aiContent;
      article = JSON.parse(jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim());
    } catch (e) {
      const title = selectedTopic;
      article = {
        title,
        category: '操作技巧',
        tags: ['ELISA', '实验技巧'],
        summary: '本篇介绍 ' + selectedTopic + ' 的实用技巧与注意事项。',
        content: aiContent,
      };
    }

    return Response.json({
      success: true,
      article: {
        ...article,
        publish_date: articleDate,
        generated_at: new Date().toISOString(),
      },
      topic: selectedTopic,
    });

  } catch (error: any) {
    console.error('Generate knowledge error:', error);
    return Response.json(
      { error: '生成失败', message: error.message },
      { status: 500 }
    );
  }
}