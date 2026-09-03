export const DATASHEET_SECTION_LABELS: Record<string, string> = {
  header: '产品信息',
  principle: '一、检测原理',
  kit_components: '二、试剂盒组分',
  equipment_needed: '需要而未提供的试剂和器材',
  sample_collection: '三、样本收集方法',
  sample_notes: '四、样本收集注意事项',
  sample_storage: '五、样本保存',
  operation_notes: '六、实验操作注意事项',
  reagent_preparation: '七、检测前试剂准备',
  washing_method: '八、洗板方法',
  procedure: '九、检测程序',
  procedure_summary: '十、检测程序总结',
  results: '十一、结果判断与计算',
  declaration: '十二、声明',
  troubleshooting: '问题分析',
}

export const DATASHEET_SECTION_KEYS = Object.keys(DATASHEET_SECTION_LABELS)

export function contentToSections(content: Record<string, string>) {
  return DATASHEET_SECTION_KEYS.map((key) => ({
    key,
    title: DATASHEET_SECTION_LABELS[key] || key,
    content: content[key] || '（该章节内容待补充）',
  }))
}
