const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
  EmbedBuilder,
} = require("discord.js");
const ms = require("ms");

const Reminder = require("../../models/reminderSchema");
const { ellipsis } = require("../../functions/utils.js");

const MIN_DURATION = 10 * 1000;
const MAX_DURATION = 365 * 24 * 60 * 60 * 1000;
const MAX_REMINDERS_PER_USER = 25;

const data = new SlashCommandBuilder()
  .setName("reminder")
  .setDescription("Util | Set reminders for yourself")
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel,
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  )
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Set a new reminder")
      .addStringOption((opt) =>
        opt
          .setName("time")
          .setDescription("When to remind you (e.g. 10m, 2h, 1d)")
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("message")
          .setDescription("What to remind you about")
          .setRequired(true)
          .setMaxLength(500),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List your active reminders"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete one of your reminders")
      .addIntegerOption((opt) =>
        opt
          .setName("number")
          .setDescription("The reminder number shown in /reminder list")
          .setMinValue(1)
          .setRequired(true),
      ),
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "set") {
    const timeInput = interaction.options.getString("time", true);
    const message = interaction.options.getString("message", true);
    const duration = ms(timeInput);

    if (typeof duration !== "number" || Number.isNaN(duration)) {
      return interaction.reply({
        content: "❌ Invalid time. Examples: `10m`, `2h`, `1d`",
        flags: "Ephemeral",
      });
    }

    if (duration < MIN_DURATION || duration > MAX_DURATION) {
      return interaction.reply({
        content: "❌ Invalid time. Must be between 10 seconds and 1 year.",
        flags: "Ephemeral",
      });
    }

    const count = await Reminder.countDocuments({
      userId: interaction.user.id,
    });
    if (count >= MAX_REMINDERS_PER_USER) {
      return interaction.reply({
        content: `❌ You can only have **${MAX_REMINDERS_PER_USER}** active reminders. Delete some with **/reminder delete**.`,
        flags: "Ephemeral",
      });
    }

    const expiresAt = new Date(Date.now() + duration);

    await Reminder.create({
      userId: interaction.user.id,
      guildId: interaction.guildId ?? null,
      channelId: interaction.channelId ?? null,
      message,
      expiresAt,
    });

    const unix = Math.floor(expiresAt.getTime() / 1000);
    return interaction.reply({
      content: `⏰ Got it! I'll remind you <t:${unix}:R> (<t:${unix}:f>):\n> ${ellipsis(message, 200)}`,
      allowedMentions: { parse: [] },
    });
  }

  if (subcommand === "list") {
    const reminders = await Reminder.find({ userId: interaction.user.id }).sort(
      { expiresAt: 1 },
    );

    if (!reminders.length) {
      return interaction.reply({
        content: "❌ You don't have any active reminders",
        flags: "Ephemeral",
      });
    }

    const lines = reminders.map((r, i) => {
      const unix = Math.floor(r.expiresAt.getTime() / 1000);
      return `**${i + 1}.** <t:${unix}:R> - ${ellipsis(r.message, 80)}`;
    });

    const embed = new EmbedBuilder()
      .setTitle("⏰ Your Reminders")
      .setDescription(ellipsis(lines.join("\n"), 4000))
      .setFooter({ text: `${reminders.length} active` });

    return interaction.reply({
      embeds: [embed],
      flags: "Ephemeral",
      allowedMentions: { parse: [] },
    });
  }

  if (subcommand === "delete") {
    const number = interaction.options.getInteger("number", true);

    const reminders = await Reminder.find({ userId: interaction.user.id }).sort(
      { expiresAt: 1 },
    );
    const target = reminders[number - 1];

    if (!target) {
      return interaction.reply({
        content:
          "❌ No reminder with that number, check **/reminder list**",
        flags: "Ephemeral",
      });
    }

    await Reminder.deleteOne({ _id: target._id });

    return interaction.reply({
      content: `✅ Deleted reminder: ${ellipsis(target.message, 200)}`,
      flags: "Ephemeral",
      allowedMentions: { parse: [] },
    });
  }
};

module.exports = { data, run };
