import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DataHistory from "./DataHistory";

test("keeps datasets from deleted workspaces available in all-workspaces history", async () => {
  global.fetch = jest.fn(() => Promise.resolve({
    ok: true,
    json: async () => [
      { _id: "edu-file", workspaceId: "education", originalName: "students.csv", rowCount: 12, columns: ["income"], size: 1024, createdAt: "2026-10-01T00:00:00.000Z" },
      { _id: "archived-file", workspaceId: "old-hospital", originalName: "visits.csv", rowCount: 9, columns: ["users"], size: 2048, createdAt: "2026-10-01T00:00:00.000Z" },
    ],
  }));

  render(
    <DataHistory
      token="test-token"
      workspaceId="education"
      workspaces={[{ id: "education", category: "Education" }]}
      onAddData={() => {}}
      onOpenDataset={() => {}}
      onDeletedDatasets={() => {}}
    />,
  );

  expect(await screen.findByText("students.csv")).toBeInTheDocument();
  expect(screen.queryByText("visits.csv")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Filter history by workspace" }), { target: { value: "all" } });
  expect(await screen.findByText("visits.csv")).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /Saved data · old-hospital/ })).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
});
