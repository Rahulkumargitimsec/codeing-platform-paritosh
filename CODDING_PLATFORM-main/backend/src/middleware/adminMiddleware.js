const { authenticate } = require("./userMiddleware");

module.exports = authenticate({ admin: true });
