const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

let embedded = null;

// DB_CONNECT_STRING set     -> connect to that MongoDB (local install or Atlas)
// DB_CONNECT_STRING empty   -> start an embedded MongoDB automatically
//   (data is kept in backend/.data/db, so it survives restarts).
//   The first start downloads a MongoDB binary (~100 MB) once.
async function main() {
    let uri = (process.env.DB_CONNECT_STRING || '').trim();

    if (!uri || uri === 'embedded') {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const dbPath = path.join(__dirname, '..', '..', '.data', 'db');
        fs.mkdirSync(dbPath, { recursive: true });
        console.log('DB_CONNECT_STRING not set — starting embedded MongoDB (first run downloads it, please wait)...');
        embedded = await MongoMemoryServer.create({
            instance: { dbPath, storageEngine: 'wiredTiger', dbName: 'codejudge' },
        });
        uri = embedded.getUri('codejudge');
        console.log(`Embedded MongoDB running, data in ${dbPath}`);
    }

    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    } catch (err) {
        throw new Error(
            `Could not connect to MongoDB at ${uri.replace(/\/\/[^@]*@/, '//***@')}\n` +
            `  -> Is MongoDB running? Or remove DB_CONNECT_STRING from backend/.env to use the embedded database.\n` +
            `  (${err.message})`
        );
    }
}

const shutdown = async () => {
    try { await mongoose.disconnect(); } catch {}
    if (embedded) { try { await embedded.stop({ doCleanup: false }); } catch {} }
};

module.exports = main;
module.exports.shutdown = shutdown;
