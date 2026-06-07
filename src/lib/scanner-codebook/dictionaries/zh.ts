import {
  scannerCodeRegistry,
  type ActiveScannerCode,
} from "@/lib/scanner-codebook/codeRegistry";
import type { ScannerCodeDictionary } from "@/lib/scanner-codebook/codeTypes";

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
    short: "当前没有明确的扫描优势。",
  },
  GR_101: {
    label: "观察",
    short: "值得跟踪，但确认条件还不完整。",
  },
  GR_201: {
    label: "建设性观察",
    short: "结构偏建设性，但置信度或确认条件仍有限。",
  },
  GR_301: {
    label: "风险",
    short: "风险条件主导当前扫描结果。",
  },
  GR_302: {
    label: "过热",
    short: "动量或延伸状态带来较高追高风险。",
  },
  GR_401: {
    label: "历史数据不足",
    short: "可用K线不足，暂时无法形成可靠扫描判断。",
  },
  GR_402: {
    label: "低质量排除",
    short: "数据或流动性质量低于研究排序要求。",
  },
  GR_501: {
    label: "符合条件",
    short: "该标的符合人工研究复核条件。",
  },
  GR_601: {
    label: "高优先级",
    short: "该标的排序较高，且风险与证据质量更可接受。",
  },
  AC_001: {
    label: "低优先级",
    short: "扫描器未提示需要立即处理。",
  },
  AC_101: {
    label: "观察",
    short: "保留在研究观察列表中。",
  },
  AC_102: {
    label: "等待",
    short: "证据尚不完整，需要等待更多确认。",
  },
  AC_103: {
    label: "仅监控",
    short: "仅作为背景监控，不提高研究优先级。",
  },
  AC_201: {
    label: "人工复核",
    short: "需要人工复核扫描证据。",
  },
  AC_301: {
    label: "避免追高",
    short: "延伸风险偏高，不宜追高。",
  },
  AC_302: {
    label: "降低优先级",
    short: "风险或质量惩罚降低研究优先级。",
  },
  AC_401: {
    label: "排除",
    short: "因必要证据不足而排除在研究优先级之外。",
  },
  AC_501: {
    label: "研究观察",
    short: "加入研究观察列表供人工复核。",
  },
  AC_601: {
    label: "高优先级复核",
    short: "优先进行人工研究复核。",
  },
  NX_001: {
    label: "中性",
    short: "扫描器没有给出明确优势。",
  },
  NX_101: {
    label: "混合研究背景",
    short: "信号并不一致，只适合作为研究背景。",
  },
  NX_201: {
    label: "谨慎",
    short: "需要更多确认，处理时应保持谨慎。",
  },
  NX_302: {
    label: "执行噪声",
    short: "该结构可能受到执行噪声影响。",
  },
  NX_801: {
    label: "未知",
    short: "该代码暂无解释。",
  },
  PX_101: {
    label: "弱反弹",
    short: "反弹质量偏弱，风险相对更高。",
  },
  PX_201: {
    label: "突破尝试",
    short: "价格正在尝试突破，但确认尚未完整。",
  },
  PX_303: {
    label: "破位",
    short: "结构已经向下破位。",
  },
  PX_305: {
    label: "突破失败",
    short: "突破尝试已经失败或失败风险升高。",
  },
  PX_501: {
    label: "突破确认",
    short: "扫描器确认了突破结构。",
  },
  PX_502: {
    label: "回踩复测",
    short: "价格正在复测此前的结构区域。",
  },
  PX_503: {
    label: "区间收复",
    short: "价格正在收复此前区间。",
  },
  PX_604: {
    label: "压缩突破",
    short: "压缩结构正在向突破形态演化。",
  },
  ST_001: {
    label: "中性",
    short: "当前没有明确的结构类型。",
  },
  ST_201: {
    label: "筑底",
    short: "价格更接近筑底状态，而不是清晰趋势。",
  },
  ST_202: {
    label: "短期复测",
    short: "短期结构处于复测状态。",
  },
  ST_301: {
    label: "过度延伸",
    short: "价格相对附近趋势支撑已经延伸。",
  },
  ST_302: {
    label: "派发",
    short: "结构显示派发风险。",
  },
  ST_501: {
    label: "健康回踩",
    short: "按扫描条件看，回踩结构仍偏建设性。",
  },
  ST_502: {
    label: "趋势延续",
    short: "趋势延续结构仍偏建设性。",
  },
  ST_503: {
    label: "趋势修复",
    short: "趋势结构正在从弱势中修复。",
  },
  TR_202: {
    label: "日线趋势",
    short: "较高周期趋势背景偏建设性。",
  },
  TR_504: {
    label: "长期修复",
    short: "长期结构正在修复。",
  },
  TR_601: {
    label: "强趋势",
    short: "趋势结构较强。",
  },
  RK_201: {
    label: "已检测风险",
    short: "扫描器检测到一个或多个风险条件。",
  },
  RK_301: {
    label: "风险升高",
    short: "风险条件已经升高。",
  },
  RK_302: {
    label: "收益风险不佳",
    short: "风险条件超过了当前结构质量。",
  },
  RK_303: {
    label: "追高风险",
    short: "动量或延伸已经偏晚，研究优先级下降。",
  },
  RK_304: {
    label: "假突破风险",
    short: "突破或收复证据存在失败风险。",
  },
  RK_305: {
    label: "突破失败风险",
    short: "突破失败风险偏高。",
  },
  QH_001: {
    label: "正常",
    short: "质量满足正常扫描展示。",
  },
  QH_101: {
    label: "低质量",
    short: "质量低于扫描器偏好的标准。",
  },
  QH_201: {
    label: "历史数据不足",
    short: "历史K线深度不足。",
  },
  QH_202: {
    label: "新上市",
    short: "上市历史较短。",
  },
  QH_501: {
    label: "主要",
    short: "该标的具备主要市场质量。",
  },
  QH_601: {
    label: "核心",
    short: "该标的具备核心市场质量。",
  },
  VL_104: {
    label: "量能偏弱",
    short: "量能或流动性背景偏弱。",
  },
  VL_304: {
    label: "流动性尖峰风险",
    short: "流动性尖峰风险偏高。",
  },
  VL_601: {
    label: "量能支持上行",
    short: "量能支持偏建设性的扫描结果。",
  },
} satisfies ScannerCodeDictionary;

export const zhScannerCodeDictionary = {
  ...generatedChineseBaselineScannerCodeEntries,
  ...manualChineseScannerCodeEntries,
} satisfies ScannerCodeDictionary;
