'use strict';
const config = require('../get-config');
const logger = require('../shared/logger')(config.web_ui.logger);

const express = require('express');
const app = express();
const parser = require('body-parser');
const path = require('path');

const auth = require(`./auth/${config.web_ui.auth.type}`)(config.web_ui.auth.options);
const counters = require('../counters-storage');
const ledger = require('../ledger');
const render = require('./render')(logger, path.join(__dirname, './views'));

function authenticate(req, res, next) {
    auth(req, res, function (err, user) {
        if (err) {
            logger.error('Authentication failed, reason: ' + err);
            return res.sendStatus(401);
        }
        logger.log('User ' + user.name + ' authenticated');
        return next();
    });
}

app.set('x-powered-by', false); // remove the stupid header

app.use('/static', express.static(path.join(__dirname, '/static'), { dotfiles: 'ignore' }));

// POST body parsers
app.use(parser.json());
app.use(parser.urlencoded({ extended: true }));

app.use(`${config.web_ui.base_path}/`, authenticate, require('./routes/index')(config, logger, render));
app.use(`${config.web_ui.base_path}/counters`, authenticate, require('./routes/counters')(config, logger, render, counters, ledger));
app.use(`${config.web_ui.base_path}/ledger`, authenticate, require('./routes/ledger')(config, logger, render, counters, ledger));
app.use(`${config.web_ui.base_path}/merkle-tree`, authenticate, require('./routes/merkle-tree')(config, logger, render, counters, ledger));

logger.log('Initializing counters storage');
counters.init((err) => {
    if (err) {
        logger.error('Could not initialize counters storage, err:', err);
        throw err;
    }
    logger.debug('Counters storage initialized');

    app.listen(config.web_ui.port, () => {
        logger.log(`Web-ui listening on port ${config.web_ui.port}`);
    });
});
