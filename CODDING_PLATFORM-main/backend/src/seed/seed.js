// Seeds the sample problem set and a demo admin account.
//  - runs automatically on server start when the problem collection is empty
//  - or manually:  npm run seed   (adds any sample problems that are missing)
const bcrypt = require('bcryptjs');
const Problem = require('../models/problem');
const User = require('../models/user');
const problems = require('./problems.json');

const DEMO_ADMIN = {
    firstName: 'Admin',
    emailId: (process.env.DEMO_ADMIN_EMAIL || 'admin@codejudge.dev').toLowerCase(),
    password: process.env.DEMO_ADMIN_PASSWORD || 'Admin@1234',
};

async function ensureAdmin() {
    let admin = await User.findOne({ role: 'admin' });
    if (admin) return { admin, created: false };
    admin = await User.findOne({ emailId: DEMO_ADMIN.emailId });
    if (admin) {
        admin.role = 'admin';
        await admin.save();
        return { admin, created: false };
    }
    admin = await User.create({
        firstName: DEMO_ADMIN.firstName,
        emailId: DEMO_ADMIN.emailId,
        password: await bcrypt.hash(DEMO_ADMIN.password, 10),
        role: 'admin',
    });
    return { admin, created: true };
}

async function seed({ onlyIfEmpty = false } = {}) {
    if (onlyIfEmpty && (await Problem.estimatedDocumentCount()) > 0) return { added: 0 };

    const { admin, created } = await ensureAdmin();
    if (created) {
        console.log(`Demo admin created -> email: ${DEMO_ADMIN.emailId}  password: ${DEMO_ADMIN.password}`);
    }

    let added = 0;
    for (const p of problems) {
        if (await Problem.exists({ title: p.title })) continue;
        await Problem.create({ ...p, problemCreator: admin._id });
        added++;
    }
    if (added) console.log(`Seeded ${added} sample problem${added === 1 ? '' : 's'}`);
    return { added };
}

module.exports = seed;

if (require.main === module) {
    require('dotenv').config();
    const connect = require('../config/db');
    connect()
        .then(() => seed())
        .then(({ added }) => console.log(added ? 'Done.' : 'Nothing to add — all sample problems already exist.'))
        .catch((e) => { console.error(e.message); process.exitCode = 1; })
        .finally(() => connect.shutdown());
}
