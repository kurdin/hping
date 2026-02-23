'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const dns = require('node:dns/promises');
const { URL } = require('node:url');
const { Command, InvalidArgumentError } = require('commander');
const yaml = require('js-yaml');
const pc = require('picocolors');

const pkg = require('../package.json');
const statusCodes = require('./status');
const createLogger = require('./logger');

const INFO = 'hPING sends HEAD or GET or POST requests to web or api servers to check if they are alive';
const USAGE = '[ping|head|get|post] [http(s)://]www.webserver.com[:port] [another host] [server group]';
const METHODS = new Set(['HEAD', 'GET', 'POST']);
const ACTIONS = new Set(['ping', 'head', 'get', 'post', 'servers', 'settings']);

const DEFAULT_SETTINGS = Object.freeze({
  interval: 1,
  type: 'HEAD',
  timeout: 5000,
  use_colors: true,
  show_stats_for_last: 100,
  stats_for_last: 100,
  max_run_time: 600,
  log_status_change: false,
  log_file: 'logs/hping.log',
  log_stats_on_exit: true,
  display_in_output: {
    status: true,
    url: true,
    ip: true,
    type: false,
    status_code: true,
    status_info: true,
    server: true,
    content_length: false,
    response_time: true
  },
  servers: {}
});

const ERROR_INFO = Object.freeze({
  ETIMEDOUT: 'connection_timeout',
  ENOTFOUND: 'server_not_found',
  ECONNRESET: 'connection_closed',
  ECONNREFUSED: 'connection_refused'
});

function resolveHomeDir() {
  if (process.env.HPING_HOME_DIR) {
    return path.resolve(process.env.HPING_HOME_DIR);
  }
  return path.resolve(os.homedir(), '.hping');
}

function defaultConfigPath() {
  return path.resolve(__dirname, '../config/hping.yaml');
}

function userConfigPath(homeDir) {
  return path.resolve(homeDir, 'hping.conf.yaml');
}

function parseNumber(value, label) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new InvalidArgumentError(`${label} must be a positive number`);
  }
  return num;
}

function parseMethod(value) {
  const method = String(value).toUpperCase();
  if (!METHODS.has(method)) {
    throw new InvalidArgumentError('method must be one of HEAD, GET, POST');
  }
  return method;
}

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeSettings(raw) {
  const source = raw && typeof raw === 'object' && raw.default && typeof raw.default === 'object'
    ? raw.default
    : raw;
  const safe = source && typeof source === 'object' ? source : {};
  const merged = {
    ...DEFAULT_SETTINGS,
    ...safe
  };
  merged.display_in_output = {
    ...DEFAULT_SETTINGS.display_in_output,
    ...(safe.display_in_output || {})
  };
  if (!safe.servers || typeof safe.servers !== 'object') {
    merged.servers = {};
  }
  return merged;
}

async function loadConfig(filePath) {
  const input = await fsp.readFile(filePath, 'utf8');
  const parsed = yaml.load(input) || {};
  return normalizeSettings(parsed);
}

async function ensureUserConfig(homeDir, sourceConfigPath, targetConfigPath) {
  await fsp.mkdir(homeDir, { recursive: true });
  await fsp.mkdir(path.resolve(homeDir, 'logs'), { recursive: true });
  try {
    await fsp.access(targetConfigPath, fs.constants.F_OK);
  } catch {
    await fsp.copyFile(sourceConfigPath, targetConfigPath);
  }
}

function expandTargets(inputTargets, servers) {
  const output = [];
  for (const target of inputTargets) {
    if (typeof target !== 'string' || !target.trim()) {
      continue;
    }
    if (servers && Array.isArray(servers[target])) {
      output.push(...servers[target]);
      continue;
    }
    output.push(target);
  }
  return output;
}

function normalizeTarget(target) {
  return /^(https?):\/\//i.test(target) ? target : `http://${target}`;
}

async function resolveIp(urlString) {
  try {
    const host = new URL(urlString).hostname;
    const ip = await dns.resolve4(host);
    return ip[0] || '';
  } catch {
    return '';
  }
}

function statusColor(code) {
  if (code === 'error' || Number(code) >= 500) return 'red';
  if (Number(code) >= 400) return 'yellow';
  return 'green';
}

function paint(text, color, settings) {
  if (!settings.use_colors) return String(text);
  if (color === 'red') return pc.red(String(text));
  if (color === 'yellow') return pc.yellow(String(text));
  if (color === 'green') return pc.green(String(text));
  if (color === 'gray') return pc.gray(String(text));
  return String(text);
}

function bold(text, settings) {
  return settings.use_colors ? pc.bold(String(text)) : String(text);
}

