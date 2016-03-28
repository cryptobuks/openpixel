'use strict';
const pg = require('pg');

var queries = {};

queries['incr'] = `
INSERT INTO stats (pstart, hostname, pathname, val)
VALUES ($1::varchar, $2::varchar, $3::varchar, $4::int)
ON CONFLICT (pstart, hostname, pathname)
DO UPDATE SET val = stats.val + $4::int
`;

queries['save_ledger_data'] = `
INSERT INTO ledger_data(pstart, hostname, journal_id, rest)
VALUES ($1::varchar, $2::varchar, $3::varchar, $4::jsonb)
`;

queries['acknowledge_stamp'] = `
UPDATE ledger_data
SET stamped = TRUE
WHERE journal_id = $1::varchar
`;

queries['set_txid'] = `
UPDATE ledger_data
SET txid = $1::varchar
WHERE journal_id = $2::varchar
`;

queries['search'] = `
SELECT pstart, hostname, path, val
FROM stats
WHERE hostname = $1::varchar AND pathname = $2::varchar AND pstart >= $2::varchar AND pstart <= $3::varchar
`;

queries['search_all_pathnames'] = `
SELECT pstart, hostname, pathname, val
FROM stats
WHERE hostname = $1::varchar AND pstart >= $2::varchar AND pstart <= $3::varchar
`;

queries['search_agg_hostname'] = `
SELECT pstart, hostname, SUM(val)
FROM stats
WHERE hostname = $1::varchar AND pstart >= $2::varchar AND pstart <= $3::varchar
GROUP BY pstart, hostname
`;

queries['search_agg_pstart'] = `
SELECT pstart, SUM(val)
FROM stats
WHERE pstart >= $2::varchar AND pstart <= $3::varchar
GROUP BY pstart
`;

module.exports = function (options, debug_msg, on_disconnect, on_error) {

    function run_query(query_name, params, callback) {
        var qid = +(new Date);
        debug_msg(`Running ${query_name} with qid = ${qid} and params = ${JSON.stringify(params)}`);
        pg.connect(options, function (err, client, pgdone) {
            if (err) {
                on_error(`Error connecting on query ${query_name} qid = ${qid}`, err);
                return callback(err);
            }

            client.query(queries[query_name], params, function (err, result) {
                pgdone();
                if (err) {
                    on_error(`Query ${query_name} with qid = ${qid} and params = ${JSON.stringify(params)} completed with errors`, err);
                    return callback(err);
                }
                debug_msg(`Query ${query_name} with qid = ${qid} completed successfully`);
                return callback();
            });
        });
    }

    return {
        init: function (done) {
            return done();
        },

        incr: function (key_data, done) {
            if (typeof key_data.req_time === 'object') {
                var h = key_data.req_time.toISOString().substr(0, 13);
            }
            else if (typeof key_data.req_time === 'number') {
                var h = (new Date(key_data.req_time)).toISOString().substr(0, 13);
            }
            else {
                var h = key_data.req_time.substr(0, 13);
            }
            key_data.val = key_data.val != null ? key_data.val : 1;

            run_query('incr', [h, key_data.hostname, key_data.pathname, key_data.val], done);
        },

        save_ledger_data: function (log_time, hostname, journal_id, rest, done) {
            if (typeof log_time === 'object') {
                var h = log_time.toISOString().substr(0, 13);
            }
            else if (typeof log_time === 'number') {
                var h = (new Date(log_time)).toISOString().substr(0, 13);
            }
            else {
                var h = log_time.substr(0, 13);
            }

            run_query('save_ledger_data', [h, hostname, journal_id, rest], done);
        },

        acknowledge_stamp: function (journal_id, done) {
            run_query('acknowledge_stamp', [journal_id], done);
        },

        set_txid: function (journal_id, txid, done) {
            run_query('set_txid', [txid, journal_id], done);
        },

        search: function (options, done) {
            var query_name = '';
            var params = [];
            if (aggr === '') {
                if (options.pathname) {
                    query_name = 'search';
                    params = [options.hostname, options.pathname, options.date_from, options.date_to];
                }
                else {
                    query_name = 'search_all_pathnames';
                    params = [options.hostname, options.date_from, options.date_to];
                }
            }
            else if (aggr === 'hostname') {
                query_name = 'search_agg_hostname';
                params = [options.hostname, options.date_from, options.date_to];
            }
            else if (aggr === 'pstart') {
                query_name = 'search_agg_pstart';
                params = [options.date_from, options.date_to];
            }
            run_query(query_name, params, done);
        }
    };
};
