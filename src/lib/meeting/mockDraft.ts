// AIにつなぐまでのダミーの下書き。文字起こしから決まった言葉を含む発言を拾うだけ（要約はしない）
import { listSpeakers } from "./transcript";
import type { ActionItem, MeetingDraft, MeetingRequest } from "./types";

const MAX_LINE = 45;
// 個人的な話題（チーム向けには出さない）
// シフトや勤務時間の相談も、事情に触れることが多いので個人的な話題として扱う
const SENSITIVE = /(子ども|子供|保育園|家族|家庭|体調|病院|通院|介護|妊娠|育休|メンタル|評価|給与|退職|シフト|勤務|休暇|有給)/;
const COMMIT = /(までに|お願いします|お願いしても|やってみ|試して|紹介します|共有して|直します|確認して)/;
const DUE = /(\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}|(?:今週の|来週の)?[月火水木金]曜(?:日)?(?:の朝会)?(?:まで)?|次回まで)/;
const MANAGER = /マネージャー|manager/i;
// あいさつや相づちだけの文（要約や取り組みには使わない）
const PLEASANTRY = /^(はい|お疲れ|おはよう|ありがとう|(?:今日は|本日は|今週も|来週も|引き続き)?よろしく|了解|分かりました|わかりました|もちろん|なるほど|助かります|賛成)/;

type Line = { speaker: string; text: string };

export function mockMeetingDraft(request: MeetingRequest): MeetingDraft {
  const lines: Line[] = request.transcript.split("\n").map((raw) => {
    const m = raw.match(/^([^：]{1,20})：(.*)$/);
    return m ? { speaker: m[1], text: m[2] } : { speaker: "", text: raw };
  });
  const speakers = listSpeakers(request.transcript);
  const members = speakers.filter((s) => !MANAGER.test(s));
  const counterpart = request.counterpart?.trim() || members[0] || "メンバー";

  // 個人的な話題を含む取り組みは、本人向け・自分用にだけ入れる（チーム向けには入れない）
  const picked = pickActions(lines, counterpart);
  const actions: ActionItem[] = picked.map(({ owner, task, due }) => ({ owner, task, due }));
  const teamActions: ActionItem[] = picked.filter((a) => !a.sensitive).map(({ owner, task, due }) => ({ owner, task, due }));
  const nextMeeting = request.transcript.match(/次回[^。\n]*?(\d{1,2}月\d{1,2}日)/)?.[1];
  const thanks = lines
    .filter((l) => MANAGER.test(l.speaker))
    .flatMap((l) => l.text.split(/(?<=[。？！?!])/).map((t) => t.trim()))
    .filter((t) => t.length >= 12 && /ありがとう|分かりやすかった|達成|いいですね/.test(t) && !SENSITIVE.test(t))
    .map(shorten)
    .slice(0, 2);
  const sensitive = lines.some((l) => SENSITIVE.test(l.text));
  const shareable = lines
    .flatMap((l) => sentencesOf(l.text))
    .filter((s) => /テンプレート|FAQ|コツ|工夫|事例/.test(s) && !SENSITIVE.test(s));

  const decisions = actions.map((a) => `${a.owner}：${a.task}`).slice(0, 3);
  const keyPoints = [
    `${request.type === "1on1" ? `${counterpart}さんとの1on1` : "チームミーティング"}で、${actions.length}件の取り組みを決めました。`,
    ...(nextMeeting ? [`次回は${nextMeeting}です。`] : []),
  ];

  if (request.type === "team") {
    return {
      headline: `決定事項${actions.length}件${nextMeeting ? `・次回${nextMeeting}` : ""}`,
      summary: { keyPoints, topics: topicLines(lines), decisions, actionItems: actions },
      toEmployee: null,
      myNotes: {
        keyPoints: ["チームミーティングの控えです（チームには送りません）。"],
        observations: members.length > 0 ? [`発言したメンバー：${members.join("、")}`] : [],
        followUps: actions.filter((a) => MANAGER.test(a.owner)).map((a) => shorten(a.task)),
        sensitive: [],
      },
      toTeam: {
        keyPoints,
        updates: topicLines(lines).slice(0, 3),
        actionItems: teamActions,
        closing: "今週もよろしくお願いします。困っている案件は、早めに相談してください。",
      },
    };
  }

  return {
    headline: `取り組み${actions.length}件${nextMeeting ? `・次回${nextMeeting}` : ""}`,
    summary: { keyPoints, topics: topicLines(lines), decisions, actionItems: actions },
    toEmployee: {
      keyPoints: [`今日は時間をとってくれてありがとうございました。`, ...keyPoints.slice(1)],
      thanks: thanks.length > 0 ? thanks : ["話してくれてありがとうございました。"],
      agreed: actions.filter((a) => !MANAGER.test(a.owner)).map((a) => shorten(a.task)),
      support: actions.filter((a) => MANAGER.test(a.owner)).map((a) => shorten(a.task)),
      closing: "気になることがあれば、次回を待たずにいつでも声をかけてください。",
    },
    myNotes: {
      keyPoints: [`${counterpart}さんとの1on1の控えです（本人・チームには送りません）。`],
      observations: ["発言の内容から、最近は余裕が少ない様子がうかがえます（本人に確認する）。"],
      followUps: actions.filter((a) => MANAGER.test(a.owner)).map((a) => shorten(`${a.task}${a.due ? `（${a.due}）` : ""}`)),
      sensitive: sensitive ? ["個人的な事情に関する話題がありました。チーム向けには含めません。"] : [],
    },
    toTeam:
      shareable.length > 0
        ? {
            keyPoints: ["1on1で出た、チームに役立つ話を共有します。"],
            updates: shareable.map(shorten).slice(0, 2),
            actionItems: [],
            closing: "引き続きよろしくお願いします。",
          }
        : null,
  };
}

