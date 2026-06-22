import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FeedbackFormDialog } from "../../src/app/components/feedback/FeedbackFormDialog";

const api = vi.hoisted(() => ({
  createSheetChatbotRow: vi.fn(),
  getSheetChatbotDuplicates: vi.fn(),
  updateSheetChatbotRow: vi.fn(),
}));

vi.mock("../../src/app/services/sheetChatbotApi", () => api);
vi.mock("../../src/app/context/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Quản lý", username: "manager" } }),
}));

describe("FeedbackFormDialog", () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getSheetChatbotDuplicates.mockResolvedValue([]);
    api.createSheetChatbotRow.mockResolvedValue({ id: "CS-100" });
  });

  it("opens create mode with source-backed prefill and saves through the shared API", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <FeedbackFormDialog
        open
        mode="create"
        prefillData={{
          question: "Khi nào có lịch thi?",
          topic: "Lịch thi",
          keyword: "lịch thi",
          source: "Không tìm thấy dữ liệu",
          conversationId: 42,
          messageId: 99,
        }}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(screen.getByRole("heading", { name: "Thêm phản hồi" })).toBeVisible();
    expect(screen.getByLabelText("Câu hỏi khách hàng")).toHaveValue("Khi nào có lịch thi?");
    expect(screen.getByLabelText("Chủ đề")).toHaveValue("Lịch thi");
    expect(screen.getByLabelText("Từ khóa")).toHaveValue("lịch thi");
    expect(screen.getByLabelText("Conversation ID")).toHaveValue("42");
    expect(screen.getByLabelText("Message ID")).toHaveValue("99");

    await user.type(screen.getByLabelText("Câu trả lời đúng"), "Lịch thi được công bố trên cổng FLIC.");
    await user.click(screen.getByRole("button", { name: "Lưu phản hồi" }));

    await waitFor(() => expect(api.createSheetChatbotRow).toHaveBeenCalledTimes(1));
    expect(api.createSheetChatbotRow).toHaveBeenCalledWith(expect.objectContaining({
      question: "Khi nào có lịch thi?",
      correctAnswer: "Lịch thi được công bố trên cổng FLIC.",
      topic: "Lịch thi",
      source: "Không tìm thấy dữ liệu",
      notes: expect.stringContaining("conversationId: 42"),
    }));
    expect(onSaved).toHaveBeenCalled();
  });

  it("blocks an exact duplicate instead of creating another row", async () => {
    const user = userEvent.setup();
    api.getSheetChatbotDuplicates.mockResolvedValue([
      { id: "CS-001", question: "Câu hỏi trùng", similarity: 1 },
    ]);
    render(
      <FeedbackFormDialog
        open
        mode="create"
        prefillData={{ question: "Câu hỏi trùng", answer: "Câu trả lời" }}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Lưu phản hồi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("đã tồn tại");
    expect(api.createSheetChatbotRow).not.toHaveBeenCalled();
  });

  it("uses the edit title in edit mode", () => {
    render(
      <FeedbackFormDialog
        open
        mode="edit"
        editingId="CS-001"
        prefillData={{ question: "Câu hỏi", answer: "Câu trả lời" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Chỉnh sửa phản hồi" })).toBeVisible();
  });
});
