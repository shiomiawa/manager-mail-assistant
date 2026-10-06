// 説明会の要約とリマインダー：AIに書かせる部分（決まった区画の中身だけ）
// 日付の計算はAIにさせない。AIは「話の中ではっきり言った月と日」だけを数字で返し、年はコードで決める

/** 日程や期限。month・day は話の中で月と日がはっきり言われたときだけ（それ以外は null） */
export type BriefingDate = {
  item: string; // 何の日か（例：操作研修、事前アンケートの締め切り）
  whenText: string; // 話した言葉のまま（例：「10月23日（金）の17時」「来週中」）
  month: number | null;
  day: number | null;
  time: string; // "HH:MM"。時刻がはっきり言われていなければ空文字
};

export type BriefingDraft = {
  /** 件名の結論部分（30字以内） */
  headline: string;
  keyPoints: string[]; // 冒頭の要点（3つまで）
  overview: string; // 概要（2〜3文）
  takeaways: string[]; // 大事な点
  todos: { task: string; due: string }[]; // 自分がやること（due は話した言葉のまま）
  dates: BriefingDate[];
  openQuestions: string[]; // まだ決まっていないこと・確認したいこと
};

export type BriefingRequest = {
  title: string; // 説明会の名前
  briefingDate: string; // YYYY-MM-DD
  transcript: string;
};
