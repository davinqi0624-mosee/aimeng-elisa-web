export type SerumCategory = 'fbs' | 'animal-serum'

export interface SerumProduct {
  slug: string
  category: SerumCategory
  name: string
  englishName: string
  catalogNumber: string
  origin: string
  serumType: string
  packageSize: string
  imageUrl: string
  summary: string
  description: string[]
  applications: string[]
  qualityItems: { label: string; value: string }[]
  cellApplications: string[]
  comparisonPoints?: { label: string; aimeng: string; common: string }[]
}

export interface SerumShowcaseGroup {
  title: string
  code: string
  description: string
  applications: string[]
  products: SerumProduct[]
}

const commonFbsQualityItems = [
  { label: '内毒素浓度', value: '≤ 20 EU/mL' },
  { label: 'Gamma 辐照', value: 'No' },
  { label: '经热灭活', value: 'No' },
  { label: '血红蛋白浓度', value: '≤ 25 mg/dL' },
  { label: '过滤处理', value: 'Triple Filtered at 0.1 μm' },
  { label: '有效期', value: '5 年' },
  { label: '运输条件', value: '干冰' },
  { label: '经过测试', value: '多达 30 项质量测试，包括 9CFR 和 EMA 病毒测试、内毒素和其他性能检测' },
  { label: '年龄', value: '6-8 个月胎龄' },
  { label: '原产国', value: '巴西 / Brazil' },
  { label: '形式', value: 'Liquid' },
  { label: '产品规格', value: '500ml 瓶装 / 10×50ml' },
  { label: '血清处理', value: 'Standard (Sterile-filtered)' },
  { label: '细菌/支原体', value: '阴性' },
  { label: 'BVDV 病毒', value: '阴性' },
]

