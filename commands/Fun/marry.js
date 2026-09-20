const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} = require("discord.js");
const Users = require("../../models/userSchema.js");

const PROPOSAL_TIMEOUT = 60 * 1000;

const data = new SlashCommandBuilder()
  .setName("marry")
  .setDescription("Fun | Marry another user (just for fun)")
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
      .setName("propose")
      .setDescription("Propose to another user")
      .addUserOption((opt) =>
        opt
          .setName("target")
          .setDescription("The user you want to marry")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("status")
      .setDescription("Check your or another user's marriage status")
      .addUserOption((opt) =>
        opt
          .setName("target")
          .setDescription("User's marriage status to check")
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName("divorce").setDescription("Divorce your partner"),
  );

const pendingProposals = new Set();

async function getUser(id) {
  let user = await Users.findOne({ id });
  if (!user) user = await Users.create({ id });
  return user;
}

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "propose") {
    const target = interaction.options.getUser("target", true);

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ You can't marry yourself... unless?",
        flags: "Ephemeral",
      });
    }

    if (target.bot) {
      return interaction.reply({
        content: "❌ Bots can't get married, we're emotionally unavailable",
        flags: "Ephemeral",
      });
    }

    if (
      pendingProposals.has(interaction.user.id) ||
      pendingProposals.has(target.id)
    ) {
      return interaction.reply({
        content: "❌ One of you already has a pending proposal, wait a moment",
        flags: "Ephemeral",
      });
    }

    const proposer = await getUser(interaction.user.id);
    const proposed = await getUser(target.id);

    if (proposer.marriage?.partner) {
      return interaction.reply({
        content: `❌ You're already married to <@${proposer.marriage.partner}>. Use **/marry divorce** first`,
        flags: "Ephemeral",
        allowedMentions: { parse: [] },
      });
    }

    if (proposed.marriage?.partner) {
      return interaction.reply({
        content: `❌ ${target} is already married to someone else`,
        flags: "Ephemeral",
        allowedMentions: { parse: [] },
      });
    }

    const buildRow = (disabled = false) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`marry_accept_${interaction.id}`)
          .setLabel("Accept")
          .setEmoji("💍")
          .setStyle(ButtonStyle.Success)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId(`marry_decline_${interaction.id}`)
          .setLabel("Decline")
          .setEmoji("💔")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(disabled),
      );

    pendingProposals.add(interaction.user.id);
    pendingProposals.add(target.id);

    const reply = await interaction.reply({
      content: `💍 ${target}, **${interaction.user.displayName}** is asking for your hand in marriage! Do you accept?`,
      components: [buildRow()],
      allowedMentions: { users: [target.id] },
      withResponse: true,
    });

    const message = reply.resource?.message;
    if (!message) {
      pendingProposals.delete(interaction.user.id);
      pendingProposals.delete(target.id);
      return;
    }

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === target.id,
      time: PROPOSAL_TIMEOUT,
      max: 1,
    });

    const bystanders = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id !== target.id,
      time: PROPOSAL_TIMEOUT,
    });
    bystanders.on("collect", (i) =>
      i
        .reply({
          content: "❌ This proposal isn't for you",
          flags: "Ephemeral",
        })
        .catch(() => {}),
    );

    let answered = false;

    collector.on("collect", async (i) => {
      answered = true;
      bystanders.stop();

      try {
        if (i.customId.startsWith("marry_decline_")) {
          return await i.update({
            content: `💔 ${target} declined **${interaction.user.displayName}**'s proposal...`,
            components: [buildRow(true)],
            allowedMentions: { parse: [] },
          });
        }

        const [a, b] = await Promise.all([
          getUser(interaction.user.id),
          getUser(target.id),
        ]);

        if (a.marriage?.partner || b.marriage?.partner) {
          return await i.update({
            content:
              "❌ One of you got married to someone else while this proposal was open",
            components: [buildRow(true)],
          });
        }

        const marriedAt = new Date();
        a.marriage = { partner: target.id, marriedAt };
        b.marriage = { partner: interaction.user.id, marriedAt };
        await Promise.all([a.save(), b.save()]);

        await i.update({
          content: `💒 ${interaction.user} and ${target} are now married! Congratulations! 🎉`,
          components: [buildRow(true)],
          allowedMentions: { users: [interaction.user.id, target.id] },
        });
      } catch (err) {
        console.error("Marry accept error:", err);
      }
    });

    collector.on("end", async () => {
      pendingProposals.delete(interaction.user.id);
      pendingProposals.delete(target.id);
      bystanders.stop();

      if (!answered) {
        await interaction
          .editReply({
            content: `⏳ ${target} didn't answer in time, the proposal expired`,
            components: [buildRow(true)],
            allowedMentions: { parse: [] },
          })
          .catch(() => {});
      }
    });

    return;
  }

  if (subcommand === "status") {
    const targetUser =
      interaction.options.getUser("target") || interaction.user;
    const account = await getUser(targetUser.id);
    const { partner, marriedAt } = account.marriage ?? {};

    const embed = new EmbedBuilder()
      .setTitle(`${targetUser.username}'s Marriage`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 512 }));

    if (!partner) {
      embed.setDescription("💔 Not married");
    } else {
      const unix = marriedAt ? Math.floor(marriedAt.getTime() / 1000) : null;
      embed.setDescription(
        [
          `💍 **Married to:** <@${partner}>`,
          unix ? `**Since:** <t:${unix}:D> (<t:${unix}:R>)` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }

    return interaction.reply({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  }

  if (subcommand === "divorce") {
    const account = await getUser(interaction.user.id);
    const partnerId = account.marriage?.partner;

    if (!partnerId) {
      return interaction.reply({
        content: "❌ You're not married to anyone",
        flags: "Ephemeral",
      });
    }

    const partner = await getUser(partnerId);

    account.marriage = { partner: null, marriedAt: null };
    if (partner.marriage?.partner === interaction.user.id) {
      partner.marriage = { partner: null, marriedAt: null };
    }

    await Promise.all([account.save(), partner.save()]);

    return interaction.reply({
      content: `💔 ${interaction.user} and <@${partnerId}> are no longer married`,
      allowedMentions: { parse: [] },
    });
  }
};

module.exports = { data, run };
