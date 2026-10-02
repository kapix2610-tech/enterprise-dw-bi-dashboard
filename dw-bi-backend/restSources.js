const crypto = require("crypto");
const dns = require("dns").promises;
const https = require("https");
const net = require("net");

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 50000;
const REQUEST_TIMEOUT_MS = 20000;

function createCredentialCipher(jwtSecret) {
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters before saving API credentials.");
  }
  const key = crypto.hkdfSync(
    "sha256",
    jwtSecret,
    Buffer.from("datawise-source-token-salt"),
    Buffer.from("datawise-rest-source-bearer-token-v1"),
    32,
  );
  return {
    encrypt(token) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
      return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64")).join(".");
    },
    decrypt(payload) {
      const [encodedIv, encodedTag, encodedData] = payload.split(".");
      if (!encodedIv || !encodedTag || !encodedData) throw new Error("Stored API credential is invalid.");
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(encodedIv, "base64"));
      decipher.setAuthTag(Buffer.from(encodedTag, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(encodedData, "base64")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}

function isPublicIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function isPublicIpv6(address) {
  const normalized = address.toLowerCase().split("%")[0];
  if (net.isIP(normalized) !== 6 || normalized.startsWith("::ffff:")) return false;
  const firstSegment = Number.parseInt(normalized.split(":")[0] || "0", 16);
  return firstSegment >= 0x2000 && firstSegment <= 0x3fff &&
    !normalized.startsWith("2001:db8:") &&
    !normalized.startsWith("2001:10:") &&
    !normalized.startsWith("2001:2:") &&
    !normalized.startsWith("2002:");
}

async function validateRestEndpoint(rawUrl) {
  let endpoint;
  try {
    endpoint = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid HTTPS API URL.");
  }
  const hasSecretQuery = [...endpoint.searchParams.keys()]
    .some((key) => /key|token|secret|password|credential|auth/i.test(key));
  if (
    endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
    endpoint.hash || (endpoint.port && endpoint.port !== "443") || hasSecretQuery
  ) {
    throw new Error("API sources must use HTTPS on the standard port, without URL credentials, secrets in query parameters, or fragments.");
  }

  const host = endpoint.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host) === 4
    ? [{ address: host, family: 4 }]
    : await dns.lookup(host, { all: true, verbatim: true }).catch(() => []);
  const publicAddresses = addresses.filter((entry) => (
    (entry.family === 4 && isPublicIpv4(entry.address)) ||
    (entry.family === 6 && isPublicIpv6(entry.address))
  ));
  const publicIpv4Addresses = publicAddresses.filter((entry) => entry.family === 4);
  if (!publicIpv4Addresses.length || publicAddresses.length !== addresses.length) {
    throw new Error("API hostname must resolve to a public IPv4 address; private and IPv6-only endpoints are not allowed.");
  }
  return { endpoint, address: publicIpv4Addresses[0].address };
}

function requestRestJson(endpoint, address, token) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      protocol: "https:",
      hostname: endpoint.hostname,
      port: 443,
      path: `${endpoint.pathname}${endpoint.search}`,
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "DatawiseBI-Connector/1.0",
      },
      servername: endpoint.hostname,
      lookup: (_hostname, _options, callback) => callback(null, address, 4),
      timeout: REQUEST_TIMEOUT_MS,
    }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`API returned HTTP ${response.statusCode}. Redirects and non-success responses are not followed.`));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy(new Error("API response exceeds the 10 MB limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          reject(new Error("API response is not valid JSON."));
        }
      });
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("API request timed out after 20 seconds.")));
    request.on("error", reject);
    request.end();
  });
}

function extractApiRows(payload, rowsPath) {
  const value = rowsPath
    ? rowsPath.split(".").reduce((current, key) => current?.[key], payload)
    : Array.isArray(payload) ? payload : payload?.data;
  if (!Array.isArray(value) || value.length > MAX_ROWS) {
    throw new Error(`API must return an array of up to ${MAX_ROWS} rows (root array, "data", or the configured rows path).`);
  }
  if (value.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("Every API row must be a JSON object.");
  }
  return value;
}

function safeSource(source) {
  return {
    id: source._id.toString(),
    workspaceId: source.workspaceId,
    name: source.name,
    url: source.url,
    rowsPath: source.rowsPath,
    enabled: source.enabled,
    lastSyncedAt: source.lastSyncedAt,
    lastError: source.lastError,
    fileId: source.fileId || "",
    createdAt: source.createdAt,
  };
}

module.exports = {
  createCredentialCipher,
  extractApiRows,
  isPublicIpv4,
  isPublicIpv6,
  requestRestJson,
  safeSource,
  validateRestEndpoint,
};
