'use strict';
module.exports = function (ext) {
    return require(`./read-${ext}`);
}
