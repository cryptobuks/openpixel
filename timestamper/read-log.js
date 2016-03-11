'use strict';
const lblr = require('line-by-line');
const fs = require('fs');
const OS = require('os');

module.exports = {
    read_by_line: function (fname, on_error, each_line, done) {
        var reader = new lblr(fname);
        reader.on('error', on_error);
        reader.on('line',  each_line);
        reader.on('end',   done);
    },

    write_by_line: function (fname, line, done) {
        fs.appendFile(fname, `${line}${OS.EOL}`, done);
    },

    write: function (fname, data, done) {
        fs.writeFile(fname, `${data}${OS.EOL}`, done);
    }
}
