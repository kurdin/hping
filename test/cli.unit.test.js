'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { DEFAULT_SETTINGS, chooseAction, expandTargets, normalizeSettings } = require('../lib/cli');

test('normalizeSettings supports top-level default and merges display settings', () => {
  const settings = normalizeSettings({
    default: {
      interval: 3,
      display_in_output: {
        server: false
      }
    }
  });

  assert.equal(settings.interval, 3);
  assert.equal(settings.display_in_output.server, false);
  assert.equal(settings.display_in_output.status, true);
});

test('normalizeSettings falls back to defaults for invalid input', () => {
  const settings = normalizeSettings(null);
  assert.equal(settings.interval, DEFAULT_SETTINGS.interval);
  assert.equal(settings.type, DEFAULT_SETTINGS.type);
  assert.deepEqual(settings.servers, {});
});

test('expandTargets replaces server groups and keeps explicit targets', () => {
  const expanded = expandTargets(
    ['prod', 'example.com'],
    {
      prod: ['api.example.com', 'app.example.com']
    }
  );

  assert.deepEqual(expanded, ['api.example.com', 'app.example.com', 'example.com']);
});

test('expandTargets skips non-string and empty targets', () => {
  const expanded = expandTargets(['', 'prod', 42, 'example.com'], { prod: ['api.example.com'] });
  assert.deepEqual(expanded, ['api.example.com', 'example.com']);
});

test('chooseAction keeps legacy host invocation compatible', () => {
  const action = chooseAction('www.google.com', ['www.apple.com'], null);
  assert.equal(action.type, 'ping');
  assert.equal(action.method, null);
  assert.deepEqual(action.targets, ['www.google.com', 'www.apple.com']);
});

test('chooseAction maps verb command to method override', () => {
  const action = chooseAction('get', ['www.google.com'], null);
  assert.equal(action.type, 'ping');
  assert.equal(action.method, 'GET');
  assert.deepEqual(action.targets, ['www.google.com']);
});

test('chooseAction handles meta actions', () => {
  const help = chooseAction(undefined, [], null);
  assert.deepEqual(help, { type: 'help', targets: [], method: null });

  const servers = chooseAction('servers', [], null);
  assert.deepEqual(servers, { type: 'servers', targets: [], method: null });

  const settings = chooseAction('settings', [], null);
  assert.deepEqual(settings, { type: 'settings', targets: [], method: null });

  const ping = chooseAction('ping', ['a.example'], 'POST');
  assert.deepEqual(ping, { type: 'ping', targets: ['a.example'], method: 'POST' });
});