/**
 * 約束や依頼を含む発言を、取り組みとして拾う。
 * マネージャーの依頼にメンバーが答えたときは、依頼の文を内容に、答えた人を担当にする
 */
function pickActions(lines: Line[], counterpart: string): (ActionItem & { sensitive: boolean })[] {
  const actions: (ActionItem & { sensitive: boolean })[] = [];
  const answered = new Set<number>();
  for (let i = 0; i < lines.length && actions.length < 5; i++) {
    const { speaker, text } = lines[i];
    if (answered.has(i) || !COMMIT.test(text)) continue;
    const next = lines[i + 1];
    const sentence = keySentence(text);
    if (!sentence) continue;
    const isRequest = MANAGER.test(speaker) && /お願いし|もらえますか|ませんか|いいですか/.test(sentence);
    if (isRequest && next && !MANAGER.test(next.speaker)) {
      answered.add(i + 1);
      actions.push({
        owner: next.speaker || counterpart,
        task: shorten(sentence),
        due: text.match(DUE)?.[1] ?? next.text.match(DUE)?.[1] ?? "",
        sensitive: SENSITIVE.test(sentence),
      });
    } else {
      actions.push({
        owner: speaker || counterpart,
        task: shorten(sentence),
        due: sentence.match(DUE)?.[1] ?? "",
        sensitive: SENSITIVE.test(sentence),
      });
    }
  }
  return actions;
}

/** 発言の中で、約束や依頼を含む文（あいさつだけの文は除く）。なければ空文字 */
function keySentence(text: string): string {
  // 「〜はありますか」のような質問や、最後のまとめ（「今日決めたことは…」）は除く
  return sentencesOf(text).find((s) => COMMIT.test(s) && !/ありますか。$|決めたことは/.test(s)) ?? "";
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[。？！?!])/)
    .map((s) => s.trim().replace(/^(はい|ええ|うん|分かりました|わかりました|了解です)[、。,]\s*/, ""))
    .filter((s) => s.length >= 6 && !PLEASANTRY.test(s));
}

/** 話した内容：話者のある発言から、数字や話題を含む長めの文を拾う */
function topicLines(lines: Line[]): string[] {
  return lines
    .filter((l) => l.speaker)
    .flatMap((l) => sentencesOf(l.text))
    .filter((s) => s.length >= 18 && !SENSITIVE.test(s) && !COMMIT.test(s))
    .map(shorten)
    .slice(0, 3);
}

/** 最初の文だけを、1行に収まる長さで */
function shorten(text: string): string {
  const first = text.split("。")[0].trim();
  return first.length > MAX_LINE ? `${first.slice(0, MAX_LINE - 1)}…` : `${first}。`;
}
