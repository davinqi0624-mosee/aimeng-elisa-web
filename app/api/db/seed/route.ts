import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SEED_SHOP_ITEMS = [
  {
    name: '100元实验耗材兑换券',
    points_required: 500,
    stock: 100,
    description: '可用于抵扣艾萌官网任意实验耗材订单，满200元可用。',
    status: 'active',
    sort_order: 1,
  },
  {
    name: 'ELISA 试剂盒 8折券',
    points_required: 1000,
    stock: 50,
    description: '全场 ELISA 试剂盒单盒 8 折优惠，不限品种。',
    status: 'active',
    sort_order: 2,
  },
  {
    name: '实验技术咨询服务（1小时）',
    points_required: 800,
    stock: 30,
    description: '资深技术工程师一对一实验方案设计与疑难解答。',
    status: 'active',
    sort_order: 3,
  },
  {
    name: 'Gold 会员（90天）',
    points_required: 2000,
    stock: 20,
    description: '享受专属客服、优先发货、免费技术资料下载等权益。',
    status: 'active',
    sort_order: 4,
  },
  {
    name: '定制抗体预研服务',
    points_required: 5000,
    stock: 5,
    description: '针对您的靶标提供抗体定制可行性评估与预研方案。',
    status: 'active',
    sort_order: 5,
  },
]

const SEED_PAPERS = [
  {
    title: 'Mouse IL-6 ELISA Kit 在 LPS 诱导巨噬细胞炎症模型中的应用',
    authors: '张明, 李华, 王强',
    journal: 'Journal of Immunological Methods',
    doi: '10.1016/j.jim.2025.04.001',
    link: 'https://doi.org/10.1016/j.jim.2025.04.001',
    abstract: '本研究评估了 Mouse IL-6 ELISA Kit 在脂多糖（LPS）诱导的小鼠巨噬细胞炎症模型中的检测性能。结果表明，该试剂盒在低浓度范围（2-50 pg/mL）内表现出优异的线性关系（R²>0.998），检测灵敏度满足细胞上清样本的定量需求。',
    status: 'verified',
    points_awarded: 100,
  },
  {
    title: '高灵敏度 TNF-α 检测在类风湿性关节炎小鼠血清分析中的验证',
    authors: '陈静, 刘洋, 赵磊',
    journal: 'Cytokine',
    doi: '10.1016/j.cyto.2025.03.012',
    link: 'https://doi.org/10.1016/j.cyto.2025.03.012',
    abstract: '采用艾萌高灵敏度 Mouse TNF-α ELISA Kit 对 CIA 模型小鼠血清进行纵向分析。批内变异系数 CV<5%，批间 CV<8%，回收率介于 95%-105% 之间，符合生物分析方法的验证标准。',
    status: 'verified',
    points_awarded: 100,
  },
  {
    title: 'Human IFN-γ ELISA Kit 在肿瘤免疫治疗临床试验中的性能评价',
    authors: '孙伟, 周婷, 吴刚',
    journal: 'Clinical Immunology',
    doi: '10.1016/j.clim.2025.02.008',
    link: 'https://doi.org/10.1016/j.clim.2025.02.008',
    abstract: '在 PD-1 抑制剂联合治疗临床试验中，使用该试剂盒监测患者血清 IFN-γ 水平变化。与对照方法的相关性 r=0.987，临床决策一致性达 94.2%，支持其作为伴随诊断工具的潜力。',
    status: 'verified',
    points_awarded: 100,
  },
]

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    // 简单校验：仅允许管理员（metadata 中 is_admin=true）
    const isAdmin = (user.user_metadata as any)?.is_admin === true
    if (!isAdmin) {
      return NextResponse.json({ error: '无权操作，请在用户 metadata 中设置 is_admin=true' }, { status: 403 })
    }

    const results: any = {}

    // 1. 插入商城商品
    const { data: itemsData, error: itemsError } = await supabase
      .from('shop_items')
      .insert(SEED_SHOP_ITEMS)
      .select('id')

    if (itemsError) {
      results.shop_items = { error: itemsError.message }
    } else {
      results.shop_items = { count: itemsData?.length || 0 }
    }

    // 2. 插入示例论文（关联到当前用户， product_id 留空）
    const papersWithUser = SEED_PAPERS.map((p) => ({
      ...p,
      user_id: user.id,
      product_id: null,
    }))

    const { data: papersData, error: papersError } = await supabase
      .from('papers')
      .insert(papersWithUser)
      .select('id')

    if (papersError) {
      results.papers = { error: papersError.message }
    } else {
      results.papers = { count: papersData?.length || 0 }
    }

    // 3. 给当前用户发放示例积分（方便测试）
    const { error: ptError } = await supabase.from('point_transactions').insert({
      user_id: user.id,
      amount: 1000,
      type: 'earn',
      source: 'seed',
      description: '种子数据初始化赠送积分',
    })

    if (ptError) {
      results.points = { error: ptError.message }
    } else {
      results.points = { awarded: 1000 }
    }

    return NextResponse.json({ success: true, results })
  } catch (err: any) {
    console.error('Seed error:', err)
    return NextResponse.json({ error: err.message || '种子数据初始化失败' }, { status: 500 })
  }
}
