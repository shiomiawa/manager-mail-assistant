// sample-data のExcelで、集計結果が想定した傾向になっているかを確かめる
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildWeeklyReport } from "./aggregate";
import { parseWorkbook } from "./parseWorkbook";
import { loadTargets } from "./targets";

const file = readFileSync("sample-data/cs-performance-sample.xlsx");
const { rows, comments } = await parseWorkbook(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const report = buildWeeklyReport(rows, loadTargets(), undefined, comments);
const employee = (id: string) => report.employees.find((e) => e.employeeId === id)!;

describe("サンプルデータの集計", () => {
  it("コメントシートを読み込み、今週分だけを集計する", () => {
    expect(comments.length).toBe(538);
    expect(report.team.voice.total).toBe(comments.filter((c) => c.date >= "2026-09-28").length);
    expect(report.employees.reduce((sum, e) => sum + e.voice.total, 0)).toBe(report.team.voice.total);
  });

  it("E002 は今週「悪い」のコメントがあり、改善点が選ばれる", () => {
    expect(employee("E002").voice.negative).toBe(3);
    expect(employee("E002").voice.improvements.length).toBe(2);
  });

  it("20人・Week40を今週として読み込める", () => {
    expect(rows).toHaveLength(1016);
    expect(report.team.weekNumber).toBe(40);
    expect(report.team.headcount).toBe(20);
    expect(report.team.thisWeek.count).toBe(2280);
    expect(report.team.trend.map((point) => point.weekNumber)).toEqual([37, 38, 39, 40]);
  });

  it("在籍期間を読み込める", () => {
    expect(employee("E006").tenureMonths).toBe(3);
    expect(employee("E014").tenureMonths).toBe(108);
  });

  it("E002（速いが満足度が低い）は効率が上位、品質が下位", () => {
    expect(employee("E002").rank.efficiency).toBeLessThanOrEqual(3);
    // 今週は満足度が下がった E005 が最下位、E002 はその次
    expect(employee("E002").rank.quality).toBeGreaterThanOrEqual(19);
  });

  it("E005 は先週から満足度が下がっている", () => {
    expect(employee("E005").changeFromLastWeek!.avgSatisfaction).toBeLessThan(-0.1);
  });

  it("E006（新人）は推移の4週すべてにデータがある（Week37から配属）", () => {
    expect(employee("E006").weeksWithData).toBe(4);
  });

  it("E010 は夏休みの週（Week36）が推移に入らないので4週そろう", () => {
    expect(employee("E010").weeksWithData).toBe(4);
  });

  it("E007（今週3日勤務）は件数の目標が3日分に按分される", () => {
    expect(employee("E007").thisWeek.workDays).toBe(3);
    expect(employee("E007").achievement.weeklyCount.target).toBeCloseTo(110 * (3 / 5));
  });
});
