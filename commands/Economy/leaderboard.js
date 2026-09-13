const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
  EmbedBuilder,
} = require("discord.js");
const Users = require("../../models/userSchema.js");

const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Economy | See who has the most ruds")
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel,
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  )
  .addBooleanOption((option) =>
    option
      .setName("server")
      .setDescription("Only show users from this server instead of globally")
      .setRequired(false),
  );

const MAX_ENTRIES = 10;
const MEDALS = ["🥇", "🥈", "🥉"];

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const serverOnly = interaction.options.getBoolean("server") ?? false;
  const rud = interaction.client.getEmoji("rud");

  if (serverOnly && !interaction.guild) {
    return interaction.reply({
      content:
        "❌ You need to use this in a server to see the server leaderboard",
      flags: "Ephemeral",
    });
  }

  await interaction.deferReply();

  let topUsers;

  if (serverOnly) {
    const members = await interaction.guild.members.fetch();
    const memberIds = [...members.keys()];

    topUsers = await Users.find({ id: { $in: memberIds } })
      .sort({ "economy.ruds": -1 })
      .limit(MAX_ENTRIES);
  } else {
    topUsers = await Users.find({})
      .sort({ "economy.ruds": -1 })
      .limit(MAX_ENTRIES);
  }

  if (!topUsers.length) {
    return interaction.editReply({
      content: "❌ No one has any ruds yet!",
    });
  }

  const lines = await Promise.all(
    topUsers.map(async (userDoc, index) => {
      const rank = MEDALS[index] || `**#${index + 1}**`;
      const user = await interaction.client.users
        .fetch(userDoc.id)
        .catch(() => null);
      const name = user ? user.toString() : `Unknown User`;

      return `${rank} ${name}: **${userDoc.economy.ruds}** ${rud}`;
    }),
  );

  const embed = new EmbedBuilder()
    .setTitle(
      serverOnly
        ? `🏆 ${interaction.guild.name} Leaderboard`
        : "🏆 Global Leaderboard",
    )
    .setDescription(lines.join("\n"))
    .setFooter({ text: `Top ${topUsers.length} shown` });

  await interaction.editReply({
    embeds: [embed],
    allowedMentions: { parse: [] },
  });
};

module.exports = { data, run };
