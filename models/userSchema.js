const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  economy: {
    ruds: {
      type: Number,
      default: 25,
    },
    job: {
      type: {
        type: String,
      },
      level: {
        type: Number,
        default: 1,
      },
      experience: {
        type: Number,
        default: 0,
      },
      nextLevelXP: {
        type: Number,
        default: 100,
      },
      lastWorked: {
        type: Date,
      },
    },
    inventory: [String],
    crime: {
      lastCommitted: {
        type: Date,
      },
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Users", UserSchema);
