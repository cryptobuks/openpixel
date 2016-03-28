'use strict';

module.exports = function (options, debug_msg, on_disconnect, on_error) {
    return {
        init: function (done) {
            debug_msg('dev-null.init() called');
            return done();
        },

        incr: function (key_data, done) {
            debug_msg('dev-null.incr() called with key_data = ' + JSON.stringify(key_data));
            done();
        },

        save_ledger_data: function (log_time, hostname, journal_id, rest, done) {
            debug_msg(`dev-null.save_ledger_data() called with log_time = ${log_time}, hostname = ${hostname}, journal_id = ${journal_id}, rest = ` + JSON.stringify(rest));
            return done();
        },

        acknowledge_stamp: function (journal_id, done) {
            debug_msg('dev-null.acknowledge_stamp() called with journal_id = ' + journal_id);
            return done();
        },

        set_txid: function (journal_id, txid, done) {
            debug_msg('dev-null.set_txid() called with journal_id = ' + journal_id + ', txid = ' + txid);
            return done();
        }
    };
};
