const express = require('express');
const pool = require('../utils/db');
const authMiddleware = require('../middleware/auth');
const bcrypt = require('bcrypt');

const router = express.Router();

// Get user profile
router.get('/me', authMiddleware, async (req, res) => {
  // authMiddleware runs before the main handler

  const client = await pool.connect();
  try {
    const sqlQuery = 'SELECT id, username, email, full_name, phone, avatar, bio, gender FROM users WHERE id=$1';
    const userRes = await client.query(sqlQuery, [req.userId]);
    if (userRes.rows.length === 0) 
      return res.status(404).json({ message: 'User not found' });

    res.json(userRes.rows[0]);      // return first match
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
