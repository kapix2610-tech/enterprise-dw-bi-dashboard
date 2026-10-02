// Always load this backend's .env file, even when the server is started from
// the repository root (for example: `node dw-bi-backend/server.js`).
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const dns = require("dns").promises;
const fs = require("fs");
const https = require("https");
const OpenAI = require("openai");
const crypto = require("crypto");
const XLSX = require("xlsx");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  createCredentialCipher,
  extractApiRows,
  requestRestJson,
  safeSource,
  validateRestEndpoint,
} = require("./restSources");
const DATA_SOURCE_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const sourceSyncsInProgress = new Set();

const app = express();
// Configure file storage
const uploadsDirectory = path.join(__dirname, "uploads");
fs.mkdirSync(uploadsDirectory, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDirectory);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const allowed = /csv|xlsx|xls|json/i.test(path.extname(file.originalname));
  cb(allowed ? null : new Error("Only CSV, Excel, and JSON files are supported."), allowed);
} });
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "datawise";
const MONGODB_RETRY_MS = Number(process.env.MONGODB_RETRY_MS || 15000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const META_API_KEY = process.env.META_API_KEY;
const meta = META_API_KEY ? new OpenAI({ apiKey: META_API_KEY, baseURL: process.env.META_BASE_URL || "https://api.llama.com/v1" }) : null;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groq = GROQ_API_KEY ? new OpenAI({ apiKey: GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" }) : null;
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 7);
const EMAIL_VERIFICATION_TTL_HOURS = Number(process.env.EMAIL_VERIFICATION_TTL_HOURS || 24);
const EMAIL_VERIFICATION_HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_VERIFICATION_COOLDOWN_MS = 60 * 1000;
const EMAIL_VERIFICATION_BASE_URL = (process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL || process.env.CORS_ORIGIN?.split(",")[0] || "http://localhost:3000").replace(/\/+$/, "");
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true" || SMTP_PORT === 465;
const mailTransport = SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM
  ? nodemailer.createTransport({ host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE, auth: { user: SMTP_USER, pass: SMTP_PASS } })
  : null;

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  emailVerificationHandoffTokenHash: { type: String, index: true },
  emailVerificationHandoffExpiresAt: { type: Date },
}, { timestamps: true });
const User = mongoose.models.User || mongoose.model("User", userSchema);

const pendingRegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  verificationTokenHash: { type: String, required: true, index: true },
  emailVerificationHandoffTokenHash: { type: String },
  lastSentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true });
const PendingRegistration = mongoose.models.PendingRegistration || mongoose.model("PendingRegistration", pendingRegistrationSchema);

const sessionSchema = new mongoose.Schema({
  tokenId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true });
const Session = mongoose.models.Session || mongoose.model("Session", sessionSchema);

const uploadedFileSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  workspaceId: { type: String, default: "default", index: true },
  sourceId: { type: String, default: null, index: true },
  originalName: String,
  storedName: String,
  mimeType: String,
  size: Number,
  rowCount: Number,
  columns: [String],
  preview: [mongoose.Schema.Types.Mixed],
  analysis: mongoose.Schema.Types.Mixed,
}, { timestamps: true });
const chatMessageSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: "UploadedFile" },
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
}, { timestamps: true });
uploadedFileSchema.index(
  { userId: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { sourceId: { $type: "string" } } },
);
const UploadedFile = mongoose.models.UploadedFile || mongoose.model("UploadedFile", uploadedFileSchema);
const ChatMessage = mongoose.models.ChatMessage || mongoose.model("ChatMessage", chatMessageSchema);
const reportSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: "UploadedFile" },
  title: { type: String, required: true },
  content: { type: String, required: true },
}, { timestamps: true });
const Report = mongoose.models.Report || mongoose.model("Report", reportSchema);
const dataSourceSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  workspaceId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  url: { type: String, required: true, maxlength: 2000 },
  rowsPath: { type: String, default: "", maxlength: 200 },
  encryptedToken: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  lastAttemptAt: { type: Date, default: null },
  lastSyncedAt: { type: Date, default: null },
  lastError: { type: String, default: "" },
  fileId: { type: String, default: "" },
}, { timestamps: true });
dataSourceSchema.index({ userId: 1, workspaceId: 1 }, { unique: true });
const DataSource = mongoose.models.DataSource || mongoose.model("DataSource", dataSourceSchema);
// Middleware
const allowedOrigins = [...(process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:3001").split(","), process.env.RENDER_EXTERNAL_URL]
  .filter(Boolean)
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("This origin is not allowed by CORS."));
  },
}));
app.use(express.json({ limit: "1mb" }));

const dashboardBuildDirectory = path.resolve(__dirname, "../dw-bi-dashboard/build");
if (process.env.NODE_ENV === "production" && fs.existsSync(dashboardBuildDirectory)) {
  app.use(express.static(dashboardBuildDirectory));
}

// Test route
app.get("/", (req, res) => {
  if (process.env.NODE_ENV === "production" && fs.existsSync(path.join(dashboardBuildDirectory, "index.html"))) {
    return res.sendFile(path.join(dashboardBuildDirectory, "index.html"));
  }
  res.send("Backend server is running! 🚀");
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    database: mongoose.connection.readyState === 1 ? "connected" : "unavailable",
    persistentAuth: Boolean(MONGODB_URI),
    emailVerificationConfigured: Boolean(mailTransport),
  });
});

