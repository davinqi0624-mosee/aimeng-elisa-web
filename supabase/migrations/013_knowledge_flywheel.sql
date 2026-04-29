-- ============================================================
-- Knowledge Flywheel: 动态知识引擎数据库扩展
-- 执行方式: Supabase Dashboard → SQL Editor → New query → 粘贴执行
-- ============================================================

-- 1. 扩展 daily_knowledge 表
ALTER TABLE daily_knowledge
  ADD COLUMN IF NOT EXISTS quality_score DECIMAL(3,2) DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS not_helpful_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- 已有数据初始化
UPDATE daily_knowledge SET quality_score = 0.70 WHERE quality_score = 0.50;
UPDATE daily_knowledge SET source_type = 'manual' WHERE source_type IS NULL;
UPDATE daily_knowledge SET lifecycle_status = 'active' WHERE lifecycle_status IS NULL;

-- 2. 知识候选池（AI 从对话中提取的待审核知识）
CREATE TABLE IF NOT EXISTS knowledge_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_conversation_id TEXT,
  source_type TEXT DEFAULT 'ai_chat',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  suggested_title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[],
  ai_quality_score DECIMAL(3,2) DEFAULT 0.50,
  ai_extract_reason TEXT,
  status TEXT DEFAULT 'pending',
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note TEXT,
  merged_into_id UUID REFERENCES daily_knowledge(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

COMMENT ON TABLE knowledge_candidates IS 'AI 自动提取的知识候选，等待管理员审核';

-- 3. 知识版本历史（追踪文章迭代）
CREATE TABLE IF NOT EXISTS knowledge_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES daily_knowledge(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  category TEXT,
  tags TEXT[],
  change_type TEXT DEFAULT 'manual_update',
  change_summary TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE knowledge_versions IS '每日知识文章的历史版本记录';

-- 4. 知识清理日志
CREATE TABLE IF NOT EXISTS knowledge_cleanup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ DEFAULT now(),
  total_scanned INTEGER DEFAULT 0,
  archived_count INTEGER DEFAULT 0,
  merged_count INTEGER DEFAULT 0,
  ai_updated_count INTEGER DEFAULT 0,
  details JSONB,
  report_summary TEXT
);

COMMENT ON TABLE knowledge_cleanup_logs IS '知识自动清理任务的执行日志';

-- 5. 索引优化
CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_status ON knowledge_candidates(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_created_at ON knowledge_candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_versions_knowledge_id ON knowledge_versions(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_daily_knowledge_lifecycle ON daily_knowledge(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_daily_knowledge_featured ON daily_knowledge(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_daily_knowledge_category ON daily_knowledge(category);

-- 6. RLS 策略
ALTER TABLE knowledge_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_cleanup_logs ENABLE ROW LEVEL SECURITY;

-- 公开读取 daily_knowledge
DROP POLICY IF EXISTS "daily_knowledge public read" ON daily_knowledge;
CREATE POLICY "daily_knowledge public read" ON daily_knowledge FOR SELECT USING (true);

-- 只有管理员可操作候选池
DROP POLICY IF EXISTS "knowledge_candidates admin all" ON knowledge_candidates;
CREATE POLICY "knowledge_candidates admin all" ON knowledge_candidates FOR ALL USING (
  EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid())
);

-- 公开读取版本历史
DROP POLICY IF EXISTS "knowledge_versions public read" ON knowledge_versions;
CREATE POLICY "knowledge_versions public read" ON knowledge_versions FOR SELECT USING (true);

-- 公开读取清理日志
DROP POLICY IF EXISTS "knowledge_cleanup_logs public read" ON knowledge_cleanup_logs;
CREATE POLICY "knowledge_cleanup_logs public read" ON knowledge_cleanup_logs FOR SELECT USING (true);

-- 7. 初始化 10 篇高质量种子文章
DO $$
DECLARE
  article RECORD;
  inserted_id UUID;
BEGIN
  FOR article IN
    SELECT * FROM (VALUES
      ('血清/血浆样本处理的 5 个关键要点',
       '掌握血清、血浆样本从采集到上样的全流程要点，避免常见处理失误。',
       '## 1. 采集后尽快处理
采集完成后，血液样本应在 2 小时内完成离心分离。长时间室温放置会导致细胞代谢物释放，干扰检测结果。

## 2. 离心条件标准化
推荐 2000-3000g 离心 10-15 分钟。转速过高可能导致细胞破裂释放胞内物质；转速过低则分离不彻底。

## 3. 避免溶血
溶血会释放大量血红蛋白和胞内蛋白，导致高背景或假阳性。采血时避免使用过小针头、避免剧烈混匀。

## 4. 抗凝剂选择
- EDTA：最常用，适合大多数指标
- 肝素：注意可能影响某些细胞因子
- 柠檬酸钠：适合凝血相关指标
务必参考试剂盒说明书确认兼容性。

## 5. 保存与分装
短期（<48h）：4°C 保存
长期：-20°C 或 -80°C，分装 200-500μL/管，避免反复冻融。',
       '样本处理',
       ARRAY['样本处理', '血清', '血浆', '保存']),

      ('TMB 显色异常排查指南',
       '显色过深、过浅或不均匀？系统排查 TMB 显色问题的完整方案。',
       '## 显色过深 / 高背景
- 洗涤不充分：增加洗涤次数至 6 次，每次浸泡 60 秒
- 抗体浓度过高：用棋盘滴定法优化抗体浓度
- 显色时间过长：控制显色在 10-15 分钟，提前准备好终止液
- 底物受污染：底物应现配现用，避免接触金属离子

## 显色过浅 / 信号弱
- 抗体失活：检查保存条件，避免反复冻融
- 孵育温度不足：确保 37°C 恒温孵育
- HRP 抑制剂：检查样本中是否含叠氮钠（NaN₃）
- 底物失效：检查底物有效期，TMB 应无色透明

## 显色不均匀
- 加样气泡：加样时沿孔壁缓慢加入，避免气泡
- 板底异物：读数前检查板底清洁度
- 孵育震动：孵育过程中避免移动或震动微孔板',
       'Troubleshooting',
       ARRAY['TMB', '显色', '故障排查', '高背景']),

      ('标准曲线不理想？常见原因与对策',
       '从曲线形状到相关系数，全面解析标准曲线异常的排查方法。',
       '## 标准曲线线性差（R² < 0.99）
- 标准品降解：分装保存，避免反复冻融
- 加样误差：校准移液器，使用排枪加样
- 孵育条件不当：严格控制温度和时间

## 高浓度点信号饱和
- 显色时间过长：缩短显色至 10 分钟
- 抗体浓度过高：适当稀释检测抗体
- 标准品浓度过高：降低最高浓度点

## 低浓度点信号过低
- 灵敏度不足：检查抗体效价，必要时更换试剂盒
- 非特异性结合：增加封闭时间或更换封闭液

## 曲线不对称
- 使用五参数逻辑回归（5-PL）代替四参数（4-PL）
- 检查标准品纯度',
       '标准曲线',
       ARRAY['标准曲线', '定量分析', '质量控制']),

      ('ELISA 试剂盒保存与复溶注意事项',
       '正确的保存和复溶操作是保证试剂盒性能的关键。',
       '## 未开封试剂盒
- 储存条件：2-8°C，避免冷冻
- 保质期：以试剂盒标注为准，通常为 6-12 个月
- 避免反复取出放回，温度波动会加速试剂降解

## 标准品复溶
1. 提前 30 分钟从冰箱取出，室温平衡
2. 加入指定体积的复溶缓冲液
3. 轻柔颠倒混匀 20 次，避免剧烈震荡
4. 室温静置 10 分钟，确保完全溶解
5. 分装为单次用量，-20°C 保存

## 抗体保存
- 浓缩抗体：按说明书稀释后尽快使用，未用完的分装保存
- 工作液：现配现用，当天用完
- 酶标抗体：避光保存，避免反复冻融

## 底物保存
- TMB 底物：2-8°C 避光保存，出现蓝色即失效
- 终止液：常温保存即可
- 洗涤缓冲液：浓缩液按说明稀释，稀释后一周内用完',
       '产品指南',
       ARRAY['保存', '复溶', '试剂盒', '标准品']),

      ('高背景值 troubleshooting',
       '系统排查导致 ELISA 高背景的 8 大原因及解决方案。',
       '## 原因 1：洗涤不充分
解决：每孔加液 ≥300μL，洗涤 5-6 次，每次浸泡 30-60 秒。最后一次拍干，避免残留。

## 原因 2：封闭不足
解决：使用 1-5% BSA 或 5% 脱脂奶粉封闭 1-2 小时。某些情况下需过夜封闭。

## 原因 3：抗体浓度过高
解决：棋盘滴定法确定最佳抗体浓度。通常稀释 1000-10000 倍。

## 原因 4：交叉反应
解决：更换特异性更高的抗体对，或选择不同表位的抗体。

## 原因 5：样本基质干扰
解决：样本适当稀释（1:2 至 1:10），或使用样本稀释液。

## 原因 6：底物污染
解决：底物现配现用，避免接触金属器具，使用一次性塑料容器。

## 原因 7：孵育温度过高
解决：严格控制 37°C，避免超过 40°C。

## 原因 8：酶标仪设置错误
解决：确认波长正确（TMB 通常为 450nm，需设参比波长 630nm）。',
       'Troubleshooting',
       ARRAY['高背景', '故障排查', '背景值']),

      ('交叉反应与干扰因素',
       '了解 ELISA 检测中的交叉反应机制和常见干扰因素。',
       '## 交叉反应机制
交叉反应发生在检测抗体与结构相似的非目标分子结合时。常见于：
- 同源家族蛋白（如 IL-6 家族）
- 同种属的不同亚型
- 降解产物或修饰形式

## 识别交叉反应
1. 检测重组蛋白的同家族成员
2.  spike-in 回收率实验
3. 与 Western Blot 结果交叉验证

## 常见干扰因素
| 干扰源 | 影响 | 解决方案 |
|--------|------|----------|
| 溶血 | 高背景 | 避免溶血，Hb>5g/L 需换样 |
| 脂血 | 信号不均 | 高速离心去除乳糜微粒 |
| 黄疸 | 颜色干扰 | 设置适当的空白对照 |
| 抗凝剂 | 抑制酶活性 | 确认试剂盒兼容性 |
| 药物 | 假阳性/阴性 | 建立药物干扰数据库 |

## 降低干扰策略
- 样本预处理：离心、过滤、稀释
- 使用高特异性抗体对
- 设置合适的空白对照和阴性对照',
       '操作技巧',
       ARRAY['交叉反应', '干扰因素', '特异性']),

      ('洗板操作的关键细节',
       '洗板是 ELISA 最关键的操作之一，掌握这些细节显著提升结果质量。',
       '## 手工洗板要点
1. **加液量**：每孔 ≥300μL（96孔板），确保完全覆盖孔底
2. **浸泡时间**：30-60 秒，让未结合物质充分洗脱
3. **拍干技巧**：在吸水纸上用力拍干，但不要让孔完全干燥（蛋白会变性）
4. **避免交叉污染**：每孔单独操作，洗液不要溅入相邻孔

## 洗板机使用
- 程序设置：加液量 350μL，浸泡 30 秒，抽吸 5 秒
- 定期检查：针尖是否堵塞、是否对齐孔中心
- 洗液更换：每天更换新鲜洗液，避免污染

## 常见问题
- **残留洗液**：最后一次拍干后，立即加入下一步试剂，不要长时间暴露
- **孔干燥**：拍干后 5 分钟内加入试剂
- **泡沫产生**：加液时沿孔壁缓慢加入，避免直接冲击孔底',
       '操作技巧',
       ARRAY['洗板', '操作细节', '重复性']),

      ('ELISA 与 Western Blot 结果不一致怎么办',
       '两种检测方法结果矛盾时的系统性排查思路。',
       '## 理解方法学差异
| 维度 | ELISA | Western Blot |
|------|-------|--------------|
| 检测对象 | 天然构象蛋白 | 变性后蛋白 |
| 灵敏度 | pg/mL 级 | ng 级 |
| 特异性 | 依赖抗体对 | 依赖抗体+分子量 |
| 定量能力 | 精确定量 | 半定量 |

## 排查步骤
1. **确认检测的是同一蛋白**
   - ELISA 抗体识别的是天然表位
   - WB 抗体识别的是线性表位（变性后暴露）
   - 如果蛋白存在翻译后修饰，两种方法可能检测不同形式

2. **检查样本处理差异**
   - ELISA 使用天然样本上清
   - WB 需要变性处理，可能破坏某些表位
   - 样本中若存在蛋白酶，WB 处理过程中可能降解目标蛋白

3. **抗体特异性验证**
   - 用重组蛋白做阳性对照
   - 做抗体 knockout 验证
   - 查看抗体数据表中的验证数据

4. **结果解读原则**
   - 两种方法结果不一致 ≠ 其中一种是错误的
   - 结合实验目的选择参考方法
   - 必要时用第三种方法（如流式、质谱）交叉验证',
       '操作技巧',
       ARRAY['WB', '结果验证', '方法学']),

      ('新品推荐：高灵敏度 IL-6 试剂盒',
       '检测限低至 1.2 pg/mL 的新一代 IL-6 检测方案，适用于低丰度样本。',
       '## 核心参数
- 检测范围：2-500 pg/mL
- 灵敏度（LOD）：1.2 pg/mL
- 样本体积：50 μL
- 总实验时间：2.5 小时
- 特异性：与 IL-11、LIF、CNTF 交叉反应 < 0.1%

## 技术亮点
1. 双单克隆抗体夹心法，捕获抗体经亲和力成熟
2. HRP 突变体标记，催化效率提升 40%
3. 新型 TMB 配方，本底更低
4. 标准品批次间 CV < 8%

## 验证数据
- 血清回收率：92%-108%（n=20）
- 稀释线性：r > 0.998
- 批内 CV：3.2%-6.8%

## 适用样本
小鼠血清/血浆、细胞培养上清、组织匀浆液',
       '产品指南',
       ARRAY['新品', 'IL-6', '高灵敏度']),

      ('实验重复性差？从这 3 个环节排查',
       '系统性提升 ELISA 实验重复性的关键控制点。',
       '## 环节 1：样本处理标准化
- 建立样本处理 SOP，每个样本按相同流程处理
- 同批实验的样本应在同一时间段内处理
- 分装保存，避免反复冻融
- 设立内参或质控样，监控批次间差异

## 环节 2：操作过程标准化
- 使用校准过的移液器，定期校验
- 标准品和样本使用同一套 tip
- 加样顺序固定，减少时间差异
- 孵育使用恒温设备，避免室温波动
- 洗涤使用洗板机或统一手工流程

## 环节 3：数据记录与分析标准化
- 建立实验记录模板：试剂批号、操作者、温湿度
- 每板独立标准曲线，不可跨板使用
- 异常数据标记并记录可能原因
- 定期做质控图（Levey-Jennings），监控趋势

## 重复性目标
- 批内 CV < 10%（理想 < 5%）
- 批间 CV < 15%（理想 < 10%）
- 达到以上目标需要严格的流程控制和持续的质控监控。',
       '操作技巧',
       ARRAY['重复性', '质量控制', '标准化'])
    ) AS t(title, summary, content, category, tags)
  LOOP
    INSERT INTO daily_knowledge (
      date, title, summary, content, category, tags,
      quality_score, source_type, lifecycle_status, expires_at, is_featured
    ) VALUES (
      CURRENT_DATE + (random() * 30)::int,
      article.title,
      article.summary,
      article.content,
      article.category,
      article.tags,
      0.75,
      'seed',
      'active',
      now() + interval '3 months',
      false
    )
    ON CONFLICT (date) DO NOTHING
    RETURNING id INTO inserted_id;
  END LOOP;
END $$;

-- 8. 设置一篇今日精选
UPDATE daily_knowledge
SET is_featured = true, quality_score = 0.90
WHERE id = (
  SELECT id FROM daily_knowledge
  WHERE lifecycle_status = 'active'
  ORDER BY quality_score DESC, view_count DESC
  LIMIT 1
);
