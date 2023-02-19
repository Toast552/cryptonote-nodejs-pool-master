// Load necessary modules
const fs = require('fs');
const cluster = require('cluster');
const os = require('os');

// Load configuration
require('./lib/configReader.js');

// Load log system
require('./lib/logger.js');

// Initialize log system
const logSystem = 'master';
require('./lib/exceptionWriter.js')(logSystem);

// Log pool information
log('info', logSystem, `Starting Cryptonote Node.JS pool version ${version}`);

// Check pool wallet address in configuration file
const poolAddress = config.poolServer.poolAddress;
if (!poolAddress || poolAddress.match(/(\s+|\*)/)) {
    log('error', logSystem, 'Invalid pool wallet address in configuration file (poolServer.poolAddress)');
    process.exit();
}

// Initialize redis database client
const redis = require('redis');
const redisDB = (config.redis.db && config.redis.db > 0) ? config.redis.db : 0;
global.redisClient = redis.createClient(config.redis.port, config.redis.host, {
    db: redisDB,
    auth_pass: config.redis.auth
});

// Load pool modules for worker processes
if (cluster.isWorker) {
    const workerType = process.env.workerType;

    switch (workerType) {
        case 'pool':
            require('./lib/pool.js');
            break;
        case 'daemon':
            require('./lib/daemon.js');
            break;
        case 'childDaemon':
            require('./lib/childDaemon.js');
            break;
        case 'blockUnlocker':
            require('./lib/blockUnlocker.js');
            break;
        case 'paymentProcessor':
            require('./lib/paymentProcessor.js');
            break;
        case 'api':
            require('./lib/api.js');
            break;
        case 'chartsDataCollector':
            require('./lib/chartsDataCollector.js');
            break;
        case 'telegramBot':
            require('./lib/telegramBot.js');
            break;
        default:
            break;
    }

    return;
}

// Log warning if developer donation is less than 0.2%
if (devFee < 0.2) {
    log('info', logSystem, 'Developer donation (devDonation) is set to %d%. Please consider raising it to 0.2% or higher!!!', [devFee]);
}

// Determine whether to run a single module
const singleModule = (() => {
    const validModules = ['pool', 'api', 'unlocker', 'payments', 'chartsDataCollector', 'telegramBot'];

    for (let i = 0; i < process.argv.length; i++) {
        if (process.argv[i].indexOf('-module=') === 0) {
            const moduleName = process.argv[i].split('=')[1];

            if (validModules.indexOf(moduleName) > -1) {
                return moduleName;
            }

            log('error', logSystem, 'Invalid module "%s", valid modules: %s', [moduleName, validModules.join(', ')]);
            process.exit();
        }
    }
})();

/**
 * Initialize and start modules
 */
const init = () => {
    checkRedisVersion(() => {
        if (singleModule) {
            log('info', logSystem, `Running in single module mode: ${singleModule}`);

            switch (singleModule) {
                case 'daemon':
                    spawnDaemon();
                    break;
                case 'pool':
                    spawnPoolWorkers();
                    break;
                case 'unlocker':
                    spawnBlockUnlocker();
                    break;
                case 'payments':
                    spawnPaymentProcessor();
                    break;
                case 'api':
                    spawnApi();
                    break;
                case '