function userId(req) {
  return req.user.id;
}

async function loadOwnedDataset(fileId, ownerId) {
  if (!mongoose.isValidObjectId(fileId)) return { error: "Invalid dataset id.", status: 400 };
  const file = await UploadedFile.findOne({ _id: fileId, userId: ownerId }).lean();
  if (!file) return { error: "Dataset not found in this workspace.", status: 404 };
  const storedName = path.basename(file.storedName || "");
  if (!storedName || storedName !== file.storedName) throw new Error("Stored dataset path is invalid.");
  try {
    const parsed = parseFile(path.join(uploadsDirectory, storedName), file.originalName);
    return { rows: parsed.rows.slice(0, 1000), columns: parsed.columns, totals: parsed.totals };
  } catch (error) {
    if (error.code === "ENOENT") return { error: "The original dataset file is no longer available.", status: 410 };
    throw error;
  }
}

async function requireAuth(req, res, next) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication required." });
  if (!databaseRequired(res)) return;
  try {
    const claims = jwt.verify(token, JWT_SECRET);
    if (typeof claims === "string" || !claims.sub || !claims.jti) {
      return res.status(401).json({ error: "Session is invalid. Please sign in again." });
    }
    const session = await Session.findOne({
      tokenId: claims.jti,
      userId: claims.sub,
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!session) return res.status(401).json({ error: "Session expired or signed out. Please sign in again." });
    req.user = { id: claims.sub, email: claims.email, name: claims.name };
    req.sessionId = claims.jti;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: "Session expired. Please sign in again." });
    }
    return next(error);
  }
}

function databaseRequired(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      error: "Persistent storage is unavailable. Check MONGODB_URI, Atlas database-user credentials, and Atlas Network Access, then retry.",
    });
    return false;
  }
  return true;
}

function validateConfiguration() {
  const issues = [];
  if (!MONGODB_URI) issues.push("MONGODB_URI is required for persistent accounts and sessions.");
  if (!JWT_SECRET || JWT_SECRET.length < 32) issues.push("JWT_SECRET must contain at least 32 characters.");
  if (!Number.isInteger(SESSION_TTL_DAYS) || SESSION_TTL_DAYS < 1 || SESSION_TTL_DAYS > 30) {
    issues.push("SESSION_TTL_DAYS must be a whole number between 1 and 30.");
  }
  if (!Number.isInteger(MONGODB_RETRY_MS) || MONGODB_RETRY_MS < 1000 || MONGODB_RETRY_MS > 300000) {
    issues.push("MONGODB_RETRY_MS must be a whole number between 1000 and 300000.");
  }
  if (!Number.isInteger(EMAIL_VERIFICATION_TTL_HOURS) || EMAIL_VERIFICATION_TTL_HOURS < 1 || EMAIL_VERIFICATION_TTL_HOURS > 168) {
    issues.push("EMAIL_VERIFICATION_TTL_HOURS must be a whole number between 1 and 168.");
  }
  if (!Number.isInteger(SMTP_PORT) || SMTP_PORT < 1 || SMTP_PORT > 65535) {
    issues.push("SMTP_PORT must be a valid TCP port.");
  }
  if (issues.length) throw new Error(`Invalid backend configuration:\n- ${issues.join("\n- ")}`);
}

async function createSession(user) {
  const tokenId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await Session.create({ tokenId, userId: user._id.toString(), expiresAt });
  const token = jwt.sign(
    { sub: user._id.toString(), jti: tokenId, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: `${SESSION_TTL_DAYS}d` },
  );
  return { token, user: { id: user._id.toString(), name: user.name, email: user.email } };
}

function hashVerificationToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function validateEmailDomain(email) {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch (error) {
    if (!["ENODATA", "ENOTFOUND", "ENODOMAIN"].includes(error.code)) {
      throw new Error("Email domain verification is temporarily unavailable.");
    }
    try {
      const addresses = await dns.lookup(domain, { all: true });
      return addresses.length > 0;
    } catch {
      return false;
    }
  }
}

async function sendVerificationEmail(registration, rawToken) {
  if (!mailTransport) throw new Error("Email verification is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.");
  const link = `${EMAIL_VERIFICATION_BASE_URL}/?verify=${encodeURIComponent(rawToken)}`;
  const safeName = registration.name.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
  await mailTransport.sendMail({
    from: SMTP_FROM,
    to: registration.email,
    subject: "Confirm your Datawise account",
    text: `Hello ${registration.name},\n\nConfirm your email address to activate your Datawise account:\n${link}\n\nThis link expires in ${EMAIL_VERIFICATION_TTL_HOURS} hours. If you did not request this account, you can ignore this message.`,
    html: `<p>Hello ${safeName},</p><p>Confirm your email address to activate your Datawise account.</p><p><a href="${link}">Confirm my email</a></p><p>This link expires in ${EMAIL_VERIFICATION_TTL_HOURS} hours. If you did not request this account, you can ignore this message.</p>`,
  });
}

