'use strict';
const express = require('express');
const router = express.Router();
const path = require('path');

module.exports = function (config, logger, render) {
    logger.log('Mounting index route');

    router.get('/', function (req, res) {
        render('index.ejs', { config: config }, function (err, html) {
            if (err) {
                return res.sendStatus(500);
            }
            res.send(html);
        });
    });

    return router;
}
