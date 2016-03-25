'use strict';
const config = require('../get-config').timestamper;
var logger = require('../shared/logger')(config.logger);

module.exports = function (ext) {
    logger.log(`Using reader: ${ext}`);

    return require(`./read-${ext}`);
}
