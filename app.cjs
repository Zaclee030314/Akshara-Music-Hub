const fs = require('fs');
const path = require('path');

function log(msg) {
    fs.appendFileSync(path.join(__dirname, 'cpanel_crash_log.txt'), msg + '\n');
}

const origLog = console.log;
const origErr = console.error;
console.log = (...args) => {
    origLog(...args);
    try { log(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')); } catch (e) {}
};
console.error = (...args) => {
    origErr(...args);
    try { log('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')); } catch (e) {}
};

async function start() {
    log('\n=== SERVER BOOT ' + new Date().toISOString() + ' ===');
    log('__dirname: ' + __dirname);
    log('cwd: ' + process.cwd());
    log('NODE_PATH: ' + (process.env.NODE_PATH || '(not set)'));

    // 1. Set the engine path env var FIRST (most reliable method)
    const engineFile = path.join(__dirname, 'dist-server', 'prisma-fix', '.prisma', 'client', 'libquery_engine-debian-openssl-3.0.x.so.node');
    const engineFileAlt = path.join(__dirname, 'dist-server', 'libquery_engine-debian-openssl-3.0.x.so.node');
    
    if (fs.existsSync(engineFile)) {
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = engineFile;
        log('ENGINE SET (prisma-fix): ' + engineFile);
    } else if (fs.existsSync(engineFileAlt)) {
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = engineFileAlt;
        log('ENGINE SET (alt): ' + engineFileAlt);
    } else {
        log('WARNING: No engine file found at either location!');
        log('  Checked: ' + engineFile);
        log('  Checked: ' + engineFileAlt);
        // List dist-server contents for debugging
        try {
            const files = fs.readdirSync(path.join(__dirname, 'dist-server'));
            log('  dist-server contents: ' + files.join(', '));
        } catch(e) {
            log('  Cannot read dist-server: ' + e.message);
        }
    }

    // 2. Copy the full Prisma client to the nodevenv location
    const nodevenvBase = '/home/aksharal/nodevenv/backend/20/lib/node_modules';
    const srcDotPrisma = path.join(__dirname, 'dist-server', 'prisma-fix', '.prisma');
    const srcAtPrisma = path.join(__dirname, 'dist-server', 'prisma-fix', '@prisma');
    
    try {
        if (fs.existsSync(srcDotPrisma)) {
            fs.cpSync(srcDotPrisma, path.join(nodevenvBase, '.prisma'), { recursive: true, force: true });
            log('COPY .prisma -> nodevenv: SUCCESS');
        } else {
            log('COPY .prisma: source not found at ' + srcDotPrisma);
        }
    } catch(e) {
        log('COPY .prisma ERROR: ' + e.message);
    }

    try {
        if (fs.existsSync(srcAtPrisma)) {
            fs.cpSync(srcAtPrisma, path.join(nodevenvBase, '@prisma'), { recursive: true, force: true });
            log('COPY @prisma -> nodevenv: SUCCESS');
        } else {
            log('COPY @prisma: source not found at ' + srcAtPrisma);
        }
    } catch(e) {
        log('COPY @prisma ERROR: ' + e.message);
    }

    // 3. Verify the engine exists in the nodevenv location after copy
    const nodevenvEngine = path.join(nodevenvBase, '.prisma', 'client', 'libquery_engine-debian-openssl-3.0.x.so.node');
    log('Engine in nodevenv exists: ' + fs.existsSync(nodevenvEngine));
    if (fs.existsSync(nodevenvEngine)) {
        try {
            const stat = fs.statSync(nodevenvEngine);
            log('Engine size: ' + stat.size + ' bytes');
        } catch(e) {}
    }

    // 4. Now import and start the app
    try {
        log('Importing dist-server/index.js...');
        const { default: app } = await import('./dist-server/index.js');
        log('Import successful!');
        
        app.use((err, req, res, next) => {
            log('REQUEST ERROR: ' + String(err.stack || err));
            res.status(500).json({ error: err.message });
        });

        process.on('unhandledRejection', (reason) => {
            log('ASYNC ERROR: ' + String(reason.stack || reason));
        });
        process.on('uncaughtException', (err) => {
            log('CRASH ERROR: ' + String(err.stack || err));
        });

        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            log('Server listening on port ' + port);
            console.log(`[PROD] Server is running on port ${port}`);
        });
    } catch (err) {
        log('IMPORT/START ERROR: ' + String(err.stack || err));
        console.error("Failed to start server:", err);
    }
}
start();
