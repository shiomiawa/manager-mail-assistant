import { describe, expect, it } from "vitest";
import { loadPrinciples, matchPrinciple } from "./principles";

describe("行動指針（Principles）", () => {
  it("名前が空の項目は使わない", () => {
    expect(loadPrinciples({ principles: [{ id: 1, name: "", description: "" }, { id: 2, name: " 項目A ", description: "説明" }] })).toEqual([
      { id: 2, name: "項目A", description: "説明" },
    ]);
  });

  it("AIが書いた名前を一覧に合わせ、合わなければ空文字", () => {
    const names = ["項目A", "項目B"];
    expect(matchPrinciple("項目B", names)).toBe("項目B");
    expect(matchPrinciple("項目A：説明つき", names)).toBe("項目A");
    expect(matchPrinciple("知らない項目", names)).toBe("");
    expect(matchPrinciple("", names)).toBe("");
  });
});
