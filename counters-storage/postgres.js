'use strict';
const pg = require('pg');

const insert_query = `
INSERT INTO stats (pstart, hostname, pathname, val)
VALUES ($1::varchar, $2::varchar, $3::varchar, $4::int)
ON CONFLICT (pstart, hostname, pathname)
DO UPDATE SET val = stats.val + $4::int
`;

const save_data_query = `
INSERT INTO ledger_data(pstart, hostname, journal_id, rest)
VALUES ($1::varchar, $2::varchar, $3::varchar, $4::jsonb)
`;

const acknowledge_query = `
UPDATE ledger_data
SET stamped = TRUE
WHERE journal_id = $1::varchar
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
            var qid = +(new Date);
            params = [h, key_data.hostname, key_data.pathname, key_data.val != null ? key_data.val : 1];
            debug_msg(`Running insert_query with id = ${qid} and params = ${JSON.stringify(params)}`);
            pg.connect(options, function (err, client, pgdone) {
                if (err) {
                    on_error(`Error running insert_query ${qid}`, err);
                    return done(err);
                }

                client.query(insert_query, params, function (err, result) {
                    pgdone();
                    if (err) {
                        on_error(`Query insert_query ${qid} completed with errors`, err);
                        return done(err);
                    }
                    debug_msg(`Query insert_query ${qid} completed successfully`);
                    return done();
                });
            });
        },

        save_ledger_data: function (log_time, hostname, journal_id, rest, done) {
            if (journal_id === null || journal_id === undefined) {
                debug_msg('Empty journal_id in save_ledger_data()');
                return done();
            }
            var params = [];
            if (typeof log_time === 'object') {
                var h = log_time.toISOString().substr(0, 13);
            }
            else if (typeof log_time === 'number') {
                var h = (new Date(log_time)).toISOString().substr(0, 13);
            }
            else {
                var h = log_time.substr(0, 13);
            }
            var qid = +(new Date);
            params = [h, hostname, journal_id, rest];
            debug_msg(`Running save_data_query with id = ${qid} and params = ${JSON.stringify(params)}`);
            pg.connect(options, function (err, client, pgdone) {
                if (err) {
                    on_error(`Error running save_data_query ${qid}`, err);
                    return done(err);
                }

                client.query(save_data_query, params, function (err, result) {
                    pgdone();
                    if (err) {
                        on_error(`Query save_data_query ${qid} completed with errors`, err);
                        return done(err);
                    }
                    debug_msg(`Query save_data_query ${qid} completed successfully`);
                    return done();
                });
            });
        },

        acknowledge_stamp: function (journal_id, done) {
            if (journal_id === null || journal_id === undefined) {
                debug_msg('Empty journal_id in acknowledge_stamp()');
                return done();
            }
            var qid = +(new Date);
            var params = [journal_id];
            debug_msg(`Running acknowledge_query with id = ${qid} and params = ${JSON.stringify(params)}`);
            pg.connect(options, function (err, client, pgdone) {
                if (err) {
                    on_error(`Error running acknowledge_query ${qid}`, err);
                    return done(err);
                }

                client.query(acknowledge_query, params, function (err, result) {
                    pgdone();
                    if (err) {
                        on_error(`Query acknowledge_query ${qid} completed with errors`, err);
                        return done(err);
                    }
                    debug_msg(`Query acknowledge_query ${qid} completed successfully`);
                    return done();
                });
            });
        }
    };
};
