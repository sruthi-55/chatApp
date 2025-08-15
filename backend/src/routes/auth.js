const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../utils/db");

const { checkUserExists, createUser, findUserByUsernameOrEmail } = require("../models/User");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// REGISTER
router.post("/register", async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, email, password, full_name, phone, avatar, bio, gender } =
      req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // check if user already exists
    if (await checkUserExists(username, email)) {
      return res
        .status(400)
        .json({ message: "Username or email already taken" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // create new user
    const newUser = await createUser({
      username,
      email,
      hashedPassword,
      full_name,
      phone,
      avatar,
      bio,
      gender,
    });

    res.status(200).json({ message: "User registered", user: newUser }); 
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  const client = await pool.connect();
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await findUserByUsernameOrEmail(usernameOrEmail); 

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }


    // bcrypt.compare()
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        avatar: user.avatar,
        bio: user.bio,
        gender: user.gender,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
});

module.exports = router;
