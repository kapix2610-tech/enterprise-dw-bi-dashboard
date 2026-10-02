import { act, fireEvent, render, screen } from "@testing-library/react";
import InsightReport from "./InsightReport";
import {
  downloadReportAsDocx,
  downloadReportAsPdf,
  downloadReportAsPptx,
} from "./reportDownloads";

jest.mock("./reportDownloads", () => ({
  downloadReportAsDocx: jest.fn(() => Promise.resolve()),
  downloadReportAsPdf: jest.fn(() => Promise.resolve()),
  downloadReportAsPptx: jest.fn(() => Promise.resolve()),
}));

afterEach(() => jest.clearAllMocks());

test("shows report exports and downloads the generated report content", async () => {
  const report = "## Weekly executive report\nRevenue grew 12%.\n\n## Next actions\n- Review the north region.";
  render(<InsightReport content={report} />);

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "PowerPoint" }));
    await Promise.resolve();
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    await Promise.resolve();
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Word (.docx)" }));
    await Promise.resolve();
  });

  expect(downloadReportAsPptx).toHaveBeenCalledWith(report);
  expect(downloadReportAsPdf).toHaveBeenCalledWith(report);
  expect(downloadReportAsDocx).toHaveBeenCalledWith(report);
});

test("does not show export controls for ordinary chat answers", () => {
  render(<InsightReport content="Here is a short answer." />);
  expect(screen.queryByRole("button", { name: "PDF" })).not.toBeInTheDocument();
});
