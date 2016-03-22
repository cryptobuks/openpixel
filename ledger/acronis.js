'use strict';

module.exports = (options, debug_msg, on_error) => {
    const api = require('./acronis-api')(options, debug_msg, on_error);
    const journal_type = 'blockchain_merkletree';
    var ts_journals = null; // list of journals for timestamper

    function get_ts_journals(done) {
        if (ts_journals) {
            return done(null, ts_journals);
        }
        var q = `
            query UserJournals {
                user {
                    email
                    journal(name: "") {
                        id
                        name
                        type
                    }
                }
            }
        `;
        api.gql_query(q, (err, result) => {
            if (err) {
                return done(err, []);
            }
            ts_journals = ((JSON.parse(result) || { user: { journal: [] } }).user || { journal: [] }).journal;
            return done(null, ts_journals);
        });
    }

    function add_to_journal(journal, register_file, counters_file, done) {
        api.create_record((err, record) => {
            if (err) return done(err);

            var fp = {
                upload_timestamp: (new Date).toISOString(),
                register_file: register_file,
                counters_file: counters_file
            };

            api.add_fingerprint(fp, record, (err) => {
                if (err) return done(err);
                api.add_file(register_file, record, (err) => {
                    if (err) return done(err);
                    api.add_file(counters_file, record, (err) => {
                        if (err) return done(err);
                        api.commit_record(journal, record, (err) => {
                            if (err) return done(err);
                            api.timestamp_journal(journal, (err) => {
                                done(err);
                            });
                        });
                    });
                });
            });
        });
    }

    return {
        stamp: function (journal_name, register_file, counters_file, done) {
            return done();
            get_ts_journals(function (err, journals) {
                if (err) {
                    return done(err);
                }

                var journal = null;
                for (let i = journals.length - 1; i >= 0; i--) {
                    if (journals[i].name === journal_name && journals[i].type === journal_type) {
                        journal = journals[i];
                        break;
                    }
                }

                if (journal) {
                    debug_msg('Using existing journal.id = ' + journal.id);
                    add_to_journal(journal, register_file, counters_file, done);
                }
                else {
                    debug_msg('Creating new journal');
                    api.create_journal(journal_name, journal_type, function (err, journal) {
                        if (err) {
                            return done(err);
                        }
                        journals.push(journal);
                        add_to_journal(journal, register_file, counters_file, done);
                    });
                }
            });
        }
    }
}
