const jwt = require("jsonwebtoken");
const HttpError = require("../models/http-error");

module.exports = (req, res, next) => {
  if (req.method === "OPTIONS") return next();

  try {
    const token = req.headers.authorization.split(" ")[1];

    if (!token) throw new Error();

    const decoded = jwt.verify(token, process.env.JWT_KEY);

    req.userData = { userId: decoded.userId };

    next();
  } catch (err) {
    return next(new HttpError("Authentication failed!", 403));
  }
};
