'use strict';

const config   = require('../get-config');
const logger   = require('../shared/logger')(config.pixel.logger);
const utils    = require('../shared/utils');
const register = require('../register');
const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const id_user  = require('./id_user');

var gif;
try {
    gif = fs.readFileSync(path.join(__dirname, './1x1.gif'));
}
catch (ex) {
    throw ex;
}

const endpoints = config.pixel.endpoints;

function check_req(req) {
    // for haproxy
    if (req.method === 'HEAD' && req.url === '/') {
        return true;
    }

    if (req.method !== 'GET') {
        return false;
    }

    for (let i = endpoints.length - 1; i >= 0; i--) {
        if (req.url === endpoints[i] || req.url.startsWith(endpoints[i] + '?')) {
            return true;
        }
    }

    return false;
}

function no_cache(res) {
    res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', 'Fri, 01 Jan 1990 00:00:00 GMT');
}

var log_404;
if (config.pixel.log_404_as_error) {
    log_404 = function (req) {
        logger.error('Invalid endpoint = ' + req.method + ' ' + req.url);
    };
}
else {
    log_404 = function () {};
}

http.createServer((req, res) => {
    if (check_req(req)) {
        no_cache(res);
        var user = id_user(req, res);
        register.serialize({
            time: (new Date).toISOString(),
            user: user,
            req: req
        });

        res.setHeader('Content-Type', 'image/gif');
        res.end(gif, 'binary');
    }
    else {
        res.statusCode = 404;
        res.end();
        log_404(req);
    }
}).listen(config.pixel.port, () => {
    logger.log('Server running at ' + config.pixel.port + ', valid endpoints: ' + endpoints.join(', '));
});
