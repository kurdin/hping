hPING (HTTP ping)
=====

Node.js CLI that sends HTTP `HEAD`, `GET`, or `POST` requests to web/api servers.

<img src="http://www.anothervision.com/img/github/hping.gif" width="1126"/>
hPING is a quick way to check and monitor HTTP server availability.

## Node.js Support

- Supported: `Node.js 20+` (validated against current major runtimes, including Node `22+`).

## Installation

hPING is installable via npm:

```bash
$ npm install hping -g
```

## Usage

hPING single server `www.google.com`:

```bash
$ hping www.google.com
```

hPING server `www.google.com` with a 10-second interval:

```bash
$ hping www.google.com -i 10
```

hPING single server with `GET` method:

```bash
$ hping get www.google.com
```

hPING multiple servers:

```bash
$ hping www.google.com www.apple.com www.microsoft.com
```

hPING group of servers from config file (default config: `~/.hping/hping.conf.yaml`):

```bash
$ hping "apple production"
```

hPING can mix group of servers and separate hosts with single command:

```bash
$ hping "apple production" www.github.com
```

Explicit `ping` command (modern style):

```bash
$ hping ping www.google.com
```

## Settings

hPING default settings (`~/.hping/hping.conf.yaml`):

```bash
interval: 1 # (seconds) interval between hPING requests
type: HEAD # (type or requests): HEAD, GET, POST, PUT
timeout: 5000 # (milliseconds) request connection timeout
use_colors: true # (true || false), use colors for hPING output
show_stats_for_last: 100 # (number of requests) show hPING statistics for last X number of requests, set 0 to disable
max_run_time: 600 # (seconds) hPING maximum running time, set 0 to disable

log_status_change: false # (true || false) if true, hPING will log status changes to log file
log_file: logs/hping.log # (path) to hPING log file, default path in users home .hping folder
log_stats_on_exit: true # (true || false) if true, hPING will log statistics to file on exit

display_in_output: # use true || fasle to turn on/off log output sections
  status: true 
  url: true
  ip: true
  type: false
  status_code: true
  status_info: true
    server: true
    content_length: false
    response_time: true
```

Show hPING server groups:

```bash
$ hping servers
```

Display hPING current settings:

```bash
$ hping settings
```

hPING server `www.google.com` with custom config:

```bash
$ hping www.google.com -c /etc/hping.conf.yaml
```

## Help

hPING quick usage help:

```bash
$ hping 
usage: hping [ping|head|get|post] [http(s)://]www.webserver.com[:port] [another host] [server group]
```

hPING full help:

```bash
$ hping -h
```

## Log to file

Enable status-change logging with `log_status_change: true`.

Default log file location: `~/.hping/logs/hping.log` (override with `log_file`).

## Development

Install deps:

```bash
$ npm install
```

Run tests:

```bash
$ npm test
```

##License
The MIT License (MIT)
Copyright (c) 2014 Sergey Kurdin