async function createPendingRegistration({ name, email, passwordHash, handoffToken }) {
  const existing = await PendingRegistration.findOne({ email }).select("lastSentAt").lean();
  if (existing?.lastSentAt && Date.now() - existing.lastSentAt.getTime() < EMAIL_VERIFICATION_COOLDOWN_MS) {
    const error = new Error("Please wait a minute before requesting another confirmation email.");
    error.code = "EMAIL_COOLDOWN";
    throw error;
  }
  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000);
  const lastSentAt = new Date();
  const registration = await PendingRegistration.findOneAndUpdate(
    { email },
    {
      name,
      email,
      passwordHash,
      verificationTokenHash: hashVerificationToken(rawToken),
      emailVerificationHandoffTokenHash: handoffToken ? hashVerificationToken(handoffToken) : undefined,
      lastSentAt,
      expiresAt,
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  try {
    await sendVerificationEmail(registration, rawToken);
    return registration;
  } catch (error) {
    await PendingRegistration.deleteOne({ _id: registration._id });
    throw error;
  }
}

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`MongoDB connected (database: ${MONGODB_DB})`);
    void syncDueRestSources();
  } catch (error) {
    console.error("MongoDB connection failed. Authentication and persistence are disabled until it is reachable:", error.message);
    const retry = setTimeout(() => { void connectToDatabase(); }, MONGODB_RETRY_MS);
    retry.unref();
  }
}

function parseFile(filePath, originalName) {
  let rows;
  if (path.extname(originalName).toLowerCase() === ".json") {
    rows = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } else {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
  }
  if (!Array.isArray(rows) || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("Dataset must contain an array of row objects.");
  }
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  // Excel serial dates and JavaScript Date values are numeric when coerced.
  // They are dimensions, not financial metrics, so never add them as totals.
  const dateColumn = /(?:^|[_\s-])(date|day|month|year|time|timestamp)(?:$|[_\s-])/i;
  const numericColumns = columns.filter((column) => !dateColumn.test(column) && rows.some((row) => {
    const value = row[column];
    return !(value instanceof Date) && value !== "" && Number.isFinite(Number(value));
  }));
  const totals = numericColumns.reduce((result, column) => { result[column] = rows.reduce((sum, row) => sum + (Number(row[column]) || 0), 0); return result; }, {});
  return { rows, columns, totals, source: originalName };
}

function summarizeData(data) {
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const columns = Array.isArray(data?.columns) && data.columns.length ? data.columns : Object.keys(rows[0] || {});
  const totals = data?.totals || rows.reduce((result, row) => {
    Object.entries(row || {}).forEach(([key, value]) => { if (Number.isFinite(Number(value)) && value !== "") result[key] = (result[key] || 0) + Number(value); });
    return result;
  }, {});
  const numeric = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  return `Rows: ${rows.length}. Columns: ${columns.join(", ") || "none"}. Numeric totals: ${numeric.map(([key, value]) => `${key}=${value}`).join(", ") || "none"}. Sample: ${JSON.stringify(rows.slice(0, 5))}`;
}

function deriveInsights(rows) {
  const valueFor = (row, names, fallback) => {
    const key = Object.keys(row || {}).find((column) => names.includes(column.toLowerCase().trim()));
    return key ? row[key] : fallback;
  };
  const amountFor = (row) => Number(valueFor(row, ["revenue", "sales", "amount", "income", "value"], 0)) || 0;
  const byRegion = Object.values(rows.reduce((result, row) => { const region = valueFor(row, ["region", "category", "location", "area"], "All records"); result[region] = result[region] || { region, revenue: 0 }; result[region].revenue += amountFor(row); return result; }, {})).sort((a, b) => b.revenue - a.revenue);
  const byDate = Object.values(rows.reduce((result, row) => { const date = valueFor(row, ["date", "month", "day", "period"], "Data"); result[date] = result[date] || { month: date, revenue: 0 }; result[date].revenue += amountFor(row); return result; }, {}));
  return { byRegion, byDate };
}

