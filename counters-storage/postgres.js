'use strict';
const pg = require('pg');

var insert_query = `
INSERT INTO stats (pstart, hostname, pathname, val)
VALUES ($1::varchar, $2::varchar, $3::varchar, $4::int)
ON CONFLICT (pstart, hostname, pathname)
DO UPDATE SET val = stats.val + $4::int
`;

module.exports = function (options, debug_msg, on_disconnect, on_error) {
    return {
        init: function (done) {
            return done();
        },
        incr: function (key_data, done) {
            var params = [];
            if (typeof key_data.req_time === 'object') {
                var h = key_data.req_time.toISOString().substr(0, 13);
            }
            else if (typeof key_data.req_time === 'number') {
                var h = (new Date(key_data.req_time)).toISOString().substr(0, 13);
            }
            else {
                var h = key_data.req_time.substr(0, 13);
            }
            params = [h, key_data.hostname, key_data.pathname, key_data.val != null ? key_data.val : 1];
            pg.connect(options, function (err, client, pgdone) {
                if (err) {
                    return done(err);
                }

                client.query(insert_query, params, function (err, result) {
                    pgdone();
                    return done(err);
                });

            });
        }
    };
};
