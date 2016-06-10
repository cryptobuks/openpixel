'use strict';

module.exports = (options, debug_msg, on_error) => {
    const api = require('./acronis-api')(options, debug_msg, on_error);
    const journal_type = 'blockchain_merkletree';

    return {
        open: function (done) {
            debug_msg('Creating new journal');
            var journal_name = 'Pixel data stamping at ' + (new Date).toISOString();
            api.create_journal(journal_name, journal_type, function (err, journal) {
                return done(err, journal);
            });
        },

        add: function (journal, log_file, counters_file, done) {
            debug_msg('Adding files ' + log_file + ', ' + counters_file + ' to journal ' + journal.id);
            api.create_record((err, record) => {
                if (err) return done(err);

                var fp = {
                    upload_timestamp: (new Date).toISOString(),
                    log_file: log_file,
                    counters_file: counters_file
                };

                api.add_fingerprint(fp, record, (err) => {
                    if (err) return done(err);
                    api.add_file(log_file, record, (err, file1) => {
                        if (err) return done(err);
                        api.add_file(counters_file, record, (err, file2) => {
                            if (err) return done(err);
                            api.commit_record(journal, record, (err) => {
                                if (err) return done(err);

                                var rest = {
                                    record_id: record.id,
                                    log_file_id: JSON.parse(file1).id,
                                    counters_file_id: JSON.parse(file2).id
                                };
                                debug_msg('Rest value to be returned: ' + JSON.stringify(rest));
                                return done(null, rest);
                            });
                        });
                    });
                });
            });
        },

        stamp: function (journal, done) {
            api.timestamp_journal(journal, (err) => {
                done(err);
            });
        },

        get_txid: function (journal, done) {
            var ii;

            var t = 0;
            function check() {
                t += 1;
                //api.show_journal(journal, function (err, full_journal) {
                var query = `
                    query {
                        user {
                            email
                            journal(id: "${journal.id}") {
                                id
                                name
                                timestamps(limit: 1) {
                                    txid
                                }
                            }
                        }
                    }
                `;
                api.gql_query(query, function (err, body) {
                    if (err) {
                        return done(err);
                    }
                    debug_msg('Got body = ' + body + ' of type ' + typeof body);
                    if (typeof body === 'string') {
                        body = JSON.parse(body);
                    }

                    if (!body.user || ! body.user.journal) {
                        return done('Unexpected resopnse: either user or user.jounral sections are missing', null);
                    }

                    var full_journal = body.user.journal[0];
                    debug_msg('Got journal = ' + JSON.stringify(journal));

                    if (full_journal.timestamps && full_journal.timestamps[0] && full_journal.timestamps[0].txid) {
                        debug_msg(`Got txid = ${full_journal.timestamps[0].txid}`);
                        clearInterval(ii);
                        return done(null, full_journal.timestamps[0].txid);
                    }

                    if (options.txid_max_checks == null || t <= options.txid_max_checks) {
                        debug_msg(`No txid yet, will check again in ${options.txid_check_interval/1000} sec.`);
                    }
                    else {
                        debug_msg(`No txid yet, but max checks (${options.txid_max_checks}) exceeded (${t}), will stop`);
                        clearInterval(ii);
                        return done('Max txid checks exceeded', null);
                    }
                });
            }

            check();
            ii = setInterval(check, options.txid_check_interval);
        },

        download: function (what, journal_id, rest, done) {
            /*
            const fs = require('fs');
            var readStream = fs.createReadStream('/Users/itsbeta/projs/super-pixel-2/processed/test.txt');
            done(null, readStream);
            */
            debug_msg(`Downloading file ${what} from journal_id = ${journal_id}, rest = ${JSON.stringify(rest)}`);
            var record = { id: rest.record_id };
            var file_id = '';
            if (what === 'log_file') {
                file_id = rest.log_file_id;
            }
            else if (what === 'counters_file') {
                file_id = rest.counters_file_id;
            }
            api.download_file(record, file_id, function (err, fstream) {
                if (err) {
                    return done(err);
                }

                var headers = {
                    'Content-Type': fstream.headers['content-type'],
                    'Content-Disposition': fstream.headers['content-disposition'].replace('attchment', 'attachment')
                };
                debug_msg('Returning stream in callback');
                return done(null, fstream, headers);
            });
        },

        set_tx_urls: function (array, txid_field, url_field, done) {
            for (var i = 0; i < array.length; i++) {
                array[i][url_field] = `https://www.blocktrail.com/BTC/tx/${array[i][txid_field]}`;
            }
            done(array);
        }
    }
}
