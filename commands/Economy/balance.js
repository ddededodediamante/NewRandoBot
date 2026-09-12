const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
} = require("discord.js");
const Users = require("../../models/userSchema.js");

const data = new SlashCommandBuilder()
  .setName("balance")
  .setDescription("Economy | Check your or another user's job status")
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  )
  .addUserOption((option) =>
    option
      .setName("target")
      .setDescription("User's balance to check")
      .setRequired(false)
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const targetUser = interaction.options.getUser("target") || interaction.user;

  let user = await Users.findOne({ id: targetUser.id });
  if (!user) {
    user = await Users.create({ id: targetUser.id });
  }

  await interaction.reply({
    content: `${targetUser.toString()} has ${user.economy.ruds} ${interaction.client.getEmoji("rud")}`,
    allowedMentions: { parse: [] },
  });
};

module.exports = { data, run };
