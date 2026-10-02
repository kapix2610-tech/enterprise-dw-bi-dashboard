import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DataSources from "./DataSources";

test("connects, refreshes, and disconnects a workspace REST API", async () => {
  let connected = false;
  const connection = {
    id: "source-1",
    workspaceId: "workspace-1",
    name: "Hospital visits",
    url: "https://api.example.com/visits",
    enabled: true,
    fileId: "file-1",
    lastSyncedAt: null,
  };
  const fetchMock = jest.fn(async (url, options = {}) => {
    if (url.includes("/api/sources?")) {
      return { ok: true, json: async () => connected ? [connection] : [] };
    }
    if (url.endsWith("/api/files")) {
      return { ok: true, json: async () => connected ? [{ sourceId: "source-1", rowCount: 2 }] : [] };
    }
    if (url.endsWith("/api/sources") && options.method === "POST") {
      connected = true;
      return { ok: true, status: 201, json: async () => ({ dataset: { fileId: "file-1", rowCount: 2 } }) };
    }
    if (url.endsWith("/api/sources/source-1/sync")) {
      return { ok: true, json: async () => ({ dataset: { fileId: "file-1", rowCount: 3 } }) };
    }
    if (url.endsWith("/api/sources/source-1") && options.method === "DELETE") {
      connected = false;
      return { ok: true, json: async () => ({ deleted: true }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  global.fetch = fetchMock;
  const onSourceSynced = jest.fn();
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);

  render(
    <DataSources
      token="session-token"
      workspaceId="workspace-1"
      onImport={jest.fn()}
      onOpenDashboard={jest.fn()}
      onSourceSynced={onSourceSynced}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /REST API/ }));
  fireEvent.change(screen.getByPlaceholderText("Hospital visits API"), { target: { value: "Hospital visits" } });
  fireEvent.change(screen.getByPlaceholderText("https://api.example.com/v1/records"), { target: { value: connection.url } });
  fireEvent.change(screen.getByPlaceholderText("Paste the API bearer token"), { target: { value: "private-test-token" } });
  fireEvent.click(screen.getByRole("button", { name: /Test & connect/i }));

  expect(await screen.findByText(/API connected\. Automatic refresh is enabled/i)).toBeInTheDocument();
  expect(onSourceSynced).toHaveBeenCalledWith("file-1");
  const createRequest = fetchMock.mock.calls.find(([url, options]) => url.endsWith("/api/sources") && options?.method === "POST");
  expect(JSON.parse(createRequest[1].body)).toMatchObject({ workspaceId: "workspace-1", token: "private-test-token" });

  fireEvent.click(screen.getByRole("button", { name: /Refresh now/i }));
  await waitFor(() => expect(onSourceSynced).toHaveBeenLastCalledWith("file-1"));
  expect(await screen.findByText(/Live data refreshed: 3 rows/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Disconnect/i }));
  expect(confirm).toHaveBeenCalled();
  expect(await screen.findByText(/API disconnected\. Its last synced dataset remains in Data history/i)).toBeInTheDocument();
  confirm.mockRestore();
});