async function syncRestSource(source) {
  const sourceId = source._id.toString();
  if (sourceSyncsInProgress.has(sourceId)) throw new Error("A refresh for this API source is already in progress.");
  sourceSyncsInProgress.add(sourceId);
  try {
    await DataSource.updateOne({ _id: source._id }, { $set: { lastAttemptAt: new Date(), lastError: "" } });
    const { endpoint, address } = await validateRestEndpoint(source.url);
    const token = createCredentialCipher(JWT_SECRET).decrypt(source.encryptedToken);
    const payload = await requestRestJson(endpoint, address, token);
    const rows = extractApiRows(payload, source.rowsPath);
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const analysis = { totals: summarizeRows(rows), sample: rows.slice(0, 5), ...deriveInsights(rows) };
    const storedName = `rest-${sourceId}-${crypto.randomUUID()}.json`;
    const filePath = path.join(uploadsDirectory, storedName);
    const serializedRows = JSON.stringify(rows);
    const previousFile = await UploadedFile.findOne({ userId: source.userId, sourceId })
      .select("storedName")
      .lean();
    let record;
    try {
      await fs.promises.writeFile(filePath, serializedRows, { flag: "wx" });
      record = await UploadedFile.findOneAndUpdate(
        { userId: source.userId, sourceId },
        {
          $set: {
            workspaceId: source.workspaceId,
            sourceId,
            originalName: `${source.name}.json`,
            storedName,
            mimeType: "application/json",
            size: Buffer.byteLength(serializedRows),
            rowCount: rows.length,
            columns,
            preview: rows.slice(0, 20),
            analysis,
          },
        },
        { upsert: true, new: true, runValidators: true },
      );
    } catch (error) {
      await fs.promises.unlink(filePath).catch((unlinkError) => {
        if (unlinkError.code !== "ENOENT") console.error("Could not clean up failed API snapshot:", unlinkError.message);
      });
      throw error;
    }

    const lastSyncedAt = record.updatedAt || new Date();
    await DataSource.updateOne(
      { _id: source._id },
      { $set: { fileId: record._id.toString(), lastSyncedAt, lastAttemptAt: new Date(), lastError: "" } },
    );
    if (previousFile?.storedName && previousFile.storedName !== storedName) {
      await fs.promises.unlink(path.join(uploadsDirectory, path.basename(previousFile.storedName))).catch((error) => {
        if (error.code !== "ENOENT") console.error("Could not remove replaced API snapshot:", error.message);
      });
    }
    return { fileId: record._id.toString(), rowCount: rows.length, columns, lastSyncedAt };
  } catch (error) {
    await DataSource.updateOne(
      { _id: source._id },
      { $set: { lastAttemptAt: new Date(), lastError: error.message.slice(0, 500) } },
    );
    throw error;
  } finally {
    sourceSyncsInProgress.delete(sourceId);
  }
}

function summarizeRows(rows) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const dateColumn = /(?:^|[_\s-])(date|day|month|year|time|timestamp)(?:$|[_\s-])/i;
  return columns
    .filter((column) => !dateColumn.test(column) && rows.some((row) => row[column] !== "" && Number.isFinite(Number(row[column]))))
    .reduce((totals, column) => {
      totals[column] = rows.reduce((sum, row) => sum + (Number(row[column]) || 0), 0);
      return totals;
    }, {});
}

async function syncDueRestSources() {
  if (mongoose.connection.readyState !== 1) return;
  const dueBefore = new Date(Date.now() - DATA_SOURCE_SYNC_INTERVAL_MS);
  try {
    const dueSources = await DataSource.find({
      enabled: true,
      $or: [
        { lastAttemptAt: null },
        { lastAttemptAt: { $exists: false } },
        { lastAttemptAt: { $lte: dueBefore } },
      ],
    }).sort({ lastAttemptAt: 1, createdAt: 1 }).limit(25);
    await Promise.all(dueSources.map(async (source) => {
      try {
        await syncRestSource(source);
      } catch (error) {
        console.error(`API source refresh failed (${source._id}):`, error.message);
      }
    }));
  } catch (error) {
    console.error("Could not check due API source refreshes:", error.message);
  }
}

async function askGemini(question, data, history) {
  const safeData = data && typeof data === "object" ? data : { rows: [], columns: [], totals: {} };
  const safeHistory = Array.isArray(history) ? history : [];
  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
      const result = await model.generateContent(`You are Datawise BI analyst. Answer concisely using only this data.\n${summarizeData(safeData)}\nQuestion: ${question}`);
      return result.response.text();
    } catch (error) {
      console.error("Gemini request failed; using local fallback:", error.status || error.message);
    }
  }
  const client = groq || meta || openai;
  const providerKey = groq ? "GROQ_API_KEY" : meta ? "META_API_KEY" : "OPENAI_API_KEY";
  if (!client) return `I analyzed ${data.rows.length} rows. Your question was: "${question}". The main numeric totals are ${JSON.stringify(data.totals)}. Add a valid ${providerKey} to enable richer natural-language insights.`;
  const prompt = `You are Datawise BI analyst. Answer concisely with useful business insight. Do not invent values.\nDataset: ${summarizeData(safeData)}\nConversation: ${safeHistory.map((message) => `${message.role}: ${message.content}`).join("\n")}\nQuestion: ${question}`;
  const model = groq ? (process.env.GROQ_MODEL || "openai/gpt-oss-120b") : meta ? (process.env.META_MODEL || "Llama-4-Scout-17B-16E-Instruct") : (process.env.OPENAI_MODEL || "gpt-4o-mini");
  const result = await client.chat.completions.create({ model, temperature: 0.2, messages: [{ role: "system", content: "You are a careful business intelligence analyst." }, { role: "user", content: prompt }] });
  return result.choices[0]?.message?.content || "I could not generate an answer.";
}

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password, handoffToken } = req.body || {};
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80 ||
      typeof email !== "string" || email.trim().length > 254 || !/^\S+@\S+\.\S+$/.test(email.trim()) ||
      typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({ error: "Name (up to 80 characters), valid email, and a password of 8–72 UTF-8 bytes are required." });
  }
  if (!databaseRequired(res)) return;
  try {
    const normalizedEmail = email.toLowerCase().trim();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ error: "An account with this email already exists." });
    if (!mailTransport) return res.status(503).json({ error: "Email verification is not configured. Ask the administrator to configure the SMTP settings." });
    if (!await validateEmailDomain(normalizedEmail)) {
      return res.status(400).json({ error: "This email domain does not have a valid mail server. Check the address and try again." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await createPendingRegistration({ name: name.trim(), email: normalizedEmail, passwordHash, handoffToken });
    return res.status(202).json({
      verificationRequired: true,
      email: normalizedEmail,
      message: "Check your inbox and confirm your email to activate your account.",
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "An account with this email already exists." });
    if (error.code === "EMAIL_COOLDOWN") return res.status(429).json({ error: error.message });
    console.error("Could not start account registration:", error.message);
    return res.status(error.message.startsWith("Email verification is not configured") ? 503 : 500).json({
      error: error.message.startsWith("Email verification is not configured")
        ? error.message
        : "Could not send the email confirmation. Check your SMTP settings and try again.",
    });
  }
});

