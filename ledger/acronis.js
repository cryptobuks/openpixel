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
            if (journal === null || journal === undefined || journal.id === null || journal.id === undefined) {
                debug_msg('Empty journal or journal.id in add()');
                return done();
            }
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
        }
    }
}
