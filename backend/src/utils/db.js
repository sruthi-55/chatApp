const { Pool } = require('pg');
require('dotenv').config();

// connection pool
// instead of opening/closing a new DB connection for every query, 
// a pool reuses a set of connections

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,     //postgresql://username:password@host:port/dbname
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// pool.query(''), it picks a free connection from the pool
// when query is done, the connection goes back to the pool (not destroyed)
module.exports = pool;