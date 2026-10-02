import { fireEvent, render, screen } from "@testing-library/react";
import Sidebar from "./Sidebar";

test("shows only the active workspace's selected metrics", () => {
  render(
    <Sidebar
      activePage="Dashboard"
      setActivePage={() => {}}
      workspace={{ id: "education", category: "Education", metrics: ["Revenue / income", "Customers / users"] }}
      workspaces={[
        { id: "education", category: "Education", metrics: ["Revenue / income", "Customers / users"] },
        { id: "hospital", category: "Hospital", metrics: ["Operations"] },
      ]}
      onSwitchWorkspace={() => {}}
      onCreateWorkspace={() => {}}
      onEditWorkspace={() => {}}
    />,
  );

  expect(screen.getByRole("button", { name: /Revenue \/ income/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Customers \/ users/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Sales" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Inventory" })).not.toBeInTheDocument();
});

test("offers workspace switching and creation controls", () => {
  const onCreateWorkspace = jest.fn();
  const onSwitchWorkspace = jest.fn();
  const onDeleteWorkspace = jest.fn();
  render(
    <Sidebar
      activePage="Dashboard"
      setActivePage={() => {}}
      workspace={{ id: "education", category: "Education", metrics: ["Customers / users"] }}
      workspaces={[
        { id: "education", category: "Education", metrics: ["Customers / users"] },
        { id: "hospital", category: "Hospital", metrics: ["Operations"] },
      ]}
      onSwitchWorkspace={onSwitchWorkspace}
      onCreateWorkspace={onCreateWorkspace}
      onEditWorkspace={() => {}}
      onDeleteWorkspace={onDeleteWorkspace}
    />,
  );

  fireEvent.change(screen.getByRole("combobox", { name: "Active workspace" }), { target: { value: "hospital" } });
  fireEvent.click(screen.getByRole("button", { name: "＋ New" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete Education workspace" }));
  expect(onSwitchWorkspace).toHaveBeenCalledWith("hospital");
  expect(onCreateWorkspace).toHaveBeenCalledTimes(1);
  expect(onDeleteWorkspace).toHaveBeenCalledTimes(1);
});
