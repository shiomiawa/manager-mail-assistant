// AIに書かせる部分（決まった区画の中身だけ）。数字はAIに書かせず、テンプレート側でコードの計算値を入れる

/** 箇条書き1行の上限（1行に収めるため） */
export const MAX_BULLET_LENGTH = 45;
export const MAX_BULLETS = 3;

/** チーム向けメールのAIコメント */
export type TeamComment = {
  goodPoints: string[]; // よかった点
  concerns: string[]; // 気になる点
  nextActions: string[]; // 来週に向けて
  closing: string; // 締めの一言
};

/** 個人向けメールのAIコメント */
export type IndividualComment = {
  goodPoints: string[]; // よかった点
  // 次に向けて（OLPの観点での声かけ。問いかけ・提案の形）。principle は config/olp.json の項目名（なければ空文字）
  nextSteps: { principle: string; text: string }[];
  closing: string;
};

export type CommentResponse<T> = { comment: T; mock: boolean };
