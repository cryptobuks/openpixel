'use strict';
const express = require('express');
const router = express.Router();
const path = require('path');

module.exports = function (config, logger, render, counters, ledger) {
    logger.log('Mounting merkle-tree route');

    router.get('/', function (req, res) {
        render('merkle-tree.ejs', { config: config }, function (err, html) {
            if (err) {
                return res.sendStatus(500);
            }
            res.send(html);
        });
    });

    router.post('/', function (req, res) {
        logger.debug('merkle-tree request: ' + JSON.stringify(req.body));
        res.json({});
    });

    return router;
};
