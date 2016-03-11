'use strict';
const zlib = require('zlib');
const readline = require('readline');
const fs = require('fs');

const OS = require('os');
const stream = require('stream');

module.exports = {
    read_by_line: function (fname, on_error, each_line, done) {
        var reader = readline.createInterface({
            input: fs.createReadStream(fname).pipe(zlib.createGunzip())
        });

        reader.on('error', on_error);
        reader.on('line',  each_line);
        reader.on('close', done);
    },

    write_by_line: function (fname, line, done) {
        var f = fs.createWriteStream(fname, { flags: 'a' });
        f.on('close', done);

        var rs = new stream.Readable();
        rs.pipe(zlib.createGzip()).pipe(f);

        rs.push(`${line}${OS.EOL}`);
        rs.push(null);
    },

    write: function (fname, data, done) {
        var f = fs.createWriteStream(fname, { flags: 'w' });
        f.on('close', done);

        var rs = new stream.Readable();
        rs.pipe(zlib.createGzip()).pipe(f);

        rs.push(`${data}${OS.EOL}`);
        rs.push(null);
    }
}
