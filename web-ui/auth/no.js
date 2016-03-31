'use strict';
const auth = require('basic-auth');

module.exports = function (options) {
    return function (req, res, done) {
        return done(null, { name: 'Anonymous' });
    };
};