app.post("/api/auth/verify-email", async (req, res) => {
  const token = req.body?.token;
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ error: "The email confirmation link is invalid or expired. Request a new one." });
  }
  if (!databaseRequired(res)) return;
  try {
    const registration = await PendingRegistration.findOne({
      verificationTokenHash: hashVerificationToken(token),
      expiresAt: { $gt: new Date() },
    });
    if (!registration) {
      return res.status(400).json({ error: "The email confirmation link is invalid or expired. Request a new one." });
    }
    if (await User.exists({ email: registration.email })) {
      await PendingRegistration.deleteOne({ _id: registration._id });
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    const user = await User.create({
      name: registration.name,
      email: registration.email,
      passwordHash: registration.passwordHash,
      emailVerificationHandoffTokenHash: registration.emailVerificationHandoffTokenHash,
      emailVerificationHandoffExpiresAt: registration.emailVerificationHandoffTokenHash
        ? new Date(Date.now() + EMAIL_VERIFICATION_HANDOFF_TTL_MS)
        : undefined,
    });
    await PendingRegistration.deleteOne({ _id: registration._id });
    return res.json(await createSession(user));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "An account with this email already exists." });
    console.error("Could not verify account email:", error.message);
    return res.status(500).json({ error: "Could not confirm this email. Please request a new link." });
  }
});

app.post("/api/auth/claim-email-verification", async (req, res) => {
  const handoffToken = req.body?.handoffToken;
  if (typeof handoffToken !== "string" || !/^[a-f0-9]{64}$/i.test(handoffToken)) {
    return res.status(400).json({ error: "The confirmation handoff is invalid." });
  }
  if (!databaseRequired(res)) return;
  try {
    const user = await User.findOneAndUpdate(
      {
        emailVerificationHandoffTokenHash: hashVerificationToken(handoffToken),
        emailVerificationHandoffExpiresAt: { $gt: new Date() },
      },
      { $unset: { emailVerificationHandoffTokenHash: "", emailVerificationHandoffExpiresAt: "" } },
      { new: true },
    );
    if (!user) return res.status(202).json({ pending: true });
    return res.json(await createSession(user));
  } catch (error) {
    console.error("Could not complete confirmed account sign-in:", error.message);
    return res.status(500).json({ error: "Could not start the confirmed account session." });
  }
});

