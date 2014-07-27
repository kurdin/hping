var log4js = require('log4js'),
    path = require('path');

module.exports = function(logfile) {

  'use strict';

  if (logfile === 'logs/hping.log') logfile = path.resolve(getHPINGHome(), logfile);

  log4js.configure({
    appenders: [{
      type: 'console',
      category: 'console',
      layout: {
        type: 'pattern',
        pattern: '%m'
      }
    }, {
      type: 'dateFile',
      filename: logfile,
      pattern: '-yyyy-MM-dd',
      category: 'log',
      layout: {
        type: 'pattern',
        pattern: '%d{hh:mm:ss} %m'
      }
    }]
  });

  return log4js.getLogger('log');
};

function getHPINGHome() {
  return path.resolve(process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE, '.hping/');
}