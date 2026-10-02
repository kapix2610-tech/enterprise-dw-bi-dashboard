import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ChatPanel from "./ChatPanel";
import { API_URL } from "../config";
import { downloadReportAsPdf } from "./reportDownloads";

jest.mock("./reportDownloads", () => ({
  downloadReportAsDocx: jest.fn(() => Promise.resolve()),
  downloadReportAsPdf: jest.fn(() => Promise.resolve()),
  downloadReportAsPptx: jest.fn(() => Promise.resolve()),
}));

afterEach(() => jest.clearAllMocks());

test("loads the selected dataset's persisted chat and sends with its auth and file context", async () => {
  const history = [{ role: "user", content: "What is the trend?" }];
  global.fetch = jest.fn((url) => {
    if (url.includes("/api/chat/history")) {
      return Promise.resolve({ ok: true, json: async () => history });
    }
    if (url.endsWith("/api/chat")) {
      return Promise.resolve({ ok: true, json: async () => ({ answer: "Revenue is rising." }) });
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  const analysis = { fileId: "file-42", sourceName: "sales.csv", rows: [{ revenue: 12 }] };

  render(<ChatPanel analysis={analysis} user={{ name: "Sam Example" }} token="session-token" onClose={() => {}} />);

  expect(await screen.findByText("What is the trend?")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(`${API_URL}/api/chat/history?fileId=file-42`, {
    headers: { Authorization: "Bearer session-token" },
  });

  fireEvent.change(screen.getByRole("textbox", { name: /ask about your business data/i }), {
    target: { value: "Summarize sales" },
  });
  fireEvent.click(screen.getByRole("button", { name: /send message/i }));

  expect(await screen.findByText("Revenue is rising.")).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(`${API_URL}/api/chat`, expect.objectContaining({
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer session-token" },
    body: JSON.stringify({ question: "Summarize sales", fileId: "file-42", data: analysis }),
  })));
});

test("generates a file-scoped report and exports the exact backend report text", async () => {
  const analysis = { fileId: "file-123", rows: [{ revenue: 42 }] };
  const generatedReport = "## Weekly executive report\nBackend-generated revenue summary.\n\n## Next actions\n- Review the region.";
  global.fetch = jest.fn((url) => {
    if (url.includes("/api/chat/history")) {
      return Promise.resolve({ ok: true, json: async () => [] });
    }
    if (url.endsWith("/api/report")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ report: generatedReport, reportId: "report-456", createdAt: "2026-10-02T07:00:00.000Z" }),
      });
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });

  render(<ChatPanel analysis={analysis} token="test-token" />);
  const reportButton = await screen.findByRole("button", { name: /weekly report/i });
  await waitFor(() => expect(reportButton).toBeEnabled());
  fireEvent.click(reportButton);

  expect(await screen.findByText(/Report report-456/)).toBeInTheDocument();
  await waitFor(() => {
    const reportRequest = global.fetch.mock.calls.find(([url]) => url.endsWith("/api/report"));
    expect(JSON.parse(reportRequest[1].body)).toMatchObject({ fileId: "file-123", data: analysis });
  });

  fireEvent.click(screen.getByRole("button", { name: "PDF" }));
  await waitFor(() => expect(downloadReportAsPdf).toHaveBeenCalledWith(generatedReport, analysis, undefined));
});