export const serumProducts: SerumProduct[] = [
  {
    slug: 'standard-fbs',
    category: 'fbs',
    name: '标准级胎牛血清',
    englishName: 'Standard Fetal Bovine Serum',
    catalogNumber: 'AM-FBS-STD-500',
    origin: '巴西',
    serumType: '普通胎牛血清',
    packageSize: '500ml / 10×50ml',
    imageUrl: '/images/elisa/elisa_full_workflow_vertical.jpg',
    summary: '适用于常规细胞培养、传代扩增和实验室日常使用。',
    description: [
      '标准级胎牛血清以常规细胞培养为主，适合大多数细胞系的基础培养和放大。',
      '该产品采用多项质量测试控制，适合对基础培养稳定性和批次追溯有要求的客户。',
      '若客户需要确认批次质控，请使用 COA 查询对应批号。',
    ],
    applications: ['常规细胞培养用', '293T / HeLa / CHO / 3T3', '实验室日常培养'],
    qualityItems: commonFbsQualityItems,
    cellApplications: ['293T', 'HUVEC', 'MCF-7', 'MRC-5', 'LX2', '4T1', 'NCM460', 'CHO', 'HeLa', 'A549'],
    comparisonPoints: [
      { label: '批次追溯', aimeng: '按批号绑定 COA', common: '资料分散，批次信息不完整' },
      { label: '细胞生长', aimeng: '提供批次测试结果', common: '仅提供基础理化指标' },
      { label: '资料查询', aimeng: '网站自助查询', common: '依赖人工发送文件' },
    ],
  },
  {
    slug: 'premium-fbs',
    category: 'fbs',
    name: '优选级胎牛血清',
    englishName: 'Premium Fetal Bovine Serum',
    catalogNumber: 'AM-FBS-PRE-500',
    origin: '澳洲 / 新西兰',
    serumType: '优选级胎牛血清',
    packageSize: '500ml',
    imageUrl: '/images/elisa/elisa_sandwich_sketch.jpg',
    summary: '适用于对稳定性、低背景和批间一致性要求更高的细胞实验。',
    description: [
      '优选级胎牛血清适合对细胞状态敏感的实验场景，强调批间一致性和培养表现。',
      '可用于长期培养、功能实验前扩增、转染前状态维护等流程。',
    ],
    applications: ['常规细胞培养用', '敏感细胞培养', '高一致性实验'],
    qualityItems: [
      { label: '无菌检测', value: '阴性' },
      { label: '支原体检测', value: '阴性' },
      { label: '内毒素', value: '较低水平，批次 COA 为准' },
      { label: '细胞倍增表现', value: '优选批次测试' },
      { label: '外观', value: '澄清，无明显沉淀' },
    ],
    cellApplications: ['干细胞相关培养', '原代细胞预实验', 'CHO', 'HEK293', '肿瘤细胞系'],
    comparisonPoints: [
      { label: '批次筛选', aimeng: '按实验应用筛选批次', common: '仅按库存批次发货' },
      { label: '适用场景', aimeng: '面向敏感细胞和关键实验', common: '常规培养为主' },
      { label: '技术支持', aimeng: '可结合细胞类型建议批次', common: '多为通用建议' },
    ],
  },
  {
    slug: 'tetracycline-free-fbs',
    category: 'fbs',
    name: '四环素阴性胎牛血清',
    englishName: 'Tetracycline-Free FBS',
    catalogNumber: 'AM-FBS-TET-500',
    origin: '进口血源批次',
    serumType: '四环素阴性血清',
    packageSize: '500ml',
    imageUrl: '/images/elisa/elisa_sandwich_pencil.jpg',
    summary: '适用于四环素调控系统、基因表达调控和诱导表达实验。',
    description: [
      '四环素阴性胎牛血清用于 tetracycline-controlled expression system，减少背景干扰。',
      '适合需要精确控制基因开关的细胞模型和诱导表达体系。',
    ],
    applications: ['特殊筛选血清', '四环素诱导系统', '基因表达调控'],
    qualityItems: [
      { label: '四环素残留', value: '阴性或低于检测限' },
      { label: '无菌检测', value: '阴性' },
      { label: '支原体检测', value: '阴性' },
      { label: '内毒素', value: '批次 COA 为准' },
    ],
    cellApplications: ['Tet-On / Tet-Off 体系', '诱导表达细胞系', '转染后筛选细胞'],
  },
  {
    slug: 'carbon-treated-fbs',
    category: 'fbs',
    name: '碳吸附胎牛血清',
    englishName: 'Charcoal-Stripped FBS',
    catalogNumber: 'AM-FBS-CH-500',
    origin: '进口血源批次',
    serumType: '碳吸附血清',
    packageSize: '500ml',
    imageUrl: '/images/elisa/elisa_full_workflow_vertical.jpg',
    summary: '适用于激素敏感、受体研究和信号通路实验。',
    description: [
      '碳吸附胎牛血清用于去除部分激素和小分子，常见于激素受体、内分泌和信号通路研究。',
      '适合激素依赖细胞、受体响应实验和需要低背景血清的体系。',
    ],
    applications: ['特殊工艺血清', '激素受体研究', '信号通路实验'],
    qualityItems: [
      { label: '激素去除', value: '批次 COA 为准' },
      { label: '无菌检测', value: '阴性' },
      { label: '支原体检测', value: '阴性' },
      { label: '过滤处理', value: 'Sterile-filtered' },
    ],
    cellApplications: ['受体研究细胞系', '激素依赖性细胞', '通路验证实验'],
  },
  {
    slug: 'dialyzed-fbs',
    category: 'fbs',
    name: '透析胎牛血清',
    englishName: 'Dialyzed FBS',
    catalogNumber: 'AM-FBS-DIA-500',
    origin: '进口血源批次',
    serumType: '透析血清',
    packageSize: '500ml',
    imageUrl: '/images/elisa/elisa_sandwich_sketch.jpg',
    summary: '适用于代谢研究、低分子干预和营养条件控制实验。',
    description: [
      '透析胎牛血清用于去除部分小分子，适合研究代谢调控、氨基酸/糖类干预和营养限制条件。',
      '适合需要控制低分子背景的实验体系。',
    ],
    applications: ['特殊工艺血清', '代谢研究', '低分子干预实验'],
    qualityItems: [
      { label: '透析处理', value: '批次 COA 为准' },
      { label: '无菌检测', value: '阴性' },
      { label: '支原体检测', value: '阴性' },
      { label: '内毒素', value: '批次 COA 为准' },
    ],
    cellApplications: ['代谢研究细胞系', '营养缺失模型', '信号干预实验'],
  },
  {
    slug: 'low-igg-fbs',
    category: 'fbs',
    name: '低 IgG 胎牛血清',
    englishName: 'Low IgG FBS',
    catalogNumber: 'AM-FBS-LIGG-500',
    origin: '进口血源批次',
    serumType: '低 IgG 血清',
    packageSize: '500ml',
    imageUrl: '/images/elisa/elisa_sandwich_lego.jpg',
    summary: '适用于免疫学实验、抗体相关研究和低干扰需求。',
    description: [
      '低 IgG 胎牛血清用于降低背景免疫球蛋白干扰，适合免疫相关细胞培养和抗体实验。',
      '可减少血清中 IgG 对检测体系的影响。',
    ],
    applications: ['特殊筛选血清', '抗体实验', '低背景培养'],
    qualityItems: [
      { label: 'IgG 含量', value: '低于常规血清' },
      { label: '无菌检测', value: '阴性' },
      { label: '支原体检测', value: '阴性' },
      { label: '内毒素', value: '批次 COA 为准' },
    ],
    cellApplications: ['免疫学实验', '抗体筛选', '低干扰培养体系'],
  },
  {
    slug: 'lipid-reduced-fbs',
    category: 'fbs',
    name: '低脂胎牛血清',
    englishName: 'Low Lipid FBS',
    catalogNumber: 'AM-FBS-LL-500',
    origin: '进口血源批次',
    serumType: '低脂血清',
    packageSize: '500ml',
    imageUrl: '/images/elisa/elisa_sandwich_pencil.jpg',
    summary: '适用于脂代谢研究和对脂类背景较敏感的实验。',
    description: [
      '低脂胎牛血清适合脂代谢、脂蛋白相关和高背景敏感实验体系。',
      '有助于降低血清中脂类成分对读数或细胞状态的影响。',
    ],
    applications: ['特殊工艺血清', '脂代谢相关实验', '低脂背景培养'],
    qualityItems: [
      { label: '脂类控制', value: '低于常规血清' },
      { label: '无菌检测', value: '阴性' },
      { label: '支原体检测', value: '阴性' },
      { label: '内毒素', value: '批次 COA 为准' },
    ],
    cellApplications: ['脂代谢模型', '代谢细胞系', '高背景敏感实验'],
  },
  {
    slug: 'exosome-depleted-fbs',
    category: 'fbs',
    name: '无外泌体胎牛血清',
    englishName: 'Exosome-Depleted Fetal Bovine Serum',
    catalogNumber: 'AM-FBS-EXO-500',
    origin: '进口血源批次',
    serumType: '无外泌体血清',
    packageSize: '500ml',
    imageUrl: '/images/elisa/elisa_sandwich_lego.jpg',
    summary: '适用于外泌体研究、细胞通讯和分泌组学。',
    description: [
      '无外泌体血清适合外泌体研究、细胞通讯和上清分析。',
      '与普通血清相比，减少外源颗粒背景，便于下游分析。',
    ],
    applications: ['外泌体研究用', '分泌组学', '上清分析'],
    qualityItems: [
      { label: '外泌体去除验证', value: '批次 COA 为准' },
      { label: '无菌检测', value: '阴性' },
      { label: '支原体检测', value: '阴性' },
      { label: '内毒素', value: '批次 COA 为准' },
    ],
    cellApplications: ['外泌体研究细胞系', 'MSC', '肿瘤细胞系'],
  },
  {
    slug: 'batch-reserve-fbs',
    category: 'fbs',
    name: '批次保留型胎牛血清',
    englishName: 'Batch Reserved FBS',
    catalogNumber: 'AM-FBS-BR-500',
    origin: '批次锁定',
    serumType: '批次固定血清',
    packageSize: '500ml',
    imageUrl: '/images/elisa/elisa_sandwich_sketch.jpg',
    summary: '适用于长期项目，保持同一批次供货。',
    description: [
      '批次保留型胎牛血清用于长期项目和重复性要求高的体系，尽量保持同一批次供货。',
      '适合需要长期稳定培养条件的团队。',
    ],
    applications: ['长期项目', '批次锁定', '稳定培养'],
    qualityItems: [
      { label: '批次锁定', value: '可选' },
      { label: '无菌检测', value: '阴性' },
      { label: '支原体检测', value: '阴性' },
      { label: '内毒素', value: '批次 COA 为准' },
    ],
    cellApplications: ['长期培养细胞系', '批间一致性要求高的项目'],
  },
  {
    slug: 'immune-cell-fbs',
    category: 'fbs',
    name: '免疫细胞培养胎牛血清',
    englishName: 'Immune Cell Culture FBS',
    catalogNumber: 'AM-FBS-IMM-500',
    origin: '进口血源批次',
    serumType: '免疫细胞培养专用',
    packageSize: '500ml',
    imageUrl: '/images/elisa/elisa_sandwich_lego.jpg',
    summary: '适用于原代免疫细胞、T 细胞、B 细胞和 NK 细胞培养。',
    description: [
      '免疫细胞培养型血清适合对活性、背景和分化状态较敏感的体系。',
      '用于免疫细胞扩增、诱导分化和保存优化。',
    ],
    applications: ['免疫细胞培养专用', 'T/B/NK 细胞', '分化诱导'],
    qualityItems: [
      { label: '细胞刺激背景', value: '低背景控制' },
      { label: '无菌检测', value: '阴性' },
      { label: '支原体检测', value: '阴性' },
      { label: '内毒素', value: '批次 COA 为准' },
    ],
    cellApplications: ['T 细胞', 'B 细胞', 'NK 细胞', 'DC 细胞', 'THP-1', 'Raw264.7'],
  },
  {
    slug: 'horse-serum',
    category: 'animal-serum',
    name: '马血清',
    englishName: 'Horse Serum',
    catalogNumber: 'AM-AS-HS-500',
    origin: '合规动物血源',
    serumType: '其他动物血清',
    packageSize: '500ml',
    imageUrl: '/images/elisa/elisa_sandwich_pencil.jpg',
    summary: '适用于特定细胞培养、封闭体系和免疫实验辅助场景。',
    description: [
      '马血清适用于部分特殊细胞培养和免疫实验体系，可根据实验目的选择热灭活或非热灭活批次。',
      '不同实验体系对动物来源血清敏感度不同，建议首次使用时进行小规模预实验。',
    ],
    applications: ['特殊细胞培养', '免疫封闭体系', '方法学预实验'],
    qualityItems: [
      { label: '无菌检测', value: '阴性' },
      { label: '支原体检测', value: '阴性' },
      { label: '内毒素', value: '批次 COA 为准' },
      { label: '外观', value: '澄清至轻微浑浊' },
    ],
    cellApplications: ['特殊细胞培养', '免疫封闭体系', '方法学预实验'],
  },
  {
    slug: 'goat-serum',
    category: 'animal-serum',
    name: '山羊血清',
    englishName: 'Goat Serum',
    catalogNumber: 'AM-AS-GS-100',
    origin: '合规动物血源',
    serumType: '其他动物血清',
    packageSize: '100ml / 500ml',
    imageUrl: '/images/elisa/elisa_full_workflow_vertical.jpg',
    summary: '常用于免疫染色、封闭液配制和抗体实验体系优化。',
    description: [
      '山羊血清常用于免疫实验封闭和抗体孵育体系优化，有助于降低非特异性结合背景。',
      '建议根据二抗来源和实验体系选择合适封闭血清，避免同源性干扰。',
    ],
    applications: ['免疫荧光', '免疫组化', '抗体实验体系'],
    qualityItems: [
      { label: '无菌检测', value: '阴性' },
      { label: '支原体检测', value: '阴性' },
      { label: '总蛋白', value: '批次 COA 为准' },
      { label: '外观', value: '澄清至轻微浑浊' },
    ],
    cellApplications: ['免疫荧光', '免疫组化', 'Western blot 封闭优化', '抗体实验体系'],
  },
  {
    slug: 'rabbit-serum',
    category: 'animal-serum',
    name: '兔血清',
    englishName: 'Rabbit Serum',
    catalogNumber: 'AM-AS-RS-100',
    origin: '合规动物血源',
    serumType: '其他动物血清',
    packageSize: '100ml / 500ml',
    imageUrl: '/images/elisa/elisa_sandwich_sketch.jpg',
    summary: '适用于免疫实验对照、封闭体系和特定检测体系验证。',
    description: [
      '兔血清可用于免疫实验中的封闭、对照和体系优化，适合需要动物来源血清参与的检测流程。',
      '使用前建议结合抗体宿主、二抗来源和检测平台确认是否适配。',
    ],
    applications: ['免疫实验对照', '封闭体系', '抗体实验优化'],
    qualityItems: [
      { label: '无菌检测', value: '阴性' },
      { label: '支原体检测', value: '阴性' },
      { label: '总蛋白', value: '批次 COA 为准' },
      { label: '储存条件', value: '-20℃ 或以下' },
    ],
    cellApplications: ['免疫实验对照', '封闭体系', '方法学验证', '抗体实验优化'],
  },
]

