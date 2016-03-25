'use strict';

module.exports = (options, debug_msg, on_error) => {
    return {
        open: function (done) {
            debug_msg(`dev-null.open() called`);
            return done(null, {});
        },

        add: function (journal_name, log_file, counters_file, done) {
            debug_msg(`dev-null.add() called with journal_name = ${journal_name}, log_file = ${log_file}, counters_file = ${counters_file}`);
            return done(null, {});
        },

        stamp: function (journal, done) {
            debug_msg('dev-null.stamp() called with journal = ' + JSON.stringify(journal));
            return done();
        }
    }
}
