import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../../src/app/components/ui/table";

describe("shared table", () => {
  it("centers headers and exposes accessible sort state and controls", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();

    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead sortDirection="ascending" onSort={onSort} sortLabel="Tên khách hàng">
              Khách hàng
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow><TableCell>An</TableCell></TableRow>
        </TableBody>
      </Table>,
    );

    const header = screen.getByRole("columnheader", { name: "Khách hàng" });
    expect(header).toHaveClass("text-center");
    expect(header).toHaveAttribute("aria-sort", "ascending");

    await user.click(screen.getByRole("button", { name: "Sắp xếp theo Tên khách hàng" }));
    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it("renders centered non-sortable and descending headers with the full table structure", () => {
    render(
      <Table>
        <TableCaption>Danh sách khách hàng</TableCaption>
        <TableHeader><TableRow>
          <TableHead>Trạng thái</TableHead>
          <TableHead sortDirection="descending" onSort={vi.fn()} sortLabel="Ngày tạo">Ngày tạo</TableHead>
        </TableRow></TableHeader>
        <TableBody><TableRow><TableCell>Đang xử lý</TableCell><TableCell>20/06/2026</TableCell></TableRow></TableBody>
        <TableFooter><TableRow><TableCell colSpan={2}>Tổng cộng: 1</TableCell></TableRow></TableFooter>
      </Table>,
    );

    expect(screen.getByRole("columnheader", { name: "Trạng thái" })).not.toHaveAttribute("aria-sort");
    expect(screen.getByRole("columnheader", { name: "Ngày tạo" })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByText("Danh sách khách hàng")).toBeVisible();
    expect(screen.getByText("Tổng cộng: 1")).toBeVisible();
  });
});
