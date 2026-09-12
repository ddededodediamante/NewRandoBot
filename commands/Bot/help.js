const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const MAX_COMMANDS_PER_PAGE = 10;

const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription(
    "Bot | Shows a list of all commands or details of a specific command"
  )
  .addStringOption((option) =>
    option
      .setName("command")
      .setDescription("The specific command you want help with")
      .setRequired(false)
  )
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  );

const optionTypeValues = {
  1: "Subcommand",
  2: "Subcommand Group",
  3: "String",
  4: "Integer",
  5: "Boolean",
  6: "User",
  7: "Channel",
  8: "Role",
  9: "Mentionable",
  10: "Number",
  11: "Attachment",
};

const helpPages = new Map();

function cleanDescription(description) {
  return (description ?? "No description available.").replace(
    /^[^|]*\|\s*/,
    ""
  );
}

function buildEmbed(index, pages) {
  const embed = new EmbedBuilder()
    .setTitle("📚 Available Commands")
    .setFooter({ text: `Page ${index + 1} of ${pages.length}` });

  const groups = {};
  for (const entry of pages[index]) {
    if (!groups[entry.category]) groups[entry.category] = [];
    groups[entry.category].push(entry.text);
  }

  for (const [category, texts] of Object.entries(groups)) {
    embed.addFields({ name: category, value: texts.join("\n") });
  }

  return embed;
}

function buildRow(index, pages, forceDisable = false) {
  const prev = new ButtonBuilder()
    .setEmoji("⬅")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId("help_prev");
  const next = new ButtonBuilder()
    .setEmoji("➡")
    .setStyle(ButtonStyle.Secondary)
    .setCustomId("help_next");

  if (forceDisable || index === 0) prev.setDisabled(true);
  if (forceDisable || index === pages.length - 1) next.setDisabled(true);

  return new ActionRowBuilder().addComponents(prev, next);
}

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const { client } = interaction;
  const commandName = interaction.options.getString("command");

  const commands = Array.from(client.commands.values());

  if (commandName) {
    const command = commands.find((c) => c.data.name === commandName);
    if (!command) {
      return interaction.reply({
        content: `❌ No command found with the name \`${commandName}\`.`,
        flags: "Ephemeral",
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`📖 Help: /${command.data.name}`)
      .setDescription(cleanDescription(command.data.description));

    if (command.category) {
      embed.addFields({
        name: "Category",
        value: command.category,
        inline: true,
      });
    }

    const options = command.data.toJSON().options;
    if (options && options.length > 0) {
      embed.addFields({
        name: "Options",
        value: options
          .map(
            (i) =>
              `→ **${i.name}** (${
                optionTypeValues[Number(i.type)] ?? "Unknown"
              }) - ${i?.description ?? "No description available."}`
          )
          .join("\n"),
      });
    }

    return await interaction.reply({ embeds: [embed], flags: "Ephemeral" });
  }

  const byCategory = new Map();

  for (const command of commands) {
    const cat = command.category ?? "Misc";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push({
      name: command.data.name,
      text: `**/${command.data.name}** - ${cleanDescription(
        command.data.description
      )}`,
    });
  }

  const allEntries = [];
  for (const [cat, entries] of [...byCategory.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      allEntries.push({ category: cat, text: entry.text });
    }
  }

  if (allEntries.length === 0) {
    return interaction.reply({
      content: "❌ No commands available",
      flags: "Ephemeral",
    });
  }

  const pages = [];
  for (let i = 0; i < allEntries.length; i += MAX_COMMANDS_PER_PAGE) {
    pages.push(allEntries.slice(i, i + MAX_COMMANDS_PER_PAGE));
  }

  const reply = await interaction.reply({
    embeds: [buildEmbed(0, pages)],
    components: pages.length > 1 ? [buildRow(0, pages)] : [],
    flags: "Ephemeral",
  });

  if (pages.length > 1) {
    helpPages.set(reply.id, {
      pages,
      pageIndex: 0,
      userId: interaction.user.id,
    });
  }
};

module.exports = { data, run, helpPages, buildEmbed, buildRow };