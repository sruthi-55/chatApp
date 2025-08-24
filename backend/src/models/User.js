const pool = require("../utils/db");

//# find user by usernameOrEmail
async function findUserByUsernameOrEmail(usernameOrEmail) {
  const client = await pool.connect();    // gets a connection from pool
  try {
    const sqlQuery = "SELECT * FROM users WHERE username = $1 OR email = $1";
    const res = await client.query(sqlQuery, [usernameOrEmail]);      // prevents SQL injection
    return res.rows[0];   // first match
  } finally {
    client.release();       // connection goes back to pool
  }
}

//# check if user exists by username or email
async function checkUserExists(username, email) {
  const client = await pool.connect();
  try {
    const sqlQuery = "SELECT id FROM users WHERE username=$1 OR email=$2";
    const res = await client.query(sqlQuery,[username, email]);
    return res.rows.length > 0;
  } finally {
    client.release();
  }
}


//# create user
async function createUser(userObj) {
  const client = await pool.connect();
  try {
    const sqlQuery = `INSERT INTO users
       (username, email, password, full_name, phone, avatar, bio, gender)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, username, email, full_name, phone, avatar, bio, gender`;

    const res = await client.query(sqlQuery,
      [userObj.username, userObj.email, userObj.hashedPassword, userObj.fullName, userObj.phone, userObj.avatar, userObj.bio, userObj.gender]
    );
    return res.rows[0];     // return the inserted user
  } finally {
    client.release();
  }
}

module.exports = {
  findUserByUsernameOrEmail,
  checkUserExists,
  createUser,
};
