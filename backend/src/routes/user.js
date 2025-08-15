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

// Search users by ID or username (partial match)
router.get('/search/:term', authMiddleware, async (req, res) => {
  const { term } = req.params;
  const client = await pool.connect();
  
  try {
    const sqlQuery = `
      SELECT id, username, email, full_name, avatar, bio
      FROM users
      WHERE CAST(id AS TEXT) ILIKE $1
         OR username ILIKE $1
         OR email ILIKE $1
    `;
    const values = [`%${term}%`];
    const result = await client.query(sqlQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error("Search user error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});



module.exports = router;
