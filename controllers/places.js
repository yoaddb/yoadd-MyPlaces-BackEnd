const fs = require("fs");
const mongoose = require("mongoose");
const HttpError = require("../models/http-error");
const { validationResult } = require("express-validator");
const getCoordsForAddress = require("../util/location");
const Place = require("../models/place");
const User = require("../models/user");

const getPlaceById = async (req, res, next) => {
  const pid = req.params.pid;

  let place;

  try {
    place = await Place.findById(pid);
  } catch (e) {
    return next(
      new HttpError("Could not find a place for the provided id.", 500)
    );
  }

  if (!place)
    return next(
      new HttpError("Could not find a place for the provided id.", 404)
    );

  res.json({ place: place.toObject({ getters: true }) });
};

const getPlacesByUserId = async (req, res, next) => {
  const uid = req.params.uid;

  let places;

  try {
    places = await Place.find({ creator: uid });
  } catch (e) {
    return next(
      new HttpError("Fetching places failed, please try again later.", 500)
    );
  }

  if (!places) {
    return next(
      new HttpError("Could not find place(s) for the provided user id.", 404)
    );
  }

  res.json({ places: places.map(p => p.toObject({ getters: true })) });
};

const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    next(new HttpError("Invalid inputs passed, please check your data.", 422));

  const { title, description, address } = req.body;

  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (e) {
    return next(e);
  }

  const createdPlace = new Place({
    title,
    description,
    location: coordinates,
    image: req.file.path,
    address,
    creator: req.userData.userId
  });

  let user;

  try {
    user = await User.findById(req.userData.userId);
  } catch (e) {
    return next(new HttpError("Creating place failed, please try again.", 500));
  }

  if (!user) {
    return next(new HttpError("Could not find user for provided id", 404));
  }

  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    await createdPlace.save({ session }); // saves newly created place to db
    user.places.push(createdPlace); // pushes place's id to places array of user
    await user.save({ session }); // saves user with changes
    await session.commitTransaction();
  } catch (e) {
    return next(new HttpError("Creating place failed, please try again.", 500));
  }

  res.status(201).json({ place: createdPlace });
};

const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    );

  const pid = req.params.pid;

  const { title, description } = req.body;

  let place;
  try {
    place = await Place.findById(pid);
  } catch (e) {
    return next(
      new HttpError("Fetching place failed, please try again later.", 500)
    );
  }

  if (!place) {
    return next(new HttpError("Could not find place with provided id.", 404));
  }

  if (place.creator.toString() !== req.userData.userId) {
    return next(new HttpError("You are not allowed to edit this place.", 401));
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (e) {
    return next(new HttpError("Could not save place to database.", 500));
  }

  res.json({ place: place.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
  const pid = req.params.pid;

  let place;

  try {
    place = await Place.findById(pid).populate("creator");
  } catch (e) {
    return next(new HttpError("Could not delete place with provided id.", 500));
  }

  if (!place) {
    return next(new HttpError("Could not find place for provided id.", 404));
  }

  if (place.creator.id !== req.userData.userId) {
    return next(new HttpError("You are not allowed to delete this place.", 401));
  }

  const imagePath = place.image;

  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    await place.remove({ session }); // deletes place from db.
    place.creator.places.pull(place); // pops place's id from places array of user
    await place.creator.save({ session }); // saves user with changes
    await session.commitTransaction();
  } catch (e) {
    return next(new HttpError("Could not delete place in database.", 500));
  }

  fs.unlink(imagePath, err => {
    console.log(err);
  });

  res.json({ message: "Deleted place." });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
