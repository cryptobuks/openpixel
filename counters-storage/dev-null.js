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
        }
    };
};
