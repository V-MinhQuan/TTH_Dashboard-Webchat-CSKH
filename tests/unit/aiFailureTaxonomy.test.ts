import { describe, expect, it } from "vitest";

import {
  AI_FAILURE_TAXONOMY,
  getAiFailureDefinition,
  normalizeAiFailureType,
} from "../../src/app/constants/aiFailureTaxonomy";

describe("AI failure taxonomy", () => {
  it("contains exactly the 8 canonical categories from the third interview", () => {
    expect(AI_FAILURE_TAXONOMY).toHaveLength(8);
  });

  it("matches the 8 issueType apiValues produced by the backend", () => {
    expect(AI_FAILURE_TAXONOMY.map((item) => item.apiValue)).toEqual([
      "Không tìm thấy dữ liệu",
      "Câu trả lời sai",
      "Thông tin không chính xác",
      "Không hiểu câu hỏi",
      "Thiếu thông tin",
      "Lỗi nguồn tri thức",
      "Lỗi hệ thống",
      "Khác",
    ]);
  });

  it("does not include the removed legacy categories", () => {
    const ids = AI_FAILURE_TAXONOMY.map((item) => item.id);
    // These old IDs must not exist as first-class entries
    expect(ids).not.toContain("missing_data");
    expect(ids).not.toContain("uncertain");
    expect(ids).not.toContain("out_of_scope");
    expect(ids).not.toContain("hallucination_risk");
  });

  it.each([
    // New canonical aliases
    ["thieuDL",       "no_data"],
    ["Không tìm thấy dữ liệu", "no_data"],
    ["no_data",       "no_data"],
    ["hallucination", "wrong_answer"],
    ["AI có nguy cơ tự tạo thông tin", "wrong_answer"],
    ["saiCauTra",     "wrong_answer"],
    ["khongChinhXac", "inaccurate"],
    ["Thông tin không chính xác", "inaccurate"],
    ["khongHieu",     "not_understood"],
    ["AI không chắc chắn", "not_understood"],
    ["khongChac",     "not_understood"],
    ["ngoaiPhamVi",   "missing_info"],
    ["Câu hỏi ngoài phạm vi", "missing_info"],
    ["thieuThongTin", "missing_info"],
    ["loiTriThuc",    "kb_error"],
    ["Lỗi tri thức",  "kb_error"],
    ["loiHeThong",    "system_error"],
    ["khac",          "other"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeAiFailureType(input)).toBe(expected);
    expect(getAiFailureDefinition(input)?.id).toBe(expected);
  });

  it("does not invent a canonical category for truly unknown values", () => {
    expect(normalizeAiFailureType("__completely_unknown_value__")).toBeNull();
    expect(getAiFailureDefinition("Lỗi không tồn tại trong taxonomy")).toBeNull();
  });

  it("every entry has a non-empty analyticsKey used by the backend JOIN query", () => {
    for (const def of AI_FAILURE_TAXONOMY) {
      expect(def.analyticsKey).toBeTruthy();
      expect(typeof def.analyticsKey).toBe("string");
    }
  });
});
