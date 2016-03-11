'use strict';

function console_log(msg_level, name, str, obj) {
    var letter = '';
    switch (msg_level) {
        case 0: letter = 'D'; break;
        case 1: letter = 'I'; break;
        case 2: letter = 'E'; break;
    }

    var prefix = (new Date).toISOString() + (name ? ' [' + name + ']' : '') + (letter ? ' ' + letter : '') + ':';

    if (msg_level == 2 || msg_level == 3) {
        if (obj !== undefined) {
            console.error(prefix, str, obj);
            console.log(prefix, str, obj);
        }
        else {
            console.error(prefix, str);
            console.log(prefix, str);
        }
    }
    else {
        if (obj !== undefined) {
            console.log(prefix, str, obj);
        }
        else {
            console.log(prefix, str);
        }
    }
}

function init_console_log(msg_level, options) {
    return function (str, obj) {
        return console_log(msg_level, options.name, str, obj);
    };
}

var levels = ['debug', 'log', 'error'];

module.exports = function (options) {
    var level = options.level || 0;
    if (typeof level === 'string') {
        level = levels.indexOf(level.toLowerCase());
    }

    var logger = {};

    for (var i = levels.length - 1; i >= 0; i -= 1) {
        logger[levels[i]] = level > i ? function () {} : init_console_log(i, options);
    }

    return logger;
}

