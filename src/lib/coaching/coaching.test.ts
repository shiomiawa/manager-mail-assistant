import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderEmailText } from "@/lib/email/template";
import { buildWeeklyReport } from "@/lib/report/aggregate";
import { parseWorkbook } from "@/lib/report/parseWorkbook";
import { loadTargets } from "@/lib/report/targets";
import { buildCoachingEmails } from "./coachingEmails";
import { buildCoachingInput } from "./data";
import { mockCoachingDraft } from "./mockCoaching";

const file = readFileSync("sample-data/cs-performance-sample.xlsx");
const { rows, comments } = await parseWorkbook(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const report = buildWeeklyReport(rows, loadTargets(), undefined, comments);

describe("コーチング用のデータ", () => {
  const input = buildCoachingInput(report, comments, "E002", "")!;

  it("期間は推移と同じ4週間（Week 37〜40）で、コメントを数える", () => {
    expect(input.weekLabel).toBe("Week 37〜40（2026/09/07〜10/02）");
    const expected = comments.filter((c) => c.employeeId === "E002" && c.date >= "2026-09-07" && c.date <= "2026-10-04");
    expect(input.totals.total).toBe(expected.length);
    expect(input.totals.negative).toBe(expected.filter((c) => c.rating === "悪い").length);
    expect(input.weeks.map((w) => w.weekNumber)).toEqual([37, 38, 39, 40]);
  });

  it("「悪い」の多い評価軸から並べ、引用は上限まで・評価軸を散らして選ぶ", () => {
    const negatives = input.byAxis.map((a) => a.negative);
    expect(negatives).toEqual([...negatives].sort((a, b) => b - a));
    expect(input.negatives.length).toBeLessThanOrEqual(6);
    expect(input.positives.length).toBeLessThanOrEqual(4);
    expect(input.negatives.every((c) => c.rating === "悪い" && c.employeeId === "E002")).toBe(true);
    if (input.totals.negative >= 2) expect(new Set(input.negatives.map((c) => c.axis)).size).toBeGreaterThan(1);
  });

  it("いない社員は null", () => {
    expect(buildCoachingInput(report, comments, "E999", "")).toBeNull();
  });
});

describe("コーチングのメール（ダミー）", () => {
  const input = buildCoachingInput(report, comments, "E005", "")!;
  const draft = mockCoachingDraft(input, []);
  const [sheet, toEmployee] = buildCoachingEmails(draft, input, report.team.weekStart);
  const sheetText = renderEmailText(sheet.doc);
  const employeeText = renderEmailText(toEmployee.doc);

  it("Coaching Sheet は自分用、To Employee は本人向け", () => {
    expect(sheet.sendable).toBe(false);
    expect(toEmployee.sendable).toBe(true);
    expect(sheet.doc.subject).toBe("【Coaching】9/28 E005");
  });

  it("Coaching Sheet には、お客様の声の集計・重点テーマの仮説・質問が入る", () => {
    expect(sheetText).toContain("【Customer Voice (4 weeks)】");
    expect(sheetText).toContain("Possible Reason：");
    expect(sheetText).toContain("【Coaching Questions】");
  });

  it("本人向けには、「悪い」の声の引用と、マネージャーの仮説を入れない", () => {
    expect(employeeText).not.toContain("Possible Reason");
    expect(employeeText).not.toContain("Areas to Improve");
    for (const c of input.negatives) expect(employeeText).not.toContain(c.text);
    expect(employeeText).toContain("【Let's Try】");
  });
});

describe("AIが書いた評価軸の名前合わせ", () => {
  it("日本語名・英語ラベル・両方を含む書き方を、データの名前に合わせる", async () => {
    const { normalizeAxis } = await import("./aiCoaching");
    const names = ["態度", "知識", "親身さ"];
    expect(normalizeAxis("態度（Attitude）", names)).toBe("態度");
    expect(normalizeAxis("Knowledge", names)).toBe("知識");
    expect(normalizeAxis(" 親身さ ", names)).toBe("親身さ");
    expect(normalizeAxis("その他", names)).toBe("その他");
  });
});
