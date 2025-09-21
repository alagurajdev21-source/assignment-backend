const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const { ROLES } = require('./constant');
const logger = require('./utils/logger');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => logger.info('DB connected'))
  .catch(err => console.error(err));

async function createAdmin() {
  const existing = await User.findOne({ email: process.env.ADMIN_EMAIL });
  if (existing) {
    logger.info('Admin already exists');
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
  const admin = new User({
    name: 'System Admin',
    email: process.env.ADMIN_EMAIL,
    password: hashedPassword,
    role: ROLES.ADMIN,
    isApproved: true
  });

  await admin.save();
  logger.log(`Admin created: email=${process.env.ADMIN_EMAIL} password=${process.env.ADMIN_PASSWORD}`);
  process.exit(0);
}

createAdmin();
