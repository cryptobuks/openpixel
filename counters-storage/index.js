'use strict';
const config = require('../get-config').counters_storage;
const logger = require('../shared/logger')(config.logger);
const utils  = require('../shared/utils');

function debug_msg(msg, obj) {
    logger.debug(msg, obj);
}

function on_disconnect(err) {
    logger.error('Connection lost:', err);
}

function on_error(msg, err) {
    logger.error(`${msg}:`, err);
}

logger.log(`Using counters storage: ${config.type}`);
const storage = require(`./${config.type}`)(config.options, debug_msg, on_disconnect, on_error);

/*
    In incr_by_json, parameter "json" should have the following structure:
    {
        "time": {
            "hostname": {
                "pathname": counter_value
            }
        }
    }
    e.g.
    {
        "2016-03-09T11": {
            "example1.com": {
                "/": 123,
                "/page1": 432
            },
            "example2.com": {
                "/page3": 10
            }
        },
        "2016-03-09T12": {
            "example1.com": {
                "/": 5
            },
            "example3.com": {
                "/page1": 3,
                "/page2/subpage": 76
            }
        }
    }
*/

function default_incr_by_json() {
    var incr = storage.incr;
    var async_for_each = utils.async_for_each;
    return function (json, done) {
        if (!json || typeof json !== 'object') {
            logger.error(`Empty json or incorrect type of json: ${typeof json}`);
            return done();
        }

        var times = Object.keys(json);
        debug_msg(`Calling default_incr_by_json() with json = ${JSON.stringify(json)}`);

        if (times.length === 0) {
            return done();
        }
        async_for_each(times, function (t, nextt) {
            let hostnames = Object.keys(json[t]);
            if (hostnames.length === 0) {
                return nextt();
            }
            async_for_each(hostnames, function (h, nexth) {
                let pathnames = Object.keys(json[t][h]);
                if (pathnames.length === 0) {
                    return nexth();
                }
                async_for_each(pathnames, function (p, nextp) {
                    let key_data = {
                        req_time: t,
                        hostname: h,
                        pathname: p,
                        val:      json[t][h][p]
                    };
                    incr(key_data, nextp);
                }, nexth);
            }, nextt)
        }, done);
    }
}

module.exports = {
    init:                   storage.init,
    incr:                   storage.incr,
    incr_by_json:           storage.incr_by_json || default_incr_by_json(),
    save_ledger_data:       storage.save_ledger_data,
    acknowledge_stamp:      storage.acknowledge_stamp,
    set_txid:               storage.set_txid,
    search:                 storage.search,
    search_count:           storage.search_count,
    search_ledger:          storage.search_ledger,
    search_ledger_count:    storage.search_ledger_count,
    get_ledger_data_by_id:  storage.get_ledger_data_by_id
};
