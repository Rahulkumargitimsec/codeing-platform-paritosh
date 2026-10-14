const validator = require("validator");

const validate = (data = {}) => {
    const { firstName, emailId, password } = data;

    if (!firstName || !emailId || !password)
        throw new Error("First name, email and password are all required");

    const name = String(firstName).trim();
    if (name.length < 3 || name.length > 20)
        throw new Error("First name must be 3 to 20 characters");

    if (!validator.isEmail(String(emailId)))
        throw new Error("Enter a valid email address");

    if (!validator.isStrongPassword(String(password)))
        throw new Error("Password needs at least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol");
};

module.exports = validate;
