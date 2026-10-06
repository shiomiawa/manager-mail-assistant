// 会議メモからの下書き：AIに書かせる部分（決まった区画の中身だけ）
// 見た目はテンプレートで固定し、ここにある文章だけをAIが書く

export type MeetingType = "1on1" | "team";

export type ActionItem = { owner: string; task: string; due: string }; // due は「10/9」「次回まで」など。なければ空文字

/** 意見への反応の種類（ラベルは英語で表示） */
export const REACTION_KINDS = ["agree", "willTry", "question", "disagree", "comment", "reply"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

/**
 * チームミーティングの話し合いの記録（アジェンダに沿って全員に意見を聞く形式）。
 * 誰がどんな意見を言い、ほかの人がどう反応したか、意見が分かれた点、総括を残す
 */
export type Discussion = {
  agenda: string;
  opinions: {
    speaker: string;
    opinion: string; // 意見（1〜2文）
    reactions: { speaker: string; kind: ReactionKind; text: string }[];
  }[];
  /** 意見が分かれた点：それぞれの考えと理由、話し合った結果 */
  differentViews: {
    topic: string;
    views: { speaker: string; view: string; reason: string }[];
    outcome: string;
  }[];
  /** 総括（2〜4文） */
  wrapUp: string;
};

export type MeetingDraft = {
  /** 件名の「結論」部分（30字程度まで。次回の日程はコードが付けるので入れない） */
  headline: string;
  /** チームミーティングの話し合いの記録。1on1では null */
  discussion: Discussion | null;
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
  agenda?: string; // あらかじめ決めたアジェンダ（チームミーティング）
  nextMeetingDate?: string; // 次回の日付 YYYY-MM-DD（フォームのカレンダーで選ぶ）
  nextMeetingTime?: string; // 次回の時刻 HH:MM（任意）
};
