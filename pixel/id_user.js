'use strict';
const config = require('../get-config');
const logger = require('../shared/logger')(config.pixel.logger);
const utils = require('../shared/utils');
const Cookies = require('cookies');
const cookie_options = {
    maxAge:    100*365*24*60*60*1000,
    expires:   new Date( +(new Date) + 100*365*24*60*60*1000),
    signed:    true,
    overwrite: true
};

function get_z(z_cookie) {
    if (!z_cookie) {
        return null;
    }

    var z_str = utils.decrypt_str(z_cookie, config.pixel.cookies.algorithm, config.pixel.cookies.password);

    if (z_str.err) {
        logger.error('Exception occured decrypting cookie:', z_str.err);
        return null;
    }
    if (!z_str.result || !utils.is_alphanum(z_str.result, config.pixel.id_length)) {
        return null;
    }

    return {
        user_id: z_str.result
    };
}

function set_z(z_json) {
    if (!z_json) {
        return null;
    }
    var z_str = z_json.user_id;
    var z_cookie = utils.encrypt_str(z_str, config.pixel.cookies.algorithm, config.pixel.cookies.password);
    if (z_cookie.err) {
        logger.error('Exception occured encrypting cookie:', z_cookie.result);
        return null;
    }

    return z_cookie.result;
}

module.exports = function (req, res) {
    var user_info = {};
    var cookies = new Cookies(req, res, { 'keys': config.pixel.cookies.sign_keys });
    var z_cookie = cookies.get('z', { signed: true });
    var z_json = get_z(z_cookie);

    if (z_cookie && z_json && z_json.user_id) {
        logger.debug('Recurring user, user_id = ' + z_json.user_id);
        user_info.is_new = false;
    }
    else {
        var z_json = {
            user_id: utils.rnd_alphanum(config.pixel.id_length)
        };
        logger.debug('New user, seting user_id = ' + z_json.user_id);
        user_info.is_new = true;
    }
    user_info.user_id = z_json.user_id;

    if (user_info.is_new) {
        z_cookie = set_z(z_json);
        cookies.set('z', z_cookie, cookie_options);
    }

    return user_info;
}
