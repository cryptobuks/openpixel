'use strict';
const express = require('express');
const router = express.Router();
const path = require('path');

module.exports = function (config, logger, render, counters, ledger) {
    logger.log('Mounting usage route');

    router.get('/', function (req, res) {
        var usage_data = {};
        render('usage.ejs', { config: config, usage_data: usage_data }, function (err, html) {
            if (err) {
                return res.sendStatus(500);
            }
            res.send(html);
        });
    });

    router.post('/counters', function (req, res) {
        logger.debug('Counters usage request: ' + JSON.stringify(req.body));

        counters.get_usage_stat(req.body, function (err, us) {
            if (err) {
                logger.error('Could not process search ledger request ' + JSON.stringify(req.body) + ', err:', err);
                return res.sendStatus(500);
            }
            res.json({ results: us.counters });
        });
    });

    return router;
}
