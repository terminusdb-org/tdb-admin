/**
 * Unit tests for the DataTable shared component.
 *
 * DataTable is a generic table component extracted from UserListPage.
 * Props: columns (with render function), data, rowKey (function), onRowClick, ariaLabel.
 *
 * Tests verify: rendering, accessibility, row interactions, empty data.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable } from "./DataTable";

interface TestRow {
  readonly id: string;
  readonly name: string;
  readonly status: string;
}

const columns = [
  { key: "name", header: "Name", render: (row: TestRow) => row.name },
  { key: "status", header: "Status", render: (row: TestRow) => row.status },
];

const sampleData: ReadonlyArray<TestRow> = [
  { id: "1", name: "Alice", status: "Active" },
  { id: "2", name: "Bob", status: "Inactive" },
  { id: "3", name: "Carol", status: "Active" },
];

const rowKey = (row: TestRow) => row.id;

describe("DataTable", () => {
  describe("rendering", () => {
    it("renders a table element", () => {
      render(
        <DataTable columns={columns} data={sampleData} rowKey={rowKey} />
      );
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("renders column headers with scope='col'", () => {
      render(
        <DataTable columns={columns} data={sampleData} rowKey={rowKey} />
      );
      const headers = screen.getAllByRole("columnheader");
      expect(headers).toHaveLength(2);
      expect(headers[0]).toHaveTextContent("Name");
      expect(headers[1]).toHaveTextContent("Status");
      headers.forEach((header) => {
        expect(header).toHaveAttribute("scope", "col");
      });
    });

    it("renders one row per data item plus header row", () => {
      render(
        <DataTable columns={columns} data={sampleData} rowKey={rowKey} />
      );
      const rows = screen.getAllByRole("row");
      expect(rows).toHaveLength(sampleData.length + 1);
    });

    it("renders cell content using the column render function", () => {
      render(
        <DataTable columns={columns} data={sampleData} rowKey={rowKey} />
      );
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Carol")).toBeInTheDocument();
    });

    it("applies ariaLabel to the table", () => {
      render(
        <DataTable
          columns={columns}
          data={sampleData}
          rowKey={rowKey}
          ariaLabel="Test table"
        />
      );
      expect(screen.getByRole("table", { name: "Test table" })).toBeInTheDocument();
    });
  });

  describe("empty data", () => {
    it("renders table with zero body rows when data is empty", () => {
      render(
        <DataTable columns={columns} data={[]} rowKey={rowKey} />
      );
      // Table renders with header row only
      const rows = screen.getAllByRole("row");
      expect(rows).toHaveLength(1); // header only
    });
  });

  describe("row interactions", () => {
    it("calls onRowClick when a row is clicked", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <DataTable
          columns={columns}
          data={sampleData}
          rowKey={rowKey}
          onRowClick={handleClick}
        />
      );

      const rows = screen.getAllByRole("button");
      await user.click(rows[0]);
      expect(handleClick).toHaveBeenCalledWith(sampleData[0]);
    });

    it("calls onRowClick when Enter is pressed on a focused row", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <DataTable
          columns={columns}
          data={sampleData}
          rowKey={rowKey}
          onRowClick={handleClick}
        />
      );

      const rows = screen.getAllByRole("button");
      rows[0].focus();
      await user.keyboard("{Enter}");
      expect(handleClick).toHaveBeenCalledWith(sampleData[0]);
    });

    it("calls onRowClick when Space is pressed on a focused row", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <DataTable
          columns={columns}
          data={sampleData}
          rowKey={rowKey}
          onRowClick={handleClick}
        />
      );

      const rows = screen.getAllByRole("button");
      rows[0].focus();
      await user.keyboard(" ");
      expect(handleClick).toHaveBeenCalledWith(sampleData[0]);
    });

    it("does not add button role or tabIndex when onRowClick is not provided", () => {
      render(
        <DataTable columns={columns} data={sampleData} rowKey={rowKey} />
      );
      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });
  });

  describe("column alignment", () => {
    it("applies right alignment class when column has align='right'", () => {
      const rightAlignedColumns = [
        { key: "name", header: "Name", render: (row: TestRow) => row.name },
        { key: "status", header: "Status", render: (row: TestRow) => row.status, align: "right" as const },
      ];

      render(
        <DataTable columns={rightAlignedColumns} data={sampleData} rowKey={rowKey} />
      );

      const headers = screen.getAllByRole("columnheader");
      expect(headers[1].className).toContain("text-right");
    });
  });

  describe("accessibility", () => {
    it("uses proper table semantics with thead and tbody", () => {
      const { container } = render(
        <DataTable columns={columns} data={sampleData} rowKey={rowKey} />
      );
      expect(container.querySelector("thead")).toBeInTheDocument();
      expect(container.querySelector("tbody")).toBeInTheDocument();
    });
  });
});
