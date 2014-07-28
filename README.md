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

```bash
$ hping www.google.com # hPING single server (www.google.com)
```




