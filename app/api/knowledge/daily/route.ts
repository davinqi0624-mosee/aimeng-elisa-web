import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SEED_ARTICLES = [
  {
    date: '2026-04-21',
    title: 'ELISA 基本原理：抗原抗体反应的定量艺术',
    summary: '深入了解酶联免疫吸附测定的核心机制，包括直接法、间接法、夹心法和竞争法四种主要类型。',
    content: `ELISA（Enzyme-Linked Immunosorbent Assay）是一种将抗原抗体反应的特异性与酶催化底物的高效性相结合的免疫检测技术。

## 核心原理
1. 固相化：将抗原或抗体固定在聚苯乙烯微孔板表面
2. 免疫反应：样本中的目标分子与固相化试剂特异性结合
3. 酶标记：加入酶标记的检测抗体，形成免疫复合物
4. 显色测定：加入底物后酶催化产生有色产物，OD值与目标物浓度成正比

## 四种主要类型
- 直接法：抗原包被 → 酶标一抗 → 显色。步骤最少，但灵敏度受限
- 间接法：抗原包被 → 一抗 → 酶标二抗 → 显色。灵敏度高，一抗无需标记
- 夹心法：捕获抗体包被 → 抗原 → 检测抗体 → 显色。特异性最强，适用于大分子
- 竞争法：固定抗原 + 样本抗原竞争结合抗体。适用于小分子和半抗原

## 关键参数
灵敏度（LOD）、特异性（交叉反应率）、精密度（CV%）、准确度（回收率）是评价ELISA试剂盒的四大核心指标。`,
    category: 'ELISA原理',
    tags: ['基础原理', '实验类型', '免疫检测'],
    is_hot: true,
  },
  {
    date: '2026-04-22',
    title: '样本处理黄金法则：从采集到上样的全流程',
    summary: '血清、血浆、细胞上清和组织样本的正确处理方法，确保 ELISA 检测结果的准确性。',
    content: `样本质量是 ELISA 实验成功的先决条件。不规范的样本处理是导致实验失败的最常见原因。

## 血清样本处理
1. 采集后室温静置 30 分钟，促进凝血
2. 2000-3000g 离心 10 分钟，吸取上清
3. 避免溶血：血红蛋白会干扰显色系统
4. 若需抗凝，请改用血浆样本处理流程

## 血浆样本处理
- EDTA：适用于大多数细胞因子检测
- 肝素：可能影响某些指标，需参考试剂盒说明书
- 柠檬酸钠：常用于凝血相关指标
注意：某些抗凝剂可能干扰特定检测，务必确认兼容性。

## 细胞培养上清
1. 收集培养基，2000g 离心 10 分钟去除细胞碎片
2. 如需长期保存，建议加入蛋白酶抑制剂混合物
3. 避免反复冻融，建议分装为 200-500μL/管

## 组织样本
1. 液氮速冻后 -80℃ 保存
2. 检测前在冰上匀浆，加入适当体积的 PBS
3. 12000g 离心 15 分钟取上清
4. 根据目标蛋白浓度决定是否需要进行蛋白定量

## 保存原则
短期（1-2天）：4℃保存
长期：-20℃或-80℃保存
禁忌：反复冻融、直接接触金属或橡胶、长时间室温放置`,
    category: '样本处理',
    tags: ['血清', '血浆', '组织', '保存'],
    is_hot: false,
  },
  {
    date: '2026-04-23',
    title: '标准曲线构建与数据拟合全攻略',
    summary: '从标准品准备到四参数逻辑回归拟合，掌握 ELISA 定量分析的核心技能。',
    content: `标准曲线是 ELISA 定量分析的基石。一条优质的标准曲线应该具备良好的线性范围、高的相关系数和适当的浓度覆盖。

## 标准品准备
1. 浓度点设置：通常 5-7 个浓度点，覆盖预期检测范围的 80%-120%
2. 稀释液选择：与样本基质匹配的缓冲液
3. 倍比稀释：推荐 2 倍系列稀释，确保等间距覆盖
4. 每浓度至少 2 个复孔，推荐 3 复孔

## 常用拟合模型
1. 线性回归：适用于窄浓度范围，形式为 y = mx + b
2. 四参数逻辑回归（4-PL）：最常用，拟合 S 型曲线
   - A：下限渐近线（背景信号）
   - B：曲线斜率因子（Hill 系数）
   - C：拐点浓度（EC50）
   - D：上限渐近线（最大信号）
3. 五参数逻辑回归（5-PL）：适用于不对称曲线，增加不对称因子 E

## 质量评价标准
- R² ≥ 0.99（理想 ≥ 0.995）
- 各浓度点复孔 CV% < 10%
- 样本 OD 值应落在标准曲线中段（20%-80% 最大 OD）
- 超出范围的样本需稀释后重测，不可外推

## 注意事项
- 每块板均需独立标准曲线，不可跨板使用
- 标准品和样本应使用同一批试剂、同一台酶标仪读数
- 显色时间需严格控制，过长会导致高浓度点信号饱和`,
    category: '标准曲线',
    tags: ['定量分析', '4-PL', '曲线拟合', '质量控制'],
    is_hot: true,
  },
  {
    date: '2026-04-24',
    title: 'ELISA 常见问题 Top10 排查手册',
    summary: '高背景、信号弱、CV过大等最常见问题的系统性排查与解决方案。',
    content: `## 1. 高背景 / 假阳性
原因：洗涤不充分、抗体浓度过高、底物孵育时间过长、交叉污染
解决：增加洗涤次数（至少 5 次，每次 1 分钟）；降低抗体浓度（推荐先做棋盘滴定）；缩短显色时间；更换新鲜洗液

## 2. 信号弱 / 假阴性
原因：抗原失活、抗体效价下降、显色系统失效、孵育温度过低
解决：检查试剂有效期和保存条件；增加抗体浓度；更换新鲜底物；确保孵育温度 37℃

## 3. 变异系数（CV）过大
原因：加样不准、边缘效应、温育温度不均、气泡干扰
解决：使用多道移液器并定期校准；避免使用板边缘孔位或做空白对照；使用湿盒恒温孵育；读数前去除气泡

## 4. 标准曲线线性差
原因：标准品降解、加样误差、孵育条件不当
解决：分装保存标准品，避免反复冻融；校准移液器；严格控制孵育温度和时间

## 5. 梯度不明显
原因：抗体浓度过高导致前带现象、抗原浓度过高
解决：稀释抗体或抗原浓度；检查标准品是否过期

## 6. 显色不均匀
原因：加样时产生气泡、板底有异物、酶标仪光路问题
解决：加样时避免气泡；检查板底清洁度；校准酶标仪

## 7. 复孔差异大
原因：加样不准确、孵育时震动、洗涤力度不均
解决：使用排枪加样；孵育时避免震动；洗涤时保持力度一致

## 8. 样本浓度超出检测范围
原因：样本中目标物浓度过高或过低
解决：高浓度样本适当稀释；低浓度样本浓缩或换用高灵敏度试剂盒

## 9. 批间差异大
原因：试剂批号更换、操作者差异、环境条件变化
解决：尽量使用同一批号试剂；建立标准操作规程（SOP）；控制实验室温湿度

## 10. 基线漂移
原因：底物不稳定、酶标仪预热不充分
解决：底物现配现用；酶标仪开机预热 15 分钟以上`,
    category: '常见问题',
    tags: ['troubleshooting', '故障排查', '质量控制'],
    is_hot: false,
  },
  {
    date: '2026-04-25',
    title: '实验优化技巧：让 ELISA 结果更稳定',
    summary: '从加样技巧到孵育优化的 8 个实用技巧，显著提升实验重复性和数据质量。',
    content: `## 技巧 1：预实验不可忽视
在正式实验前，用 2-3 个代表性样本进行预实验，确认样本浓度在检测范围内，避免因样本问题导致整批实验失败。

## 技巧 2：室温平衡
所有试剂和样本在使用前需室温平衡 30 分钟，避免低温试剂导致孵育温度波动。注意：不要将试剂直接置于 37℃ 水浴快速升温，可能破坏蛋白活性。

## 技巧 3：加样顺序策略
建议按「标准品 → 低浓度样本 → 高浓度样本」的顺序加样，避免高浓度样本污染低浓度孔位。使用排枪时，每加完一排更换 tip。

## 技巧 4：边缘效应对策
微孔板边缘孔位因蒸发快易出现边缘效应。解决方案：
- 边缘孔位加入 PBS 或空白液，不用于实验
- 使用湿盒孵育，保持湿度 > 90%
- 孵育时板子加盖或覆盖保鲜膜

## 技巧 5：洗涤的艺术
洗涤是 ELISA 最关键的操作之一：
- 每孔加液量 ≥ 300μL（96 孔板）
- 浸泡时间 30-60 秒，让未结合物质充分洗脱
- 最后一次洗涤后，将板子在吸水纸上拍干，避免残留洗液稀释后续试剂
- 切勿让孔完全干燥，可能导致蛋白变性

## 技巧 6：显色时间控制
显色反应是酶促反应，对时间敏感：
- 提前准备好终止液
- 高浓度标准品先显色，可观察颜色变化判断终止时机
- 建议从加入第一孔底物开始计时，按固定时间间隔依次终止

## 技巧 7：读数时机
终止后应在 10 分钟内完成读数，避免颜色随时间变化。读数前检查板底是否有气泡或污渍。

## 技巧 8：数据记录习惯
建立完整的实验记录，包括：试剂批号、操作人员、环境温湿度、异常现象。这些数据对排查问题和实验复现至关重要。`,
    category: '实验技巧',
    tags: ['优化', '重复性', '操作技巧'],
    is_hot: true,
  },
  {
    date: '2026-04-26',
    title: '新品速递：高灵敏度小鼠 IL-6 试剂盒上市',
    summary: '检测限低至 1.2 pg/mL，专为低丰度细胞因子检测优化的全新试剂盒。',
    content: `## 产品亮点
- 检测范围：2-500 pg/mL
- 灵敏度（LOD）：1.2 pg/mL
- 样本体积：仅需 50 μL
- 孵育时间：总实验时间缩短至 2.5 小时
- 特异性：与 IL-6 家族其他成员（IL-11, LIF, CNTF）交叉反应率 < 0.1%

## 技术改进
1. 采用双单克隆抗体夹心法，捕获抗体经亲和力成熟筛选
2. 检测抗体标记高活性 HRP 突变体，催化效率提升 40%
3. 显色底物采用新型 TMB 配方，本底更低、信号更强
4. 标准品采用重组蛋白在大肠杆菌表达后复性，批次间 CV < 8%

## 验证数据
- 血清样本回收率：92%-108%（n=20）
- 细胞上清稀释线性：r > 0.998
- 批内 CV：3.2%-6.8%
- 批间 CV：5.1%-9.3%

## 适用样本
- 小鼠血清 / 血浆（EDTA、肝素、柠檬酸钠）
- 细胞培养上清
- 组织匀浆液（需适当稀释）

## 注意事项
- 样本中若含叠氮钠（NaN₃），需透析去除，因为叠氮钠会抑制 HRP 活性
- 严重溶血样本（血红蛋白 > 5 g/L）可能影响检测结果
- 建议样本测定前进行 1:2 预稀释，确认浓度在标准曲线范围内`,
    category: '新品介绍',
    tags: ['新品', 'IL-6', '高灵敏度', '小鼠'],
    is_hot: true,
  },
  {
    date: '2026-04-27',
    title: 'Troubleshooting 实战：一次真实的实验失败复盘',
    summary: '从标准曲线异常到最终解决，完整复盘一次 ELISA 实验问题的排查过程。',
    content: `## 问题描述
某实验室使用艾萌大鼠 TNF-α 试剂盒，连续两批实验出现标准曲线斜率偏低、高浓度点信号饱和的现象，R² 仅 0.97。

## 排查过程

### 第一步：排除试剂问题
- 检查试剂盒有效期：在有效期内
- 检查标准品复溶：发现复溶后未混匀，底部有未溶解沉淀
- 处理：标准品复溶后室温静置 10 分钟，轻柔颠倒混匀 20 次，避免剧烈震荡产生泡沫

### 第二步：优化标准品稀释
- 问题：采用 1:2 倍比稀释，但移液器量程为 100-1000μL，最小分度不够精细
- 解决：更换 2-20μL 和 20-200μL 量程移液器，重新做标准曲线

### 第三步：检查孵育条件
- 问题：实验室空调故障，室温高达 28℃，而说明书要求 25℃
- 解决：转移至恒温培养箱（25±1℃）孵育，使用湿盒保持湿度

### 第四步：评估洗涤效果
- 问题：手工洗涤，每孔加液量仅 200μL，浸泡时间不足
- 解决：改用洗板机，每孔 350μL，浸泡 60 秒，共洗涤 6 次

## 最终结果
优化后重新实验：
- 标准曲线 R² = 0.9987
- 各浓度点复孔 CV < 5%
- 样本回收率 96%-104%

## 经验教训
1. 标准品复溶和混匀是最容易被忽视但影响巨大的环节
2. 移液器量程选择直接影响稀释精度
3. 环境温度波动对 ELISA 结果有明显影响，建议使用恒温设备
4. 洗涤不充分是背景高、灵敏度低的常见原因
5. 建立实验室 SOP 并严格执行，可大幅减少人为误差`,
    category: 'troubleshooting',
    tags: ['案例复盘', '实验失败', '排查流程'],
    is_hot: true,
  },
]

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'

    let query = supabase.from('daily_knowledge').select('*')
    if (!all) {
      const today = new Date().toISOString().split('T')[0]
      const startOfMonth = today.slice(0, 7) + '-01'
      query = query.gte('date', startOfMonth).lte('date', today)
    }

    const { data, error } = await query.order('date', { ascending: true })
    if (error) throw error
    return NextResponse.json({ items: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const reset = body.reset === true
    const supabase = await createClient()

    // Ensure table exists via RPC
    const setupSql = `
      CREATE TABLE IF NOT EXISTS daily_knowledge (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE NOT NULL UNIQUE,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        tags TEXT[],
        is_hot BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      ALTER TABLE daily_knowledge ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "Allow all" ON daily_knowledge;
      CREATE POLICY "Allow all" ON daily_knowledge FOR ALL USING (true) WITH CHECK (true);
    `
    const { error: setupErr } = await supabase.rpc('exec_sql', { sql: setupSql })
    if (setupErr) {
      console.warn('exec_sql not available for daily_knowledge:', setupErr.message)
    }

    if (reset) {
      await supabase.from('daily_knowledge').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }

    const results: Array<{ title: string; status: string; error?: string }> = []
    for (const article of SEED_ARTICLES) {
      const { data: existing } = await supabase
        .from('daily_knowledge')
        .select('id')
        .eq('date', article.date)
        .maybeSingle()

      if (existing?.id) {
        results.push({ title: article.title, status: 'skipped' })
        continue
      }

      const { error } = await supabase.from('daily_knowledge').insert({
        date: article.date,
        title: article.title,
        summary: article.summary,
        content: article.content,
        category: article.category,
        tags: article.tags,
        is_hot: article.is_hot,
      })

      if (error) {
        results.push({ title: article.title, status: 'error', error: error.message })
      } else {
        results.push({ title: article.title, status: 'inserted' })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
