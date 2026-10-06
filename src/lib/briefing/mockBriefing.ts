// AIにつなぐまでのダミーの下書き。文字起こしから日付や依頼を含む文を拾うだけ（要約はしない）
import type { BriefingDate, BriefingDraft, BriefingRequest } from "./types";

const MAX_LINE = 45;
const DATE = /(\d{1,2})月(\d{1,2})日(?:[（(][月火水木金土日][）)])?/;
const TIME = /(\d{1,2})時(?:(\d{1,2})分|半)?/;

export function mockBriefingDraft(request: BriefingRequest): BriefingDraft {
  const sentences = request.transcript
    .split("\n")
    .map((line) => line.replace(/^[^：]{1,20}：/, ""))
    .flatMap((line) => line.split(/(?<=[。？！?!])/))
    .map((s) => s.trim())
    .filter((s) => s.length >= 8 && !/^(皆さん|本日は|お疲れ|ありがとう)/.test(s));

  // 日程・期限：月日を含む文（最後のまとめの文は除き、同じ日付は1つだけ）
  const dates: BriefingDate[] = [];
  for (const s of sentences) {
    if (/まとめ/.test(s)) continue;
    const date = s.match(DATE);
    const vague = s.match(/来週中|今週中|今月中/);
    if (!date && !(vague && /送り|お知らせ/.test(s))) continue;
    const month = date ? Number(date[1]) : null;
    const day = date ? Number(date[2]) : null;
    if (date && dates.some((d) => d.month === month && d.day === day)) continue;
    const time = s.match(TIME);
    dates.push({
      item: shorten(s),
      whenText: date ? `${date[0]}${time ? `の${time[0]}` : ""}` : vague![0],
      month,
      day,
      time: time ? `${time[1].padStart(2, "0")}:${time[2] ? time[2].padStart(2, "0") : time[0].endsWith("半") ? "30" : "00"}` : "",
    });
    if (dates.length >= 6) break;
  }

  const todos = sentences
    .filter((s) => /してください|お願いします|答えてください|確認しておいて/.test(s) && !/質問/.test(s))
    .map((s) => ({ task: shorten(s), due: s.match(DATE)?.[0] ?? s.match(/来週中|今週中/)?.[0] ?? "" }))
    .slice(0, 5);

  return {
    headline: request.title.slice(0, 30) || "説明会のメモ",
    keyPoints: [
      `${request.title || "説明会"}の内容を、自分用のメモにまとめました。`,
      `日程・期限が${dates.length}件、やることが${todos.length}件あります。`,
    ],
    overview: sentences.slice(0, 2).join(""),
    takeaways: sentences.filter((s) => /できるようになります|上限|使えません|移します|反映します/.test(s)).map(shorten).slice(0, 4),
    todos,
    dates,
    openQuestions: sentences.filter((s) => /検討中|後日お知らせ|未定/.test(s)).map(shorten).slice(0, 3),
  };
}

function shorten(text: string): string {
  return text.length > MAX_LINE ? `${text.slice(0, MAX_LINE - 1)}…` : text;
}
