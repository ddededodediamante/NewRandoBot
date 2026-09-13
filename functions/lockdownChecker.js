const Lockdown = require("../models/lockdownSchema");

module.exports = async (client) => {
  const check = async () => {
    const now = new Date();

    const expired = await Lockdown.find({ expiresAt: { $lte: now } });

    for (const lockdown of expired) {
      const guild = client.guilds.cache.get(lockdown.guildId);
      if (!guild) {
        await Lockdown.deleteOne({ _id: lockdown._id });
        continue;
      }

      const channel = await guild.channels
        .fetch(lockdown.channelId)
        .catch(() => null);

      if (channel) {
        const overwrite = channel.permissionOverwrites.get(guild.id);
        if (overwrite) {
          await overwrite
            .edit(
              { SendMessages: null, SendMessagesInThreads: null },
              `Auto-unlock | ${lockdown.moderatorId}`,
            )
            .catch(() => {});
        }
      }

      await Lockdown.deleteOne({ _id: lockdown._id });
    }
  };

  await check();

  setInterval(check, 60000);
};
