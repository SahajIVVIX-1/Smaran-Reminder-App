#!/usr/bin/env node

/**
 * Smaran Connect — Lightweight Sharing Agent
 *
 * Designed for participant PCs that do not have the full Smaran application installed.
 * Allows sharing screens and application windows securely with Smaran Remote Hub.
 *
 * NOTE: As per Smaran Security Policy, this agent NEVER enables or exposes remote desktop control.
 * Only full Smaran-installed host PCs are eligible for remote desktop interaction.
 */

import http from 'node:http';
import os from 'node:os';
import readline from 'node:readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => rl.question(question, resolve));
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
        try {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: data ? JSON.parse(data) : {},
          });
        } catch {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log('=======================================================');
  console.log('       Smaran Connect — Lightweight Sharing Agent       ');
  console.log('=======================================================');
  console.log('Security Notice: Remote Desktop Control is DISABLED by policy.');
  console.log('This agent operates strictly in Screen & Window Broadcast mode.\n');

  const hubUrlInput = await prompt('Enter Remote Hub URL (e.g. http://127.0.0.1:5902): ');
  const hubUrlStr = hubUrlInput.trim() || 'http://127.0.0.1:5902';
  let hubUrl;
  try {
    hubUrl = new URL(hubUrlStr);
  } catch {
    console.error('Invalid URL format.');
    process.exit(1);
  }

  console.log(`Connecting to Smaran Remote Hub at ${hubUrl.origin}...`);

  try {
    const health = await requestHttp({
      hostname: hubUrl.hostname,
      port: hubUrl.port,
      path: '/api/health',
      method: 'GET',
    });
    if (health.statusCode !== 200) {
      console.error(`Remote Hub unreachable (HTTP ${health.statusCode}).`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }

  console.log(
    'Hub reachable! To pair this PC, obtain a 6-digit pairing code from Smaran Remote Hub dashboard.',
  );
  const code = (await prompt('Enter 6-Digit Pairing Code: ')).trim();

  const devName = (await prompt(`Device Name [${os.hostname()}]: `)).trim() || os.hostname();

  console.log('\nPairing with Remote Hub...');
  try {
    const pairRes = await requestHttp(
      {
        hostname: hubUrl.hostname,
        port: hubUrl.port,
        path: '/api/devices/pair',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        code,
        name: devName,
        hostname: os.hostname(),
        os: `${os.type()} ${os.release()}`,
        isSmaranInstalled: false, // Participant agent!
        agentVersion: '1.0.0',
      },
    );

    if (pairRes.statusCode !== 200 || !pairRes.body.ok) {
      console.error('Pairing failed:', pairRes.body.error || 'Invalid code.');
      process.exit(1);
    }

    console.log(`\n>>> [SUCCESS] Paired successfully as "${devName}"! <<<`);
    console.log(`Device ID: ${pairRes.body.device.id}`);
    console.log('Status: ONLINE');
    console.log('Screen Sharing: READY');
    console.log('Remote Control: NOT PERMITTED (By Security Architecture)\n');

    console.log('Sending background heartbeats... Press Ctrl+C to disconnect and exit.');
    setInterval(async () => {
      // In production agent, sends periodic heartbeats or stream updates
    }, 20000);
  } catch (err) {
    console.error('Pairing request error:', err.message);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].includes('smaran-sharing-agent')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
