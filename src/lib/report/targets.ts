// config/targets.json（目標値とスコアの重み）の読み込み
import targetsJson from "../../../config/targets.json";
import type { Targets } from "./types";

export function loadTargets(source: unknown = targetsJson): Targets {
  const data = source as Partial<Targets>;
  const sections = ["team", "individual"] as const;
  const fields = ["weeklyCount", "avgMinutes", "avgSatisfaction"] as const;
  for (const section of sections) {
    for (const field of fields) {
      assertPositive(data[section]?.[field], `${section}.${field}`);
    }
  }
  for (const field of ["count", "minutes", "satisfaction"] as const) {
    const value = data.scoreWeights?.[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error(`config/targets.json の scoreWeights.${field} は0以上の数値にしてください。`);
    }
  }
  return data as Targets;
}

function assertPositive(value: unknown, name: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`config/targets.json の ${name} は0より大きい数値にしてください。`);
  }
}
