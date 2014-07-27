'use strict';

var log4js = require('log4js');

module.exports = function(logfile) {

  log4js.configure({
    appenders: [
     { type: 'console',
       category: "console", 
       layout: {
          type: 'pattern',
          pattern: "%m"
        }},
     { type: "dateFile",
       filename: logfile || "./logs/hping.log",
       pattern : "-yyyy-MM-dd",
       category: "log", 
       layout: {
          type: 'pattern',
          pattern: "%d{hh:mm:ss} %m"
      }
    }]
  });

  return log4js.getLogger('log');
} 

