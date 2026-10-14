const redisClient = require("../config/redis");
const User = require("../models/user");
const validate = require('../utils/validator');
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const cookieOptions = require("../utils/cookieOptions");

const publicUser = (user) => ({
    firstName: user.firstName,
    lastName: user.lastName,
    emailId: user.emailId,
    _id: user._id,
    role: user.role,
    createdAt: user.createdAt,
});

const issueToken = (res, user) => {
    const token = jwt.sign({ _id: user._id, emailId: user.emailId, role: user.role }, process.env.JWT_KEY, { expiresIn: 60 * 60 });
    res.cookie("token", token, cookieOptions);
};

const register = async (req, res) => {
    try {
        validate(req.body);
        const emailId = String(req.body.emailId).toLowerCase().trim();

        if (await User.exists({ emailId }))
            return res.status(409).json({ message: "An account with this email already exists. Log in instead." });

        const user = await User.create({
            firstName: String(req.body.firstName).trim(),
            lastName: req.body.lastName ? String(req.body.lastName).trim() : undefined,
            emailId,
            password: await bcrypt.hash(req.body.password, 10),
            role: 'user',
        });

        issueToken(res, user);
        res.status(201).json({ user: publicUser(user), message: "Account created" });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const login = async (req, res) => {
    try {
        const emailId = String(req.body.emailId || '').toLowerCase().trim();
        const { password } = req.body;
        if (!emailId || !password) throw new Error("Enter your email and password");

        const user = await User.findOne({ emailId });
        if (!user || !(await bcrypt.compare(password, user.password)))
            throw new Error("That email and password don't match an account");

        issueToken(res, user);
        res.status(200).json({ user: publicUser(user), message: "Logged in" });
    } catch (err) {
        res.status(401).json({ message: err.message });
    }
};

const logout = async (req, res) => {
    try {
        const { token } = req.cookies;
        const payload = jwt.decode(token);

        // Block this token until it would have expired anyway
        await redisClient.set(`token:${token}`, 'Blocked');
        await redisClient.expireAt(`token:${token}`, payload.exp);

        const { maxAge, ...clearOptions } = cookieOptions;
        res.clearCookie("token", clearOptions);
        res.json({ message: "Logged out" });
    } catch (err) {
        res.status(503).json({ message: err.message });
    }
};

// Admins can create other accounts (including admin accounts)
const adminRegister = async (req, res) => {
    try {
        validate(req.body);
        const emailId = String(req.body.emailId).toLowerCase().trim();
        if (await User.exists({ emailId }))
            return res.status(409).json({ message: "An account with this email already exists" });

        const user = await User.create({
            firstName: String(req.body.firstName).trim(),
            emailId,
            password: await bcrypt.hash(req.body.password, 10),
            role: req.body.role === 'admin' ? 'admin' : 'user',
        });
        res.status(201).json({ user: publicUser(user), message: "Account created" });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

const deleteProfile = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.result._id); // submissions are removed by the model hook
        const { maxAge, ...clearOptions } = cookieOptions;
        res.clearCookie("token", clearOptions);
        res.status(200).json({ message: "Account deleted" });
    } catch (err) {
        res.status(500).json({ message: "Couldn't delete the account" });
    }
};

const checkUser = (req, res) => {
    res.status(200).json({ user: publicUser(req.result), message: "Valid User" });
};

module.exports = { register, login, logout, adminRegister, deleteProfile, checkUser };
