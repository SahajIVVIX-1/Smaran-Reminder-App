import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const archivePath = path.join(root, 'resources', 'engine.tar.gz');

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen({ port: 0, host: '127.0.0.1' }, () => {
      const address = srv.address();
      if (typeof address === 'object' && address !== null) {
        const port = address.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error('Could not get ephemeral port')));
      }
    });
  });
}

function requestHttp(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`HTTP request to ${options.path} timed out`));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function waitForServer(port, maxWaitMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await requestHttp({
        hostname: '127.0.0.1',
        port,
        path: '/',
        method: 'GET',
        timeout: 1000,
      });
      if (res.statusCode >= 200 && res.statusCode < 500) {
        return;
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`HFS engine failed to respond on port ${port} within ${maxWaitMs}ms`);
}

async function runSmokeTest() {
  console.log('--- Smaran Packaged HFS Engine Automated Smoke Test ---');

  // 1. Verify archive integrity
  console.log(`[1/8] Verifying archive integrity at ${archivePath}...`);
  if (!existsSync(archivePath)) {
    throw new Error(`Engine archive not found at ${archivePath}`);
  }
  const stat = statSync(archivePath);
  if (stat.size < 1_000_000) {
    throw new Error(`Engine archive too small (${stat.size} bytes)`);
  }
  console.log(`[PASS] Archive size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);

  // 2. Extract into isolated temporary test directory
  const tempDir = path.join(os.tmpdir(), `smaran-hfs-smoke-${crypto.randomUUID()}`);
  mkdirSync(tempDir, { recursive: true });
  console.log(`[2/8] Extracting archive into isolated sandbox ${tempDir}...`);

  try {
    execFileSync('tar.exe', ['-xzf', archivePath, '-C', tempDir], { windowsHide: true });
  } catch (err) {
    throw new Error(`Extraction failed: ${err.message}`);
  }

  // 3-7. Verify files, package.json, central.json, runtime dependencies, and plugins
  console.log('[3/8] Validating extracted entry points, central.json, and plugins...');
  const entryPoint = path.join(tempDir, 'src', 'index.js');
  const pkgJsonPath = path.join(tempDir, 'package.json');
  const centralPath = path.join(tempDir, 'central.json');

  if (!existsSync(entryPoint)) throw new Error('Missing src/index.js');
  if (!existsSync(pkgJsonPath)) throw new Error('Missing package.json');
  if (!existsSync(centralPath)) throw new Error('Missing central.json');

  JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  JSON.parse(readFileSync(centralPath, 'utf8'));

  const requiredPlugins = ['smaran-security', 'server-info', 'antibrute'];
  for (const plug of requiredPlugins) {
    const plugJs = path.join(tempDir, 'plugins', plug, 'plugin.js');
    if (!existsSync(plugJs)) {
      throw new Error(`Missing required engine plugin entry point: ${plugJs}`);
    }
  }
  console.log('[PASS] Core runtime entry points, central.json, and all plugins present.');

  // 8-10. Prepare configuration, test files, and allocate port
  console.log('[4/8] Preparing isolated configuration and allocating ephemeral test port...');
  const testPort = await getAvailablePort();
  const storageDir = path.join(tempDir, 'test_storage');
  mkdirSync(storageDir, { recursive: true });

  const publicFileText = 'Smaran 3.4.4 Public File OK';
  const secretFileText = 'Smaran 3.4.4 Secret Protected File OK';
  writeFileSync(path.join(storageDir, 'public.txt'), publicFileText, 'utf8');
  writeFileSync(path.join(storageDir, 'secret.txt'), secretFileText, 'utf8');

  const adminUser = 'smokeadmin';
  const adminPass = 'smokepassword456';
  const validAuth = 'Basic ' + Buffer.from(`${adminUser}:${adminPass}`).toString('base64');
  const invalidAuth = 'Basic ' + Buffer.from(`${adminUser}:wrongpassword`).toString('base64');

  // YAML configuration conforming to Smaran standard HFS configuration
  const configYaml = `
title: "Smaran HFS Smoke Test"
port: ${testPort}
localhost_admin: false
open_browser_at_start: false
force_theme: dark
accept_cors: true
accounts:
  ${adminUser}:
    password: "${adminPass}"
    admin: true
    ignore_limits: true
    belongs:
      - admistrators
  admistrators:
    admin: true
vfs:
  source: "${storageDir.replace(/\\/g, '/')}"
  can_see: true
  can_read: true
  can_list: true
  masks:
    "secret.txt":
      can_see:
        - admistrators
      can_read:
        - admistrators
`;
  writeFileSync(path.join(tempDir, 'config.yaml'), configYaml, 'utf8');

  // 11. Launch engine
  console.log(`[5/8] Launching packaged HFS engine on 127.0.0.1:${testPort}...`);
  let child = null;
  const serverLogs = [];

  try {
    child = spawn(
      process.execPath,
      [
        entryPoint,
        '--cwd',
        tempDir,
        '--config',
        path.join(tempDir, 'config.yaml'),
        '--port',
        String(testPort),
      ],
      {
        cwd: tempDir,
        env: {
          ...process.env,
          PORT: String(testPort),
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    child.stdout.on('data', (d) => serverLogs.push(d.toString('utf8')));
    child.stderr.on('data', (d) => serverLogs.push(d.toString('utf8')));

    await waitForServer(testPort);
    console.log('[PASS] HFS Engine started and responded to health probe.');

    // 12-16. Test HTTP server functionality, authentication & authorization
    console.log(
      '[6/8] Testing permitted file access, authentication rejection, and authorized access...',
    );

    // A. Permitted public file access
    const pubRes = await requestHttp({
      hostname: '127.0.0.1',
      port: testPort,
      path: '/public.txt',
      method: 'GET',
    });
    if (pubRes.statusCode !== 200 || pubRes.body !== publicFileText) {
      throw new Error(
        `Public file access failed: expected 200 with text "${publicFileText}", got status ${pubRes.statusCode} with body "${pubRes.body.slice(0, 200)}"`,
      );
    }
    console.log('[PASS] Permitted public file access verified (HTTP 200, matching content).');

    // B. Unauthorized request to protected resource
    const anonRes = await requestHttp({
      hostname: '127.0.0.1',
      port: testPort,
      path: '/secret.txt',
      method: 'GET',
    });
    if (anonRes.statusCode !== 401 && anonRes.statusCode !== 403 && anonRes.statusCode !== 404) {
      throw new Error(
        `Protected resource did not reject anonymous request: got ${anonRes.statusCode}`,
      );
    }
    console.log(
      `[PASS] Anonymous access to protected resource rejected (HTTP ${anonRes.statusCode}).`,
    );

    // C. Invalid credentials to protected resource
    const badAuthRes = await requestHttp({
      hostname: '127.0.0.1',
      port: testPort,
      path: '/secret.txt',
      method: 'GET',
      headers: {
        Authorization: invalidAuth,
      },
    });
    if (
      badAuthRes.statusCode !== 401 &&
      badAuthRes.statusCode !== 403 &&
      badAuthRes.statusCode !== 404
    ) {
      throw new Error(
        `Protected resource did not reject bad credentials: got ${badAuthRes.statusCode}`,
      );
    }
    console.log(
      `[PASS] Invalid credentials to protected resource rejected (HTTP ${badAuthRes.statusCode}).`,
    );

    // D. Valid authentication to protected resource
    const okAuthRes = await requestHttp({
      hostname: '127.0.0.1',
      port: testPort,
      path: '/secret.txt',
      method: 'GET',
      headers: {
        Authorization: validAuth,
      },
    });
    if (okAuthRes.statusCode !== 200 || okAuthRes.body !== secretFileText) {
      throw new Error(
        `Authorized request failed: expected 200 with text "${secretFileText}", got ${okAuthRes.statusCode} with body "${okAuthRes.body.slice(0, 200)}"`,
      );
    }
    console.log(
      '[PASS] Valid authentication to protected resource verified (HTTP 200, matching content).',
    );

    // E. Verify admin endpoint responds to authorized admin credentials
    const adminRes = await requestHttp({
      hostname: '127.0.0.1',
      port: testPort,
      path: '/~/admin/',
      method: 'GET',
      headers: {
        Authorization: validAuth,
      },
    });
    if (adminRes.statusCode !== 200) {
      throw new Error(`Admin endpoint failed with valid credentials: got ${adminRes.statusCode}`);
    }
    console.log('[PASS] Protected Admin interface verified with valid credentials (HTTP 200).');
  } finally {
    // 17-18. Graceful shutdown and forced cleanup
    console.log('[7/8] Shutting down test engine gracefully...');
    if (child && !child.killed) {
      try {
        child.kill('SIGTERM');
      } catch {
        // ignore
      }

      const exited = await Promise.race([
        new Promise((resolve) => child.on('exit', () => resolve(true))),
        new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
      ]);

      if (!exited) {
        console.warn('Process did not exit within 3s, force terminating...');
        try {
          if (process.platform === 'win32' && child.pid) {
            execFileSync('taskkill.exe', ['/pid', String(child.pid), '/f', '/t'], {
              windowsHide: true,
            });
          } else {
            child.kill('SIGKILL');
          }
        } catch {
          // ignore
        }
      }
    }
    console.log('[PASS] Test engine process terminated.');

    // 19. Clean up temporary test files
    console.log('[8/8] Cleaning up temporary test sandbox...');
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // non-critical
    }
    console.log('[PASS] Sandbox directory cleaned.');
  }

  console.log('>>> [SUCCESS] All Packaged HFS Engine Smoke Tests Passed! <<<');
}

runSmokeTest().catch((err) => {
  console.error(`\n>>> [FAIL] Packaged HFS Engine Smoke Test Failed: ${err.message} <<<`);
  process.exit(1);
});
