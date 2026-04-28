-- v4.0 智能说明书引擎种子数据

-- 1. 说明书模板
INSERT INTO datasheet_templates (name, method, description, sections, status, sort_order)
VALUES
  (
    '夹心法 ELISA 通用模板',
    'sandwich',
    '适用于双抗体夹心法检测大分子抗原（如细胞因子、蛋白标志物）的标准说明书模板。',
    '[
      {"key": "principle", "title": "检测原理", "required": true},
      {"key": "kit_components", "title": "试剂盒组成", "required": true},
      {"key": "sample_preparation", "title": "样本处理", "required": true},
      {"key": "assay_procedure", "title": "操作步骤", "required": true},
      {"key": "standard_curve", "title": "标准曲线", "required": true},
      {"key": "notes", "title": "注意事项", "required": true},
      {"key": "troubleshooting", "title": "常见问题", "required": true}
    ]'::jsonb,
    'active',
    1
  ),
  (
    '竞争法 ELISA 通用模板',
    'competitive',
    '适用于竞争法检测小分子物质（如激素、药物残留、毒素）的标准说明书模板。',
    '[
      {"key": "principle", "title": "检测原理", "required": true},
      {"key": "kit_components", "title": "试剂盒组成", "required": true},
      {"key": "sample_preparation", "title": "样本处理", "required": true},
      {"key": "assay_procedure", "title": "操作步骤", "required": true},
      {"key": "standard_curve", "title": "标准曲线", "required": true},
      {"key": "notes", "title": "注意事项", "required": true},
      {"key": "troubleshooting", "title": "常见问题", "required": true}
    ]'::jsonb,
    'active',
    2
  ),
  (
    '化学发光法 ELISA 通用模板',
    'chemiluminescence',
    '适用于化学发光免疫分析（CLIA）的超灵敏检测说明书模板，适合低丰度靶标检测。',
    '[
      {"key": "principle", "title": "检测原理", "required": true},
      {"key": "kit_components", "title": "试剂盒组成", "required": true},
      {"key": "sample_preparation", "title": "样本处理", "required": true},
      {"key": "assay_procedure", "title": "操作步骤", "required": true},
      {"key": "standard_curve", "title": "标准曲线", "required": true},
      {"key": "notes", "title": "注意事项", "required": true},
      {"key": "troubleshooting", "title": "常见问题", "required": true}
    ]'::jsonb,
    'active',
    3
  );

-- 2. 示例抗体数据（IL-6 相关）
INSERT INTO antibody_catalog (supplier, catalog_number, target, species, clone_number, host, reactivity, applications, concentration, status)
VALUES
  (
    'Abcam',
    'ab9324',
    'IL-6',
    'Human',
    '2A5',
    'Mouse',
    'Human, Mouse, Rat',
    'ELISA, WB, IHC',
    '1 mg/mL',
    'active'
  ),
  (
    'R&D Systems',
    'MAB2061',
    'IL-6',
    'Mouse',
    'MP5-20F3',
    'Rat',
    'Mouse, Rat',
    'ELISA, Flow Cytometry',
    '0.5 mg/mL',
    'active'
  ),
  (
    'Thermo Fisher',
    'MA5-23778',
    'IL-6',
    'Human',
    'B-E4',
    'Mouse',
    'Human',
    'ELISA, IHC, FACS',
    '1 mg/mL',
    'active'
  ),
  (
    'Sigma-Aldrich',
    'SAB1402208',
    'IL-6',
    'Rat',
    'POLY',
    'Rabbit',
    'Rat, Mouse, Human',
    'ELISA, WB',
    '0.8 mg/mL',
    'active'
  ),
  (
    'BioLegend',
    '501102',
    'IL-6',
    'Human',
    'MQ2-13A5',
    'Mouse',
    'Human',
    'ELISA, Flow Cytometry, ICC',
    '1 mg/mL',
    'active'
  );
