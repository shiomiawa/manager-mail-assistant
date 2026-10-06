import { describe, expect, it } from "vitest";
import { buildWeeklyReport, calculateScores, summarize } from "./aggregate";
import type { PerformanceRow, Targets } from "./types";

const targets: Targets = {
  team: { weeklyCount: 100, avgMinutes: 8, avgSatisfaction: 4.4 },
  individual: { weeklyCount: 50, avgMinutes: 8, avgSatisfaction: 4.3 },
  scoreWeights: { count: 0.1, minutes: 0.3, satisfaction: 0.6 },
};

function row(overrides: Partial<PerformanceRow>): PerformanceRow {
  return {
    date: "2026-09-28",
    employeeId: "E001",
    channel: "電話",
    count: 10,
    avgMinutes: 8,
    avgSatisfaction: 4.0,
    weekStart: "2026-09-28",
    weekNumber: 40,
    tenureMonths: 12,
    ...overrides,
  };
}

describe("summarize", () => {
  it("平均は件数で重みづけする", () => {
    const metrics = summarize([
      row({ count: 30, avgMinutes: 6, avgSatisfaction: 5 }),
      row({ count: 10, avgMinutes: 10, avgSatisfaction: 3, date: "2026-09-29" }),
    ]);
    expect(metrics.count).toBe(40);
    expect(metrics.avgMinutes).toBeCloseTo(7); // (30×6 + 10×10) ÷ 40
    expect(metrics.avgSatisfaction).toBeCloseTo(4.5); // (30×5 + 10×3) ÷ 40
    expect(metrics.workDays).toBe(2);
  });
});

describe("calculateScores", () => {
  it("対応時間は短いほど、満足度は高いほどスコアが高い", () => {
    const scores = calculateScores(
      [
        row({ employeeId: "FAST", avgMinutes: 5, avgSatisfaction: 4.0 }),
        row({ employeeId: "SLOW", avgMinutes: 10, avgSatisfaction: 4.0 }),
      ],
      targets.scoreWeights,
    );
    expect(scores.get("FAST")!.efficiency).toBeGreaterThan(scores.get("SLOW")!.efficiency);
  });

  it("満足度の重み0.6が、件数・時間の重みより強く効く", () => {
    const scores = calculateScores(
      [
        // 件数が多く速いが満足度が低い
        row({ employeeId: "A", count: 20, avgMinutes: 5, avgSatisfaction: 3.8 }),
        // 件数が少なく遅いが満足度が高い
        row({ employeeId: "B", count: 10, avgMinutes: 10, avgSatisfaction: 4.8 }),
      ],
      targets.scoreWeights,
    );
    expect(scores.get("A")!.total).toBe(40); // 0.1×100 + 0.3×100 + 0.6×0
    expect(scores.get("B")!.total).toBe(60); // 0.1×0 + 0.3×0 + 0.6×100
  });

  it("チャンネルの違いで不利にならない（それぞれのチャンネル平均どおりなら同じスコア）", () => {
    const scores = calculateScores(
      [
        row({ employeeId: "CHAT1", channel: "チャット", count: 30, avgMinutes: 5 }),
        row({ employeeId: "CHAT2", channel: "チャット", count: 30, avgMinutes: 5 }),
        row({ employeeId: "MAIL1", channel: "メール", count: 15, avgMinutes: 10 }),
        row({ employeeId: "MAIL2", channel: "メール", count: 15, avgMinutes: 10 }),
      ],
      targets.scoreWeights,
    );
    const totals = [...scores.values()].map((score) => score.total);
    expect(new Set(totals).size).toBe(1);
  });

  it("出勤日数が少なくても、1日あたりの処理量で比べる", () => {
    const scores = calculateScores(
      [
        row({ employeeId: "FULL", date: "2026-09-28" }),
        row({ employeeId: "FULL", date: "2026-09-29" }),
        row({ employeeId: "HALF", date: "2026-09-28" }),
      ],
      targets.scoreWeights,
    );
    expect(scores.get("FULL")!.total).toBe(scores.get("HALF")!.total);
  });
});

describe("buildWeeklyReport", () => {
  const rows: PerformanceRow[] = [
    row({ employeeId: "E001", weekStart: "2026-09-21", weekNumber: 39, date: "2026-09-21", avgSatisfaction: 4.0 }),
    row({ employeeId: "E001", avgSatisfaction: 4.6 }),
    row({ employeeId: "E002", avgSatisfaction: 4.2, avgMinutes: 9 }),
    // E003 は今週だけ
    row({ employeeId: "E003", avgSatisfaction: 4.2, avgMinutes: 9, tenureMonths: 3 }),
  ];

  it("最新の週を今週として集計する", () => {
    const report = buildWeeklyReport(rows, targets);
    expect(report.team.weekNumber).toBe(40);
    expect(report.team.headcount).toBe(3);
    expect(report.team.thisWeek.count).toBe(30);
  });

  it("推移は古い順。データのない週は null", () => {
    const report = buildWeeklyReport(rows, targets);
    const e003 = report.employees.find((e) => e.employeeId === "E003")!;
    expect(e003.trend.map((point) => point.weekNumber)).toEqual([39, 40]);
    expect(e003.trend[0].metrics).toBeNull();
    expect(e003.weeksWithData).toBe(1);
    expect(e003.changeFromLastWeek).toBeNull();
  });

  it("先週との差を出す", () => {
    const report = buildWeeklyReport(rows, targets);
    const e001 = report.employees.find((e) => e.employeeId === "E001")!;
    expect(e001.changeFromLastWeek!.avgSatisfaction).toBeCloseTo(0.6);
  });

  it("順位はスコア順で、同点は同じ順位", () => {
    const report = buildWeeklyReport(rows, targets);
    expect(report.employees[0].employeeId).toBe("E001");
    expect(report.employees.map((e) => e.rank.total)).toEqual([1, 2, 2]);
  });

  it("個人の件数目標は出勤日数で按分する（1日勤務なら 50×1/5＝10件）", () => {
    const report = buildWeeklyReport(rows, targets);
    const e002 = report.employees.find((e) => e.employeeId === "E002")!;
    expect(e002.achievement.weeklyCount.target).toBe(10);
    expect(e002.achievement.weeklyCount.achieved).toBe(true);
  });

  it("平均対応時間は目標以下で達成", () => {
    const report = buildWeeklyReport(rows, targets);
    const e002 = report.employees.find((e) => e.employeeId === "E002")!;
    expect(e002.achievement.avgMinutes.achieved).toBe(false); // 9分 > 8分
    const e001 = report.employees.find((e) => e.employeeId === "E001")!;
    expect(e001.achievement.avgMinutes.achieved).toBe(true); // 8分 ≤ 8分
  });

  it("指定した週で集計できる", () => {
    const report = buildWeeklyReport(rows, targets, "2026-09-21");
    expect(report.team.weekNumber).toBe(39);
    expect(report.employees).toHaveLength(1);
  });
});

describe("達成の判定", () => {
  it("表示の桁で判定する（8.04分は「8.0分」と表示されるので、目標8.0分を達成）", () => {
    const report = buildWeeklyReport([row({ avgMinutes: 8.04 }), row({ employeeId: "E002", avgMinutes: 8.06 })], targets);
    const e001 = report.employees.find((e) => e.employeeId === "E001")!;
    const e002 = report.employees.find((e) => e.employeeId === "E002")!;
    expect(e001.achievement.avgMinutes.achieved).toBe(true);
    expect(e002.achievement.avgMinutes.achieved).toBe(false); // 8.1分
  });
});