app.post("/api/auth/resend-verification", async (req, res) => {
  const email = req.body?.email;
  if (typeof email !== "string" || email.trim().length > 254 || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (!databaseRequired(res)) return;
  if (!mailTransport) {
    return res.status(503).json({ error: "Email verification is not configured. Ask the administrator to configure the SMTP settings." });
  }
  try {
    const registration = await PendingRegistration.findOne({ email: email.toLowerCase().trim() });
    if (registration && Date.now() - registration.lastSentAt.getTime() >= EMAIL_VERIFICATION_COOLDOWN_MS) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      registration.verificationTokenHash = hashVerificationToken(rawToken);
      registration.lastSentAt = new Date();
      registration.expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000);
      await registration.save();
      await sendVerificationEmail(registration, rawToken);
    }
    return res.status(202).json({ message: "If this address has an eligible pending registration, a confirmation link has been sent." });
  } catch (error) {
    console.error("Could not resend verification email:", error.message);
    return res.status(503).json({ error: "Could not send a new confirmation email. Please check the SMTP configuration." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== "string" || email.trim().length > 254 || typeof password !== "string" ||
      !email.trim() || !password || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({ error: "Enter a valid email address and password." });
  }
  if (!databaseRequired(res)) return;
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");
    if (!user) {
      const pending = await PendingRegistration.findOne({ email: normalizedEmail }).select("+passwordHash");
      if (pending && await bcrypt.compare(password, pending.passwordHash)) {
        return res.status(403).json({ error: "Confirm your email address using the link we sent before signing in." });
      }
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    return res.json(await createSession(user));
  } catch (error) {
    console.error("Could not sign in:", error.message);
    return res.status(500).json({ error: "Could not sign in." });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = await User.findById(userId(req)).select("name email").lean();
  if (!user) {
    await Session.deleteOne({ tokenId: req.sessionId });
    return res.status(401).json({ error: "Account no longer exists. Please sign in again." });
  }
  return res.json({ user: { id: user._id.toString(), name: user.name, email: user.email } });
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  await Session.deleteOne({ tokenId: req.sessionId });
  return res.status(204).end();
});

// Test AI route
app.get("/test-ai", async (req, res) => {
  try {
    if (gemini) { try { const result = await gemini.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" }).generateContent("Say hello in one short sentence."); return res.send(result.response.text()); } catch (error) { return res.status(502).send("Gemini API is not available for this key or model."); } }
    const client = groq || meta || openai;
    if (!client) return res.status(503).send("GROQ_API_KEY, GEMINI_API_KEY, META_API_KEY, or OPENAI_API_KEY is not configured.");
    const model = groq ? (process.env.GROQ_MODEL || "openai/gpt-oss-120b") : meta ? (process.env.META_MODEL || "Llama-4-Scout-17B-16E-Instruct") : (process.env.OPENAI_MODEL || "gpt-4o-mini");
    const result = await client.chat.completions.create({ model, messages: [{ role: "user", content: "Say hello in one short sentence." }] });
    res.send(result.choices[0]?.message?.content || "Hello.");
  } catch (error) {
    console.error(error);
    res.status(500).send("AI request failed: " + error.message);
  }
});

app.get("/api/sources", requireAuth, async (req, res) => {
  if (!databaseRequired(res)) return;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId || workspaceId.length > 100) {
    return res.status(400).json({ error: "A valid workspace id is required." });
  }
  const sources = await DataSource.find({ userId: userId(req), workspaceId })
    .sort({ createdAt: -1 })
    .lean();
  return res.json(sources.map(safeSource));
});

app.post("/api/sources", requireAuth, async (req, res) => {
  if (!databaseRequired(res)) return;
  const { name, url, token, rowsPath = "", workspaceId } = req.body || {};
  if (
    typeof name !== "string" || !name.trim() || name.trim().length > 80 ||
    typeof url !== "string" || !url.trim() || url.length > 2000 ||
    typeof token !== "string" || !token.trim() || token.trim().length > 4096 ||
    typeof workspaceId !== "string" || !workspaceId.trim() || workspaceId.length > 100 ||
    typeof rowsPath !== "string" || rowsPath.length > 200
  ) {
    return res.status(400).json({ error: "Provide a source name, HTTPS URL, bearer token, workspace id, and optional valid rows path." });
  }
  try {
    await validateRestEndpoint(url.trim());
    const existing = await DataSource.findOne({ userId: userId(req), workspaceId: workspaceId.trim() }).select("_id").lean();
    if (existing) return res.status(409).json({ error: "This workspace already has a REST API source. Disconnect it before adding another." });
    const source = await DataSource.create({
      userId: userId(req),
      workspaceId: workspaceId.trim(),
      name: name.trim(),
      url: url.trim(),
      rowsPath: rowsPath.trim(),
      encryptedToken: createCredentialCipher(JWT_SECRET).encrypt(token.trim()),
      enabled: true,
    });
    try {
      const dataset = await syncRestSource(source);
      const updatedSource = await DataSource.findById(source._id).lean();
      return res.status(201).json({ source: safeSource(updatedSource), dataset });
    } catch (error) {
      const updatedSource = await DataSource.findById(source._id).lean();
      return res.status(502).json({
        error: `API source was saved, but its first refresh failed: ${error.message}`,
        source: safeSource(updatedSource),
      });
    }
  } catch (error) {
    const status = /HTTPS|valid API URL|public IPv4|URL credentials|URL credentials|JWT_SECRET/i.test(error.message) ? 400 : 502;
    return res.status(status).json({ error: error.message || "Could not connect to this API source." });
  }
});

app.post("/api/sources/:sourceId/sync", requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.sourceId)) return res.status(400).json({ error: "Invalid source id." });
  if (!databaseRequired(res)) return;
  const source = await DataSource.findOne({ _id: req.params.sourceId, userId: userId(req) });
  if (!source) return res.status(404).json({ error: "API source not found in this account." });
  try {
    const dataset = await syncRestSource(source);
    const updatedSource = await DataSource.findById(source._id).lean();
    return res.json({ source: safeSource(updatedSource), dataset });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Could not refresh this API source." });
  }
});

app.delete("/api/sources/:sourceId", requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.sourceId)) return res.status(400).json({ error: "Invalid source id." });
  if (!databaseRequired(res)) return;
  const source = await DataSource.findOneAndDelete({ _id: req.params.sourceId, userId: userId(req) });
  if (!source) return res.status(404).json({ error: "API source not found in this account." });
  return res.json({ deleted: true, preservedDatasetId: source.fileId || null });
});

