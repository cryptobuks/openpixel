'use strict';
const version = 1;
const config = require('../get-config').register
const logger = require('../shared/logger')(config.logger);

const fs = require('fs');
const path = require('path');
const OS = require('os');

const lru = require('lru-cache');
const utils = require('../shared/utils');

var cache_options = Object.assign({}, config.cache_options);
cache_options.dispose = function (hostname, fd) {
    logger.log('Closing file descriptor for ' + hostname + ' (fd = ' + fd + ')');
    fs.close(fd, function (err) {
        if (err) {
            return logger.error('Could not close file descriptor for ' + hostname + ' (fd = ' + fd + ', err:', err);
        }
        else {
            logger.debug('File descriptor for ' + hostname + ' (fd = ' + fd + ') closed');
        }
    });
};
var hosts = lru(cache_options);

setInterval(() => {
    logger.log('****** Prune expired file descriptors (currently opened ' + hosts.itemCount + ')');
    hosts.prune();
}, config.prune_interval);

function append_to_fd(fd, obj, hostname, callback) {
    logger.debug('Trying to append to hostname = ' + hostname + ' (fd = ' + fd + '), object = '+ JSON.stringify(obj));
    fs.write(fd, JSON.stringify(obj) + OS.EOL, function (err, written, string) {
        if (err) {
            logger.error('Could not append to hostname = ' + hostname + ' (fd = ' + fd + '), object = ' + JSON.stringify(obj) + ', err:', err);
        }
        else {
            logger.debug('Appended to hostname = ' + hostname + ' (fd = ' + fd + '), ' + written + ' bytes written');
        }
        callback(err);
    });
}

function serialize_user(user) {
    return (user || {});
}

function serialize_req(req) {
    if (!req) {
        return {};
    }
    return {
        method:  req.method,
        url:     req.url,
        headers: req.headers
    }
}

function get_log_fname(hostname) {
    return path.join(config.folder, hostname + '.log');
}

module.exports = {
    serialize: (t) => {
        if (!t.req || !t.req.headers) {
            return logger.error('Missing req object or req.headers');
        }

        var hostname = '_no_referer_';
        if (t.req.headers.referer) {
            let parsed = utils.get_hostname_pathname(t.req.headers.referer);
            if (parsed.err || !parsed.hostname) {
                return logger.error('Error parsing referer or empty hostname, err:', parsed.err)
            }
            hostname = parsed.hostname;
        }

        var obj = {
            v:    version,
            time: t.time,
            user: serialize_user(t.user),
            req:  serialize_req(t.req)
        };

        var fd = hosts.get(hostname);
        if (!fd) {
            var fname = get_log_fname(hostname);
            logger.log('Opening file descriptor for ' + hostname + ' at ' + fname);
            fs.open(fname, 'a', function (err, fd) {
                if (err) {
                    return logger.error('Could not open file descriptor for ' + hostname + ' at ' + fname + ', err:', err);
                }
                logger.debug('Opened file descriptor for ' + hostname + ' (fd = ' + fd + ')');
                hosts.set(hostname, fd);
                append_to_fd(fd, obj, hostname, (err) => {});
            });
        }
        else {
            append_to_fd(fd, obj, hostname, (err) => {});
        }
    }
};

