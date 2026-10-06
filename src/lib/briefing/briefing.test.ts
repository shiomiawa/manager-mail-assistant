import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderEmailText } from "@/lib/email/template";
import { normalizeTranscript } from "@/lib/meeting/transcript";
import { buildBriefingEmail } from "./briefingEmail";
import { resolveDate } from "./calendar";
import { mockBriefingDraft } from "./mockBriefing";

const transcript = normalizeTranscript(readFileSync("sample-data/briefing-sample.txt", "utf8"));
const request = { title: "新しい問い合わせ管理システムの導入説明会", briefingDate: "2026-10-14", transcript };
const draft = mockBriefingDraft(request);

describe("説明会のメモ（ダミー）", () => {
  it("日程と期限を、話した言葉と月・日・時刻で拾う（同じ日付は1つ、まとめの文は除く）", () => {
    const dates = draft.dates.map((d) => `${d.month ?? "-"}/${d.day ?? "-"} ${d.time || "--:--"} ${d.whenText}`);
    expect(dates).toEqual([
      "11/4 --:-- 11月4日（水）",
      "10/20 14:00 10月20日（火）の14時",
      "10/23 17:00 10月23日（金）の17時",
      "10/30 --:-- 10月30日（金）",
      "-/- --:-- 来週中",
    ]);
  });

  it("まだ決まっていないことを Open Questions に入れる", () => {
    expect(draft.openQuestions.join("")).toContain("検討中");
  });

  it("メモの件名と区画（日程は画面で確かめた日付を使う）", () => {
    const doc = buildBriefingEmail(
      draft,
      { title: request.title, briefingDate: request.briefingDate },
      draft.dates.map((d) => ({ title: d.item, whenText: d.whenText, date: resolveDate(d.month, d.day, request.briefingDate), time: d.time })),
    );
    expect(doc.subject).toBe("【Briefing】10/14 新しい問い合わせ管理システムの導入説明会");
    expect(doc.accent).toBe("#c0572f");
    const text = renderEmailText(doc);
    expect(text).toContain("【Dates & Deadlines】\nDate | Item");
    expect(text).toContain("2026/10/23 (Fri) 17:00 |");
    expect(text).toContain("来週中 |");
    expect(text).toContain("【Open Questions】");
  });
});
