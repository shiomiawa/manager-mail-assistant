// AIに書かせる部分（決まった区画の中身だけ）。数字はAIに書かせず、テンプレート側でコードの計算値を入れる

/** 箇条書き1行の上限（1行に収めるため） */
export const MAX_BULLET_LENGTH = 45;
export const MAX_BULLETS = 3;
/** 個人向けの Good Points・Next Steps は例外で、2〜3文・この文字数まで。4週間の推移にも触れる */
export const MAX_LONG_ITEM_LENGTH = 100;

/** チーム向けメールのAIコメント */
export type TeamComment = {
  goodPoints: string[]; // よかった点
  concerns: string[]; // 気になる点
  nextActions: string[]; // 来週に向けて
  closing: string; // 締めの一言
};

/** 個人向けメールのAIコメント */
export type IndividualComment = {
  goodPoints: string[]; // よかった点（2〜3文。Kudosをほめ、推移にも触れる）
  // 次に向けて（2〜3文。行動指針の観点での声かけ。改善点は責めずに、推移も踏まえた問いかけ・提案の形）
  // principle は config/principles.json の項目名（なければ空文字）
  nextSteps: { principle: string; text: string }[];
  closing: string;
};

export type CommentResponse<T> = { comment: T; mock: boolean };
