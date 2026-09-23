const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  EmbedBuilder,
} = require("discord.js");
const {
  collectFamily,
  renderFamilyTree,
} = require("../../functions/familyTreeGenerator.js");

const data = new SlashCommandBuilder()
  .setName("familytree")
  .setDescription("Social | Show a visual family tree as an image")
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel,
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  )
  .addUserOption((opt) =>
    opt
      .setName("target")
      .setDescription("Whose family to show (default: you)")
      .setRequired(false),
  )
  .addIntegerOption((opt) =>
    opt
      .setName("generations")
      .setDescription("Max generations to show above and below (default: all)")
      .setMinValue(1)
      .setRequired(false),
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const targetUser = interaction.options.getUser("target") || interaction.user;

  await interaction.deferReply();

  const people = await collectFamily(
    targetUser.id,
    interaction.options.getInteger("generations") ?? Infinity,
  );

  if (people.size <= 1) {
    return interaction.editReply({
      content: `❌ ${
        targetUser.id === interaction.user.id
          ? "You don't"
          : `${targetUser} doesn't`
      } have a family yet. Try **/adopt user** or **/marry propose**`,
      allowedMentions: { parse: [] },
    });
  }

  const resolveUser = async (id) => {
    try {
      const user =
        interaction.client.users.cache.get(id) ??
        (await interaction.client.users.fetch(id));
      return {
        name: user.displayName ?? user.username,
        avatarURL: user.displayAvatarURL({ extension: "png", size: 128 }),
      };
    } catch {
      return { name: "Unknown", avatarURL: null };
    }
  };

  const buffer = await renderFamilyTree(people, targetUser.id, resolveUser);

  const attachment = new AttachmentBuilder(buffer, { name: "familytree.png" });

  const embed = new EmbedBuilder()
    .setTitle(`🌳 ${targetUser.username}'s Family Tree`)
    .setImage("attachment://familytree.png")
    .setFooter({ text: `${people.size} members` });

  return interaction.editReply({
    embeds: [embed],
    files: [attachment],
    allowedMentions: { parse: [] },
  });
};

module.exports = { data, run };
