const mongoose = require("mongoose");

const LockdownSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  reason: { type: String, default: "No reason provided" },
  expiresAt: { type: Date, required: true },
  moderatorId: { type: String, required: true },
});

LockdownSchema.index({ expiresAt: 1 });

module.exports = mongoose.model("Lockdowns", LockdownSchema);