app.post("/api/upload", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }
  if (!databaseRequired(res)) {
    await fs.promises.unlink(req.file.path).catch((error) => {
      if (error.code !== "ENOENT") console.error("Could not remove unpersisted upload:", error.message);
    });
    return;
  }
  const workspaceId = typeof req.body.workspaceId === "string" && req.body.workspaceId.trim()
    ? req.body.workspaceId.trim()
    : "default";
  if (workspaceId.length > 100) {
    await fs.promises.unlink(req.file.path).catch((error) => {
      if (error.code !== "ENOENT") console.error("Could not remove invalid upload:", error.message);
    });
    return res.status(400).json({ error: "Workspace id is invalid." });
  }
  try {
    let data;
    try {
      data = parseFile(req.file.path, req.file.originalname);
    } catch (error) {
      await fs.promises.unlink(req.file.path).catch((unlinkError) => {
        if (unlinkError.code !== "ENOENT") console.error("Could not remove invalid upload:", unlinkError.message);
      });
      return res.status(422).json({ error: `Could not parse file: ${error.message}` });
    }
    const analysis = { totals: data.totals, sample: data.rows.slice(0, 5), ...deriveInsights(data.rows) };
    let record;
    try {
      record = await UploadedFile.create({ userId: userId(req), workspaceId, originalName: req.file.originalname, storedName: req.file.filename, mimeType: req.file.mimetype, size: req.file.size, rowCount: data.rows.length, columns: data.columns, preview: data.rows.slice(0, 20), analysis });
    } catch (error) {
      await fs.promises.unlink(req.file.path).catch((unlinkError) => {
        if (unlinkError.code !== "ENOENT") console.error("Could not remove unpersisted upload:", unlinkError.message);
      });
      console.error("Could not save uploaded file:", error.message);
      return res.status(500).json({ error: "Could not save the uploaded file." });
    }
    return res.json({ message: "File uploaded and parsed.", fileId: record._id, filename: req.file.originalname, workspaceId: record.workspaceId, rowCount: data.rows.length, columns: data.columns, rows: data.rows.slice(0, 1000), preview: data.rows.slice(0, 5), analysis });
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch((unlinkError) => {
      if (unlinkError.code !== "ENOENT") console.error("Could not remove failed upload:", unlinkError.message);
    });
    console.error("File upload processing failed:", error.message);
    return res.status(500).json({ error: "File upload processing failed." });
  }
});

app.get("/api/files", requireAuth, async (req, res) => {
  if (!databaseRequired(res)) return;
  const files = await UploadedFile.find({ userId: userId(req) }).sort({ updatedAt: -1 }).select("originalName mimeType size rowCount columns analysis workspaceId sourceId createdAt updatedAt").lean();
  res.json(files);
});

app.get("/api/files/:fileId", requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.fileId)) return res.status(400).json({ error: "Invalid dataset id." });
  if (!databaseRequired(res)) return;
  try {
    const file = await UploadedFile.findOne({ _id: req.params.fileId, userId: userId(req) }).lean();
    if (!file) return res.status(404).json({ error: "Dataset not found in this workspace." });
    const storedName = path.basename(file.storedName || "");
    if (!storedName || storedName !== file.storedName) {
      console.error("Rejected unsafe stored file name for dataset:", file._id.toString());
      return res.status(500).json({ error: "Stored dataset file could not be opened." });
    }
    const filePath = path.join(uploadsDirectory, storedName);
    try {
      const parsed = parseFile(filePath, file.originalName);
      return res.json({
        fileId: file._id,
        workspaceId: file.workspaceId || "default",
          sourceId: file.sourceId || null,
          filename: file.originalName,
        rowCount: parsed.rows.length,
        columns: parsed.columns,
        rows: parsed.rows.slice(0, 1000),
        analysis: file.analysis,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      });
    } catch (error) {
      if (error.code === "ENOENT") return res.status(410).json({ error: "The original dataset file is no longer available." });
      throw error;
    }
  } catch (error) {
    console.error("Could not load dataset:", error.message);
    return res.status(500).json({ error: "Could not load the selected dataset." });
  }
});

async function deleteStoredFiles(files) {
  const failures = [];
  for (const file of files) {
    const storedName = path.basename(file.storedName || "");
    if (!storedName || storedName !== file.storedName) {
      failures.push(file._id.toString());
      continue;
    }
    try {
      await fs.promises.unlink(path.join(uploadsDirectory, storedName));
    } catch (error) {
      if (error.code !== "ENOENT") failures.push(file._id.toString());
    }
  }
  return failures;
}

async function deleteFilesForUser(filter, ownerId) {
  const files = await UploadedFile.find(filter).select("_id storedName").lean();
  if (!files.length) return { deleted: 0, cleanupFailures: [], deletedIds: [] };
  const fileIds = files.map((file) => file._id);
  await Promise.all([
    ChatMessage.deleteMany({ userId: ownerId, fileId: { $in: fileIds } }),
    Report.deleteMany({ userId: ownerId, fileId: { $in: fileIds } }),
  ]);
  const result = await UploadedFile.deleteMany(filter);
  const cleanupFailures = await deleteStoredFiles(files);
  return { deleted: result.deletedCount, cleanupFailures, deletedIds: files.map((file) => file._id.toString()) };
}

app.delete("/api/files/:fileId", requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.fileId)) return res.status(400).json({ error: "Invalid dataset id." });
  if (!databaseRequired(res)) return;
  try {
    const result = await deleteFilesForUser({ _id: req.params.fileId, userId: userId(req) }, userId(req));
    if (!result.deleted) return res.status(404).json({ error: "Dataset not found in this workspace." });
    return res.json({ deleted: result.deleted, deletedIds: result.deletedIds, cleanupFailures: result.cleanupFailures.length });
  } catch (error) {
    console.error("Could not delete dataset:", error.message);
    return res.status(500).json({ error: "Could not delete the selected dataset." });
  }
});

