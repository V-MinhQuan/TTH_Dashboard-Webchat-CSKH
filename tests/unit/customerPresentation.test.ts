import { describe, expect, it } from "vitest";

import { getCustomerPresentation } from "../../src/app/services/conversationApi";

describe("getCustomerPresentation", () => {
  it.each([
    ["Nguyễn An", "C001", "0901000000", "Nguyễn An"],
    [null, "C001", "0901000000", "KH ••••C001"],
    [null, null, "0901000000", "KH ••••0000"],
    [null, null, null, "Không xác định"],
  ])("uses the database name first and masks anonymous identifiers", (name, id, phone, expected) => {
    expect(getCustomerPresentation(name, id, phone).primary).toBe(expected);
  });

  it("keeps the database id as secondary text when a customer name exists", () => {
    expect(getCustomerPresentation("Nguyễn An", "C001", "0901000000").secondary).toBe("C001");
  });

  it("never renders object coercion as a customer value", () => {
    expect(getCustomerPresentation({}, {}, {}).primary).toBe("Không xác định");
  });
});
