// AIにつなぐまでのダミーの下書き。文字起こしから決まった言葉を含む発言を拾うだけ（要約はしない）
import { listSpeakers } from "./transcript";
import type { ActionItem, Discussion, MeetingDraft, MeetingRequest, ReactionKind } from "./types";

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

  // 1on1 の取り組み。個人的な話題を含むものも、本人向け・自分用には入れる（チーム向けには取り組みを入れない）
  const picked = pickActions(lines, counterpart);
  const actions: ActionItem[] = picked.map(({ owner, task, due }) => ({ owner, task, due }));
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
  if (request.type === "team") {
    const { discussion, afterWrapUp } = buildDiscussion(lines, request.agenda);
    // 取り組みは、総括のあとの発言から拾う（意見交換の中の「真似してみます」は意見への反応として扱う）
    const teamPicked = pickActions(afterWrapUp.length > 0 ? afterWrapUp : lines, counterpart);
    const teamActions: ActionItem[] = teamPicked
      .filter((a) => !a.sensitive)
      .map(({ owner, task, due }) => ({ owner, task, due }));
    const agendaShort = discussion.agenda.length > 24 ? `${discussion.agenda.slice(0, 23)}…` : discussion.agenda;
    const keyPoints = [
      ...(discussion.agenda
        ? [`アジェンダ「${agendaShort}」について、${discussion.opinions.length}人が意見を出しました。`]
        : []),
      ...(discussion.differentViews.length > 0
        ? [`意見が分かれた点が${discussion.differentViews.length}つあり、話し合って方向をそろえました。`]
        : []),
      `今週の取り組みを${teamActions.length}件決めました。`,
    ];
    return {
      headline: agendaShort || `取り組み${teamActions.length}件`,
      discussion,
      summary: {
        keyPoints,
        topics: discussion.opinions.map((o) => `${o.speaker}：${shorten(o.opinion)}`).slice(0, 3),
        decisions: teamActions.map((a) => `${a.owner}：${a.task}`).slice(0, 3),
        actionItems: teamActions,
      },
      toEmployee: null,
      myNotes: {
        keyPoints: ["チームミーティングの控えです（チームには送りません）。"],
        observations: [
          ...(members.length > 0 ? [`発言したメンバー：${members.join("、")}`] : []),
          ...discussion.opinions
            .filter((o) => o.reactions.some((r) => r.kind === "willTry"))
            .map((o) => `${o.speaker}さんの意見を真似したいという声がありました（本人に伝えたい）。`),
        ],
        followUps: teamActions.filter((a) => MANAGER.test(a.owner)).map((a) => shorten(a.task)),
        sensitive: [],
      },
      toTeam: {
        keyPoints,
        updates: [],
        actionItems: teamActions,
        closing: "今週もよろしくお願いします。試してみて気づいたことは、次回に共有してください。",
      },
    };
  }

  const keyPoints = [`${counterpart}さんとの1on1で、${actions.length}件の取り組みを決めました。`];
  return {
    headline: `取り組み${actions.length}件`,
    discussion: null,
    summary: { keyPoints, topics: topicLines(lines), decisions, actionItems: actions },
    toEmployee: {
      keyPoints: ["今日は時間をとってくれてありがとうございました。", ...keyPoints],
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
 * アジェンダに沿って全員に意見を聞く形式の話し合いを、意見・反応・意見が分かれた点・総括に分ける。
 * マネージャーの「まず／次は〇〇さん、お願いします」で発言の順番を見つける
 */
function buildDiscussion(lines: Line[], agendaInput?: string): { discussion: Discussion; afterWrapUp: Line[] } {
  const agenda =
    agendaInput?.trim() ||
    lines.map((l) => l.text.match(/(?:アジェンダ|テーマ|議題)[^「]*「([^」]+)」/)?.[1]).find(Boolean) ||
    "";
  const opinions: Discussion["opinions"] = [];
  const differentViews: Discussion["differentViews"] = [];
  let wrapUp = "";
  let afterWrapUp: Line[] = [];
  let expected = "";
  let current: Discussion["opinions"][number] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const { speaker, text } = lines[i];
    if (MANAGER.test(speaker)) {
      current = null;
      if (/総括|まとめ/.test(text)) {
        // 総括の文だけを残し、そのあとの依頼（「今週は…」「〇〇さんは…」）は取り組みとして扱う
        const sentences = text
          .replace(/^.*?(総括します|まとめます|まとめると)[。、]?/, "")
          .split(/(?<=[。？！?!])/)
          .map((t) => t.trim())
          .filter(Boolean);
        const cut = sentences.findIndex((t) => /^今週は|^次回は|お願い|もらえますか|さんは/.test(t));
        const end = cut === -1 ? sentences.length : cut;
        wrapUp = sentences.slice(0, end).join("");
        afterWrapUp = [{ speaker, text: sentences.slice(end).join("") }, ...lines.slice(i + 1)];
        break;
      }
      expected = text.match(/(?:まず|次は)\s*([^\s、。]+?)さん/)?.[1] ?? "";
      continue;
    }
    if (!current && speaker === expected) {
      current = { speaker, opinion: firstSentences(text, 2), reactions: [] };
      opinions.push(current);
      continue;
    }
    if (!current) continue;
    const kind = classify(text, speaker === current.speaker);
    current.reactions.push({ speaker, kind, text: firstSentences(text, 2) });
    if (kind === "disagree") {
      const answer = lines[i + 1] && !MANAGER.test(lines[i + 1].speaker) ? lines[i + 1] : null;
      differentViews.push({
        topic: shorten(current.opinion),
        views: [
          { speaker: current.speaker, view: firstSentences(current.opinion, 1), reason: reasonOf(current.opinion) },
          { speaker, view: firstSentences(text, 1), reason: reasonOf(text) },
        ],
        outcome: answer ? `${answer.speaker}：${firstSentences(answer.text, 2)}` : "",
      });
    }
  }
  return { discussion: { agenda, opinions, differentViews, wrapUp }, afterWrapUp };
}

function classify(text: string, isOwner: boolean): ReactionKind {
  if (isOwner) return "reply";
  if (/反対|ただ、|一方で|違う意見/.test(text)) return "disagree";
  if (/真似|取り入れ|試してみ|やってみ/.test(text)) return "willTry";
  if (/[？?]/.test(text)) return "question";
  if (/いいですね|賛成|同感|分かりやすい|なるほど/.test(text)) return "agree";
  return "comment";
}

/** 理由を述べている文（「〜から」「〜ので」「〜ため」）。なければ空文字 */
function reasonOf(text: string): string {
  return (
    text
      .split(/(?<=[。？！?!])/)
      .map((s) => s.trim())
      .find((s) => /(から|ので|ため)/.test(s) && s.length >= 8) ?? ""
  );
}

function firstSentences(text: string, count: number): string {
  return text
    .split(/(?<=[。？！?!])/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, count)
    .join("");
}

/**
 * 約束や依頼を含む発言を、取り組みとして拾う。
 * マネージャーの依頼にメンバーが答えたときは、依頼の文を内容に、答えた人を担当にする
 */
function pickActions(lines: Line[], counterpart: string): (ActionItem & { sensitive: boolean })[] {
  const actions: (ActionItem & { sensitive: boolean })[] = [];
  const members = [...new Set(lines.map((l) => l.speaker).filter((sp) => sp && !MANAGER.test(sp)))];
  const answered = new Set<number>();
  for (let i = 0; i < lines.length && actions.length < 5; i++) {
    if (answered.has(i)) continue;
    const { speaker, text } = lines[i];
    const next = lines[i + 1];
    for (const sentence of actionSentences(text)) {
      if (actions.length >= 5) break;
      const named = members.find((m) => sentence.includes(`${m}さん`));
      const isRequest = MANAGER.test(speaker) && /お願いし|もらえますか|ませんか|いいですか/.test(sentence);
      const owner = named
        ? named
        : /全員|皆さん|みなさん/.test(sentence)
          ? "全員"
          : isRequest && next && !MANAGER.test(next.speaker)
            ? next.speaker
            : speaker || counterpart;
      // 依頼に本人が答えた行は、同じ取り組みなので拾わない
      const answer = next && next.speaker === owner && owner !== speaker ? next : null;
      if (answer) answered.add(i + 1);
      actions.push({
        owner,
        task: shorten(sentence),
        due: sentence.match(DUE)?.[1] ?? answer?.text.match(DUE)?.[1] ?? "",
        sensitive: SENSITIVE.test(sentence),
      });
    }
  }
  return actions;
}

/**
 * 発言の中で、約束や依頼を含む文（あいさつだけの文は除く）。
 * 「〜はありますか」のような質問、最後のまとめ（「今日決めたことは…」）、次回の日程の案内は除く
 */
function actionSentences(text: string): string[] {
  return sentencesOf(text).filter((s) => COMMIT.test(s) && !/ありますか。$|決めたことは|^次回は/.test(s));
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
