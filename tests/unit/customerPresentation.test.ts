import { describe, expect, it } from "vitest";

import { getCustomerPresentation } from "../../src/app/services/conversationApi";

describe("getCustomerPresentation", () => {
  it.each([
    ["Nguyễn An", "C001", "0901000000", "Nguyễn An"],
    [null, "C001", "0901000000", "C001"],
    [null, null, "0901000000", "0901000000"],
    [null, null, null, "Không xác định"],
  ])("uses database name, id, phone and unknown fallbacks in order", (name, id, phone, expected) => {
    expect(getCustomerPresentation(name, id, phone).primary).toBe(expected);
  });

  it("never renders object coercion as a customer value", () => {
    expect(getCustomerPresentation({}, {}, {}).primary).toBe("Không xác định");
  });
});
