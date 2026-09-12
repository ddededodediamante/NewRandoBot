const {
  Client,
  Events,
  GuildMember,
  CommandInteraction,
  inlineCode,
} = require("discord.js");
const Servers = require("../models/serverSchema.js");
const { helpPages, buildEmbed, buildRow } = require("../commands/Bot/help.js");

delete require.cache[require.resolve("./imageEffects")];
const imageEffects = require("./imageEffects");

delete require.cache[require.resolve("./gifEffects")];
const gifEffects = require("./gifEffects");

module.exports = async (client = Client.prototype) => {
  client.removeAllListeners();

  client.on(Events.GuildCreate, async (guild) => {
    try {
      let existing = await Servers.findOne({ id: guild.id });
      if (!existing) {
        await Servers.create({
          id: guild.id,
          welcome: { channel: null, messages: [], role: null },
          farewell: { channel: null, messages: [] },
          counting: {
            channel: null,
            count: 0,
            lastUser: null,
            mistakeThreadId: null,
            resetOnWrong: false,
          },
        });
        console.log(
          `✅ Created config for new guild: ${guild.name} (${guild.id})`
        );
      } else {
        console.log(
          `ℹ️ Guild already exists in DB: ${guild.name} (${guild.id})`
        );
      }
    } catch (err) {
      console.error(`❌ Failed to create config for guild ${guild.id}:`, err);
    }
  });

  client.on(
    Events.InteractionCreate,
    async (interaction = CommandInteraction.prototype) => {
      if (interaction.isAutocomplete()) {
        const focused = interaction.options.getFocused();
        let choices = [];

        if (interaction.commandName === "image") {
          let initialChoices = Object.keys(imageEffects).map((key) => ({
            name: key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase(),
            value: key,
          }));

          choices = initialChoices.filter((choice) =>
            choice.name.includes(focused.toLowerCase())
          );
        } else if (interaction.commandName === "gif") {
          let initialChoices = Object.keys(gifEffects).map((key) => ({
            name: key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase(),
            value: key,
          }));

          choices = initialChoices.filter((choice) =>
            choice.name.includes(focused.toLowerCase())
          );
        }

        return await interaction.respond(
          choices.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 25)
        );
      }

      if (interaction.isButton()) {
        if (!["help_prev", "help_next"].includes(interaction.customId)) return;

        const data = helpPages.get(interaction.message.id);
        if (!data) return;

        if (interaction.user.id !== data.userId) {
          return interaction.reply({
            content: "❌ Not your help menu!",
            flags: "Ephemeral",
          });
        }

        if (interaction.customId === "help_prev" && data.pageIndex > 0) {
          data.pageIndex--;
        } else if (
          interaction.customId === "help_next" &&
          data.pageIndex < data.pages.length - 1
        ) {
          data.pageIndex++;
        } else {
          return;
        }

        return await interaction.update({
          embeds: [buildEmbed(data.pageIndex, data.pages)],
          components: [buildRow(data.pageIndex, data.pages)],
        });
      }

      if (
        !interaction.isChatInputCommand() &&
        !interaction.isContextMenuCommand()
      )
        return;

      const command = client.commands.get(interaction.commandName);
      if (!command || !command.run || !command.data)
        return interaction.reply({
          content: "❌ Unknown command",
          flags: "Ephemeral",
        });

      try {
        return await command.run(interaction);
      } catch (error) {
        console.error(error);
        const method =
          interaction.deferred || interaction.replied ? "followUp" : "reply";
        return interaction[method]({
          content: "❌ There was an error while running this command",
          flags: "Ephemeral",
        });
      }
    }
  );

  client.on(Events.GuildMemberAdd, async (member = GuildMember.prototype) => {
    if (member.user.bot) return;

    const config = await Servers.findOne({ id: member.guild.id });
    if (!config?.welcome) return;

    try {
      const { channel: channelId, messages, role: roleId } = config.welcome;
      if (channelId && messages?.length > 0) {
        const channel = await member.guild.channels.fetch(channelId, {
          cache: true,
        });

        if (channel?.isTextBased()) {
          const message = messages[
            Math.floor(Math.random() * messages.length)
          ].replace("{user}", member.toString());

          await channel.send({
            content: `${client.getEmoji("join")} ${message}`.slice(0, 2000),
            allowedMentions: { users: [member.id] },
          });
        }
      }

      if (roleId) {
        const role = await member.guild.roles.fetch(roleId, { cache: true });
        if (role) {
          await member.roles.add(role);
        }
      }
    } catch (error) {
      console.error("Failed to send welcome message or add role:", error);
    }
  });

  client.on(
    Events.GuildMemberRemove,
    async (member = GuildMember.prototype) => {
      if (member.user.bot) return;

      const config = await Servers.findOne({ id: member.guild.id });
      if (!config?.farewell) return;

      try {
        const { channel: channelId, messages } = config.farewell;
        if (!channelId || !messages?.length) return;

        const channel = await member.guild.channels.fetch(channelId, {
          cache: true,
        });
        if (!channel?.isTextBased()) return;

        const message = messages[
          Math.floor(Math.random() * messages.length)
        ].replace("{user}", member.toString());

        await channel.send({
          content: `${client.getEmoji("leave")} ${message}`.slice(0, 2000),
          allowedMentions: { users: [member.id] },
        });
      } catch (error) {
        console.error("Failed to send farewell message:", error);
      }
    }
  );

  const deletedByMe = new Set();
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guildId) return;

    const config = await Servers.findOne({ id: message.guildId });

    if (config?.wordStory?.channel === message.channelId) {
      const { wordsPerUser = 1, lastUser } = config.wordStory;

      const words = message.content.trim().split(/\s+/);

      if (lastUser === message.author.id || words.length !== wordsPerUser) {
        if (message.deletable) {
          deletedByMe.add(message.id);
          await message.delete();
        }
        return;
      }

      await Servers.updateOne(
        { id: message.guildId },
        {
          $push: {
            "wordStory.messages": {
              messageId: message.id,
              userId: message.author.id,
              content: message.content.trim(),
            },
          },
          $set: {
            "wordStory.lastUser": message.author.id,
          },
        }
      );

      return await message.react("✅").catch(() => {});
    }

    if (config?.counting?.channel === message.channelId) {
      async function getMistakesThread() {
        let thread;
        try {
          if (mistakeThreadId) {
            thread = await client.channels.fetch(mistakeThreadId);
            if (thread?.isThread() && thread.archived) {
              await thread.setArchived(false, "Reopening mistakes thread");
            }
          }
        } catch (err) {
          console.error("Error fetching mistakes thread:", err);
          thread = null;
        }

        if (!thread?.isThread()) {
          try {
            thread = await message.channel.threads.create({
              name: "Counting Mistakes",
              autoArchiveDuration: 60,
              reason: "Initializing mistakes thread",
            });
            mistakeThreadId = thread.id;
            await Servers.updateOne(
              { id: message.guildId },
              { $set: { "counting.mistakeThreadId": mistakeThreadId } }
            );
          } catch (err) {
            console.error("Could not create mistakes thread:", err);
            thread = null;
          }
        }

        return thread;
      }

      const {
        resetOnWrong = false,
        count = 0,
        lastUser,
        mistakeThreadId,
      } = config.counting;

      const got = Number(message.content.trim().split(" ")[0]);
      if (isNaN(got)) {
        if (message.deletable) {
          deletedByMe.add(message.id);
          await message.delete();
        }
        return;
      }

      const expected = count + 1;
      if (message.author.id === lastUser) {
        const thread = await getMistakesThread();
        const notice = `🛑 ${message.author} tried to count twice in a row. The next number is **${expected}**.`;
        let sentInThread = false;
        if (thread?.isThread()) {
          try {
            await thread.send(notice);
            sentInThread = true;
          } catch (err) {
            console.error("Failed to send counting mistake in thread:", err);
          }
        }

        if (message.deletable) {
          deletedByMe.add(message.id);
          message.delete();
        } else if (!sentInThread) message.react("🛑").catch(() => {});
        return;
      }

      if (got === expected) {
        await Servers.updateOne(
          { id: message.guildId },
          {
            $set: {
              "counting.count": expected,
              "counting.lastUser": message.author.id,
            },
          }
        );
        return await message.react("✅").catch(() => {});
      }

      if (resetOnWrong) {
        await Servers.updateOne(
          { id: message.guildId },
          { $set: { "counting.count": 0, "counting.lastUser": null } }
        );
        if (
          message.channel
            .permissionsFor(message.guild.members.me)
            .has("SendMessages")
        )
          await message.reply(
            `❌ Wrong number! Count has been reset. The next number is **1**.`
          );
        if (!message.deletable) message.react("🔄").catch(() => {});
        else {
          deletedByMe.add(message.id);
          message.delete();
        }
        return;
      }

      const thread = await getMistakesThread();
      const notice = `❌ <@${message.author.id}> posted **${got}**, but the next number should be **${expected}**.`;
      let sentInThread = false;
      if (thread?.isThread()) {
        try {
          await thread.send(notice);
          sentInThread = true;
        } catch (err) {
          console.error("Failed to send counting mistake in thread:", err);
        }
      }

      if (!sentInThread) {
        try {
          await message.author.send(
            `❌ In <#${message.channelId}>, you sent **${got}**, but the next number should be **${expected}**.`
          );
        } catch (err) {
          console.warn(
            `Failed to DM user ${message.author.tag} for counting mistake`
          );
        }
      }

      if (message.deletable) {
        deletedByMe.add(message.id);
        message.delete();
      } else message.react("❌").catch(() => {});

      return;
    }
  });

  client.on(Events.MessageDelete, async (message) => {
    if (message.author.bot || !message.guildId || !message.channelId) return;
    if (deletedByMe.has(message.id)) {
      deletedByMe.delete(message.id);
      return;
    }

    const config = await Servers.findOne({ id: message.guildId });

    if (config?.wordStory?.channel === message.channelId) {
      const { lastUser } = config.wordStory;

      const content = inlineCode(message.content.trim());

      if (message.author.id === lastUser) {
        try {
          await message.channel.send({
            content: `${message.author}: ${content}`,
            allowedMentions: { parse: [] },
          });
        } catch (_) {}
      }

      return;
    }

    if (config?.counting?.channel === message.channelId) {
      const { count = 0, lastUser } = config.counting;

      const got = Number(message.content.trim().split(" ")[0]);

      if (!isNaN(got) && got === count && message.author.id === lastUser) {
        try {
          await message.channel.send({
            content: `${message.author}: ${count}`,
            allowedMentions: { parse: [] },
          });
        } catch (_) {}
      }

      return;
    }
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (
      !newMessage.guildId ||
      newMessage.author?.bot ||
      oldMessage?.content === newMessage?.content
    )
      return;

    const config = await Servers.findOne({ id: newMessage.guildId });
    if (!config) return;

    const isCounting = config.counting?.channel === newMessage.channelId;

    const isWordStory = config.wordStory?.channel === newMessage.channelId;

    if (!isCounting && !isWordStory) return;

    try {
      await newMessage.react("✏️");
    } catch (_) {}
  });

  client.on(Events.Error, (err) => {
    console.error(err);
  });
};
