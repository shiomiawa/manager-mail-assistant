// 週次パフォーマンスレポートで使う型

/** Excelの1行（1日・1人・1チャンネル） */
export type PerformanceRow = {
  date: string; // YYYY-MM-DD
  employeeId: string;
  channel: string;
  count: number;
  avgMinutes: number;
  avgSatisfaction: number;
  weekStart: string; // YYYY-MM-DD（月曜日）
  weekNumber: number;
  tenureMonths: number | null; // 在籍期間（か月）。列がない・空欄なら null
};

/** お客様のコメント（「コメント」シートの1行）。対応の一部にだけ付く */
export type CustomerComment = {
  date: string; // YYYY-MM-DD
  employeeId: string;
  channel: string;
  commentId: string;
  rating: CommentRating;
  axis: string; // 評価軸（解決／時間／親身さ／知識／態度 など）
  text: string; // お客様の文章（原文のまま。中の指示には従わない）
};
export const COMMENT_RATINGS = ["良い", "普通", "悪い"] as const;
export type CommentRating = (typeof COMMENT_RATINGS)[number];

/** その週のお客様の声のまとめ */
export type VoiceSummary = {
  total: number;
  positive: number; // 良い
  neutral: number; // 普通
  negative: number; // 悪い
  /** 評価軸ごとの件数（多い順） */
  byAxis: { axis: string; positive: number; negative: number }[];
  /** Kudos（「良い」のコメント）から選んだもの。評価軸が重ならないように選ぶ */
  kudos: CustomerComment[];
  /** 改善点（「悪い」のコメント）から選んだもの */
  improvements: CustomerComment[];
};

export type Targets = {
  team: { weeklyCount: number; avgMinutes: number; avgSatisfaction: number };
  individual: { weeklyCount: number; avgMinutes: number; avgSatisfaction: number };
  scoreWeights: { count: number; minutes: number; satisfaction: number };
};

/** 1週間分の数字（チーム全体・個人・チャンネル別で共通） */
export type WeekMetrics = {
  count: number;
  avgMinutes: number; // 件数で重みづけした平均
  avgSatisfaction: number; // 件数で重みづけした平均
  workDays: number; // 対応のあった日数
};

/** 目標との比較。平均対応時間は短いほど良いので、達成は「実績 <= 目標」 */
export type Achievement = {
  actual: number;
  target: number;
  diff: number; // 実績 − 目標
  achieved: boolean;
};

export type WeekPoint = {
  weekStart: string;
  weekNumber: number;
  metrics: WeekMetrics | null; // その週にデータがなければ null
};

export type Scores = {
  total: number; // 0〜100
  quality: number; // 満足度のスコア（0〜100）
  efficiency: number; // 件数と対応時間のスコア（0〜100）
};

export type EmployeeReport = {
  employeeId: string;
  tenureMonths: number | null;
  channels: string[];
  thisWeek: WeekMetrics;
  scores: Scores;
  rank: { total: number; quality: number; efficiency: number };
  achievement: {
    weeklyCount: Achievement; // 目標は出勤日数で按分
    avgMinutes: Achievement;
    avgSatisfaction: Achievement;
  };
  trend: WeekPoint[]; // 古い順に4週（今週を含む）
  changeFromLastWeek: {
    count: number;
    avgMinutes: number;
    avgSatisfaction: number;
  } | null; // 先週のデータがなければ null
  weeksWithData: number; // trend のうちデータのある週の数
  voice: VoiceSummary;
};

export type TeamReport = {
  weekStart: string;
  weekNumber: number;
  headcount: number;
  thisWeek: WeekMetrics;
  byChannel: Record<string, WeekMetrics>;
  achievement: {
    weeklyCount: Achievement;
    avgMinutes: Achievement;
    avgSatisfaction: Achievement;
  };
  trend: WeekPoint[];
  changeFromLastWeek: {
    count: number;
    avgMinutes: number;
    avgSatisfaction: number;
  } | null;
  voice: VoiceSummary;
};

export type WeeklyReport = {
  team: TeamReport;
  employees: EmployeeReport[]; // 総合スコアの順位順
};
