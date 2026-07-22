import { describe, expect, it } from "vitest";

import { chartBuilderErrorMessage } from "../../src/app/components/chartbuilder/chartBuilderErrors";

describe("chartBuilderErrorMessage", () => {
  it("translates duplicate alias validation into clear Vietnamese", () => {
    expect(chartBuilderErrorMessage(
      new Error("Value error, Bí danh của chiều phân tích, chỉ số và chuỗi dữ liệu không được trùng nhau"),
      "Không thể tải dữ liệu biểu đồ.",
    )).toBe(
      "Một trường đang được chọn trùng ở nhiều vị trí không tương thích. Hãy kiểm tra các ô X, Y và G rồi xóa trường bị trùng.",
    );
  });

  it("does not expose an English network error", () => {
    expect(chartBuilderErrorMessage(
      new TypeError("Failed to fetch"),
      "Không thể tải dữ liệu biểu đồ.",
    )).toContain("Không thể kết nối đến hệ thống dữ liệu");
  });

  it("keeps a concise Vietnamese backend message and strips technical prefix", () => {
    expect(chartBuilderErrorMessage(
      new Error("Value error, Trường 'channel' không thể dùng ở vai trò 'metric'"),
      "Không thể tải dữ liệu biểu đồ.",
    )).toBe("Trường 'Kênh' không thể dùng ở vai trò 'Giá trị / Chỉ số - Y'");
  });
});
