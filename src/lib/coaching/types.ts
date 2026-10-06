// アンケートのコーチング：1人のメンバーの直近4週間のお客様アンケート（コメント）から、1on1 で使う材料を作る

import type { CustomerComment } from "@/lib/report/types";

/** コードで計算してAIに渡すデータ（AIには計算させない） */
export type CoachingInput = {
  employeeId: string;
  tenureMonths: number | null;
  weekLabel: string; // 例：Week 37〜40（2026/09/07〜10/02）
  csatTarget: number;
  weeks: { weekNumber: number; csat: number | null; cases: number | null; aht: number | null }[];
  totals: { total: number; positive: number; neutral: number; negative: number };
  byAxis: { axis: string; positive: number; neutral: number; negative: number }[]; // 「悪い」の多い順
  positives: CustomerComment[]; // 引用する「良い」のコメント
  negatives: CustomerComment[]; // 引用する「悪い」のコメント
  memo: string; // マネージャーの行動メモ（任意）
};

/** AIが書く部分 */
export type CoachingDraft = {
  headline: string; // 件名の結論部分（30字以内）
  summary: string; // お客様の声の概要（2〜3文）
  strengths: { axis: string; point: string }[]; // 強み（お客様が評価していること）
  focusAreas: {
    axis: string;
    voice: string; // お客様が言っていること（事実）
    hypothesis: string; // 考えられる理由（仮説。断定しない）
    tryThis: string; // 試すこと（具体的な行動）
    examplePhrase: string; // 言い換えの例文（なければ空文字）
    principle: string; // 関係する行動指針（Principles）の項目名（なければ空文字）
  }[];
  questions: string[]; // 1on1 で聞く質問（本人に考えてもらう問いかけ）
  nextCheck: string; // 次の数週間で見ること（1文）
  messageToEmployee: {
    opening: string; // 書き出し（1〜2文）
    closing: string; // 締めの一言
  };
};
