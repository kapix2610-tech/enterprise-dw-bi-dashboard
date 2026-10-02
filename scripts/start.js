const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const apiPort = process.env.DATAWISE_API_PORT || "5000";
const dashboardPort = process.env.DATAWISE_DASHBOARD_PORT || "3000";
const apiUrl = `http://127.0.0.1:${apiPort}`;
const dashboardUrl = `http://127.0.0.1:${dashboardPort}`;
const children = [];

async function inspectService(url, isExpectedService) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    const body = await response.text();
    return {
      reachable: true,
      isExpectedService: response.ok && isExpectedService(response, body),
      responseStatus: response.status,
    };
  } catch (error) {
    const refused = error.cause?.code === "ECONNREFUSED" || error.cause?.code === "ECONNRESET";
    return { reachable: !refused, isExpectedService: false, error };
  }
}

async function ensureAvailable(service, url, isExpectedService, startService) {
  const status = await inspectService(url, isExpectedService);
  if (status.isExpectedService) {
    console.log(`${service} already running at ${url}; reusing it.`);
    return false;
  }
  if (status.reachable) {
    throw new Error(
      `Port for ${service} (${url}) is occupied by another service. Stop that process or set DATAWISE_${service === "Dashboard" ? "DASHBOARD" : "API"}_PORT to a free port.`,
    );
  }
  startService();
  return true;
}

function startChild(name, entryPoint, cwd, environment) {
  const child = spawn(process.execPath, [entryPoint], {
    cwd,
    env: { ...process.env, ...environment },
    stdio: "inherit",
  });
  children.push({ name, child });
  child.on("error", (error) => {
    console.error(`Could not start ${name}: ${error.message}`);
    stopChildren(child);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    const wasRequestedToStop = process.exitCode !== undefined || signal === "SIGINT" || signal === "SIGTERM";
    if (!wasRequestedToStop && code !== 0) {
      console.error(`${name} stopped unexpectedly with exit code ${code ?? signal}.`);
      process.exitCode = code || 1;
      stopChildren(child);
    }
  });
  return child;
}

function stopChildren(except) {
  for (const { child } of children) {
    if (child !== except && child.exitCode === null && child.signalCode === null) {
      child.kill();
    }
  }
}

async function main() {
  const hasApi = await ensureAvailable(
    "Backend",
    `${apiUrl}/api/health`,
    (response, body) => {
      if (!response.ok) return false;
      try {
        const health = JSON.parse(body);
        return health.ok === true && typeof health.database === "string";
      } catch {
        return false;
      }
    },
    () => startChild(
      "Backend",
      path.join(root, "dw-bi-backend", "server.js"),
      path.join(root, "dw-bi-backend"),
      { PORT: apiPort },
    ),
  );

  const hasDashboard = await ensureAvailable(
    "Dashboard",
    dashboardUrl,
    (_response, body) => body.includes('<meta name="application-name" content="Datawise"'),
    () => startChild(
      "Dashboard",
      path.join(root, "dw-bi-dashboard", "node_modules", "react-scripts", "scripts", "start.js"),
      path.join(root, "dw-bi-dashboard"),
      { PORT: dashboardPort, REACT_APP_API_URL: process.env.REACT_APP_API_URL || apiUrl },
    ),
  );

  if (!hasApi && !hasDashboard) {
    console.log(`Both Datawise services are already running:\n- Dashboard: ${dashboardUrl}\n- Backend: ${apiUrl}`);
    return;
  }

  console.log(`Datawise URLs:\n- Dashboard: ${dashboardUrl}\n- Backend: ${apiUrl}`);
}

process.on("SIGINT", () => {
  process.exitCode = 0;
  stopChildren();
});
process.on("SIGTERM", () => {
  process.exitCode = 0;
  stopChildren();
});

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
  stopChildren();
});
