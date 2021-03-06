'use strict';
const express = require('express');
const router = express.Router();
const path = require('path');
const parser = require('body-parser');

module.exports = function (config, logger, render, counters, ledger) {
    logger.log('Mounting ledger route');

    router.get('/', function (req, res) {
        render('ledger.ejs', { config: config }, function (err, html) {
            if (err) {
                return res.sendStatus(500);
            }
            res.send(html);
        });
    });

    router.post('/count', function (req, res) {
        logger.debug('Count ledger request: ' + JSON.stringify(req.body));
        counters.search_ledger_count(req.body, function (err, rows) {
            if (err) {
                logger.error('Could not process count ledger request ' + JSON.stringify(req.body) + ', err:', err);
                if (err === 'Empty WHERE statement in query') {
                    return res.sendStatus(400);
                }
                else {
                    return res.sendStatus(500);
                }
            }
            res.json({ results: rows });
        });
    });

    router.post('/', function (req, res) {
        logger.debug('Search ledger request: ' + JSON.stringify(req.body));
        req.body._page_size = config.web_ui.page_size;
        counters.search_ledger(req.body, function (err, rows) {
            if (err) {
                logger.error('Could not process search ledger request ' + JSON.stringify(req.body) + ', err:', err);
                return res.sendStatus(500);
            }
            ledger.set_tx_urls(rows, 'txid', 'txid_url', function (updated_rows) {
                res.json({ results: updated_rows });
            });
        });
    });

    router.get('/dlf', function (req, res) {
        if (!req.query.id) {
            logger.error('Trying to download log file without id. Other headers: ' + JSON.stringify(req.headers));
            return res.sendStatus(400);
        }
        logger.debug('Downloading log file for id = ' + req.query.id);
        counters.get_ledger_data_by_id(req.query.id, function (err, rows) {
            if (err) {
                logger.error('Could not get ledger data for id = ' + req.query.id + ', err:', err);
                return ( err === 'Invalid id' ? res.sendStatus(400) : res.sendStatus(500) );
            }

            var ledger_data = rows[0];
            logger.debug('Returned ledger_data = ' + JSON.stringify(ledger_data));
            ledger.download('log_file', ledger_data.journal_id, ledger_data.rest, function (err, fstream, headers) {
                if (err) {
                    logger.error('Could not get log download stream for id = ' + req.query.id + ', err:', err);
                    return res.sendStatus(500);
                }

                if (headers) {
                    for (var h in headers) {
                        logger.debug(`Applying header ${h}: ${headers[h]}`);
                        res.setHeader(h, headers[h]);
                    }
                }

                fstream.pipe(res);
                logger.debug('Streaming');
            });
        });
    });

    router.get('/dcf', function (req, res) {
        if (!req.query.id) {
            logger.error('Trying to download counters file without id. Other headers: ' + JSON.stringify(req.headers));
            return res.sendStatus(400);
        }
        logger.debug('Downloading counters file for id = ' + req.query.id);
        counters.get_ledger_data_by_id(req.query.id, function (err, rows) {
            if (err) {
                logger.error('Could not get ledger data for id = ' + req.query.id + ', err:', err);
                return ( err === 'Invalid id' ? res.sendStatus(400) : res.sendStatus(500) );
            }

            var ledger_data = rows[0];
            logger.debug('Returned ledger_data = ' + JSON.stringify(ledger_data));
            ledger.download('counters_file', ledger_data.journal_id, ledger_data.rest, function (err, fstream, headers) {
                if (err) {
                    logger.error('Could not get download counters stream for id = ' + req.query.id + ', err:', err);
                    return res.sendStatus(500);
                }

                if (headers) {
                    for (var h in headers) {
                        logger.debug(`Applying header ${h}: ${headers[h]}`);
                        res.setHeader(h, headers[h]);
                    }
                }

                fstream.pipe(res);
                logger.debug('Streaming');
            });
        });
    });

    return router;
};
