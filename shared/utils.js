'use strict';
const url = require('fast-url-parser');
const punycode = require('punycode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const alphanum_chars = ('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789').split('');
const hostname_check = /^(?:[a-z0-9][\w\-]*[a-z0-9]*\.)*(?:(?:(?:[a-z0-9][\w\-]*[a-z0-9]*)(?:\.[a-z0-9]+)?)|(?:(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)))$/;

function rm_duplicates(a) {
    var r = []; // resulting array of uniques

    for (let i = 0; i < a.length; i++) {
        if (r.indexOf(a[i]) === -1) {
            r.push(a[i]);
        }
    }

    return r;
}

function get_ch_folder(time) {
    time = (time || new Date).toISOString();
    return time.substr(0,13).split('-').join('/');
}

function get_ph_folder(time) {
    time = time || new Date;
    time = new Date(time.setHours(time.getHours() - 1));
    return get_ch_folder(time);
}

function get_nh_folder(time) {
    time = time || new Date;
    time = new Date(time.setHours(time.getHours() + 1));
    return get_ch_folder(time);
}

function get_hostname_pathname(full_url) {
    var ret = {
        original_url: full_url,
        err: null,
        hostname: '',
        pathname: ''
    };

    if (!full_url) {
        ret.err = 'Empty full_url';
        return ret;
    }

    try {
        var parsed_url = url.parse(full_url);

        var hostname = parsed_url.hostname || '';
        var pathname = (parsed_url.pathname || '').toLowerCase();

        if (!hostname_check.test(hostname)) {
            ret.err = 'Invalid hostname';
            return ret;
        }

        if (hostname.substr(0, 4) === 'xn--' || hostname.indexOf('.xn--') > 0) {
            hostname = punycode.toUnicode(hostname);
        }

        if (pathname.indexOf('%') >= 0) {
            pathname = decodeURIComponent(pathname);
        }

        ret.hostname = hostname;
        ret.pathname = pathname;
        return ret;
    }
    catch (e) {
        ret.err = e;
        return ret;
    }
}

function merge(cust, def) {
    var out = {};
    var keys = rm_duplicates(Object.keys(def).concat(Object.keys(cust)));

    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var td = typeof def[k];
        var tc = typeof cust[k];

        if (td === 'undefined') {
            if (tc === 'undefined') {
                // this should never happen
            }
            else {
                out[k] = cust[k];
            }
        }
        else {
            if (td !== 'object' || def[k] === null) {
                if (cust[k] !== undefined) {
                    out[k] = cust[k];
                }
                else {
                    out[k] = def[k];
                }
            }
            else {
                if (tc !== 'undefined' && tc !== 'object' || cust[k] === null) {
                    out[k] = cust[k];
                }
                else {
                    out[k] = merge((cust[k] !== undefined ? cust[k] : {}), def[k]);
                }
            }
        }
    }
    return out;
}

function rnd_alphanum(str_length) {
    str_length = str_length || 6;
    var str = '';
    for (let i = 0; i < str_length; i++) {
        str += alphanum_chars[Math.floor(Math.random() * alphanum_chars.length)];
    }
    return str;
}

function is_alphanum(str, str_length) {
    if (str_length && str.length !== str_length) {
        return false;
    }

    for (let i = str.length - 1; i >= 0; i--) {
        if (alphanum_chars.indexOf(str[i]) < 0) {
            return false;
        }
    }
    return true;
}

function async_for_each(array, for_each, done) {
    var i = 0;
    if (array.length === 0) {
        return done();
    }

    function next(err) {
        if (err) {
            return done(err);
        }

        if (i === array.length - 1) {
            return done();
        }

        i += 1;
        for_each(array[i], next);
    }

    for_each(array[0], next);
}

function encrypt_str(str, alg, pass) {
    try {
        if (alg === 'xor') {
            return xor_encrypt(str, pass);
        }
        var cipher = crypto.createCipher(alg, pass);
        cipher.update(str, 'utf-8', 'hex');
        return { err: null, result: cipher.final('hex') };
    }
    catch (e) {
        return { err: e, result: null };
    }
}

function decrypt_str(crypt, alg, pass) {
    try {
        if (alg === 'xor') {
            return xor_decrypt(crypt, pass);
        }
        var decipher = crypto.createDecipher(alg, pass);
        decipher.update(crypt, 'hex', 'utf-8');
        return { err: null, result: decipher.final('utf-8') };
    }
    catch (e) {
        return { err: e, result: null };
    }
}

function xor_encrypt(str, pass) {
    if (typeof str !== 'string' || str === '' || typeof pass !== 'string' || pass === '') {
        return { err: 'Wrong args', result: null };
    }

    var strb = new Buffer(str, 'utf8');
    var passb = new Buffer(pass, 'utf8');
    var result = new Buffer(strb.length);

    for (var i = strb.length; i >= 0; i--) {
        result[i] = strb[i] ^ passb[i%passb.length];
    }
    return { err: null, result: result.toString('hex') };
}

function xor_decrypt(crypt, pass) {
    if (typeof crypt !== 'string' || crypt === '' || typeof pass !== 'string' || pass === '') {
        return { err: 'Wrong args', result: null };
    }

    var cryptb = new Buffer(crypt, 'hex');
    var passb = new Buffer(pass, 'utf8');
    var result = new Buffer(cryptb.length);

    for (var i = cryptb.length; i >= 0; i--) {
        result[i] = cryptb[i] ^ passb[i%passb.length];
    }
    return { err: null, result: result.toString('utf8') };
}

function fexists(fname, mode) {
    try {
        fs.accessSync(fname, mode);
        return true;
    }
    catch (e) {
        return false;
    }
}

function mkdirp(p, callback) {
    fs.mkdir(p, function (err) {
        if (!err) return callback(null);

        // already exists
        if (err.code === 'EEXIST') return callback(null);

        if (err.code === 'ENOENT') {
            return mkdirp(path.resolve(p, '..'), function (err) {
                if (!err) return mkdirp(p, callback);
                return callback(err);
            });
        }

        return callback(err);
    });
}

function mkdirpSync(p) {
    try {
        fs.mkdirSync(p);
        return null;
    }
    catch (err) {
        // already exists
        if (err.code === 'EEXIST') return null;

        if (err.code === 'ENOENT') {
            var err2 = mkdirpSync(path.resolve(p, '..'));
            if (!err2) mkdirpSync(p);
            return err2;
        }
        return err;
    }
}

function hrt2sec(hr, p) {
    p = (p == null ? 1 : p);

    var r = hr[0];
    var h = Math.floor(hr[0]/(60*60));
    r = r - 60*60*h;
    var m = Math.floor(r/60);
    r = r - 60*m;

    var str = '';
    if (h > 0) {
        str += h + ' hr. ';
    }
    if (m > 0) {
        str += m + ' min. ';
    }
    str += (r + hr[1]/1e9).toFixed(p) + ' sec.';
    return str;
}

module.exports = {
    rm_duplicates:         rm_duplicates,
    merge:                 merge,
    get_hostname_pathname: get_hostname_pathname,
    rnd_alphanum:          rnd_alphanum,
    is_alphanum:           is_alphanum,
    async_for_each:        async_for_each,
    encrypt_str:           encrypt_str,
    decrypt_str:           decrypt_str,
    fexists:               fexists,
    mkdirp:                mkdirp,
    mkdirpSync:            mkdirpSync,
    get_ch_folder:         get_ch_folder,
    get_nh_folder:         get_nh_folder,
    get_ph_folder:         get_ph_folder,
    hrt2sec:               hrt2sec
};
