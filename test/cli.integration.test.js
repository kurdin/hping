'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { mkdtemp, mkdir, writeFile } = require('node:fs/promises');

const ROOT = path.resolve(__dirname, '..');
const BIN = path.resolve(ROOT, 'bin/hping');

function runCli(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd: ROOT,
      env: {
        ...process.env,
        NO_COLOR: '1',
        ...env
      }
    });

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`CLI execution timed out. stdout:\n${stdout}\nstderr:\n${stderr}`));
    }, 15000);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
}

async function createConfig(tempDir, overrides) {
  const configPath = path.resolve(tempDir, overrides.fileName || 'hping.conf.yaml');
  const display = overrides.display || {};
  const servers = overrides.servers || ['local'];
  const serverLines = [];
  for (const name of servers) {
    const targets = overrides.serverGroups && overrides.serverGroups[name]
      ? overrides.serverGroups[name]
      : [`http://127.0.0.1:${overrides.serverPort}`];
    serverLines.push(`    ${name}:`);
    for (const target of targets) {
      serverLines.push(`      - ${target}`);
    }
  }

  const content = [
    'default:',
    `  interval: ${overrides.interval ?? 0.1}`,
    '  type: HEAD',
    `  timeout: ${overrides.timeout ?? 2000}`,
    `  use_colors: ${overrides.use_colors ?? false}`,
    `  show_stats_for_last: ${overrides.show_stats_for_last ?? 3}`,
    `  max_run_time: ${overrides.max_run_time ?? 0.2}`,
    '  stats_for_last: 3',
    `  log_status_change: ${overrides.log_status_change ?? false}`,
    `  log_file: ${overrides.log_file ?? 'logs/hping.log'}`,
    `  log_stats_on_exit: ${overrides.log_stats_on_exit ?? false}`,
    '  display_in_output:',
    `    status: ${display.status ?? true}`,
    `    url: ${display.url ?? true}`,
    `    ip: ${display.ip ?? true}`,
    `    type: ${display.type ?? true}`,
    `    status_code: ${display.status_code ?? true}`,
    `    status_info: ${display.status_info ?? true}`,
    `    server: ${display.server ?? true}`,
    `    content_length: ${display.content_length ?? true}`,
    `    response_time: ${display.response_time ?? true}`,
    '  servers:',
    ...serverLines
  ].join('\n') + '\n';

  await writeFile(configPath, content, 'utf8');
  return configPath;
}

async function startServer(handler) {
  const server = http.createServer(handler || ((req, res) => {
    if (req.url === '/not-found') {
      res.statusCode = 404;
      res.end('missing');
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Length', '0');
    res.setHeader('Server', 'test-server');
    res.end();
  }));

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    port: address.port
  };
}

