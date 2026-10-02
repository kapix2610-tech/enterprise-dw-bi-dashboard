import { render, screen } from "@testing-library/react";
import Dashboard from "./Dashboard";

test("shows only the metrics selected for the workspace and uses matching data", () => {
  const onOpenAI = jest.fn();
  render(
    <Dashboard
      analysis={{
        sourceName: "operations.csv",
        rows: [{ revenue: 42, customers: 99, stock_units: 7 }],
        columns: ["revenue", "customers", "stock_units"],
        totals: { revenue: 42, customers: 99, stock_units: 7 },
        rowCount: 1,
      }}
      workspace={{ category: "Manufacturing", metrics: ["Revenue / income", "Inventory / assets"] }}
      user={{ name: "Sam Example" }}
      onAddData={() => {}}
      onOpenAI={onOpenAI}
    />,
  );

  expect(screen.getByText("Revenue / income")).toBeInTheDocument();
  expect(screen.getByText("Inventory / assets")).toBeInTheDocument();
  expect(screen.getAllByText("42")).toHaveLength(2);
  expect(screen.getAllByText("7")).toHaveLength(2);
  expect(screen.queryByText(/Customers \/ users/)).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /welcome, sam/i })).toBeInTheDocument();
  screen.getByRole("button", { name: /ask ai/i }).click();
  expect(onOpenAI).toHaveBeenCalledTimes(1);
});
