"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "./utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className,
      )}
      {...props}
    />
  );
}

export interface TableHeadProps extends React.ComponentProps<"th"> {
  sortDirection?: "ascending" | "descending" | "none";
  sortLabel?: string;
  onSort?: () => void;
}

function TableHead({
  className,
  children,
  sortDirection,
  sortLabel,
  onSort,
  ...props
}: TableHeadProps) {
  const SortIcon = sortDirection === "ascending"
    ? ArrowUp
    : sortDirection === "descending"
      ? ArrowDown
      : ArrowUpDown;
  const headerLabel = typeof children === "string" ? children : sortLabel;

  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-center align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      aria-label={props["aria-label"] ?? headerLabel}
      aria-sort={onSort ? (sortDirection ?? "none") : props["aria-sort"]}
      {...props}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          aria-label={`Sắp xếp theo ${sortLabel ?? headerLabel ?? "cột này"}`}
          className="table-sort-button"
        >
          <span aria-hidden="true">{children}</span>
          <SortIcon size={13} aria-hidden="true" />
        </button>
      ) : children}
    </th>
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 text-center align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
