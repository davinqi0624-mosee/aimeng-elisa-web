import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmbedding } from '@/lib/ai/ollama'

const ELISA_ARTICLES = [
  {
    title: 'ELISA 实验原理与类型详解',
    content: `ELISA（酶联免疫吸附测定）是一种基于抗原-抗体特异性结合的免疫检测技术。基本原理是将抗原或抗体固定在固相载体表面，加入酶标记的抗体或抗原，通过酶催化底物显色来定量检测目标物质。主要类型包括：直接法（Direct ELISA）——抗原直接包被，酶标一抗检测，操作简单但灵敏度较低；间接法（Indirect ELISA）——抗原包被后先加一抗，再加酶标二抗，灵敏度提高且无需标记每种一抗；夹心法（Sandwich ELISA）——捕获抗体包被，加样抗原，再加检测抗体，特异性最强，适用于大分子抗原；竞争法（Competitive ELISA）——样本抗原与固定抗原竞争结合抗体，适用于小分子和半抗原。`,
    category: '实验技术',
    tags: ['ELISA原理', '实验类型', '免疫检测'],
  },
  {
    title: 'ELISA 标准曲线建立与数据分析',
    content: `标准曲线是 ELISA 定量分析的核心。建立标准曲线的步骤：1. 准备系列浓度标准品（通常5-7个浓度点，覆盖预期检测范围）；2. 与样本同步进行 ELISA 反应；3. 测定各浓度点的吸光度（OD值）；4. 以浓度为横坐标、OD值为纵坐标绘制曲线。常用拟合模型：线性回归（适用于窄浓度范围）、四参数逻辑回归（4-PL，最常用，拟合S型曲线）、五参数逻辑回归（5-PL，适用于不对称曲线）。数据分析注意事项：相关系数R²应大于0.99；样本OD值应落在标准曲线中段（20%-80%最大OD）；超出范围的样本需稀释后重测；每块板均需独立标准曲线，不可跨板使用。`,
    category: '数据分析',
    tags: ['标准曲线', '定量分析', '曲线拟合'],
  },
  {
    title: 'ELISA 常见问题排查与解决',
    content: `ELISA 实验常见问题及解决方案：1. 高背景/假阳性——可能原因：洗涤不充分、抗体浓度过高、底物孵育时间过长；解决：增加洗涤次数、降低抗体浓度、缩短显色时间。2. 信号弱/假阴性——可能原因：抗原失活、抗体效价下降、显色系统失效；解决：检查试剂有效期、增加抗体浓度、更换新鲜底物。3. 变异系数（CV）过大——可能原因：加样不准、边缘效应、温育温度不均；解决：使用多道移液器、避免板边缘孔位、使用湿盒恒温孵育。4. 标准曲线线性差——可能原因：标准品降解、加样误差、孵育条件不当；解决：分装保存标准品、校准移液器、严格控制孵育温度和时间。`,
    category: '故障排除',
    tags: ['troubleshooting', '质量控制', '实验优化'],
  },
  {
    title: 'ELISA 样本处理与保存指南',
    content: `样本质量直接影响 ELISA 检测结果的准确性。血清样本：采集后室温静置30分钟，2000-3000g离心10分钟，吸取上清；避免溶血（血红蛋白干扰）。血浆样本：根据目标分子选择抗凝剂（EDTA、肝素或柠檬酸钠）；某些指标对特定抗凝剂敏感，需参考试剂盒说明。细胞培养上清：2000g离心10分钟去除细胞碎片；如需长期保存，建议加入蛋白酶抑制剂。组织样本：液氮速冻后-80℃保存；检测前匀浆处理，12000g离心取上清。通用保存原则：短期（1-2天）4℃保存；长期-20℃或-80℃保存；避免反复冻融（分装保存）；样本避免直接接触金属或橡胶。`,
    category: '样本处理',
    tags: ['样本保存', '血清处理', '组织匀浆'],
  },
  {
    title: 'ELISA 试剂盒选购与验证',
    content: `选购 ELISA 试剂盒的关键考量因素：1. 检测性能——检测范围应覆盖预期样本浓度；灵敏度（LOD）满足实验需求；批内/批间CV一般要求<10%和<15%。2. 特异性——与结构类似物的交叉反应率应<1%；查看供应商提供的特异性验证数据。3. 样本适用性——确认试剂盒已验证过您的样本类型（血清/血浆/细胞上清/组织等）。4. 供应商资质——ISO13485认证、完善的质量体系、可追溯的批记录。试剂盒验证步骤：进行回收率实验（80%-120%为合格）；稀释线性验证（平行性实验）；与参考方法或已验证试剂盒进行相关性比较（n≥40，r≥0.95）。建议在正式实验前进行小样本预实验，确认试剂盒适用于您的具体实验体系。`,
    category: '产品选购',
    tags: ['试剂盒', '方法验证', '质量控制'],
  },
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const reset = body.reset === true

    const supabase = await createClient()

    // Attempt to create tables if not exist (requires adequate privileges)
    const setupSql = `
      CREATE EXTENSION IF NOT EXISTS vector;

      CREATE TABLE IF NOT EXISTS knowledge_base (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding VECTOR(768),
        category TEXT,
        tags TEXT[],
        source TEXT DEFAULT 'manual',
        file_type TEXT,
        file_size INTEGER,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_embedding
        ON knowledge_base USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);

      CREATE TABLE IF NOT EXISTS chat_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        mode TEXT NOT NULL,
        title TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        sources UUID[],
        rating TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      CREATE OR REPLACE FUNCTION match_knowledge(
        query_embedding VECTOR(768),
        match_threshold FLOAT,
        match_count INT
      )
      RETURNS TABLE(
        id UUID,
        title TEXT,
        content TEXT,
        category TEXT,
        tags TEXT[],
        similarity FLOAT
      ) LANGUAGE plpgsql AS $$
      BEGIN
        RETURN QUERY
        SELECT
          kb.id,
          kb.title,
          kb.content,
          kb.category,
          kb.tags,
          1 - (kb.embedding <=> query_embedding)::FLOAT AS similarity
        FROM knowledge_base kb
        WHERE 1 - (kb.embedding <=> query_embedding)::FLOAT > match_threshold
        ORDER BY kb.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$;
    `

    const { error: setupError } = await supabase.rpc('exec_sql', { sql: setupSql })
    if (setupError) {
      console.warn('exec_sql RPC not available. Tables may need manual creation:', setupError.message)
    }

    if (reset) {
      await supabase.from('knowledge_base').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }

    const inserted: Array<{ title: string; status: string; id?: string; error?: string }> = []
    for (const article of ELISA_ARTICLES) {
      const { data: existing } = await supabase
        .from('knowledge_base')
        .select('id')
        .eq('title', article.title)
        .maybeSingle()

      if (existing?.id) {
        inserted.push({ title: article.title, status: 'skipped', id: existing.id })
        continue
      }

      const embedding = await getEmbedding(article.title + '\n' + article.content)

      const { data, error } = await supabase
        .from('knowledge_base')
        .insert({
          title: article.title,
          content: article.content,
          embedding: embedding as any,
          category: article.category,
          tags: article.tags,
          source: 'seed',
        })
        .select('id')
        .single()

      if (error) {
        inserted.push({ title: article.title, status: 'error', error: error.message })
      } else {
        inserted.push({ title: article.title, status: 'inserted', id: data!.id })
      }
    }

    return NextResponse.json({ success: true, inserted })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
