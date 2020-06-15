const HttpError = require("../models/http-error");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/user");

const getAllUsers = async (req, res, next) => {
  let users;

  try {
    users = await User.find({}, "-password");
  } catch (e) {
    return next(
      new HttpError("Fetching users failed, please try again later.", 500)
    );
  }
  res.json({ users: users.map(u => u.toObject({ getters: true })) });
};

const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 404)
    );

  const { email, password, name } = req.body;

  let existingUser;

  try {
    existingUser = await User.findOne({ email });
  } catch (e) {
    return next(
      new HttpError("Signing up failed, please try again later.", 500)
    );
  }

  if (existingUser) {
    return next(
      new HttpError("User already exists, please login instead.", 422)
    );
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (e) {
    return next(new HttpError("Could not create user, please try again.", 500));
  }

  const createdUser = new User({
    name,
    email,
    image: req.file.path,
    password: hashedPassword,
    places: []
  });

  try {
    await createdUser.save();
  } catch (e) {
    return next(new HttpError("Could not save user to database.", 500));
  }

  let token;
  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      process.env.JWT_KEY,
      {
        expiresIn: "1h"
      }
    );
  } catch (e) {
    return next(
      new HttpError("Signing up failed, please try again later.", 500)
    );
  }

  res
    .status(201)
    .json({ userId: createdUser.id, email: createdUser.email, token });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  let user;

  try {
    user = await User.findOne({ email });
  } catch (e) {
    return next(
      new HttpError("Logging in failed, please try again later.", 500)
    );
  }

  if (!user) {
    return next(
      new HttpError(
        "Could not indentify user, credentials seem to be wrong.",
        403
      )
    );
  }

  let passwordMatch = false;
  try {
    passwordMatch = await bcrypt.compare(password, user.password);
  } catch (e) {
    return next(new HttpError("Logging in failed, please try again.", 500));
  }

  if (!passwordMatch) {
    return next(
      new HttpError(
        "Could not indentify user, credentials seem to be wrong.",
        403
      )
    );
  }

  let token;

  try {
    token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_KEY,
      {
        expiresIn: "1h"
      }
    );
  } catch (e) {
    return next(new HttpError("Logging in failed, please try again.", 500));
  }

  res.json({
    userId: user.id,
    email: user.email,
    token
  });
};

exports.getAllUsers = getAllUsers;
exports.signup = signup;
exports.login = login;