export const fbsShowcaseGroups: SerumShowcaseGroup[] = [
  {
    title: '常规培养与批次优选',
    code: 'FBS-CELL',
    description: '用于常规细胞培养、敏感细胞预实验和长期项目批次保留，重点展示细胞培养数据和批次稳定性。',
    applications: ['常规传代扩增', '敏感细胞预实验', '长期项目批次保留'],
    products: serumProducts.filter((item) =>
      ['standard-fbs', 'premium-fbs', 'batch-reserve-fbs', 'immune-cell-fbs'].includes(item.slug)
    ),
  },
  {
    title: '特殊筛选/特殊工艺血清',
    code: 'FBS-SPEC',
    description: '从原料筛选或后处理工艺控制特定背景成分，不按常规细胞培养应用场景归类。',
    applications: ['四环素阴性', '碳吸附', '透析', '低 IgG', '低脂'],
    products: serumProducts.filter((item) =>
      ['tetracycline-free-fbs', 'carbon-treated-fbs', 'dialyzed-fbs', 'low-igg-fbs', 'lipid-reduced-fbs'].includes(item.slug)
    ),
  },
  {
    title: '外泌体研究用',
    code: 'FBS-EXO',
    description: '针对外泌体研究和上清分析降低外源颗粒背景，适合展示外泌体去除验证数据。',
    applications: ['外泌体研究', '细胞通讯', '上清分析'],
    products: serumProducts.filter((item) =>
      ['exosome-depleted-fbs'].includes(item.slug)
    ),
  },
]

export function getSerumProductsByCategory(category: SerumCategory) {
  return serumProducts.filter((product) => product.category === category)
}

export function getSerumProduct(slug: string) {
  return serumProducts.find((product) => product.slug === slug)
}
