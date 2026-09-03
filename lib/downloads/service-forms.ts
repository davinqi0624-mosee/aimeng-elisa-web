export type ServiceDownloadFile = {
  title: string
  fileName: string
  href: string
  description: string
}

export const DEFAULT_ELISA_TESTING_SERVICE_FORM: ServiceDownloadFile = {
  title: 'ELISA 代测申请表',
  fileName: 'AMUN Elisa实验代测表.docx',
  href: '/downloads/AMUN-ELISA-testing-service-form.docx',
  description: '客户委托 ELISA 代测时填写样本信息、检测指标、样本保存条件和报告要求。',
}

export const ELISA_TESTING_SERVICE_FORM = DEFAULT_ELISA_TESTING_SERVICE_FORM
