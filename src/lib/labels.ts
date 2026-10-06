// 画面とメールのラベル（英語）。説明文は日本語、項目名・見出し・順位などのラベルは英語にする
// 用語：Quality（クオリティ）＝満足度、Efficiency（エフィシェンシー＝効率）＝対応件数・対応時間

export const L = {
  // 観点
  quality: "Quality",
  efficiency: "Efficiency",
  total: "Total",
  // 指標
  csat: "CSAT", // 平均満足度
  cases: "Cases", // 対応件数
  aht: "AHT", // 平均対応時間（Average Handle Time）
  // 達成
  met: "Met",
  missed: "Missed",
  target: "Target",
  vsLastWeek: "vs last week",
  // 表
  week: "Week",
  channel: "Channel",
  rank: "Rank",
  employeeId: "Employee ID",
  score: "Score",
  item: "Item",
  tenure: "Tenure",
  // メールの見出し
  keyPoints: "Key Points",
  thisWeek: "This Week",
  byChannel: "By Channel",
  trend: "4-Week Trend",
  top3: "Top 3 (Total Score)",
  scores: "Scores",
  review: "Review",
  goodPoints: "Good Points",
  concerns: "Concerns",
  nextWeek: "Next Week",
  nextSteps: "Next Steps",
  customerVoice: "Customer Voice",
  kudos: "Kudos",
  toImprove: "Areas to Improve",
  comments: "Comments",
  axis: "Topic",
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  weeklyReport: "Weekly Report",
  individualReport: "Individual Report",
} as const;

const CHANNELS: Record<string, string> = { 電話: "Phone", メール: "Email", チャット: "Chat" };

/** チャンネル名を英語にする（知らない名前はそのまま） */
export const channelLabel = (name: string) => CHANNELS[name] ?? name;

// お客様コメントの評価軸
const AXES: Record<string, string> = {
  解決: "Resolution",
  時間: "Speed",
  親身さ: "Empathy",
  知識: "Knowledge",
  態度: "Attitude",
};

/** 評価軸を英語にする（知らない名前はそのまま） */
export const axisLabel = (name: string) => AXES[name] ?? name;

/** 順位（例：#3） */
export const rankLabel = (rank: number) => `#${rank}`;

/** 在籍期間（例：29か月 → 2y 5m、3か月 → 3m） */
export function tenureLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest}m`;
  return `${years}y ${rest}m`;
}
