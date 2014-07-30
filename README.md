hPING (HTTP ping)
=====

Node.js CLI that sends HTTP HEAD or GET or POST requests to any web or api servers.

hPING is the fastest and easiest way to check or quickly monitor for http servers availability.

## Installation
The latest hPING version is installable via NPM:
```bash
$ npm install hping -g
```
If the above fails try this:
```bash
$ npm install git://github.com/kurdin/hping#master -g
```
or
```bash
$ git clone https://github.com/kurdin/hping
$ cd hping 
$ npm install 
$ npm link 
```
## Usage

hPING single server ``www.google.com``:
```bash
$ hping www.google.com 
```
hPING server ``www.google.com`` with 10 seconds interval:
```bash
$ hping www.google.com -i 10 
```
hPING single server with ``GET`` method:
```bash
$ hping get www.google.com
```
hPING multiple servers ``www.google.com`` and ``www.apple.com`` and ``www.microsoft.com``):
```bash
$ hping www.google.com www.apple.com www.microsoft.com
```
hPING group of servers from config file (default config: ``~/.hping/hping.conf.yaml``):
```bash
$ hping "apple production"
```
hPING can mix group of servers and separate hosts with single command:
```bash
$ hping "apple production" www.github.com
```
## Settings
hPING default settings, default ``~/.hping/hping.conf.yaml``:
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
Show hPING server groups from config file, default ``~/.hping/hping.conf.yaml``:
```bash
$ hping servers
 "microsoft live": 
  "http://www.live.com"
  "http://www.live.fr"
  "http://www.live.de"
  "http://www.live.ru"
  "http://www.live.com/api"
 
 "apple production": 
  "http://www.apple.com"
  "http://www.icloud.com"
  "https://itunes.apple.com"
 
 "eurohosting": 
  "http://www.leaseweb.eu"
  "http://www.hetzner.de"
  "http://www.1and1.co.uk"
```
Display hPING current settings:
```bash
$ hping settings
```
hPING server ``www.goolge.com`` and use settings from config file ``/etc/hping.conf.yaml``:
```bash
$ hping www.google.com -c /etc/hping.conf.yaml 
```
## Help
hPING quick usage help:
```bash
$ hping 
usage: hping [head|get|post] [http(s)://]www.webserver.com[:port] [another host] [server group]
```
hPING full help:
```bash
$ hping -h
  Usage: hping [head|get|post] [http(s)://]www.webserver.com[:port] [another host] [server group]

  Commands:

    servers 
       Show server groups information from config file
    
    settings 
       Show hPING settings from config file
    
    get 
       Sends HTTP GET requests to web or api server (set default in ~/.hping/hping.conf.yaml)
    
    post 
       Sends HTTP POST requests to web or api server (set default in ~/.hping/hping.conf.yaml)
    
    head 
       Sends HTTP HEAD requests to web or api server (set default in ~/.hping/hping.conf.yaml)
    

  Options:

    -h, --help                                   output usage information
    -V, --version                                output the version number
    -c, --config [~/.hping/hping.conf.yaml]  hping config file in YAML format
    -i, --interval [1] 
```
## Log to file
You can setup hPING to log status change to separate log file. Default log file located in ``~/.hping/logs`` folder, you can change it with ``log_file`` option. 

To enable log output, you need to edit ``~/.hping/hping.conf.yaml`` config file and set: ``log_status_change`` : ``true``

Also, you can make hPING to output statistics to log file with option ``log_stats_on_exit`` : ``true``
