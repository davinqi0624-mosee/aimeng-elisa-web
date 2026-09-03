在酶联免疫吸附试验（ELISA）中，**加标回收率**用于评估样品基质（如血清、血浆、组织匀浆）是否会干扰目标物质的检测。它通过向已知浓度的样本中添加标准品，并计算其实际测出值与理论值的比值来判定。 [[1](https://www.tw-reagent.com/article.php?id=648), [2](https://m.biomart.cn/news/16/3133966.htm)]

一、 核心计算公式

计算公式如下： [[1](https://www.med66.com/linchuangjianyanjishi/fudangjinghua/gg1812066149.shtml), [2](https://www.tw-reagent.com/article.php?id=648)]

\(\text{回收率 (\%)} = \frac{\text{测定浓度 (加标)} - \text{测定浓度 (未加标)}}{\text{理论加标浓度}} \times 100\%\)

或者简化为：
\(\text{回收率 (\%)} = \frac{\text{实测浓度}}{\text{理论浓度}} \times 100\%\) [[1](https://www.med66.com/linchuangjianyanjishi/fudangjinghua/gg1812066149.shtml)]

二、 具体计算步骤

1. **制备样本与加标样**：将同一批样品分为两份，一份为空白样本（测定基础浓度），另一份加入已知浓度的标准品作为加标样本。
2. **检测与计算浓度**：根据试剂盒的标准曲线，计算出空白样本和加标样本中靶蛋白/物质的浓度。
3. **扣除本底并计算**：从加标样本的实测浓度中减去空白样本的测定浓度（即为扣除本底后的实际增加量），再除以理论添加浓度。 [[1](http://docs.abcam.com/pdf/protocols/ELISA-Guide.pdf?elqTrackId=018345e97d1f4ccdbdec83c5de412b26&elqaid=931&elqat=2), [2](http://labchem.fujifilm-wako.com.cn/gories/show/125.html), [3](https://www.tw-reagent.com/article.php?id=648)]

三、 实例解析

假设某血清样本中目标蛋白的基础浓度测得为 \(10 \text{ ng/mL}\)。
随后，人为向该样本中加入标准品，使其**理论上**增加 \(20 \text{ ng/mL}\)（即理论加标浓度为 \(20 \text{ ng/mL}\)，理论总浓度为 \(30 \text{ ng/mL}\)）。
最终使用ELISA测出加标样本的总浓度为 \(28 \text{ ng/mL}\)。

- 测得增加量 = \(28 - 10 = 18 \text{ ng/mL}\)
- 回收率 = \(\frac{18}{20} \times 100\% = 90\%\)

四、 结果判定标准

- **可接受范围**：一般合格的ELISA试剂盒，其平均回收率应在 **\(80\% \sim 120\%\)** 之间。 [[1](https://www.feiyuebio.com/product/traditional/FY-EU1201-2.pdf), [2](https://www.tw-reagent.com/article.php?id=648)]
- **结果分析**：
  - 若回收率 **低于 \(80\%\)**，说明样品基质中可能存在抑制效应（如蛋白质干扰）导致目标物丢失或检测受阻。
  - 若回收率 **高于 \(120\%\)**，则可能存在基质增强效应，导致假阳性或读数偏高。
  - 若超出此范围，通常需要对样品进行适当稀释（如 1:2 或 1:4），或更换与样品基质更匹配的检测稀释液。 [[1](http://docs.abcam.com/pdf/protocols/ELISA-Guide.pdf?elqTrackId=018345e97d1f4ccdbdec83c5de412b26&elqaid=931&elqat=2), [2](https://www.tw-reagent.com/article.php?id=648), [3](http://labchem.fujifilm-wako.com.cn/gories/show/125.html)]

若您目前正在处理ELISA实验的数据，需要进一步确认标准曲线的拟合方法或样本的稀释倍数，可以随时告诉我。我可以为您提供更具体的分析指导！