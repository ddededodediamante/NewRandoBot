const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  EmbedBuilder,
  codeBlock,
  ChatInputCommandInteraction,
} = require("discord.js");

const data = new SlashCommandBuilder()
  .setName("eval")
  .setDescription("Owner | Evaluate JavaScript code")
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  )
  .addStringOption((option) =>
    option
      .setName("code")
      .setDescription("The JavaScript code to evaluate")
      .setRequired(true)
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  if (interaction.user.id !== "694587798598058004") {
    return await interaction.reply({
      content: "❌ Not enough permissions",
      flags: "Ephemeral",
    });
  } else {
    await interaction.deferReply({ flags:'Ephemeral' });
    const embed = new EmbedBuilder();

    try {
      const start_time = new Date();
      const result = await eval(interaction.options.getString("code"));
      const end_time = new Date();

      embed.setTitle("Eval Successful");
      embed.setColor("Green");
      embed.setFields(
        { name: "Result", value: codeBlock(String(result)) },
        { name: "Type", value: codeBlock(typeof result) },
        {
          name: "Time (ms)",
          value: codeBlock(Math.abs(end_time - start_time).toString()),
        }
      );
    } catch (error) {
      embed.setTitle("Eval Error");
      embed.setColor("Red");
      embed.setDescription(codeBlock(String(error)));
    }

    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp({
        embeds: [embed],
        flags: "Ephemeral",
      });
    } else {
      return await interaction.reply({ embeds: [embed], flags: "Ephemeral" });
    }
  }
};

module.exports = { data, run };
