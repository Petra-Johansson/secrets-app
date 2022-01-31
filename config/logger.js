const expressWinston = require('express-winston');
const winston = require('winston'); 
require('winston-mongodb').MongoDB;

const { createLogger, transports, format } = require('winston');


const logger = createLogger ({
    transports: [
        new transports.File({
            filename: 'info.log',
            level: 'info',
            //format: format.combine(format.timestamp(), format.simple())
            format: format.combine(format.timestamp(), format.json())
        }),
        new transports.MongoDB({
            level:'error',
            db: process.env.MONGODB,
            options: { useUnifiedTopology: true },
            collection: 'users',
            format: format.combine(format.timestamp(), format.json())
        })
    ]
    });

module.exports = logger;