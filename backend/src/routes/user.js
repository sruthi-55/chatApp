const express = require('express');
const pool = require('../utils/db');
const authMiddleware = require('../middleware/auth');
const bcrypt = require('bcrypt');

const router = express.Router();

//# get user profile
router.get('/me', authMiddleware, async (req, res) => {
  // authMiddleware runs before the main handler
  // it verifies token and sets req.userId to user id extracted from token

  const client = await pool.connect();
  try {
    const sqlQuery = 'SELECT id, username, email, full_name, phone, avatar, bio, gender FROM users WHERE id=$1';
    const userRes = await client.query(sqlQuery, [req.userId]);
    if (userRes.rows.length === 0) 
      return res.status(404).json({ message: 'User not found' });       // Not Found

    res.json(userRes.rows[0]);      // return first match
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ message: 'Server error' });        // Internal Server Error
  } finally {
    client.release();
  }
});


//# search users by ID or username or email (partial match)
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
    // ILIKE is case-insensitive match
    const values = [`%${term}%`];     // partial matches
    const result = await client.query(sqlQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No users found" });       // Not Found
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error("Search user error:", err);
    res.status(500).json({ message: "Server error" });      // Internal Server Error
  } finally {
    client.release();
  }
});



module.exports = router;
