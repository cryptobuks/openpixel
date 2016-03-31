'use strict';
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

var cache = {};

module.exports = function (logger, views_folder) {

    return function (name, locals, callback) {
        var fname = path.join(views_folder, `./${name}`);

        if (process.env.NODE_ENV === 'development') {
            logger.debug('In development environment reload files from disk each time');
            fs.readFile(fname, 'utf8', function (err, f) {
                if (err) {
                    logger.debug(`Error loading view ${name} from file ${fname}:`, err);
                    return callback(err);
                }

                try {
                    var html = ejs.compile(f)(locals);
                    logger.debug(`View ${name} was compiled from file ${fname}`);
                    return callback(null, html);
                }
                catch(e) {
                    logger.error(`Exception compiling view ${name} from file ${fname}:`, e);
                    return callback(e);
                }
            });
        }

        else if (cache[fname]) {
            logger.debug(`Loading view ${fname} from cache`);
            try {
                var html = cache[fname](locals);
                logger.debug(`View ${name} was compiled from cache`);
                return callback(null, html);
            }
            catch (e) {
                logger.error(`Exception compiling view ${name} from cache:`, e);
                return callback(e);
            }
        }

        else {
            logger.debug(`Missing view ${fname} in cache`);
            fs.readFile(fname, 'utf8', function (err, f) {
                if (err) {
                    logger.debug(`Error loading view ${name} from file ${fname}:`, err);
                    return callback(err);
                }

                try {
                    var tmpl = ejs.compile(f);
                    var html = tmpl(locals);
                    logger.debug(`View ${name} was compiled from file ${fname}, will save to cache`);
                    cache[fname] = tmpl;
                    return callback(null, html);
                }
                catch(e) {
                    logger.error(`Exception compiling view ${name} from file ${fname}:`, e);
                    return callback(e);
                }
            });
        }
    };

};
