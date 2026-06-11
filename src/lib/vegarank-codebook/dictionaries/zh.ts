import {
  scannerCodeRegistry,
  type ActiveScannerCode,
} from "@/lib/vegarank-codebook/codeRegistry";
import type { ScannerCodeDictionary } from "@/lib/vegarank-codebook/codeTypes";

export const generatedChineseBaselineScannerCodeEntries = Object.fromEntries(
  Object.values(scannerCodeRegistry).map((metadata) => [
    metadata.code,
    {
      label: metadata.code,
      short: "该扫描代码已有记录，但暂无详细中文解释。",
    },
  ]),
) as Record<ActiveScannerCode, { label: string; short: string }>;

export const manualChineseScannerCodeEntries = {
  GR_001: {
    label: "中性",
    short: "当前证据不足以形成更高研究优先级。",
  },
  GR_101: {
    label: "观察",
    short: "已有部分证据，但更适合继续观察。",
  },
  GR_201: {
    label: "建设性观察",
    short: "结构正在改善，但确认仍有限。",
  },
  GR_301: {
    label: "风险",
    short: "风险约束升高，研究优先级应降低。",
  },
  GR_302: {
    label: "过热",
    short: "动量或价格乖离偏高，追高风险升高。",
  },
  GR_401: {
    label: "历史样本不足",
    short: "历史样本不足，证据可靠性受限。",
  },
  GR_402: {
    label: "低质量排除",
    short: "数据质量、流动性或资格约束过强，已排除出优先研究范围。",
  },
  GR_501: {
    label: "研究合格",
    short: "结构证据和风险条件足以保留在研究范围内。",
  },
  GR_601: {
    label: "高优先级复核",
    short: "结构质量、证据可靠性和风险条件支持优先人工复核。",
  },

  AC_001: {
    label: "低优先级",
    short: "当前扫描结果不需要提高研究优先级。",
  },
  AC_101: {
    label: "观察",
    short: "保留在观察范围内，但不视为紧急复核。",
  },
  AC_102: {
    label: "等待",
    short: "等待更多确认或更清晰的结构。",
  },
  AC_103: {
    label: "仅跟踪",
    short: "仅作为背景跟踪，暂不提升优先级。",
  },
  AC_201: {
    label: "人工复核",
    short: "证据较混合，适合人工检查上下文。",
  },
  AC_301: {
    label: "避免追高",
    short: "后续反应的风险回报比不佳，应降低优先级。",
  },
  AC_302: {
    label: "降低优先级",
    short: "风险或证据可靠性约束降低研究优先级。",
  },
  AC_401: {
    label: "排除",
    short: "由于证据约束较强，排除出优先研究范围。",
  },
  AC_501: {
    label: "加入研究观察",
    short: "保留为研究候选，进入人工复核队列。",
  },
  AC_601: {
    label: "高优先级复核",
    short: "证据质量和风险背景较好，可优先人工复核。",
  },

  MO_001: {
    label: "动量中性",
    short: "动量证据较平衡，暂不改变研究优先级。",
  },
  MO_101: {
    label: "动量偏弱",
    short: "动量证据偏弱，延续性信心下降。",
  },
  MO_201: {
    label: "动量改善",
    short: "动量正在改善，但仍需结合其他因素复核。",
  },
  MO_202: {
    label: "动量观察",
    short: "动量支持继续观察，但确认仍不完整。",
  },
  MO_340: {
    label: "动量过热",
    short: "动量偏高，追高风险升高。",
  },
  MO_301: {
    label: "RSI 背景偏弱",
    short: "RSI 背景偏弱，动量证据可靠性下降。",
  },
  MO_302: {
    label: "MACD 转弱",
    short: "MACD 背景正在转弱，延续性可靠性下降。",
  },
  MO_303: {
    label: "MACD 偏弱",
    short: "MACD 证据偏弱，拖累当前扫描结果。",
  },
  MO_304: {
    label: "MACD 继续走弱",
    short: "MACD 证据进一步走弱，需要保持谨慎。",
  },
  MO_501: {
    label: "RSI 修复",
    short: "RSI 背景正在修复，支持更建设性的复核。",
  },
  MO_502: {
    label: "MACD 改善",
    short: "MACD 证据正在改善，支持建设性动量背景。",
  },
  MO_601: {
    label: "MACD 背景较强",
    short: "MACD 证据较强，支持动量确认。",
  },
  MO_603: {
    label: "RSI 恢复",
    short: "RSI 背景恢复，动量证据可靠性改善。",
  },

  TR_001: {
    label: "趋势背景",
    short: "趋势信息可作为辅助研究背景。",
  },
  TR_101: {
    label: "趋势修复",
    short: "趋势质量正在修复，但仍需要更清晰确认。",
  },
  TR_201: {
    label: "短期趋势下方",
    short: "价格低于近端趋势参考，趋势质量受限。",
  },
  TR_202: {
    label: "日线趋势",
    short: "较高周期趋势背景偏建设性。",
  },
  TR_301: {
    label: "中期趋势下方",
    short: "价格低于中期趋势参考，确认力度较弱。",
  },
  TR_302: {
    label: "长期趋势下方",
    short: "价格低于长期趋势参考，证据可靠性较弱。",
  },
  TR_303: {
    label: "趋势排列偏弱",
    short: "均线排列偏弱，趋势一致性下降。",
  },
  TR_304: {
    label: "修复结构丢失",
    short: "此前的趋势修复尝试正在失去结构。",
  },
  TR_305: {
    label: "重新站回失败",
    short: "价格未能重新站回关键趋势参考，置信度受限。",
  },
  TR_501: {
    label: "短期趋势上方",
    short: "价格位于近端趋势参考上方，支持趋势质量。",
  },
  TR_502: {
    label: "中期趋势上方",
    short: "价格位于中期趋势参考上方，趋势背景改善。",
  },
  TR_503: {
    label: "长期趋势上方",
    short: "价格位于长期趋势参考上方，支持更宽的结构背景。",
  },
  TR_504: {
    label: "主趋势修复",
    short: "更宽周期的趋势结构正在从弱势中修复。",
  },
  TR_601: {
    label: "强趋势",
    short: "趋势质量较强，在风险可接受时支持更高研究优先级。",
  },
  TR_602: {
    label: "长期排列改善",
    short: "长期趋势排列偏建设性，证据可靠性改善。",
  },
  TR_603: {
    label: "趋势重新站回",
    short: "价格正在重新站回重要趋势参考。",
  },
  TR_604: {
    label: "趋势排列修复",
    short: "趋势排列正在改善，可能支持后续延续性。",
  },
  TR_605: {
    label: "短期排列改善",
    short: "近端趋势排列偏建设性。",
  },

  PX_001: {
    label: "结构中性",
    short: "价格结构保持中性，暂不改变研究优先级。",
  },
  PX_101: {
    label: "反弹偏弱",
    short: "反弹质量偏弱，需要更清晰确认。",
  },
  PX_201: {
    label: "突破尝试",
    short: "价格结构正在尝试改善，但确认仍不完整。",
  },
  PX_301: {
    label: "上影风险",
    short: "K线结构显示受压风险，延续性质量较弱。",
  },
  PX_302: {
    label: "收盘偏弱",
    short: "收盘质量偏弱，结构置信度下降。",
  },
  PX_303: {
    label: "结构跌破风险",
    short: "价格结构走弱，研究优先级应降低。",
  },
  PX_304: {
    label: "突破位丢失",
    short: "此前的结构位置被丢失，当前结构转弱。",
  },
  PX_305: {
    label: "突破失败",
    short: "突破尝试已经失败，或失败风险升高。",
  },
  PX_501: {
    label: "突破确认",
    short: "结构确认更强，但仍需结合风险和流动性复核。",
  },
  PX_502: {
    label: "回踩复测",
    short: "价格正在以较建设性的方式复测此前结构区域。",
  },
  PX_503: {
    label: "区间收复",
    short: "价格正在收复此前区间，结构质量改善。",
  },
  PX_601: {
    label: "收盘较强",
    short: "收盘表现支持更强的价格结构确认。",
  },
  PX_602: {
    label: "突破位守住",
    short: "价格守住此前突破区域，结构可靠性改善。",
  },
  PX_603: {
    label: "前高突破",
    short: "价格越过此前高点，支持结构确认。",
  },
  PX_604: {
    label: "压缩突破",
    short: "压缩状态正在转向更强的结构形态。",
  },

  VO_001: {
    label: "波动率正常",
    short: "波动率背景正常，不主导当前扫描结果。",
  },
  VO_101: {
    label: "低波动",
    short: "波动较安静，需要更多上下文才能提高优先级。",
  },
  VO_102: {
    label: "波动率正常",
    short: "波动率仍处于正常研究范围。",
  },
  VO_202: {
    label: "波动率压缩",
    short: "波动率处于压缩状态，需结合趋势和结构判断意义。",
  },
  VO_301: {
    label: "波动扩张风险",
    short: "波动率扩张提高风险，需要谨慎复核。",
  },
  VO_302: {
    label: "波动不稳定",
    short: "波动不稳定，降低当前结构的证据可靠性。",
  },
  VO_501: {
    label: "压缩结构",
    short: "当趋势和结构配合时，压缩状态更具建设性。",
  },
  VO_601: {
    label: "扩张确认",
    short: "波动率扩张得到更多确认，仍需结合上下文复核。",
  },

  VL_001: {
    label: "参与度正常",
    short: "交易活跃度接近正常水平，不主导当前扫描结果。",
  },
  VL_101: {
    label: "活跃度偏低",
    short: "交易活跃度低于偏好的研究范围。",
  },
  VL_104: {
    label: "参与度偏弱",
    short: "成交参与度或流动性背景偏弱，降低置信度。",
  },
  VL_201: {
    label: "参与度安静",
    short: "交易活跃度较安静，只有在其他证据配合时才支持压缩背景。",
  },
  VL_202: {
    label: "活跃度不稳定",
    short: "交易活跃度不稳定，证据可靠性下降。",
  },
  VL_301: {
    label: "流动性风险升高",
    short: "流动性可靠性偏弱，研究优先级应降低。",
  },
  VL_302: {
    label: "放量噪声风险",
    short: "成交量异常放大增加噪声风险，需要谨慎复核。",
  },
  VL_303: {
    label: "派发量能",
    short: "成交量行为增加结构转弱风险。",
  },
  VL_304: {
    label: "流动性尖峰风险",
    short: "流动性状态异常，降低证据可靠性。",
  },
  VL_401: {
    label: "流动性排除",
    short: "流动性约束过强，不适合优先研究。",
  },
  VL_501: {
    label: "参与度扩张",
    short: "成交参与度扩大，在结构建设性时可支持确认。",
  },
  VL_601: {
    label: "参与度支持结构",
    short: "成交参与度支持当前建设性结构。",
  },
  VL_602: {
    label: "回踩量能稳定",
    short: "回踩时成交参与度较稳定，支持结构质量。",
  },

  RK_101: {
    label: "轻度谨慎",
    short: "存在轻度风险约束，复核时需要纳入考虑。",
  },
  RK_201: {
    label: "已检测风险",
    short: "当前扫描结果存在一个或多个风险约束。",
  },
  RK_202: {
    label: "风险不对称",
    short: "风险不够均衡，需要更强证据才适合提高优先级。",
  },
  RK_301: {
    label: "风险升高",
    short: "风险约束已经升高，降低证据置信度。",
  },
  RK_302: {
    label: "风险回报比不佳",
    short: "风险约束超过当前结构质量。",
  },
  RK_303: {
    label: "追高风险",
    short: "价格或动量乖离偏高，后续反应吸引力下降。",
  },
  RK_304: {
    label: "假突破风险",
    short: "突破或重新站回的证据存在失败风险。",
  },
  RK_305: {
    label: "突破失败风险",
    short: "突破失败风险升高，研究优先级下降。",
  },
  RK_306: {
    label: "确认转弱",
    short: "风险上升，同时确认力度正在减弱。",
  },
  RK_401: {
    label: "硬性风险排除",
    short: "风险约束过强，应排除出优先研究范围。",
  },

  ST_001: {
    label: "结构中性",
    short: "当前没有明确的结构类型。",
  },
  ST_201: {
    label: "基底构建",
    short: "价格更接近基底构建，而不是清晰趋势。",
  },
  ST_202: {
    label: "短期复测",
    short: "短期结构正在复测此前参考区域。",
  },
  ST_301: {
    label: "过度延伸",
    short: "价格偏离基底过远，追高风险升高。",
  },
  ST_302: {
    label: "派发风险",
    short: "结构显示派发风险，延续性质量下降。",
  },
  ST_501: {
    label: "健康回踩",
    short: "回踩结构仍偏建设性。",
  },
  ST_502: {
    label: "趋势延续",
    short: "趋势延续结构仍偏建设性。",
  },
  ST_503: {
    label: "趋势修复",
    short: "趋势结构正在从弱势中修复。",
  },

  QH_001: {
    label: "质量正常",
    short: "数据质量足以支持正常扫描展示。",
  },
  QH_101: {
    label: "低质量",
    short: "证据质量低于偏好的研究标准。",
  },
  QH_102: {
    label: "RSI 不足",
    short: "RSI 证据不可用，动量置信度受限。",
  },
  QH_103: {
    label: "布林背景不足",
    short: "布林背景不可用，波动率置信度受限。",
  },
  QH_201: {
    label: "历史样本不足",
    short: "历史样本深度不足，难以形成可靠扫描判断。",
  },
  QH_202: {
    label: "新上市",
    short: "上市历史较短，证据可靠性受限。",
  },
  QH_301: {
    label: "历史样本不稳定",
    short: "历史证据不够稳定，难以支持较高置信度。",
  },
  QH_401: {
    label: "历史样本排除",
    short: "历史样本深度过低，不适合优先研究。",
  },
  QH_402: {
    label: "数据质量排除",
    short: "数据质量约束过强，难以形成可靠扫描判断。",
  },
  QH_501: {
    label: "主要质量",
    short: "该标的具备较稳定的市场质量，适合扫描研究。",
  },
  QH_601: {
    label: "核心质量",
    short: "该标的具备核心市场质量，证据可靠性较好。",
  },

  NX_001: {
    label: "优先级不明确",
    short: "当前证据不足以进入更强研究分组。",
  },
  NX_101: {
    label: "混合研究背景",
    short: "证据较混合，只适合作为辅助研究背景。",
  },
  NX_201: {
    label: "谨慎",
    short: "当前扫描结果需要更多确认后再提高优先级。",
  },
  NX_302: {
    label: "执行噪声",
    short: "该结构可能受到执行质量或市场噪声影响。",
  },
  NX_801: {
    label: "未知代码",
    short: "该扫描代码暂无解释。",
  },
} satisfies ScannerCodeDictionary;

export const zhScannerCodeDictionary = {
  ...generatedChineseBaselineScannerCodeEntries,
  ...manualChineseScannerCodeEntries,
} satisfies ScannerCodeDictionary;
