'use strict';
const config = require('../get-config').ledger;
const logger = require('../shared/logger')(config.logger);

function debug_msg(msg, obj) {
    logger.debug(msg, obj);
}

function on_error(msg, err) {
    logger.error(`${msg}:`, err);
}

logger.log(`Using ledger: ${config.type}`);
const ledger = require(`./${config.type}`)(config.options, debug_msg, on_error);

module.exports = {
    open:     ledger.open,
    add:      ledger.add,
    stamp:    ledger.stamp,
    get_txid: ledger.get_txid
};
