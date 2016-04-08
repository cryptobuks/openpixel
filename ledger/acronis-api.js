'use strict';
const crypto = require('crypto');

module.exports = function (options, debug_msg, on_error) {
    const req = require('../shared/make-request')(options, debug_msg, on_error);

    function gql_query(query, callback) {
        debug_msg(`(gql_query) Running query in graphQL ${query}`);
        req.send('/graphql', { method: 'POST', data: query, headers: {'content-type': 'application/graphql' } }, (err, body) => {
            if (err) {
                on_error('(gql_query) Request error:', err);
                return callback(err, null);
            }
            debug_msg('(gql_query) Request completed');
            return callback(null, body);
        });
    }

    function create_journal(name, type, callback) {
        debug_msg(`(create_journal) New journal name = ${name}, type = ${type}`);
        var json = {
            name: name,
            type: type
        };
        req.send('/journals', { method: 'POST', json: json }, (err, journal) => {
            if (err) {
                on_error('(create_journal) Request error:', err);
                return callback(err, {});
            }
            debug_msg(`(create_journal) Request completed: ${JSON.stringify(journal)}`);
            return callback(null, journal);
        });
    }

    function show_journal(journal, callback) {
        debug_msg(`(show_journal) Show journal id = ${journal.id}`);
        req.send(`/journals/${journal.id}`, {}, (err, journal) => {
            if (err) {
                on_error('(show_journal) Request error:', err);
                return callback(err, {});
            }
            debug_msg(`(show_journal) Request completed: ${JSON.stringify(journal)}`);
            return callback(null, journal);
        });
    }

    function create_record(callback) {
        debug_msg('(create_record) New record');
        req.send('/records', { method: 'POST', json: {} }, (err, record) => {
            if (err) {
                on_error('(create_record) Request error:', err);
                return callback(err, {});
            }
            debug_msg(`(create_record) Request completed: ${JSON.stringify(record)}`);
            return callback(err, record);
        });
    }

    function add_fingerprint(fp, record, callback) {
        var md = JSON.stringify(fp);
        debug_msg(`(add_fingerprint) Trying to add fingerprint: ${md}`);
        var json = {
            metadata: new Buffer(md).toString('base64'),
            metadataContentType: 'application/json;enc=v1',
            metadataHash: crypto.createHash('sha256').update(md).digest('base64'),
            nonce: new Buffer(Math.random().toString()).toString('base64')
        };
        req.send(`/records/${record.id}/fingerprints`, { method: 'POST', json: json, ok_code: 204 }, (err, body) => {
            if (err) {
                on_error('(add_fingerprints) Request error:', err);
                return callback(err, {});
            }
            debug_msg('(add_fingerprint) Request completed');
            return callback(err, body);
        });
    }

    function add_file(file, record, callback) {
        debug_msg(`(add_file) Trying to add file: ${file}`);
        req.send(`/records/${record.id}/files`, { method: 'POST', file: file }, (err, body) => {
            if (err) {
                on_error('(add_file) Request error:', err);
                return callback(err, {});
            }
            debug_msg('(add_file) Request completed');
            return callback(err, body);
        });
    }

    function download_file(record, file_id, callback) {
        debug_msg(`(download_file) Trying to download from record ${record.id} the file ${file_id}`);
        req.send(`/records/${record.id}/files/${file_id}/download`, { method: 'GET', fstream: true }, (err, fstream) => {
            if (err) {
                on_error('(download_file) Request error:', err);
                return callback(err, null);
            }
            if (!fstream.statusCode.toString().startsWith('2')) {
                on_error('(download_file) Response code is not 2xx:', fstream.statusCode);
                return callback(fstream.statusCode, null);
            }

            debug_msg('(download_file) Request completed, streaming ' + JSON.stringify(fstream));
            return callback(err, fstream);
        });
    }

    function commit_record(journal, record, callback) {
        debug_msg(`(commit_record) Trying to commit record ${record.id} to journal ${journal.id}`);
        req.send(`/journals/${journal.id}/commit/${record.id}`, { method: 'POST', json: {}, ok_code: 204 }, (err, body) => {
            if (err) {
                on_error('(commit_record) Request error:', err);
                return callback(err, {});
            }
            debug_msg('(commit_record) Request completed');
            return callback(err, body);
        });
    }

    function timestamp_journal(journal, callback) {
        debug_msg(`(timestamp_journal) Trying to timestamp journal ${journal.id}`);
        req.send(`/journals/${journal.id}/timestamp`, { method: 'POST', json: {}, ok_code: 204 }, (err, body) => {
            if (err) {
                on_error('(timestamp_journal) Request error:', err);
                return callback(err, {});
            }
            debug_msg('(timestamp_journal) Request completed');
            return callback(err, body);
        });
    }

    return {
        create_journal:    create_journal,
        show_journal:      show_journal,
        create_record:     create_record,
        add_fingerprint:   add_fingerprint,
        add_file:          add_file,
        download_file:     download_file,
        commit_record:     commit_record,
        timestamp_journal: timestamp_journal,
        gql_query:         gql_query
    };
}
