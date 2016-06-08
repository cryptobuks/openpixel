'use strict';
/*
    In this ledger type no real journal is used.

    $ curl http://notarystorage.acronis.com/api/files/7e9d4a89f78c8a5c5b265661b0eb887142655411cc112da392fb9cefd9434475

    [
        {
            "hash": "7e9d4a89f78c8a5c5b265661b0eb887142655411cc112da392fb9cefd9434475",
            "object": {
                "key": "image.jpeg",
                "eTag": "3e658c2633e4b70e1337683b4c958ffb",
                "size": 2726993,
                "sequencer": "498"
            },
            "txid": "0xd70b3c0bc22c0f8f7d46740da5b66485b20ee0c35dfbf70e6429848b199c7be0",
            "contract": "0xe7fc3edecf57ede990c9b40444ab003f2be25dea",
            "sender": "23290181614a8591db234fec6bb2d963936a2691",
            "timestamp": 1464548050,
            "merkle_root": "7972ce1a82f72386a20cad062cc13b1ab5817996c9583caec004b634c28d6ddf  ",
            "merkle_proof": [
                "f3a1207e9d4a89f78c8a5c5b265661b0eb887142655411cc112da392fb9cefd9434475903e658c2633e4b70e1337683b4c958ffb"
            ]
        }
    ]
*/

const amqp = require('amqp');
const aws = require('aws-sdk');
const https = require('https');
const path = require('path');
const fs = require('fs');

module.exports = (options, debug_msg, on_error) => {
    var amqp_conn, amqp_queue;
    var bucket;
    var per_stamped_file, get_hostname;
    var files_sent_cnt = 0;

    return {
        open: function (done, _per_stamped_file, _get_hostname) {
            if (_per_stamped_file) {
                per_stamped_file = _per_stamped_file;
            }
            if (_get_hostname) {
                get_hostname = _get_hostname;
            }

            // configure AMQP first
            debug_msg('(AMQP) Connecting to host');
            var amqp_conn = amqp.createConnection({ url: options.amqp.url });
            amqp_conn.on('error', function (err) {
                on_error('(AMQP) Error', err);
            });

            amqp_conn.on('ready', function () {
                debug_msg('(AMQP) Ready');
                amqp_conn.queue(options.amqp.queue.name, { passive: true, durable: true }, function (q) { amqp_queue = q; });
                return done(null, { id: 0 });
            });

            // then AWS.S3
            aws.config.update(options.aws);
            options.s3.httpOptions = { agent: new https.Agent({ rejectUnauthorized: false }) }; // hack for testing
            bucket = new aws.S3(options.s3);
        },

        add: function (journal, log_file, counters_file, done) {
            debug_msg('Adding files ' + log_file + ', ' + counters_file + ' to journal ' + journal.id);

            function s3_keys(fname, type) {
                var prep = fname.split(path.sep);
                prep = prep.slice(prep.length - 1 - 3);
                var keys = {
                    Key: (new Buffer(type + '-' + prep.join('-'))).toString('base64'),
                    Body: fs.createReadStream(fname)
                };
                debug_msg('(S3) Key for fname ' + fname + ' = ' + keys.Key);
                return keys;
            }

            // log file
            var log_file_s3 = s3_keys(log_file, 'log');
            bucket.putObject(log_file_s3, function (err, log_file_etag_obj) {
                if (err) {
                    on_error('(S3) Error while putting log file to bucket: ', err);
                    return done(err);
                }
                if ( !(log_file_etag_obj && log_file_etag_obj.ETag) ) {
                    on_error('(S3) Empty ETage returned for log file');
                    return done(new Error('Empty ETage returned for log file'));
                }
                var log_file_etag = log_file_etag_obj.ETag.split('"').join('');
                debug_msg('(S3) ETag for log file: ' + log_file_etag);
                files_sent_cnt++;

                // counters file
                var counters_file_s3 = s3_keys(counters_file, 'cnt');
                bucket.putObject(counters_file_s3, function (err, counters_file_etag_obj) {
                    if (err) {
                        on_error('(S3) Error while putting counters file to bucket: ', err);
                        return done(err);
                    }
                    if ( !(counters_file_etag_obj && counters_file_etag_obj.ETag) ) {
                        on_error('(S3) Empty ETage returned for counters file');
                        return done(new Error('Empty ETage returned for counters file'));
                    }
                    var counters_file_etag = counters_file_etag_obj.ETag.split('"').join('');
                    debug_msg('(S3) ETag for counters file: ' + counters_file_etag);
                    files_sent_cnt++;

                    return done(null, {
                        log_file_s3_key: log_file_s3.Key,
                        log_file_etag: log_file_etag,
                        counters_file_s3_key: counters_file_s3.Key,
                        counters_file_etag: counters_file_etag
                    });
                });
            });;
        },

        stamp: function (journal, done) {
            debug_msg('Subscribe to the queue');

            amqp_queue.bind('#'); // Catch all messages
            amqp_queue.subscribe(function (message) {
                debug_msg('(AMQP) Message received: ' + JSON.stringify(message));
                var txid = message.txid;
                var key = message.object.key;
                var type = key.substr(0, 3);
                var pstart = key.substr(4, 13);
                var hostname = get_hostname( key.substr(4 + 14) );
                debug_msg('(AMQP) Message of type ' + type + ' for hostname ' + hostname);
                if (type === 'log') {
                    per_stamped_file(pstart, hostname, txid, function (err) {
                        files_sent_cnt--;
                        if (err) {
                            return debug_msg('Stamped file ' + hostname + ' - error: ' + err);
                        }
                        else {
                            return debug_msg('Stamped file ' + hostname + ' - OK');
                        }
                    });
                }
                else {
                    files_sent_cnt--;
                }
            });
            done();
        },

        get_txid: function (journal, done) {
            debug_msg('Wait till all files are processed');
            var ii;
            var t = 0;
            function check() {
                t += 1;
                if (files_sent_cnt === 0) {
                    debug_msg(`All files processed`);
                    clearInterval(ii);
                    return done();
                }

                if (options.txid_max_checks == null || t <= options.txid_max_checks) {
                    debug_msg(`Files not processed yet (${files_sent_cnt} left), will check again in ${options.txid_check_interval/1000} sec.`);
                }
                else {
                    debug_msg(`Files not processed yet (${files_sent_cnt} left), but max checks (${options.txid_max_checks}) exceeded (${t}), will stop`);
                    clearInterval(ii);
                    return done('Max txid checks exceeded', null);
                }
            }

            check();
            ii = setInterval(check, options.txid_check_interval);
        },

        download: function (what, journal_id, rest, done) {
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

                debug_msg('Returning stream in callback');
                return done(null, fstream);
            });
        }
    }
};
