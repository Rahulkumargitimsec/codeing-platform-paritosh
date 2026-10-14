const { createClient } = require('redis');

// Redis is only used as a blocklist for logged-out JWTs.
//  - REDIS_URL set   -> real Redis (local: redis://localhost:6379,
//                       Redis Cloud: redis://default:<password>@<host>:<port>)
//  - REDIS_URL unset -> in-memory fallback, fine for local development
//                       (blocklist is cleared when the server restarts)

let redisClient;

if (process.env.REDIS_URL) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis Client Error:', err.message));
} else if (process.env.REDIS_PASS) {
    // Backwards compatible with the original deployed config (Redis Cloud host + REDIS_PASS)
    redisClient = createClient({
        username: 'default',
        password: process.env.REDIS_PASS,
        socket: {
            host: process.env.REDIS_HOST || 'redis-15673.crce286.ap-south-1-1.ec2.cloud.redislabs.com',
            port: Number(process.env.REDIS_PORT) || 15673,
        },
    });
    redisClient.on('error', (err) => console.error('Redis Client Error:', err.message));
} else {
    const store = new Map(); // key -> { value, expiresAt (ms) | null }

    const alive = (key) => {
        const entry = store.get(key);
        if (!entry) return false;
        if (entry.expiresAt && entry.expiresAt <= Date.now()) {
            store.delete(key);
            return false;
        }
        return true;
    };

    redisClient = {
        async connect() {
            console.log('REDIS_URL not set — using in-memory token blocklist (dev only)');
        },
        async set(key, value) {
            store.set(key, { value, expiresAt: null });
            return 'OK';
        },
        async expireAt(key, unixSeconds) {
            if (!alive(key)) return 0;
            store.get(key).expiresAt = unixSeconds * 1000;
            return 1;
        },
        async exists(key) {
            return alive(key) ? 1 : 0;
        },
    };
}

module.exports = redisClient;
