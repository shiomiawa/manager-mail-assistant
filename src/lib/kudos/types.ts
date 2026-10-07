// 称賛メール（Kudos Mail）：メンバーの具体的な行動をほめるメールを作る
import type { CustomerComment } from "@/lib/report/types";

/** AIに渡すデータ（数字とお客様の声はコードで用意する） */
export type KudosInput = {
  name: string; // ほめる人（社員IDや名前）
  episode: string; // マネージャーが書いた具体的な行動（必須）
  quotes: CustomerComment[]; // 引用するお客様のほめ言葉（3件まで）
  trend: string[]; // 4週間の推移（例：「Week 37：CSAT 4.10、Cases 77件、AHT 10.5分」）。データがなければ空
  tenureMonths: number | null;
  includeTeam: boolean; // チームへの紹介メールも作るか
};

/** AIが書く部分 */
export type KudosDraft = {
  toEmployee: {
    opening: string; // 書き出し（1〜2文）
    whatYouDid: string[]; // 何をしたか（具体的な行動。1〜3項目）
    impact: string[]; // その行動がもたらしたこと（お客様の声・数字。0〜3項目）
    principle: string; // 関係する行動指針の項目名（なければ空文字）
    principleNote: string; // 行動指針とのつながり（1文。なければ空文字）
    closing: string; // 感謝の締め（1〜2文）
  };
  toTeam: {
    intro: string; // 紹介の書き出し（1文）
    highlights: string[]; // 紹介する行動（1〜3項目）
    whyItMatters: string; // チームにとって大事な理由（1〜2文）
    closing: string; // 締め（1文）
  } | null;
};
