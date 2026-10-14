const express = require('express');
const authRouter = express.Router();
const { register, login, logout, adminRegister, deleteProfile, checkUser } = require('../controllers/userAuthent');
const userMiddleware = require("../middleware/userMiddleware");
const adminMiddleware = require('../middleware/adminMiddleware');

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', userMiddleware, logout);
authRouter.post('/admin/register', adminMiddleware, adminRegister);
authRouter.delete('/deleteProfile', userMiddleware, deleteProfile);
// No cookie just means "not logged in" — answer 200 so the browser console stays clean
authRouter.get('/check', (req, res, next) => (req.cookies.token ? next() : res.json({ user: null })), userMiddleware, checkUser);

module.exports = authRouter;
