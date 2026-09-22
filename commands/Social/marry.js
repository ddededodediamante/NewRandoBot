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

const PROPOSAL_TIMEOUT = 2 * 60 * 1000;
const MAX_PARTNERS = 2;

const data = new SlashCommandBuilder()
  .setName("marry")
  .setDescription("Social | Marry another user (just for fun)")
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
    sub
      .setName("divorce")
      .setDescription("Divorce one of your partners")
      .addUserOption((opt) =>
        opt
          .setName("partner")
          .setDescription("Which partner to divorce (default: your only one)")
          .setRequired(false),
      ),
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

    const proposer = await getUser(interaction.user.id);
    const proposed = await getUser(target.id);

    const proposerPartners = proposer.marriage?.partners ?? [];
    const proposedPartners = proposed.marriage?.partners ?? [];

    if (proposerPartners.some((p) => p.id === target.id)) {
      return interaction.reply({
        content: `❌ You're already married to ${target}`,
        flags: "Ephemeral",
        allowedMentions: { parse: [] },
      });
    }

    if (proposerPartners.length >= MAX_PARTNERS) {
      return interaction.reply({
        content: `❌ You already have **${MAX_PARTNERS}** partners, that's the maximum. Use **/marry divorce** first`,
        flags: "Ephemeral",
      });
    }

    if (proposedPartners.length >= MAX_PARTNERS) {
      return interaction.reply({
        content: `❌ ${target} already has **${MAX_PARTNERS}** partners, that's the maximum`,
        flags: "Ephemeral",
        allowedMentions: { parse: [] },
      });
    }

    const currentPartnerId = proposerPartners[0]?.id ?? null;

    const locked = [interaction.user.id, target.id, currentPartnerId].filter(
      Boolean,
    );
    if (locked.some((id) => pendingProposals.has(id))) {
      return interaction.reply({
        content: "❌ One of you already has a pending proposal, wait a moment",
        flags: "Ephemeral",
      });
    }

    const familyProblem = await getFamilyProblem(proposer, proposed);
    if (familyProblem) {
      return interaction.reply({
        content: `❌ ${familyProblem}`,
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
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
      );

    for (const id of locked) pendingProposals.add(id);
    const releaseLocks = () => {
      for (const id of locked) pendingProposals.delete(id);
    };

    const reply = await interaction.reply({
      content: `💍 ${target}, **${interaction.user.displayName}** is asking for your hand in marriage! Do you accept?`,
      components: [buildRow()],
      allowedMentions: { users: [target.id] },
      withResponse: true,
    });

    const message = reply.resource?.message;
    if (!message) {
      releaseLocks();
      return;
    }

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === target.id ||
        (i.user.id === interaction.user.id &&
          i.customId.startsWith("marry_decline_")),
      time: PROPOSAL_TIMEOUT,
      max: 1,
    });

    const bystanders = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id !== target.id &&
        !(
          i.user.id === interaction.user.id &&
          i.customId.startsWith("marry_decline_")
        ),
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

    // DISCLAIMER: yeah i needed help here tooo...
    const finalize = async (i) => {
      const [a, b] = await Promise.all([
        getUser(interaction.user.id),
        getUser(target.id),
      ]);
      const aPartners = a.marriage?.partners ?? [];
      const bPartners = b.marriage?.partners ?? [];

      if (
        aPartners.length >= MAX_PARTNERS ||
        bPartners.length >= MAX_PARTNERS ||
        aPartners.some((p) => p.id === target.id)
      ) {
        await i.update({
          content:
            "❌ One of you got married to someone else while this proposal was open",
          components: [buildRow(true)],
        });
        return;
      }

      const staleFamily = await getFamilyProblem(a, b);
      if (staleFamily) {
        await i.update({
          content: `❌ The marriage can't go through anymore: ${staleFamily}`,
          components: [buildRow(true)],
          allowedMentions: { parse: [] },
        });
        return;
      }

      const marriedAt = new Date();
      a.marriage.partners = [...aPartners, { id: target.id, marriedAt }];
      b.marriage.partners = [
        ...bPartners,
        { id: interaction.user.id, marriedAt },
      ];
      await Promise.all([a.save(), b.save()]);

      await i.update({
        content: `💒 ${interaction.user} and ${target} are now married! Congratulations! 🎉`,
        components: [buildRow(true)],
        allowedMentions: { users: [interaction.user.id, target.id] },
      });

      if (currentPartnerId) {
        try {
          const currentPartnerUser =
            await interaction.client.users.fetch(currentPartnerId);
          await currentPartnerUser.send(
            `💍 Heads up! **${interaction.user.displayName}** just married ${target.username} too. You're both still married to them.`,
          );
        } catch (err) {}
      }
    };

    collector.on("collect", async (i) => {
      answered = true;
      bystanders.stop();

      try {
        if (i.customId.startsWith("marry_decline_")) {
          releaseLocks();
          return await i.update({
            content:
              i.user.id === target.id
                ? `💔 ${target} declined **${interaction.user.displayName}**'s proposal...`
                : `💔 **${interaction.user.displayName}** withdrew their proposal to ${target}...`,
            components: [buildRow(true)],
            allowedMentions: { parse: [] },
          });
        }

        await finalize(i);
      } catch (err) {
        console.error("Marry accept error:", err);
      } finally {
        releaseLocks();
      }
    });

    collector.on("end", async () => {
      bystanders.stop();

      if (!answered) {
        releaseLocks();
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
    const partners = account.marriage?.partners ?? [];

    const embed = new EmbedBuilder()
      .setTitle(`${targetUser.username}'s Marriage`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 512 }));

    if (!partners.length) {
      embed.setDescription("💔 Not married");
    } else {
      embed.setDescription(
        partners
          .map(({ id, marriedAt }) => {
            const unix = marriedAt
              ? Math.floor(marriedAt.getTime() / 1000)
              : null;
            return [
              `💍 **Married to:** <@${id}>`,
              unix ? `**Since:** <t:${unix}:D> (<t:${unix}:R>)` : null,
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n\n"),
      );
    }

    return interaction.reply({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  }

  if (subcommand === "divorce") {
    const partnerOption = interaction.options.getUser("partner");
    const account = await getUser(interaction.user.id);
    const partners = account.marriage?.partners ?? [];

    if (!partners.length) {
      return interaction.reply({
        content: "❌ You're not married to anyone",
        flags: "Ephemeral",
      });
    }

    let partnerId = partnerOption?.id;
    if (!partnerId) {
      if (partners.length > 1) {
        return interaction.reply({
          content: `❌ You have multiple partners (${partners
            .map((p) => `<@${p.id}>`)
            .join(", ")}), specify which one with the **partner** option`,
          flags: "Ephemeral",
          allowedMentions: { parse: [] },
        });
      }
      partnerId = partners[0].id;
    }

    if (!partners.some((p) => p.id === partnerId)) {
      return interaction.reply({
        content: `❌ You're not married to <@${partnerId}>`,
        flags: "Ephemeral",
        allowedMentions: { parse: [] },
      });
    }

    const partner = await getUser(partnerId);

    account.marriage.partners = partners.filter((p) => p.id !== partnerId);
    partner.marriage.partners = (partner.marriage?.partners ?? []).filter(
      (p) => p.id !== interaction.user.id,
    );

    await Promise.all([account.save(), partner.save()]);

    return interaction.reply({
      content: `💔 ${interaction.user} and <@${partnerId}> are no longer married`,
      allowedMentions: { parse: [] },
    });
  }
};

module.exports = { data, run };
