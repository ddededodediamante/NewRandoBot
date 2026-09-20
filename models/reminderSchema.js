const mongoose = require("mongoose");

const ReminderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, default: null },
  channelId: { type: String, default: null },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

ReminderSchema.index({ expiresAt: 1 });
ReminderSchema.index({ userId: 1 });

module.exports = mongoose.model("Reminders", ReminderSchema);
