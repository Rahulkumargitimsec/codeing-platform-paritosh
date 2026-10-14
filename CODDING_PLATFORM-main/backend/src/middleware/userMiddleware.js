const jwt = require("jsonwebtoken");
const User = require("../models/user");
const redisClient = require("../config/redis");

// Verifies the auth cookie and puts the user document on req.result.
// With { admin: true } the user must also have the admin role (read from the DB,
// so promoting someone with `npm run make-admin` works without logging out).
const authenticate = ({ admin = false } = {}) => async (req, res, next) => {
    try {
        const { token } = req.cookies;
        if (!token) return res.status(401).json({ message: "You're not logged in" });

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_KEY);
        } catch {
            return res.status(401).json({ message: "Your session has expired. Log in again." });
        }

        if (await redisClient.exists(`token:${token}`))
            return res.status(401).json({ message: "Your session has ended. Log in again." });

        const user = payload._id ? await User.findById(payload._id) : null;
        if (!user) return res.status(401).json({ message: "This account no longer exists" });

        if (admin && user.role !== 'admin')
            return res.status(403).json({ message: "Only admins can do this" });

        req.result = user;
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = authenticate();
module.exports.authenticate = authenticate;
