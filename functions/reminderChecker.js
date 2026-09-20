const Reminder = require("../models/reminderSchema");

module.exports = async (client) => {
  const check = async () => {
    const now = new Date();

    const due = await Reminder.find({ expiresAt: { $lte: now } });

    for (const reminder of due) {
      const deleted = await Reminder.deleteOne({ _id: reminder._id });
      if (!deleted.deletedCount) continue;

      const createdUnix = Math.floor(reminder.createdAt.getTime() / 1000);
      const content = `⏰ <@${reminder.userId}>, you asked me <t:${createdUnix}:R> to remind you:\n> ${reminder.message}`;
      const allowedMentions = { users: [reminder.userId] };

      let delivered = false;

      if (reminder.channelId) {
        try {
          const channel = await client.channels.fetch(reminder.channelId);
          if (channel?.isTextBased()) {
            await channel.send({ content, allowedMentions });
            delivered = true;
          }
        } catch (_) {}
      }

      if (!delivered) {
        try {
          const user = await client.users.fetch(reminder.userId);
          await user.send({ content, allowedMentions });
        } catch (_) {}
      }
    }
  };

  const safeCheck = () =>
    check().catch((err) => console.error("❌ Reminder check failed:", err));

  await safeCheck();

  setInterval(safeCheck, 15000);
};