async function makeTempHome() {
  const temp = await mkdtemp(path.resolve(os.tmpdir(), 'hping-test-'));
  const home = path.resolve(temp, '.hping');
  await mkdir(home, { recursive: true });
  return { temp, home };
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = address.port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test('settings command prints loaded configuration', async () => {
  const { temp, home } = await makeTempHome();

  const { server, port } = await startServer();
  const configPath = await createConfig(temp, { serverPort: port });

  try {
    const result = await runCli(['settings', '--config', configPath], {
      HPING_HOME_DIR: home
    });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Settings from config file:/);
    assert.match(result.stdout, /interval:/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('servers command prints configured server groups', async () => {
  const { temp, home } = await makeTempHome();
  const { server, port } = await startServer();
  const configPath = await createConfig(temp, {
    serverPort: port,
    serverGroups: {
      local: [`http://127.0.0.1:${port}`],
      api: [`http://127.0.0.1:${port}/v1`]
    },
    servers: ['local', 'api']
  });

  try {
    const result = await runCli(['servers', '--config', configPath], {
      HPING_HOME_DIR: home
    });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Server groups/);
    assert.match(result.stdout, /local:/);
    assert.match(result.stdout, /api:/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('legacy target invocation runs ping loop and reports UP', async () => {
  const { temp, home } = await makeTempHome();

  const { server, port } = await startServer();
  const configPath = await createConfig(temp, { serverPort: port, max_run_time: 0.25 });

  try {
    const result = await runCli([`127.0.0.1:${port}`, '--config', configPath], {
      HPING_HOME_DIR: home
    });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /hPING:/);
    assert.match(result.stdout, /\[UP\]/);
    assert.match(result.stdout, /code=200/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('get command supports explicit verb invocation', async () => {
  const { temp, home } = await makeTempHome();

  const { server, port } = await startServer();
  const configPath = await createConfig(temp, { serverPort: port, max_run_time: 0.25 });

  try {
    const result = await runCli(['get', `http://127.0.0.1:${port}/not-found`, '--config', configPath], {
      HPING_HOME_DIR: home
    });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /type=get/);
    assert.match(result.stdout, /code=404/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('method override works with ping command', async () => {
  const { temp, home } = await makeTempHome();
  const { server, port } = await startServer((req, res) => {
    if (req.method === 'POST') {
      res.statusCode = 201;
      res.end();
      return;
    }
    res.statusCode = 405;
    res.end();
  });
  const configPath = await createConfig(temp, { serverPort: port, max_run_time: 0.2 });

  try {
    const result = await runCli(
      ['ping', `http://127.0.0.1:${port}`, '--method', 'POST', '--config', configPath],
      { HPING_HOME_DIR: home }
    );
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /type=post/);
    assert.match(result.stdout, /code=201/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('ping by server group name expands from config', async () => {
  const { temp, home } = await makeTempHome();
  const { server, port } = await startServer();
  const configPath = await createConfig(temp, {
    serverPort: port,
    servers: ['local'],
    max_run_time: 0.2
  });

  try {
    const result = await runCli(['ping', 'local', '--config', configPath], {
      HPING_HOME_DIR: home
    });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /127\.0\.0\.1/);
    assert.match(result.stdout, /code=200/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('invalid interval fails fast', async () => {
  const result = await runCli(['ping', 'example.com', '--interval', '0'], {});
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /must be a positive number/);
});

test('invalid method fails fast', async () => {
  const result = await runCli(['ping', 'example.com', '--method', 'PUT'], {});
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /method must be one of HEAD, GET, POST/);
});

test('no args prints help output', async () => {
  const result = await runCli([], {});
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Usage: hping/);
  assert.match(result.stdout, /Examples:/);
});

test('missing custom config falls back to user config', async () => {
  const { home } = await makeTempHome();
  const missingConfig = path.resolve(home, 'missing-config.yaml');
  const result = await runCli(['settings', '--config', missingConfig], {
    HPING_HOME_DIR: home
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stderr, /could not be used/);
  assert.match(result.stdout, /Settings from config file:/);
  assert.match(result.stdout, /hping\.conf\.yaml/);
});

test('first run bootstraps default user config', async () => {
  const { home } = await makeTempHome();
  const defaultConfig = path.resolve(home, 'hping.conf.yaml');
  const result = await runCli(['settings'], {
    HPING_HOME_DIR: home
  });

  assert.equal(result.code, 0, result.stderr);
  await fs.access(defaultConfig);
});

test('invalid default config fails with non-zero exit', async () => {
  const { home } = await makeTempHome();
  const defaultConfig = path.resolve(home, 'hping.conf.yaml');
  await fs.writeFile(defaultConfig, 'default:\n  interval: [broken', 'utf8');

  const result = await runCli(['settings'], {
    HPING_HOME_DIR: home
  });

  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /(unexpected end|stream|yaml)/i);
});

test('connection errors produce DOWN output', async () => {
  const { temp, home } = await makeTempHome();
  const deadPort = await reservePort();
  const configPath = await createConfig(temp, {
    serverPort: deadPort,
    max_run_time: 0.2,
    timeout: 300
  });

  const result = await runCli([`127.0.0.1:${deadPort}`, '--config', configPath], {
    HPING_HOME_DIR: home
  });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /\[DOWN\]/);
  assert.match(result.stdout, /error=/);
});

test('status-change logging writes both UP and DOWN transitions', async () => {
  const { temp, home } = await makeTempHome();
  let count = 0;
  const { server, port } = await startServer((req, res) => {
    count += 1;
    if (count % 2 === 0) {
      res.statusCode = 500;
      res.end('down');
      return;
    }
    res.statusCode = 200;
    res.end('up');
  });
  const configPath = await createConfig(temp, {
    serverPort: port,
    max_run_time: 0.45,
    interval: 0.08,
    log_status_change: true,
    log_stats_on_exit: false,
    log_file: 'logs/status.log'
  });

  try {
    const result = await runCli([`127.0.0.1:${port}`, '--config', configPath], {
      HPING_HOME_DIR: home
    });
    assert.equal(result.code, 0, result.stderr);
    const logPath = path.resolve(home, 'logs/status.log');
    const logContent = await fs.readFile(logPath, 'utf8');
    assert.match(logContent, /\[UP\]/);
    assert.match(logContent, /\[DOWN\]/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('ping without targets returns usage error', async () => {
  const { temp, home } = await makeTempHome();
  const { server, port } = await startServer();
  const configPath = await createConfig(temp, { serverPort: port, max_run_time: 0.2 });

  try {
    const result = await runCli(['ping', '--config', configPath], {
      HPING_HOME_DIR: home
    });
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /usage: hping/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('interval CLI option overrides config interval', async () => {
  const { temp, home } = await makeTempHome();
  const { server, port } = await startServer();
  const configPath = await createConfig(temp, {
    serverPort: port,
    interval: 2,
    max_run_time: 0.25
  });

  try {
    const result = await runCli(
      [`127.0.0.1:${port}`, '--interval', '0.05', '--config', configPath],
      { HPING_HOME_DIR: home }
    );
    assert.equal(result.code, 0, result.stderr);
    const pingLines = result.stdout.split('\n').filter((line) => line.includes('hPING:'));
    assert.ok(pingLines.length > 1, `expected multiple ping lines, got ${pingLines.length}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('stats are written to log on exit when enabled', async () => {
  const { temp, home } = await makeTempHome();
  const { server, port } = await startServer();
  const configPath = await createConfig(temp, {
    serverPort: port,
    max_run_time: 0.25,
    interval: 0.05,
    log_status_change: true,
    log_stats_on_exit: true,
    log_file: 'logs/with-stats.log'
  });

  try {
    const result = await runCli([`127.0.0.1:${port}`, '--config', configPath], {
      HPING_HOME_DIR: home
    });
    assert.equal(result.code, 0, result.stderr);
    const logPath = path.resolve(home, 'logs/with-stats.log');
    const logContent = await fs.readFile(logPath, 'utf8');
    assert.match(logContent, /hPING statistics/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
