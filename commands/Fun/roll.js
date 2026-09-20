const {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  ApplicationIntegrationType,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ContainerBuilder,
  MessageFlags,
} = require("discord.js");
const { random, ellipsis } = require("../../functions/utils.js");

const data = new SlashCommandBuilder()
  .setName("roll")
  .setDescription("Fun | Rolls a die and obtain the number")
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel,
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  )
  .addNumberOption((option) =>
    option
      .setName("min")
      .setDescription("The minimum the die can roll")
      .setRequired(false)
      .setMinValue(-1e5)
      .setMaxValue(0),
  )
  .addNumberOption((option) =>
    option
      .setName("max")
      .setDescription("The maximum the die can roll")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(1e5),
  )
  .addNumberOption((option) =>
    option
      .setName("amount")
      .setDescription("The amount of dice to roll")
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(50),
  );

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const min = interaction.options.getNumber("min") ?? 1;
  const max = interaction.options.getNumber("max") ?? 6;
  const amount = interaction.options.getNumber("amount") ?? 1;

  try {
    if (min > max) {
      return await interaction.reply({
        content: "❌ Minimum value cannot be greater than maximum value.",
        ephemeral: true,
      });
    }

    const rolls = [];
    for (let i = 0; i < amount; i++) {
      rolls.push(random(min, max));
    }

    const sum = rolls.reduce((a, b) => a + b, 0);
    const average = Math.round((sum / amount) * 100) / 100;

    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## Rolled ${amount} ${amount === 1 ? "die" : "dice"}`,
      ),
      new TextDisplayBuilder().setContent(`**Result:** ${sum}`),
    );

    if (amount > 1) {
      container
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Average:** ${average}`),
        )
        .addComponents(
          new SeparatorBuilder()
            .setDivider(true)
            .setSpacing(SeparatorSpacingSize.Small),
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Individual Results:**\n\`${ellipsis(rolls.join(", "), 1000)}\``,
          ),
        );
    }

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (err) {
    console.error("Roll error:", err);
    await interaction.reply({
      content: "❌ Could not generate roll.",
      ephemeral: true,
    });
  }
};

module.exports = { data, run };
