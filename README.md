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

Quick help:
```bash
$ hping # 
usage: hping [head|get|post] [http(s)://]www.webserver.com[:port] [another host] [server group]
```
hPING single server ``www.google.com``:
```bash
$ hping www.google.com 
```
hPING single server with ``GET`` method:
```bash
$ hping get www.google.com
```
hPING multiple servers (www.google.com and www.apple.com and www.microsoft.com):
```bash
$ hping www.google.com www.apple.com www.microsoft.com
```
hPING group of servers from config file (default config in: ``~/.hping/hping.conf.yaml``):
```bash
$ hping "apple production"
```
Show hPING server groups from config:
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
hPING can mix group of servers and separate hosts with single command:
```bash
$ hping "apple production" www.github.com
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