function underline(text, settings) {
  return settings.use_colors ? pc.underline(String(text)) : String(text);
}

function token(label, value, color, settings, suffix = '') {
  const rendered = color ? paint(value, color, settings) : String(value);
  return `${label}=${rendered}${suffix}`;
}

function joinLine(parts) {
  return parts.filter(Boolean).join(' ').replace(/\n\s/g, '\n');
}

function pretty(data) {
  return yaml.dump(data, { noRefs: true, lineWidth: 120 }).trimEnd();
}

function mapErrorCode(error) {
  if (error && error.name === 'AbortError') {
    return 'ETIMEDOUT';
  }
  if (error && error.cause && typeof error.cause.code === 'string') {
    return error.cause.code;
  }
  if (error && typeof error.code === 'string') {
    return error.code;
  }
  return 'REQUEST_FAILED';
}

async function performRequest(url, method, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        'User-Agent': 'hPING [git.io/hping]'
      }
    });
    if (response.body) {
      response.body.cancel().catch(() => {});
    }
    return {
      code: response.status,
      headers: response.headers,
      elapsedMs: Date.now() - started,
      errorCode: null
    };
  } catch (error) {
    return {
      code: 'error',
      headers: null,
      elapsedMs: 0,
      errorCode: mapErrorCode(error)
    };
  } finally {
    clearTimeout(timer);
  }
}

function formatUrl(urlString, color, settings, code) {
  let out = urlString;
  try {
    const parsed = new URL(urlString);
    if (parsed.hostname) {
      const host = bold(paint(parsed.hostname, color, settings), settings);
      out = out.replace(parsed.hostname, host);
    }
    if (parsed.port) {
      const port = bold(paint(parsed.port, color, settings), settings);
      out = out.replace(parsed.port, port);
    }
    if (parsed.pathname && parsed.pathname !== '/' && code !== 'error') {
      out = out.replace(parsed.pathname, paint(parsed.pathname, color, settings));
    }
  } catch {
    return urlString;
  }
  return out;
}

function createDisplayLine(settings, payload) {
  const output = settings.display_in_output;
  const type = token('type', payload.method.toLowerCase(), null, settings);
  const color = statusColor(payload.code);
  const isDown = payload.code === 'error' || Number(payload.code) >= 500;
  const status = isDown ? '[DOWN]' : '[UP]';
  const statusText = bold(paint(status, color, settings), settings);
  const urlText = formatUrl(payload.url, color, settings, payload.code);
  const ipText = payload.ip ? paint(`(${payload.ip})`, 'gray', settings) : '';

  let codeText = '';
  let infoText = '';
  let serverText = '';
  let lengthText = '';
  let timeText = '';

  if (payload.code === 'error') {
    codeText = token('error', String(payload.errorCode).toLowerCase(), 'red', settings);
    if (ERROR_INFO[payload.errorCode]) {
      infoText = token('info', ERROR_INFO[payload.errorCode], 'red', settings);
    }
  } else {
    codeText = token('code', payload.code, color === 'green' ? null : color, settings);
    if (statusCodes[String(payload.code)]) {
      infoText = token(
        'info',
        statusCodes[String(payload.code)].replace(/\s+/g, '_'),
        color === 'green' ? null : color,
        settings
      );
    }
    const contentLength = payload.headers.get('content-length');
    if (contentLength && Number(contentLength) > 0) {
      lengthText = `content-length=${contentLength}`;
    }
    const server = payload.headers.get('server');
    if (server) {
      serverText = `server=${server}`;
    }
    timeText = token('time', underline(payload.elapsedMs, settings), null, settings, 'ms');
  }

  return {
    line: joinLine([
      'hPING:',
      output.status ? statusText : '',
      output.url ? urlText : '',
      output.ip ? ipText : '',
      output.type ? type : '',
      output.status_code ? codeText : '',
      output.status_info ? infoText : '',
      output.server ? serverText : '',
      output.content_length ? lengthText : '',
      output.response_time ? timeText : ''
    ]),
    status,
    code: payload.code,
    elapsedMs: payload.elapsedMs
  };
}

function floorSingleDecimal(input) {
  return Math.floor(input * 10) / 10;
}

function percentage(value, total) {
  if (total === 0) return 0;
  return floorSingleDecimal((value / total) * 100);
}

function formatStatEntry(label, value, total, color, settings, useBold) {
  if (value <= 0) return '';
  const line = `${label}=${percentage(value, total)}%`;
  const colored = paint(line, color, settings);
  return useBold ? bold(colored, settings) : colored;
}

