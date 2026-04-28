import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chatCompletion } from '@/lib/ai/llm'
import { requireRole, getClientIP } from '@/lib/admin/permissions'
import { logAudit } from '@/lib/admin/audit'

const SPECIES_CODE_MAP: Record<string, string> = {
  Human: '1',
  Mouse: '3',
  Rat: '2',
  Rabbit: '21',
  Monkey: '5',
  Canine: '6',
  Dog: '6',
  Porcine: '7',
  Pig: '7',
  Bovine: '8',
  Cow: '8',
  Chicken: '9',
  'Guinea pig': '17',
  GuineaPig: '17',
  Sheep: '18',
  Zebrafish: '19',
  'zebrafish': '19',
}

const SECTIONS = [
  'header',
  'principle',
  'kit_components',
  'equipment_needed',
  'sample_collection',
  'sample_notes',
  'sample_storage',
  'operation_notes',
  'reagent_preparation',
  'washing_method',
  'procedure',
  'procedure_summary',
  'results',
  'declaration',
  'troubleshooting',
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { target, species, method, antibodyId, templateId, customAntibody, size = '96T' } = body
    if (!target || !species || !method) {
      return NextResponse.json({ error: '缺少必填参数（靶标、种属、方法）' }, { status: 400 })
    }

    const speciesCode = SPECIES_CODE_MAP[species]
    if (!speciesCode) {
      return NextResponse.json({ error: `不支持的种属: ${species}` }, { status: 400 })
    }

    const sizeSuffix = size === '48T' ? 'S' : 'M'

    const { user, error: authError } = await requireRole(request, ['super', 'level1', 'level2'])
    if (authError) return authError

    const supabase = await createClient()

    // Fetch antibody info if provided
    let antibodyInfo = ''
    if (antibodyId) {
      const { data: ab } = await supabase
        .from('antibody_catalog')
        .select('*')
        .eq('id', antibodyId)
        .single()
      if (ab) {
        antibodyInfo = `\n所选抗体信息：\n- 供应商：${ab.supplier}\n- 货号：${ab.catalog_number}\n- 靶标：${ab.target}\n- 种属：${ab.species}\n- 克隆号：${ab.clone_number || 'N/A'}\n- 宿主：${ab.host}\n- 反应性：${ab.reactivity || 'N/A'}\n- 应用：${ab.applications || 'N/A'}\n- 浓度：${ab.concentration || 'N/A'}`
      }
    } else if (customAntibody && typeof customAntibody === 'object') {
      antibodyInfo = `\n用户提供的抗体信息：\n- 供应商：${customAntibody.supplier || 'N/A'}\n- 货号：${customAntibody.catalog_number || 'N/A'}\n- 靶标：${customAntibody.target || target}\n- 种属：${customAntibody.species || species}\n- 克隆号：${customAntibody.clone_number || 'N/A'}\n- 宿主：${customAntibody.host || 'N/A'}`
    }

    const systemPrompt = `你是一位资深的 ELISA 试剂盒技术文档工程师。请严格按照以下模板格式生成试剂盒说明书，输出必须是一个严格的 JSON 对象。

模板来源：上海爱萌优宁生物技术有限公司标准 ELISA 试剂盒说明书

JSON 字段要求：
{
  "header": "封面信息，格式如下：\n货号：XXX\n种属：XXX\n规格：96T/48T\n检测范围：XXX pg/ml\n灵敏度：XXX pg/ml\n有效期：6个月\n保存温度：2-8℃\n标准曲线浓度为: 1000.0、500.0、250.0、125.0、62.5、31.25、15.6、0 pg/ml\n特异性描述\n重复性描述（板内、板间变异系数均<10%）\n用途描述\n简介：关于检测靶标的生物学背景介绍（150-200字）\n公司官网：http://www.animaluni.com/\n公司地址：上海市闵行区新骏环路188号19号楼408室。",

  "principle": "一、检测原理：\n采用夹心法ELISA原理的完整描述。将捕获抗体包被于酶标板上，捕获样品及标准品中的靶蛋白，生物素化的检测抗体与靶蛋白结合，SABC复合物与生物素化检测抗体结合，形成免疫复合物，加入TMB显色液后显蓝色，加入终止液变黄色。检测过程中未结合的成分均被洗去，用酶标仪在450nm处测OD值，靶蛋白浓度与OD值之间呈正比，通过绘制标准曲线计算出标本中靶蛋白的浓度。（200-300字）",

  "kit_components": "二、试剂盒组分:（保存温度4℃）\n以表格形式列出，包含：预包被酶标板、标准品S（10×）、标准品/样品稀释液、生物素化检测抗体（100×）、生物素化检测抗体稀释液、SABC复合物（100×）、SABC复合物稀释液、TMB显色液A、TMB显色液B、终止液、30×浓缩洗涤液、封板胶纸、产品说明书。每种组分需标注48T和96T规格。",

  "equipment_needed": "※需要而未提供的试剂和器材\n1. 标准规格酶标仪、自动洗板机、恒温箱。\n2. 进口品牌可调节移液器及吸头，0.5-10μL, 2-20μL, 20-200μL, 200-1000μL。一次检测样品较多时，最好用多通道移液器。\n3. 干净的试管和Ep管。\n4. 双蒸水或去离子水。",

  "sample_collection": "三、样本收集方法：\n按以下样本类型分别详细描述收集方法：\n●血清：室温血液自然凝固10-20分钟后，离心20分钟左右（2000-3000转/分），收集上清-20℃或者-80℃冷冻保存。\n●血浆：应根据试剂盒的要求选择EDTA、柠檬酸钠或肝素作为抗凝剂，抗凝血离心20分钟左右（2000-3000转/分），仔细收集上清，-20℃或者-80℃冷冻保存。\n●尿液、胸腹水、脑脊液、肺泡灌洗液：用无菌管收集，离心20分钟左右（2000-3000转/分），仔细收集上清，-20℃或者-80℃冷冻保存。\n●细胞培养上清：用于检测分泌性的成分，用无菌管收集，离心20分钟左右（2000-3000转/分），仔细收集上清。检测细胞内的成分时，用PBS稀释细胞悬液，细胞浓度达到100万/ml左右，通过超声破碎或反复冻融，离心20分钟左右（2000-3000转/分），仔细收集上清，-20℃或者-80℃冷冻保存。\n●组织标本：切割标本后，准确称取组织重量。按重量(g):体积(mL)=1:9的比例，加入9倍体积的匀浆介质PBS，用手工或匀浆器将标本匀浆充分，离心20分钟左右（2000-3000转/分），仔细收集匀浆上清，-20℃或者-80℃冷冻保存。",

  "sample_notes": "四、样本收集注意事项：\n1. 每个标本量收集体积＝约60μl×检测指标，如要做复孔，标本量收集体积＝约60μl×检测指标×2。\n2. 收集标本前必须清楚要检测的成份是否足够稳定，以确定样本保存温度。\n3. 血清标本采集时，应注意避免溶血，红细胞溶解时会释放出具有过氧化物酶活性的物质。\n4. 为了保证尿液检测结果的准确性，必须正确收集尿液标本和保存，盛尿容器要清洁干燥。\n5. 冻结标本融解后，蛋白质局部浓缩，分布不均，应充分轻缓混匀，避免气泡。\n6. 混浊或有沉淀的标本应先离心或过滤，澄清后再检测。\n7. 反复冻融会使蛋白效价降低，所以待测标本如需保存作多次检测，宜少量分装冰存。\n8. 激素类标本需添加抑肽酶。",

  "sample_storage": "五、样本保存：\n1. 4°C保存：1-4天检测的样本，超过时间的需低温保存。\n2. -20°C或-80°C保存：对收集后当天进行检测的标本，储存在4°C备用，如有特殊原因需要周期收集标本，将标本及时分装后放在-20°C或-80°C条件下保存。避免反复冻融。\n3. 一般情况下，标本4°C可保存48小时，-20°C下可保存1个月。-80°C下可保存6个月。",

  "operation_notes": "六、实验操作注意事项：\n1. 在试验中标准品和样本检测时建议作双孔检测，每次检测都应做标准曲线。\n2. 洗涤过程很关键，洗涤不充分将导致精确度误差及OD值错误地升高。从冰箱中取出的浓缩洗涤液可能有结晶,属于正常现象，37℃水浴使结晶完全溶解后再配制洗涤液。\n3. 检测时所有试剂都要恢复到室温，板条开封后剩余板条需封好，放回袋中1个月内用完。\n4. 试剂盒使用超敏TMB溶液，显色过深时会出现沉淀状，属正常现象，混匀即可，不影响结果判读。\n5. 试验中请穿着实验服并戴乳胶手套做好防护工作。\n6. 不同批号的试剂盒组份不能混用(反应终止液除外)。\n7. 试验中所用的EP管和吸头均为一次性使用，严禁混用。",

  "reagent_preparation": "七、检测前试剂准备:\n1. 提前20分钟从冰箱中取出试剂盒，平衡至室温，读数前15分钟打开酶标仪预热。\n2. 洗涤液配置：用蒸馏水1:30稀释（例：1ml浓缩洗涤液加入29ml的蒸馏水）。\n3. 标准品配制：取8个1.5ml离心管，分别标注S1, S2, S3, S4, S5, S6, S7, Blank, 第一管S1中加入标准品/样品稀释液900μl，S2至Blank中分别加入标准品/样品稀释液200μl，在第一管S1中加入标准品S（10×）溶液100μl置于漩涡混合器上混匀后用加样器吸出200μl，移至S2，如此反复作对倍稀释至S7, 混匀，Blank为空白对照。\n4. 生物素化抗体工作液配置:使用前20分钟，用生物素化抗体稀释液将100×生物素化抗体稀释成1×工作液。\n5. SABC复合物工作液配置:使用前20分钟，用SABC复合物稀释液将100×浓缩ABC复合物稀释成1×工作液。\n6. TMB显色液的配置：使用前10分钟，将TMB显色液A液和B液1:1混合，避光放置备用。\n7. 如果您检测的样本中靶蛋白浓度高于标准品最高值，建议重新检测，请根据实际情况，适当倍数稀释。\n8. 当标准品/样品稀释液及洗涤液不够用时，可以用1×PBST替代。",

  "washing_method": "八、洗板方法：\n● 手工洗板方法：\n吸去（不可触及板壁）或甩掉酶标板内的液体；在实验台上铺垫几层吸水纸，酶标板朝下用力拍几次；将1×洗涤缓冲液至少300μl注入孔内，浸泡1-2分钟。根据需要，重复此过程数次。\n●自动洗板：\n全自动洗板机的使用应注意以下几点：\n1. 洗板前，应检查洗液瓶、蒸馏水瓶是否充足，废液瓶是否满瓶。\n2. 在自检过程中注意观察洗液灌注是否通畅，排液是否通畅。\n3. 在洗板过程中，应注意观察反应孔每孔是否灌满且无外溢，每孔吸水是否吸尽，并且要保证洗液在孔中放置的时间。",

  "procedure": "九、检测程序:\n1. 加样：空白孔加入50μl标准品/样品稀释液，其余孔各对应加入标准品或待测样品50μl，贴上封板胶纸，将反应板混匀后置37℃，50分钟。\n2. 洗板：用1×洗涤液将反应板充分洗涤3次，每孔加入1×洗液300μl，每次震荡/浸泡1-2分钟，向滤纸上印干。\n3. 加抗体：空白孔加入100μl生物素化抗体稀释液，其余孔各加入1×的生物素化抗体工作液100μl，贴上封板胶纸，混匀后置37℃，50分钟。\n4. 洗板：同上。\n5. 加SABC：每孔加入SABC复合物工作液100μl，贴上封板胶纸，混匀后置37℃，30分钟。\n6. 洗板：同上。\n7. 加显色液：每孔加入提前配置好的TMB混合液100μl，混匀后贴上封板胶纸，置于37℃暗处反应10-20分钟（具体显色时间根据显色结果而定）。\n8. 加终止液：每孔加入50μl终止液，混匀，30分钟内用酶标仪在450nm处测吸光值。",

  "procedure_summary": "十、检测程序总结：\n1. 加样品及标准品，37℃反应50分钟。洗涤3次。\n2. 加生物素化检测抗体，37℃反应50分钟。洗涤3次。\n3. 加SABC复合物，37℃反应30分钟。洗涤3次。\n4. 加TMB显色液，37℃反应10-20分钟。\n5. 加入终止液，读数。",

  "results": "十一、结果判断与计算：\n1. 所有OD值建议减除空白孔值后再进行计算，如空白孔OD低于0.1，也可以直接计算。\n2. 以标准品浓度作横坐标，OD值作纵坐标，手工绘制或用软件绘制标准曲线，根据样品OD值计算出相应含量，再乘以稀释倍数即可。",

  "declaration": "十二、声明：\n1、本公司只对试剂盒本身负责，不对因使用该试剂盒所造成的样本消耗负责，请使用者使用前充分考虑到样本的可能使用量，预留充足的样本。\n2、若所检样本不包含在说明书所列样本之中，建议进行预实验验证其有效性，并注意留存样本。\n3、使用化学裂解液制备的组织匀浆或细胞提取液可能会由于某些化学物质的引入导致ELISA实验结果偏差。\n4、若样本为细胞培养上清，因该类样本干扰因素较多，如：细胞状态、细胞数量、采样时间等，所以可能存在检测不出的情况。\n5、某些天然蛋白或重组蛋白，包括原核及真核重组蛋白，可能因为与本产品所使用的检测抗体及捕获抗体不匹配，而不被检测出。\n6、建议使用新鲜样本，保存时间过长可能会存在蛋白降解或变性导致实验结果偏差。",

  "troubleshooting": "问题分析：\n若实验效果不好，请及时对显色结果拍照，保存实验数据，保留所用板条及未使用试剂，然后联系我公司技术支持为您解决问题。\n\n标准曲线较差\n原因\t解决方案\n标准品溶液配置有误\t确认是否进行正确稀释。\n标准品复溶不当\t开盖前进行离心；检查复溶后是否存在不溶物。\n标准品已降解\t按推荐方式保存和处理标准品。\n\n无信号\n原因\t解决方案\n孵育时间过短\t样品在4℃孵育过夜，或遵循试剂的实验方案。\n靶标含量低于检测范围\t减小样品的稀释倍数或浓缩样品。\n检测试剂不足\t遵循试剂的实验方案，增加检测试剂的浓度或用量。\n\n变异系数（CV）较大\n原因\t解决方案\n孔中有气泡\t读板前，确保不存在气泡。\n孔洗涤不均/未充分洗涤\t检查洗板机的所有管口是否畅通。\n试剂混匀不充分\t确保所有试剂充分混匀。\n移液量不一致\t正确使用经过校准的移液器。"
}

重要规则：
1. 所有字段必须存在且不为空
2. 内容必须使用中文，专业术语可保留英文
3. 严格按照上述模板的章节结构、编号方式和行文风格输出
4. header字段中的货号、检测范围、灵敏度等参数需根据靶标和种属给出合理估计值
5. 数值参数需符合ELISA行业常规范围
6. 标准曲线浓度点为8点（含空白）：1000.0、500.0、250.0、125.0、62.5、31.25、15.6、0 pg/ml`

    const userPrompt = `请为以下试剂盒生成完整说明书：\n- 检测靶标：${target}\n- 适用种属：${species}\n- 实验方法：${method}${antibodyInfo}`

    const rawContent = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.5, maxTokens: 4096 }
    )

    // Parse JSON response
    let content: Record<string, string> = {}
    try {
      const cleaned = rawContent.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim()
      content = JSON.parse(cleaned)
      // Ensure all sections exist
      for (const key of SECTIONS) {
        if (!content[key]) content[key] = '（该章节内容待补充）'
      }
    } catch (parseErr: any) {
      console.warn('JSON parse failed, using fallback structure:', parseErr.message)
      // Fallback: split by section headers
      const fallback: Record<string, string> = {}
      let currentKey = 'principle'
      for (const line of rawContent.split('\n')) {
        const lower = line.toLowerCase()
        if (lower.includes('原理')) currentKey = 'principle'
        else if (lower.includes('组成') || lower.includes('组分')) currentKey = 'kit_components'
        else if (lower.includes('器材') || lower.includes('设备')) currentKey = 'equipment_needed'
        else if (lower.includes('样本收集方法') || lower.includes('收集方法')) currentKey = 'sample_collection'
        else if (lower.includes('样本收集注意') || lower.includes('收集注意')) currentKey = 'sample_notes'
        else if (lower.includes('样本保存') || lower.includes('保存')) currentKey = 'sample_storage'
        else if (lower.includes('操作注意') || lower.includes('实验操作')) currentKey = 'operation_notes'
        else if (lower.includes('试剂准备') || lower.includes('准备')) currentKey = 'reagent_preparation'
        else if (lower.includes('洗板') || lower.includes('洗涤')) currentKey = 'washing_method'
        else if (lower.includes('检测程序') || lower.includes('程序')) currentKey = 'procedure'
        else if (lower.includes('程序总结') || lower.includes('总结')) currentKey = 'procedure_summary'
        else if (lower.includes('结果') || lower.includes('计算')) currentKey = 'results'
        else if (lower.includes('声明')) currentKey = 'declaration'
        else if (lower.includes('问题') || lower.includes('故障') || lower.includes('排查')) currentKey = 'troubleshooting'
        fallback[currentKey] = (fallback[currentKey] || '') + line + '\n'
      }
      content = { ...Object.fromEntries(SECTIONS.map((k) => [k, ''])), ...fallback }
    }

    // Generate catalog number via atomic DB function
    const { data: cnData, error: cnError } = await supabase.rpc('next_catalog_number', {
      p_species_code: speciesCode,
      p_size: sizeSuffix,
    })

    if (cnError) {
      console.error('Catalog number generation error:', cnError)
      return NextResponse.json({ error: `货号生成失败: ${cnError.message}` }, { status: 500 })
    }

    const catalogNumber = cnData as string

    // Patch the AI-generated header with the real catalog number
    if (content.header) {
      content.header = content.header.replace(/货号[：:]\s*[^\n]+/, `货号：${catalogNumber}`)
    }

    // Save to database
    const title = `${target} (${species}) ${method} 试剂盒说明书`
    const { data: inserted, error: insertError } = await supabase
      .from('auto_datasheets')
      .insert({
        user_id: user.id,
        title,
        target,
        species,
        method,
        catalog_number: catalogNumber,
        size,
        template_id: templateId || null,
        antibody_id: antibodyId || null,
        content,
        status: 'draft',
      })
      .select('id, catalog_number')
      .single()

    if (insertError) {
      console.error('Datasheet insert error:', insertError)
      return NextResponse.json({ error: `保存说明书失败: ${insertError.message}` }, { status: 500 })
    }

    // Audit log
    await logAudit({
      admin_id: user.id,
      action: 'generate',
      target_table: 'auto_datasheets',
      target_id: inserted.id,
      new_value: { target, species, method, catalogNumber: inserted.catalog_number, size },
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ id: inserted.id, title, catalogNumber: inserted.catalog_number, size, content })
  } catch (err: any) {
    console.error('Datasheet generate error:', err)
    const isDeepSeekErr = err.message?.includes('DeepSeek') || err.message?.includes('DEEPSEEK')
    return NextResponse.json(
      {
        error: err.message,
        detail: isDeepSeekErr
          ? 'DeepSeek API 调用失败，请检查 API Key 和环境变量配置。'
          : '服务器内部错误，请联系管理员。',
      },
      { status: 500 }
    )
  }
}
