const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");
const mongoose = require("mongoose");
const { app, parseFile, parseFileBuffer, summarizeData } = require("./server");
const {
  createCredentialCipher,
  extractApiRows,
  isPublicIpv4,
  isPublicIpv6,
  validateRestEndpoint,
} = require("./restSources");

test("parses spreadsheet content into rows and numeric totals", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([{ product: "A", revenue: 1200 }, { product: "B", revenue: 800 }]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sales");
  const filePath = path.join(__dirname, "parser-test.xlsx");
  XLSX.writeFile(workbook, filePath);
  try {
    const parsed = parseFile(filePath, "parser-test.xlsx");
    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.totals.revenue, 2000);
    assert.match(summarizeData(parsed), /Rows: 2/);
  } finally { fs.rmSync(filePath, { force: true }); }
});

test("parses JSON datasets into rows and numeric totals", () => {
  const filePath = path.join(__dirname, "parser-test.json");
  fs.writeFileSync(filePath, JSON.stringify([{ income: 1200, date: "2026-01-01" }, { income: 800, date: "2026-01-02" }]));
  try {
    const parsed = parseFile(filePath, "parser-test.json");
    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.totals.income, 2000);
    assert.deepEqual(parsed.columns, ["income", "date"]);
  } finally { fs.rmSync(filePath, { force: true }); }
});

test("parses JSON and spreadsheet buffers for durable dataset storage", () => {
  const json = parseFileBuffer(Buffer.from(JSON.stringify([{ income: 1200 }, { income: 800 }])), "data.json");
  assert.equal(json.totals.income, 2000);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ revenue: 35 }]), "Sales");
  const spreadsheet = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const parsedSpreadsheet = parseFileBuffer(spreadsheet, "data.xlsx");
  assert.equal(parsedSpreadsheet.totals.revenue, 35);
});

test("extracts rows from common REST response shapes and rejects malformed data", () => {
  const rows = [{ income: 1200 }];
  assert.deepEqual(extractApiRows(rows), rows);
  assert.deepEqual(extractApiRows({ data: { records: rows } }, "data.records"), rows);
  assert.deepEqual(extractApiRows({ data: [] }), []);
  assert.throws(() => extractApiRows({ data: [null] }), /JSON object/i);
});

test("encrypts bearer credentials and rejects non-public endpoints", async () => {
  const cipher = createCredentialCipher("a-secure-test-signing-secret-with-at-least-32-characters");
  const encrypted = cipher.encrypt("never-return-this-token");
  assert.notEqual(encrypted, "never-return-this-token");
  assert.equal(cipher.decrypt(encrypted), "never-return-this-token");
  assert.equal(isPublicIpv4("8.8.8.8"), true);
  assert.equal(isPublicIpv4("127.0.0.1"), false);
  assert.equal(isPublicIpv6("2606:4700:4700::1111"), true);
  assert.equal(isPublicIpv6("::1"), false);
  await assert.rejects(validateRestEndpoint("https://127.0.0.1/data"), /public IPv4/i);
  await assert.rejects(validateRestEndpoint("https://example.com/data?api_token=secret"), /secrets in query/i);
  assert.throws(() => createCredentialCipher("short"), /at least 32 characters/i);
});

test("auth endpoints do not create temporary accounts when MongoDB is unavailable", async (t) => {
  assert.notEqual(mongoose.connection.readyState, 1);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const signup = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test User", email: "test@example.com", password: "password123" }),
  });
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", password: "password123" }),
  });

  assert.equal(signup.status, 503);
  assert.match((await signup.json()).error, /persistent storage is unavailable/i);
  assert.equal(login.status, 503);
  assert.match((await login.json()).error, /persistent storage is unavailable/i);

  const verify = await fetch(`${baseUrl}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "invalid-token" }),
  });
  assert.equal(verify.status, 400);
  assert.match((await verify.json()).error, /invalid or expired/i);

  const invalidHandoff = await fetch(`${baseUrl}/api/auth/claim-email-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handoffToken: "invalid-token" }),
  });
  assert.equal(invalidHandoff.status, 400);

  const pendingHandoff = await fetch(`${baseUrl}/api/auth/claim-email-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handoffToken: "a".repeat(64) }),
  });
  assert.equal(pendingHandoff.status, 503);
});
