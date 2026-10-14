const express = require('express');
const submitRouter = express.Router();
const userMiddleware = require("../middleware/userMiddleware");
const { submitCode, runCode, mySubmissions } = require("../controllers/userSubmission");

submitRouter.post("/submit/:id", userMiddleware, submitCode);
submitRouter.post("/run/:id", userMiddleware, runCode);
submitRouter.get("/mine", userMiddleware, mySubmissions);

module.exports = submitRouter;
