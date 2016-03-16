'use strict';
const version = 1;
const config = require('../get-config').register
const logger = require('../shared/logger')(config.logger);
const utils = require('../shared/utils');

const fs = require('fs');
const path = require('path');
const OS = require('os');

const lru = require('lru-cache');
const CronJob = require('cron').CronJob;

function append_to_fd(fd, obj, hostname, hourstr, callback) {
    logger.debug('Trying to append to (' + hostname + ', ' + hourstr + '), fd = ' + fd + ', object = '+ JSON.stringify(obj));
    fs.write(fd, JSON.stringify(obj) + OS.EOL, function (err, written, string) {
        if (err) {
            logger.error('Could not append to (' + hostname + ', ' + hourstr + '), fd = ' + fd + ', object = ' + JSON.stringify(obj) + ', err:', err);
        }
        else {
            logger.debug('Appended to (' + hostname + ', ' + hourstr + '), fd = ' + fd + ', ' + written + ' bytes written');
        }
        callback(err);
    });
}

function serialize_time(time) {
    return time.toISOString();
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

function get_log_fname(time, hostname) {
    var hf = utils.get_ch_folder(time);
    return path.join(path.join(config.folder, hf), hostname + '.log');
}

/****** Cache of file descriptors ******/
var cache_options = Object.assign({}, config.cache_options);
cache_options.dispose = function (key, fd) {
    var si = key.indexOf('|');
    key = {
        hourstr:  key.substr(0,si),
        hostname: key.substr(si+1),
    };

    logger.log('Closing file descriptor on the next tick for (' + key.hostname + ', ' + key.hourstr + '), fd = ' + fd);
    process.nextTick(function () {
        fs.close(fd, function (err) {
            if (err) {
                return logger.error('Could not close file descriptor for (' + key.hostname + ', ' + key.hourstr + '), fd = ' + fd + ', err:', err);
            }
            else {
                logger.debug('File descriptor for (' + key.hostname + ', ' + key.hourstr + '), fd = ' + fd + ' closed');
            }
        });
    });
};
var hosts = lru(cache_options);

setInterval(() => {
    logger.log('****** Prune expired file descriptors (currently opened ' + hosts.itemCount + ')');
    hosts.prune();
}, config.prune_interval);

/****** Creating folders for logs ******/
var chfname = path.join(config.folder, utils.get_ch_folder());
logger.log('Create folder for the current hour = ' + chfname);
var ens = utils.mkdirpSync(chfname);
if (ens) throw ens;
logger.debug('Folder for the current hour created');

var nhfname = path.join(config.folder, utils.get_nh_folder());
logger.log('Create folder for the next hour = ' + nhfname);
var ens = utils.mkdirpSync(nhfname);
if (ens) throw ens;
logger.debug('Folder for the next hour created');

new CronJob('0 59 * * * *', function () {
    var phfname = path.join(config.folder, utils.get_nh_folder());
    logger.log('****** Create folder for the next hour = ' + phfname);
    utils.mkdirp(phfname, (err) => {
        if (err) {
            return logger.error('****** Could not create folder for the next hour, err: ', err);
        }
        return logger.debug('****** Folder for the next hour created');
    });
}, null, true, null, null, null);

module.exports = {
    serialize: (t) => {
        if (!t.req || !t.req.headers) {
            return logger.error('Missing req object or req.headers');
        }

        var hostname = '_no_referer_';
        var hourstr  = utils.get_ch_folder(t.time);
        if (t.req.headers.referer) {
            let parsed = utils.get_hostname_pathname(t.req.headers.referer);
            if (parsed.err || !parsed.hostname) {
                return logger.error('Error parsing referer ' + parsed.original_url + ' , err:', parsed.err)
            }
            hostname = parsed.hostname;
        }

        var obj = {
            v:    version,
            time: serialize_time(t.time),
            user: serialize_user(t.user),
            req:  serialize_req(t.req)
        };

        var fd = hosts.get(hourstr + '|' + hostname);
        if (!fd) {
            var fname = get_log_fname(t.time, hostname);
            logger.log('Opening file descriptor for (' + hostname + ', ' + hourstr + ') at ' + fname);
            fs.open(fname, 'a', function (err, fd) {
                if (err) {
                    return logger.error('Could not open file descriptor for (' + hostname + ', ' + hourstr + ' at ' + fname + ', err:', err);
                }
                logger.debug('Opened file descriptor for (' + hostname + ', ' + hourstr + ') at ' + fname + ' (fd = ' + fd + ')');
                hosts.set(hourstr + '|' + hostname, fd);
                append_to_fd(fd, obj, hostname, hourstr, (err) => {});
            });
        }
        else {
            append_to_fd(fd, obj, hostname, hourstr, (err) => {});
        }
    }
};