function formatStatistics(url, history, settings) {
  if (!history.length) return '';
  const totals = {
    requests: history.length,
    codes: {},
    up: 0,
    down: 0,
    times: []
  };

  for (const entry of history) {
    totals.codes[entry.code] = (totals.codes[entry.code] || 0) + 1;
    if (entry.status === '[UP]') totals.up += 1;
    else totals.down += 1;
    if (entry.time > 0) totals.times.push(entry.time);
  }

  const codeLines = Object.keys(totals.codes).map((code) => {
    const label = code === 'error' ? 'errors' : code;
    return formatStatEntry(label, totals.codes[code], totals.requests, statusColor(code), settings, false);
  }).filter(Boolean);

  let timing = '';
  if (totals.times.length > 0) {
    const min = Math.min(...totals.times);
    const max = Math.max(...totals.times);
    const avg = Math.floor(totals.times.reduce((acc, value) => acc + value, 0) / totals.times.length);
    timing = `time(min=${min} avg=${avg} max=${max})ms`;
  }

  return [
    '',
    `--- ${url} hPING statistics [last ${totals.requests} requests] ---`,
    formatStatEntry('UP', totals.up, totals.requests, 'green', settings, true),
    formatStatEntry('DOWN', totals.down, totals.requests, 'red', settings, true),
    codeLines.join(' '),
    timing
  ].filter(Boolean).join('\n');
}

function showServers(settings) {
  const groups = settings.servers && Object.keys(settings.servers).length > 0
    ? `\nServer groups (set in config):\n${pretty(settings.servers)}`
    : '';
  console.log(`${INFO}${groups}\nusage: hping ${USAGE}`);
}

function showSettings(settingsPath, settings) {
  console.log(`Settings from config file: ${settingsPath}\n${pretty(settings)}`);
}

async function loadSettingsWithFallback(context) {
  const requestedPath = context.configPath || context.userConfigPath;
  await ensureUserConfig(context.homeDir, context.defaultConfigPath, context.userConfigPath);

  let activePath = requestedPath;
  let settings;
  try {
    settings = await loadConfig(activePath);
  } catch (error) {
    if (activePath !== context.userConfigPath) {
      console.error(
        `Specified config file "${activePath}" could not be used (${error.message}). Using default config: ${context.userConfigPath}`
      );
      activePath = context.userConfigPath;
      settings = await loadConfig(activePath);
    } else {
      throw error;
    }
  }

  if (context.interval !== undefined) {
    settings.interval = context.interval;
  }

  return { settings, settingsPath: activePath };
}

function chooseAction(actionOrTarget, targets, methodOverride) {
  if (!actionOrTarget) {
    return { type: 'help', targets: [], method: null };
  }
  const action = String(actionOrTarget).toLowerCase();
  if (!ACTIONS.has(action)) {
    return {
      type: 'ping',
      targets: [actionOrTarget, ...targets],
      method: methodOverride || null
    };
  }

  if (action === 'servers' || action === 'settings') {
    return { type: action, targets: [], method: null };
  }

  if (action === 'ping') {
    return {
      type: 'ping',
      targets,
      method: methodOverride || null
    };
  }

  return {
    type: 'ping',
    targets,
    method: action.toUpperCase()
  };
}

