const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { ROLES } = require('../constant');
const router = express.Router();

// Only allow admin users
router.post('/create-teacher', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      name,
      email,
      password: hashedPassword,
      role: ROLES.TEACHER,
      isApproved: true, 
    });

    res.json({ message: 'Teacher account created', email, password });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
