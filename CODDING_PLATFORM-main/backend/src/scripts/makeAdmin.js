// Create an admin account, or promote an existing user to admin.
// Usage:
//   npm run make-admin -- <email> [password] [firstName]
// If the user already exists, only the role is changed.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user');

(async () => {
  const [email, password, firstName = 'Admin'] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: npm run make-admin -- <email> [password] [firstName]');
    process.exit(1);
  }

  await mongoose.connect(process.env.DB_CONNECT_STRING);
  const emailId = email.toLowerCase().trim();
  const existing = await User.findOne({ emailId });

  if (existing) {
    existing.role = 'admin';
    await existing.save();
    console.log(`Promoted ${emailId} to admin.`);
  } else {
    if (!password) {
      console.error('User does not exist — pass a password to create it.');
      process.exit(1);
    }
    await User.create({
      firstName,
      emailId,
      password: await bcrypt.hash(password, 10),
      role: 'admin',
    });
    console.log(`Created admin ${emailId}.`);
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
