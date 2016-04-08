'use strict';

module.exports = (options, debug_msg, on_error) => {
    return {
        open: function (done) {
            debug_msg(`dev-null.open() called`);
            return done(null, { id: `testing-${Number(new Date)}` });
        },

        add: function (journal, log_file, counters_file, done) {
            debug_msg(`dev-null.add() called with journal = ${JSON.stringify(journal)}, log_file = ${log_file}, counters_file = ${counters_file}`);
            return done(null, {});
        },

        stamp: function (journal, done) {
            debug_msg('dev-null.stamp() called with journal = ' + JSON.stringify(journal));
            return done();
        },

        get_txid: function (journal, done) {
            debug_msg('dev-null.get_txid() called with journal = ' + JSON.stringify(journal));
            return done(null, `testing-${Number(new Date)}`);
        }
    };
};
