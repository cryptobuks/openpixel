'use strict';
const basic_auth = require('basic-auth');

module.exports = function (options) {
    function res401(res) {
        res.setHeader('WWW-Authenticate', 'Basic realm="${options.realm}"');
    }

    return function (req, res, done) {
        var credentials = basic_auth(req);
        console.log(credentials);
        var ret = {};
        if (!credentials) {
            res401(res);
            return done('Missing credentials');
        }

        for (let i = options.users.length - 1; i >= 0; i--) {
            if (options.users[i].name.trim().toLowerCase() === credentials.name.trim().toLowerCase()) {
                if (options.users[i].pass === credentials.pass) {
                    return done(null, { name: options.users[i].name });
                }
                else {
                    res401(res);
                    return done('Incorrect password for user ' + credentials.name);
                }
            }
        }

        res401(res);
        return done('User ' + credentials.name + ' not found');
    };
};
