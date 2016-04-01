'use strict';
const express = require('express');
const router = express.Router();
const path = require('path');
const parser = require('body-parser');

module.exports = function (config, logger, counters, ledger) {
    logger.log('Mounting counters route');
    const render = require('../render')(logger, path.join(__dirname, '../views'));

    router.get('/counters', function (req, res) {
        render('counters.ejs', { config: config }, function (err, html) {
            if (err) {
                return res.sendStatus(500);
            }
            res.send(html);
        });
    });

    router.post('/counters/count', function (req, res) {
        logger.debug('Count counters request: ' + JSON.stringify(req.body));
        counters.search_count(req.body, function (err, rows) {
            if (err) {
                logger.error('Could not process count counters request ' + JSON.stringify(req.body) + ', err:', err);
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

    router.post('/counters', function (req, res) {
        logger.debug('Search counters request: ' + JSON.stringify(req.body));
        req.body._page_size = config.web_ui.page_size;
        counters.search(req.body, function (err, rows) {
            if (err) {
                logger.error('Could not process search counters request ' + JSON.stringify(req.body) + ', err:', err);
                return res.sendStatus(500);
            }
            res.json({ results: rows });
        });
    });

    return router;
};
