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

function get_log_fname(rel_folder, hostname) {
    return path.join(path.join(config.folder, rel_folder), hostname + '.log');
}

/****** Function to cache log folder for the current hour ******/
var cur_hourstr = utils.get_ch_folder();
var transition = ( (new Date).getMinutes() >= 58 );
logger.log('String for the folder of logs = ' + cur_hourstr);
logger.log('Is transition happening = ' + transition);

new CronJob('0 59 * * * *', function () {
    logger.log('****** Begin transition');
    transition = true;
}, null, true, null, null, null);

new CronJob('0 1 * * * *', function () {
    logger.log('****** End transition, recalculate string for the folder of logs');
    cur_hourstr = utils.get_ch_folder();
    transition = false;
    logger.log('****** New string for the folder of logs = ' + cur_hourstr);
}, null, true, null, null, null);

function get_hourstr() {
    if (transition) {
        logger.debug('In transitional period recalculate get_ch_folder() each time');
        return utils.get_ch_folder();
    }
    return cur_hourstr;
}

/****** Cache of file descriptors ******/
var cache_options = Object.assign({}, config.cache_options);
cache_options.dispose = function (key, fd) {
    var si = key.indexOf('|');
    key = {
        hourstr:  key.substr(0,si),
        hostname: key.substr(si+1),
    };

    logger.debug('Closing file descriptor on the next tick for (' + key.hostname + ', ' + key.hourstr + '), fd = ' + fd);
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
logger.log('Ensure folder for the current hour exists = ' + chfname);
var ens = utils.mkdirpSync(chfname);
if (ens) throw ens;

var nhfname = path.join(config.folder, utils.get_nh_folder());
logger.log('Ensure folder for the next hour exists = ' + nhfname);
var ens = utils.mkdirpSync(nhfname);
if (ens) throw ens;

new CronJob('0 50 * * * *', function () {
    var nhfname = path.join(config.folder, utils.get_nh_folder());
    logger.log('****** Create folder for the next hour = ' + nhfname);
    utils.mkdirp(nhfname, (err) => {
        if (err) {
            logger.error('****** Could not create folder for the next hour, err: ', err);
            throw err;
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
        var hourstr = get_hourstr();
        if (t.req.headers.referer) {
            let parsed = utils.get_hostname_pathname(t.req.headers.referer);
            if (parsed.err || !parsed.hostname) {
                return logger.error('Error parsing referer ' + parsed.original_url + ' requested by ' + JSON.stringify(t.req.headers) + ', err:', parsed.err)
            }
            hostname = parsed.hostname;
        }
        else {
            logger.error('Missing referer. Requested by: ' + JSON.stringify(t.req.headers));
        }

        var obj = {
            v:    version,
            time: serialize_time(t.time),
            user: serialize_user(t.user),
            req:  serialize_req(t.req)
        };

        var fd = hosts.get(hourstr + '|' + hostname);
        if (!fd) {
            var fname = get_log_fname(hourstr, hostname);
            logger.debug('Opening file descriptor for (' + hostname + ', ' + hourstr + ') at ' + fname);
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

