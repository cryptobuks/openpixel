'use strict';

module.exports = (options, debug_msg, on_error) => {
    return {
        stamp: function (journal_name, register_file, counters_file, done) {
            debug_msg(`dev-null.stamp() called with journal_name = ${journal_name}, register_file = ${register_file}, counters_file = ${counters_file}`);
            return done();
        }
    }
}
