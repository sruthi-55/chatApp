const express = require("express");
const bcrypt = require("bcrypt"); // hash passwords securely before saving to DB
const jwt = require("jsonwebtoken"); // create auth tokens

const {
  checkUserExists,
  createUser,
  findUserByUsernameOrEmail,
} = require("../models/User");

// instead of putting all endpoints directly in index.js / server.js, you group them by feature
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";


//# user registration
router.post("/register", async (req, res) => {
  try {
    const { username, email, password, full_name, phone, avatar, bio, gender } =
      req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" }); // Bad request
    }

    // if username/email already exists
    if (await checkUserExists(username, email)) {
      return res
        .status(400)
        .json({ message: "Username or email already taken" }); // Bad request
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10); // with salt rounds = 10

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

    res.status(200).json({ message: "User registered", user: newUser });      // 200 ok
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });      // Internal Server Error
  } 
});


//# user login
router.post("/login", async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ message: "Missing required fields" });      // Bad request
    }

    const user = await findUserByUsernameOrEmail(usernameOrEmail);

    if (!user) {
      return res.status(400).json({ message: "User not found" });               // Bad request
    }

    // bcrypt.compare()
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });          // Bad request   
    }


    // create JWT token using secret key
    // (payload, secret, options)
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "7d",
    });


    // 200 ok
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
    res.status(500).json({ message: "Server error" });        // Internal Server Error
  } 
});

module.exports = router;
