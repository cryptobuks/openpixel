const fs     = require('fs');
const path   = require('path');
const config = require('../get-config');
const logger = require('../shared/logger')(config.timestamper.logger);
const counters_storage = require('../counters-storage');

function exit(code) {
    logger.log(`Exiting with code ${code}`);
    process.exit(code);
}

var folder = process.argv[2];

if (!folder) {
    logger.error('Missing parameter(s). Usage example: $ node timestamper/refill_queue.js requests/2016/03/16T19');
    process.exit(2);
}

var abs_path = folder;
if (!path.isAbsolute(folder)) {
    abs_path = path.resolve(folder);
}

logger.log('Initializing counters storage');
counters_storage.init(function (err) {
    if (err) {
        logger.error('Could not initialize counters storage, err:', err);
        return exit(1);
    }
    logger.debug('Counters storage initialized');

    counters_storage.queue_clear_ok(function (err) {
        if (err) {
            logger.error('Error running queue_clear_ok, err:', err);
            return exit(1);
        }
        logger.log('Cleared rows with ok status from the queue');

        var files = fs.readdirSync(abs_path).map(f => path.join(abs_path, f));
        counters_storage.queue_insert_new(files, function (err) {
            if (err) {
                logger.error('Error running queue_insert_new, err:', err);
                return exit(1);
            }
            logger.log(`Inserted ${files.length} new rows in the queue.`);

            return exit(0);
        })
    });
});
