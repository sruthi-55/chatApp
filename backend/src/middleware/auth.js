const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)    return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];       // "Bearer TOKEN"
  if (!token) return res.status(401).json({ message: 'Invalid token format' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;      // sets req.userId to user id extracted from token
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
