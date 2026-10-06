// 会議メモからの下書き：AIに書かせる部分（決まった区画の中身だけ）
// 見た目はテンプレートで固定し、ここにある文章だけをAIが書く

export type MeetingType = "1on1" | "team";

export type ActionItem = { owner: string; task: string; due: string }; // due は「10/9」「次回まで」など。なければ空文字

export type MeetingDraft = {
  /** 件名の「結論」部分（30字程度まで） */
  headline: string;
  /** Summary（マネージャーが読む要約） */
  summary: {
    keyPoints: string[]; // 冒頭の要点（3つまで）
    topics: string[]; // 話した内容
    decisions: string[]; // 決まったこと
    actionItems: ActionItem[];
  };
  /** To Employee（1on1の相手への下書き）。チームミーティングでは null */
  toEmployee: {
    keyPoints: string[];
    thanks: string[]; // 感謝・ほめたいこと
    agreed: string[]; // 一緒に決めたこと
    support: string[]; // マネージャーがすること
    closing: string;
  } | null;
  /** My Notes（自分用の控え。本人やチームには送らない） */
  myNotes: {
    keyPoints: string[];
    observations: string[]; // 気づいたこと（断定しない）
    followUps: string[]; // フォローすること
    sensitive: string[]; // 配慮が必要な話題（チーム向けには出さない）
  };
  /**
   * To Team（チームへの下書き）。1on1では、チームに共有してよい内容があるときだけ。
   * 個人的な話題（家庭・健康・評価など）は入れない。共有することがなければ null
   */
  toTeam: {
    keyPoints: string[];
    updates: string[]; // 共有すること
    actionItems: ActionItem[];
    closing: string;
  } | null;
};

export type MeetingRequest = {
  type: MeetingType;
  transcript: string;
  meetingDate: string; // YYYY-MM-DD
  counterpart?: string; // 1on1の相手（社員IDや名前）
};