async function runPing(runtime) {
  const { settings, settingsPath } = await loadSettingsWithFallback(runtime.context);
  const method = parseMethod(runtime.method || settings.type || 'HEAD');
  const targets = expandTargets(runtime.targets, settings.servers).map(normalizeTarget);

  if (targets.length === 0) {
    throw new Error(`usage: hping ${USAGE}`);
  }

  const intervalSeconds = toNumber(settings.interval, DEFAULT_SETTINGS.interval);
  const timeoutMs = Math.max(1, Math.floor(toNumber(settings.timeout, DEFAULT_SETTINGS.timeout)));
  const maxRunTime = toNumber(settings.max_run_time, DEFAULT_SETTINGS.max_run_time);
  const statsLimit = Math.max(1, Math.floor(toNumber(settings.stats_for_last, DEFAULT_SETTINGS.stats_for_last)));
  const showStats = Math.max(0, Math.floor(toNumber(settings.show_stats_for_last, DEFAULT_SETTINGS.show_stats_for_last)));

  const logger = settings.log_status_change
    ? await createLogger(settings.log_file, runtime.context.homeDir)
    : null;

  const histories = new Map();
  const timers = new Set();
  let inFlight = 0;
  let shuttingDown = false;
  let finished = false;
  let finishOnce;

  const done = new Promise((resolve) => {
    finishOnce = resolve;
  });

  async function finalize() {
    if (finished) return;
    finished = true;

    if (showStats > 0) {
      for (const [url, history] of histories.entries()) {
        const report = formatStatistics(url, history.slice(-showStats), settings);
        if (!report) continue;
        console.log(report);
        if (settings.log_stats_on_exit && logger) {
          logger.info(report);
        }
      }
    }

    if (logger) {
      await logger.close();
    }
    finishOnce();
  }

  async function shutdown(withMessage) {
    if (shuttingDown) return;
    shuttingDown = true;
    if (withMessage) {
      console.log(withMessage);
    }
    for (const timer of timers) {
      clearTimeout(timer);
    }
    timers.clear();
    if (inFlight === 0) {
      await finalize();
    }
  }

  async function requestLoop(url, ip, runCount) {
    if (shuttingDown) return;

    inFlight += 1;
    try {
      const result = await performRequest(url, method, timeoutMs);
      const line = createDisplayLine(settings, {
        method,
        url,
        ip,
        code: result.code,
        headers: result.headers || new Headers(),
        elapsedMs: result.elapsedMs,
        errorCode: result.errorCode
      });
      console.log(line.line);

      const history = histories.get(url) || [];
      if (settings.log_status_change && logger) {
        const previous = history[history.length - 1];
        if (!previous || previous.status !== line.status) {
          logger.info(line.line);
        }
      }
      history.push({
        status: line.status,
        code: line.code,
        time: line.elapsedMs
      });
      if (history.length > statsLimit) {
        history.shift();
      }
      histories.set(url, history);
    } finally {
      inFlight -= 1;
      if (shuttingDown && inFlight === 0) {
        await finalize();
      }
    }

    const nextCount = runCount + 1;
    const keepRunning = maxRunTime === 0 || maxRunTime > intervalSeconds * nextCount;
    if (!keepRunning) {
      await shutdown('hPING: Maximum running time has been reached (set in config), exiting.');
      return;
    }
    if (shuttingDown) {
      return;
    }

    const timer = setTimeout(() => {
      timers.delete(timer);
      requestLoop(url, ip, nextCount).catch((error) => {
        console.error(error.message || error);
        shutdown().catch(() => {});
      });
    }, intervalSeconds * 1000);
    timers.add(timer);
  }

  async function begin() {
    for (const target of targets) {
      const ip = await resolveIp(target);
      histories.set(target, []);
      requestLoop(target, ip, 0).catch((error) => {
        console.error(error.message || error);
        shutdown().catch(() => {});
      });
    }
  }

  const onSignal = () => {
    shutdown().catch(() => {});
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  console.log(`Using config: ${settingsPath}`);
  await begin();
  await done;
}

async function runAction(action, runtime) {
  if (action.type === 'help') {
    runtime.program.outputHelp();
    return;
  }
  if (action.type === 'servers' || action.type === 'settings') {
    const { settings, settingsPath } = await loadSettingsWithFallback(runtime.context);
    if (action.type === 'servers') {
      showServers(settings);
      return;
    }
    showSettings(settingsPath, settings);
    return;
  }
  await runPing({
    context: runtime.context,
    method: action.method,
    targets: action.targets
  });
}

function buildProgram(context) {
  const program = new Command();
  program
    .name('hping')
    .description(INFO)
    .version(pkg.version)
    .usage(USAGE)
    .showHelpAfterError()
    .option('-c, --config <path>', 'hping config file in YAML format', context.userConfigPath)
    .option('-i, --interval <seconds>', 'hping interval in seconds', (value) => parseNumber(value, 'interval'))
    .option('-m, --method <method>', 'method override for ping command', parseMethod)
    .argument('[actionOrTarget]', 'command (ping/get/post/head/servers/settings) or first target')
    .argument('[targets...]', 'targets or server group names')
    .addHelpText(
      'after',
      [
        '',
        'Examples:',
        '  hping ping www.google.com',
        '  hping get www.google.com -i 2',
        '  hping www.google.com www.apple.com',
        '  hping "apple production"',
        '  hping servers'
      ].join('\n')
    )
    .action(async (actionOrTarget, targets, options) => {
      const action = chooseAction(actionOrTarget, targets, options.method);
      await runAction(action, {
        context: {
          ...context,
          configPath: options.config,
          interval: options.interval
        },
        program
      });
    });

  return program;
}

async function runCli(argv) {
  const homeDir = resolveHomeDir();
  const context = {
    homeDir,
    defaultConfigPath: defaultConfigPath(),
    userConfigPath: userConfigPath(homeDir)
  };
  const program = buildProgram(context);
  await program.parseAsync(argv, { from: 'user' });
}

module.exports = {
  DEFAULT_SETTINGS,
  expandTargets,
  normalizeSettings,
  chooseAction,
  runCli
};
