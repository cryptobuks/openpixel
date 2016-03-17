'use strict';

const fs     = require('fs');
const path   = require('path');
const OS     = require('os');
const config = require('../get-config');
const logger = require('../shared/logger')(config.timestamper.logger);
const utils  = require('../shared/utils');
const counters_storage = require('../counters-storage');
const ledger = require('../ledger');

const run_lock = path.join(__dirname, '../run_lock');

logger.log('Starting');

function exit(code, rm_run_lock) {
    code = code || 0;
    if (rm_run_lock) {
        logger.log(`Removing run-lock file ${run_lock}`);
        fs.unlinkSync(run_lock);
    }
    logger.log(`Script exits, code = ${code}`);
    process.exit(code);
}

function should_run() {
    logger.log(`Checking the existence of run-lock file = ${run_lock}`);
    if (!utils.fexists(run_lock, fs.R_OK | fs.W_OK)) {
        logger.log(`Run-lock file does not exist, creating`);
        fs.writeFileSync(run_lock, `running since ${(new Date).toISOString()}, pid = ${process.pid}`);
        return true;
    }

    logger.error(`Run-lock file exists, another instance of this script is ${fs.readFileSync(run_lock)}.`);
    return false;
}

function ls(dir, ignore_dot, ext, done) {
    fs.readdir(dir, (err, all_files) => {
        if (err) {
            return done(err, []);
        }
        var files = [];
        for (let i = 0; i < all_files.length; i++) {
            if ((ignore_dot || all_files[i].startsWith('.')) && (!ext || all_files[i].endsWith(`.${ext}`))) {
                files.push(path.join(config.timestamper.logs_folder, all_files[i]));
            }
        }
        done(null, files);
    });
}

function get_hostname(fname, ext) {
    return path.basename(fname, `.${ext}`);
}

function get_counters_fname(hostname, started_at, ext) {
    return path.join(config.timestamper.processed_counters_folder, `${hostname}.counters.${ext}`);
}

function deserialize(line) {
    try {
        return JSON.parse(line);
    }
    catch (e) {
        logger.error(`Exception occured parsing line ${line}:`, e);
        return null;
    }
}

function parse_line(line) {
    var data = deserialize(line);
    if (!data) {
        logger.error(`Skipping unparsable line ${line}`);
        return null;
    }

    if (!data) {
        logger.error(`Skipping incorrect line, missing time. Original line: ${line}`);
        return null;
    }

    if (!data.req) {
        logger.error(`Skipping incorrect line, missing req object. Original line: ${line}`);
        return null;
    }

    if (!data.req.headers) {
        logger.error(`Skipping incorrect line, missing req.headers. Original line: ${line}`);
        return null;
    }

    // if (!data.req.headers.referer) {
    //     logger.error(`Skipping incorrect line, missing req.headers.referer. Original line: ${line}`);
    //     return null;
    // }

    if (data.req.headers.referer) {
        var hp = utils.get_hostname_pathname(data.req.headers.referer);
        if (hp.err) {
            logger.error(`Error occured while trying to get hostname and pathname from referer ${data.req.headers.referer}, err:`, hp.err);
            return null;
        }
    }
    else {
        var hp = {
            hostname: '_no_referer_',
            pathname: ''
        }
    };

    return {
        time:     data.time,
        hostname: hp.hostname,
        pathname: hp.pathname
    };
}

// --------- MAIN ----------- //

const ext = config.timestamper.extension || 'log';
logger.log(`Using reader for extension .${ext} on files in folder ${config.timestamper.logs_folder}`);
const file_reader = require('./reader')(ext);

const started_at = (new Date).toISOString().substr(0,13);
var failed_files = [];

if (!should_run()) {
    return exit(2);
}

ls(config.timestamper.logs_folder, true, ext, function (err, files) {
    if (err) {
        if (err.code === 'ENOENT') {
            logger.error(`Logs folder does not exist ${config.timestamper.logs_folder}`);
            return exit(2, true);
        }
        throw err;
    }

    if (files.length === 0) {
        logger.log('No log-files to parse');
        return exit(0, true);
    }

    logger.log(`Files to be processed: ${files.map((f) => path.basename(f)).join(', ')}`);

    var i = 0; // files counter

    function next_file(err) {
        if (err) {
            logger.error(`Skipping file ${files[i]}`);
            if (config.timestamper.max_failed_files != null && failed_files.length > config.timestamper.max_failed_files) {
                logger.error(`Too many files were failed to stamp (max ${config.timestamper.max_failed_files}), exiting`);
                return exit(1, true);
            }
        }
        if (i >= files.length - 1) {
            logger.log(`Completed processing files. Total files process: ${files.length}, failed to stamp: ${failed_files.length}`);
            if (failed_files.length > 0) {
                logger.error(`Failed to stamp ${failed_files.length} files`);
            }
            return exit(failed_files.length > 0 ? 1 : 0, true);
        }
        i += 1;
        parse_file(files[i], next_file);
    }

    function parse_file(fname, next_file) {
        failed_files.push(fname);
        var hostname = get_hostname(fname, ext);
        logger.log(`Trying to parse logs of ${hostname} (file = ${fname})`);
        var total_counter = {};
        let dur = process.hrtime();
        file_reader.read_by_line(fname,
            function (err) {
                logger.error(`Error reading line from file = ${fname}, err:`, err);
                return next_file(err);
            },
            function (line) {
                logger.debug(`Trying to parse line = ${line}`);
                var counter = parse_line(line);
                logger.debug(`Line processed, counter = ${JSON.stringify(counter)}`);
                if (!counter) {
                    return;
                }
                var t = counter.time.substr(0,13);
                if (!total_counter[t]) {
                    total_counter[t] = {};
                }
                if (!total_counter[t][counter.hostname]) {
                    total_counter[t][counter.hostname] = {};
                }
                if (!total_counter[t][counter.hostname][counter.pathname]) {
                    total_counter[t][counter.hostname][counter.pathname] = 0;
                }
                total_counter[t][counter.hostname][counter.pathname] += 1;
            },
            function () {
                dur = process.hrtime(dur);
                logger.log(`File ${fname} processed, ${dur[0]} sec. elapsed`);
                var counters_fname = get_counters_fname(hostname, started_at, ext);
                dur = process.hrtime();
                file_reader.write(counters_fname, JSON.stringify(total_counter), function (err) {
                    if (err) {
                        logger.error(`Could not save counters file = ${counters_fname}, err:`, err);
                        return next_file(err);
                    }
                    dur = process.hrtime(dur);
                    logger.log(`Counters files ${counters_fname} saved, ${dur[0]} sec. elapsed`);
                    dur = process.hrtime();
                    counters_storage.incr_by_json(total_counter, function (err) {
                        if (err) {
                            logger.error(`Error updating counters in storage for file = ${fname}:`, err);
                            return next_file(err);
                        }
                        dur = process.hrtime(dur);
                        logger.log(`Counters updated in storage for file = ${fname}, ${dur[0]} sec. elapsed`);
                        dur = process.hrtime();
                        ledger.stamp(`Pixel data for ${hostname}`, fname, counters_fname, function (err) {
                            if (err) {
                                logger.error('Failed to stamp in ledger, err:', err);
                                return next_file(err);
                            }
                            dur = process.hrtime(dur);
                            logger.log(`Successfully stamped ${hostname} in ledger, ${dur[0]} sec. elapsed`);
                            failed_files.pop();
                            return next_file();
                        });
                    });
                });
            }
        );
    }

    parse_file(files[0], next_file);
});
