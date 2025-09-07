const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// verify token and set req.userId to user id extracted from token
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)    
    return res.status(401).json({ message: 'No token provided' });          // Unauthorized

  const token = authHeader.split(' ')[1];       // "Bearer TOKEN"
  if (!token) 
    return res.status(401).json({ message: 'Invalid token format' });       // Unauthorized

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Decoded JWT:", decoded);
    req.userId = decoded.userId;      // sets req.userId to user id extracted from token
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });     // Unauthorized
  }
}

module.exports = authMiddleware;
