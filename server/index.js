const http = require("http");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const url = require("url");

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) {
        return reject({ error, stdout, stderr });
      }
      resolve({ stdout, stderr });
    });
  });
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const mime = ext === ".html" ? "text/html" : ext === ".css" ? "text/css" : "text/plain";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const { pathname, query } = parsed;

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (pathname === "/api/address" && req.method === "GET") {
    try {
      const { stdout } = await run("npx hardhat redact:address --network localhost");
      const match = stdout.match(/RedactedToken address is\s+(0x[a-fA-F0-9]{40})/);
      return sendJSON(res, 200, { ok: true, address: match ? match[1] : null, raw: stdout });
    } catch (e) {
      return sendJSON(res, 500, { ok: false, error: e.stderr || String(e.error || e) });
    }
  }
  if (pathname === "/api/accounts" && req.method === "GET") {
    try {
      const { stdout } = await run("npx hardhat accounts --network localhost");
      const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const addrs = lines.filter((l) => /^0x[a-fA-F0-9]{40}$/.test(l));
      return sendJSON(res, 200, { ok: true, accounts: addrs, raw: stdout });
    } catch (e) {
      return sendJSON(res, 500, { ok: false, error: e.stderr || String(e.error || e) });
    }
  }

  if (pathname === "/api/balance" && req.method === "GET") {
    const addressFlag = query.address ? ` --address ${query.address}` : "";
    const fromIndexFlag = query.fromIndex ? ` --fromindex ${query.fromIndex}` : "";
    try {
      const { stdout } = await run(`npx hardhat redact:get-balance --network localhost${addressFlag}${fromIndexFlag}`);
      // 兼容大小写与可变空格
      const encMatch = stdout.match(/encrypted balance:\s+(0x[a-fA-F0-9]+)/i);
      const clearMatch = stdout.match(/clear balance\s*:\s*(\d+)/i);
      return sendJSON(res, 200, {
        ok: true,
        encrypted: encMatch ? encMatch[1] : null,
        clear: clearMatch ? Number(clearMatch[1]) : null,
        raw: stdout,
      });
    } catch (e) {
      return sendJSON(res, 500, { ok: false, error: e.stderr || String(e.error || e) });
    }
  }

  if (pathname === "/api/mint" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { to, value, fromIndex } = JSON.parse(body || "{}");
        if (!to || !value) return sendJSON(res, 400, { ok: false, error: "Missing to or value" });
        const fromIndexFlag = fromIndex !== undefined && fromIndex !== "" ? ` --fromindex ${fromIndex}` : "";
        const { stdout } = await run(`npx hardhat redact:mint --network localhost --to ${to} --value ${value}${fromIndexFlag}`);
        const txMatch = stdout.match(/tx:(0x[a-fA-F0-9]+)/);
        return sendJSON(res, 200, { ok: true, tx: txMatch ? txMatch[1] : null, raw: stdout });
      } catch (e) {
        return sendJSON(res, 500, { ok: false, error: e.stderr || String(e.error || e) });
      }
    });
    return;
  }

  // 新增：明文铸币
  if (pathname === "/api/mint-clear" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { to, value, fromIndex } = JSON.parse(body || "{}");
        if (!to || !value) return sendJSON(res, 400, { ok: false, error: "Missing to or value" });
        const fromIndexFlag = fromIndex !== undefined && fromIndex !== "" ? ` --fromindex ${fromIndex}` : "";
        const { stdout } = await run(`npx hardhat redact:mint-clear --network localhost --to ${to} --value ${value}${fromIndexFlag}`);
        const txMatch = stdout.match(/tx:(0x[a-fA-F0-9]+)/);
        return sendJSON(res, 200, { ok: true, tx: txMatch ? txMatch[1] : null, raw: stdout });
      } catch (e) {
        return sendJSON(res, 500, { ok: false, error: e.stderr || String(e.error || e) });
      }
    });
    return;
  }

  // 新增：从明文余额加密到私密余额（调用者自身）
  if (pathname === "/api/encrypt" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { value, fromIndex } = JSON.parse(body || "{}");
        if (!value) return sendJSON(res, 400, { ok: false, error: "Missing value" });
        const fromIndexFlag = fromIndex !== undefined && fromIndex !== "" ? ` --fromindex ${fromIndex}` : "";
        const { stdout } = await run(`npx hardhat redact:encrypt-from-clear --network localhost --value ${value}${fromIndexFlag}`);
        const txMatch = stdout.match(/tx:(0x[a-fA-F0-9]+)/);
        return sendJSON(res, 200, { ok: true, tx: txMatch ? txMatch[1] : null, raw: stdout });
      } catch (e) {
        return sendJSON(res, 500, { ok: false, error: e.stderr || String(e.error || e) });
      }
    });
    return;
  }

  // 新增：从私密余额解密到明文余额（调用者自身）
  if (pathname === "/api/decrypt" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { value, fromIndex } = JSON.parse(body || "{}");
        if (!value) return sendJSON(res, 400, { ok: false, error: "Missing value" });
        const fromIndexFlag = fromIndex !== undefined && fromIndex !== "" ? ` --fromindex ${fromIndex}` : "";
        const { stdout } = await run(`npx hardhat redact:decrypt-to-clear --network localhost --value ${value}${fromIndexFlag}`);
        const txMatch = stdout.match(/tx:(0x[a-fA-F0-9]+)/);
        return sendJSON(res, 200, { ok: true, tx: txMatch ? txMatch[1] : null, raw: stdout });
      } catch (e) {
        return sendJSON(res, 500, { ok: false, error: e.stderr || String(e.error || e) });
      }
    });
    return;
  }

  if (pathname === "/api/transfer" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { to, value, fromIndex } = JSON.parse(body || "{}");
        if (!to || !value) return sendJSON(res, 400, { ok: false, error: "Missing to or value" });
        const fromIndexFlag = fromIndex !== undefined && fromIndex !== "" ? ` --fromindex ${fromIndex}` : "";
        const { stdout } = await run(`npx hardhat redact:transfer --network localhost --to ${to} --value ${value}${fromIndexFlag}`);
        const txMatch = stdout.match(/tx:(0x[a-fA-F0-9]+)/);
        return sendJSON(res, 200, { ok: true, tx: txMatch ? txMatch[1] : null, raw: stdout });
      } catch (e) {
        return sendJSON(res, 500, { ok: false, error: e.stderr || String(e.error || e) });
      }
    });
    return;
  }

  // static files
  const filePath = pathname === "/" ? path.join(process.cwd(), "public", "index.html") : path.join(process.cwd(), "public", pathname);
  return sendFile(res, filePath);
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`UI server listening at http://localhost:${port}`);
});