app.delete("/api/files", requireAuth, async (req, res) => {
  if (!databaseRequired(res)) return;
  const rawDays = req.body?.days;
  const days = rawDays === "all" ? null : Number(rawDays || 0);
  if (rawDays !== undefined && rawDays !== "all" && (!Number.isInteger(days) || days < 0 || days > 36500)) {
    return res.status(400).json({ error: "History age must be 'all' or a non-negative whole number of days." });
  }
  const filter = { userId: userId(req) };
  if (typeof req.body?.workspaceId === "string" && req.body.workspaceId.trim()) {
    const workspaceId = req.body.workspaceId.trim();
    if (workspaceId === "default") {
      filter.$or = [{ workspaceId: "default" }, { workspaceId: { $exists: false } }];
    } else {
      filter.workspaceId = workspaceId;
    }
  }
  if (days) filter.createdAt = { $lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
  try {
    const result = await deleteFilesForUser(filter, userId(req));
    return res.json({ deleted: result.deleted, deletedIds: result.deletedIds, cleanupFailures: result.cleanupFailures.length });
  } catch (error) {
    console.error("Could not delete dataset history:", error.message);
    return res.status(500).json({ error: "Could not delete dataset history." });
  }
});

app.post("/api/chat", requireAuth, async (req, res) => {
  const { question, fileId } = req.body || {};
  if (typeof question !== "string" || !question.trim() || question.length > 4000) {
    return res.status(400).json({ error: "Question must be 1–4000 characters." });
  }
  if (!databaseRequired(res)) return;
  try {
    let dataset = { rows: [], columns: [], totals: {} };
    if (fileId) {
      const ownedDataset = await loadOwnedDataset(fileId, userId(req));
      if (ownedDataset.error) return res.status(ownedDataset.status).json({ error: ownedDataset.error });
      dataset = ownedDataset;
    }
    const history = await ChatMessage.find({ userId: userId(req), fileId }).sort({ createdAt: -1 }).limit(10).lean();
    const answer = await askGemini(question, dataset, history.reverse());
    await ChatMessage.insertMany([{ userId: userId(req), fileId, role: "user", content: question }, { userId: userId(req), fileId, role: "assistant", content: answer }]);
    res.json({ answer, persisted: true });
  } catch (error) { res.status(500).json({ error: `AI chat failed: ${error.message}` }); }
});

app.get("/api/chat/history", requireAuth, async (req, res) => {
  if (!databaseRequired(res)) return;
  res.json(await ChatMessage.find({ userId: userId(req), fileId: req.query.fileId }).sort({ createdAt: 1 }).limit(100).lean());
});

app.post("/api/report", requireAuth, async (req, res) => {
  const { data: submittedData, fileId } = req.body || {};
  if (!databaseRequired(res)) return;
  try {
    let data = submittedData;
    if (fileId) {
      const ownedDataset = await loadOwnedDataset(fileId, userId(req));
      if (ownedDataset.error) return res.status(ownedDataset.status).json({ error: ownedDataset.error });
      data = ownedDataset;
    }
    if (!data || typeof data !== "object") return res.status(400).json({ error: "Dataset is required." });
    const report = await askGemini(
      "Create a weekly executive report with wins, risks, anomalies, and next actions. Use clear section headings and do not invent values.",
      data,
      [],
    );
    const record = await Report.create({
      userId: userId(req),
      fileId: fileId || undefined,
      title: `Weekly executive report - ${new Date().toLocaleDateString("en-US")}`,
      content: report,
    });
    return res.json({ report, reportId: record._id, createdAt: record.createdAt });
  } catch (error) {
    console.error("Could not generate or save report:", error.message);
    return res.status(500).json({ error: "Could not generate and save this report." });
  }
});

app.get("/api/reports", requireAuth, async (req, res) => {
  if (!databaseRequired(res)) return;
  const reports = await Report.find({ userId: userId(req) }).sort({ createdAt: -1 }).limit(100).select("title content fileId createdAt").lean();
  return res.json(reports);
});

app.delete("/api/reports/:reportId", requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.reportId)) return res.status(400).json({ error: "Invalid report id." });
  if (!databaseRequired(res)) return;
  const result = await Report.deleteOne({ _id: req.params.reportId, userId: userId(req) });
  if (!result.deletedCount) return res.status(404).json({ error: "Report not found in this workspace." });
  return res.status(204).end();
});

app.post("/api/anomalies", requireAuth, (req, res) => {
  const rows = req.body.data?.rows || [];
  const values = rows.map((row) => Number(row.revenue || row.sales || row.amount || 0)).filter(Boolean);
  const mean = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
  const deviation = Math.sqrt(values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length || 1));
  const anomalies = rows.filter((row) => Math.abs(Number(row.revenue || row.sales || row.amount || 0) - mean) > deviation * 2);
  res.json({ anomalies, message: anomalies.length ? `${anomalies.length} unusual record(s) found.` : "No strong anomalies found." });
});

async function start() {
  validateConfiguration();
  app.listen(PORT, () => console.log(`Server is running at: http://localhost:${PORT}`));
  const scheduler = setInterval(() => { void syncDueRestSources(); }, 30000);
  scheduler.unref();
  await connectToDatabase();
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = { app, parseFile, summarizeData, validateConfiguration };
