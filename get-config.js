'use strict';
const defaults = require('./defaults');
const logger = require('./shared/logger')(defaults.config.logger);
const utils  = require('./shared/utils');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

function absolutize_path(p) {
    if (p && !path.isAbsolute(p)) {
        return path.join(__dirname, p);
    }
    else {
        return p;
    }
}

function arrayize_object(a) {
    if (a && !Array.isArray(a)) {
        return Object.keys(a).map((k) => a[k]);
    }
    else {
        return a;
    }
}

var custom = {};

var local_path = path.join(__dirname, defaults.config.filename);
logger.log('Trying to read custom config file <local dir>/config.yaml: ' + local_path);
if (utils.fexists(local_path, fs.R_OK)) {
    custom = yaml.safeLoad(fs.readFileSync(local_path, 'utf-8'), { schema: yaml.DEFAULT_SAFE_SCHEMA, json: true });
}
else {
    var home_path = path.join(process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'], './.pixel');
    home_path = path.join(home_path, defaults.config.filename);
    logger.log('Trying to read custom config file <home dir>/.pixel/config.yaml: ' + home_path);
    if (utils.fexists(home_path, fs.R_OK)) {
        custom = yaml.safeLoad(fs.readFileSync(home_path, 'utf-8'), { schema: yaml.DEFAULT_SAFE_SCHEMA, json: true });
    }
    else {
        logger.log('No custom config files found, using defaults');
        custom = {};
    }
}

var config = utils.merge(custom, defaults);

config.register.folder = absolutize_path(config.register.folder);
config.timestamper.logs_folder = absolutize_path(process.argv[2] || path.join(config.timestamper.logs_folder, utils.get_ph_folder()));
config.timestamper.processed_counters_folder = absolutize_path(config.timestamper.processed_counters_folder);
config.pixel.endpoints = arrayize_object(config.pixel.endpoints);
config.pixel.cookies.sign_keys = arrayize_object(config.pixel.cookies.sign_keys);

logger.debug('Final config: ' + JSON.stringify(config));

module.exports = config;
