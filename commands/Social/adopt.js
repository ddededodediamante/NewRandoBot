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
const { walkTree } = require("../../functions/family.js");

const PROPOSAL_TIMEOUT = 2 * 60 * 1000;
const MAX_PARENTS = 3;
const MAX_CHILDREN = 15;

const data = new SlashCommandBuilder()
  .setName("adopt")
  .setDescription(
    "Social | Adopt other users and build a family tree (just for fun)",
  )
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
      .setName("user")
      .setDescription("Ask to adopt another user")
      .addUserOption((opt) =>
        opt
          .setName("target")
          .setDescription("The user you want to adopt")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("family")
      .setDescription("View your or another user's family")
      .addUserOption((opt) =>
        opt
          .setName("target")
          .setDescription("User's family to view")
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("disown")
      .setDescription("Disown one of your children")
      .addUserOption((opt) =>
        opt
          .setName("child")
          .setDescription("The child to disown")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("runaway")
      .setDescription("Run away from your parents")
      .addUserOption((opt) =>
        opt
          .setName("parent")
          .setDescription("Only leave this parent (default: leave all)")
          .setRequired(false),
      ),
  );

const pendingAdoptions = new Set();

async function getUser(id) {
  let user = await Users.findOne({ id });
  if (!user) user = await Users.create({ id });
  return user;
}

async function getAdoptionProblem(parent, child) {
  const parentFamily = parent.family ?? { parents: [], children: [] };
  const childFamily = child.family ?? { parents: [], children: [] };

  if (parentFamily.children.includes(child.id)) {
    return `<@${child.id}> is already your child`;
  }
  if ((parent.marriage?.partners ?? []).some((p) => p.id === child.id)) {
    return `<@${child.id}> is your partner, you can't adopt them`;
  }
  if (parentFamily.parents.some((id) => childFamily.parents.includes(id))) {
    return `<@${child.id}> is your sibling, you can't adopt them`;
  }
  if (parentFamily.children.length >= MAX_CHILDREN) {
    return `you already have **${MAX_CHILDREN}** children, that's the maximum`;
  }
  if (childFamily.parents.length >= MAX_PARENTS) {
    return `<@${child.id}> already has **${MAX_PARENTS}** parents, that's the maximum`;
  }

  const [ancestors, descendants] = await Promise.all([
    walkTree(parent.id, "parents", child.id),
    walkTree(parent.id, "children", child.id),
  ]);
  if (ancestors.has(child.id)) {
    return `<@${child.id}> is your ancestor, you can't adopt them`;
  }
  if (descendants.has(child.id) && descendants.get(child.id) < 3) {
    return `<@${child.id}> is already your descendant`;
  }

  return null;
}

const formatList = (ids, max = 10) => {
  if (!ids.length) return "None";
  const shown = ids.slice(0, max).map((id) => `<@${id}>`);
  const extra = ids.length - max;
  return shown.join(", ") + (extra > 0 ? ` +${extra} more` : "");
};

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "user") {
    const target = interaction.options.getUser("target", true);

    if (target.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ You can't adopt yourself",
        flags: "Ephemeral",
      });
    }

    if (target.bot) {
      return interaction.reply({
        content: "❌ Bots can't be adopted, we come pre-installed",
        flags: "Ephemeral",
      });
    }

    if (
      pendingAdoptions.has(interaction.user.id) ||
      pendingAdoptions.has(target.id)
    ) {
      return interaction.reply({
        content: "❌ One of you already has a pending adoption, wait a moment",
        flags: "Ephemeral",
      });
    }

    const [parentDoc, childDoc] = await Promise.all([
      getUser(interaction.user.id),
      getUser(target.id),
    ]);

    const problem = await getAdoptionProblem(parentDoc, childDoc);
    if (problem) {
      return interaction.reply({
        content: `❌ ${problem}`,
        flags: "Ephemeral",
        allowedMentions: { parse: [] },
      });
    }

    const buildRow = (disabled = false) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`adopt_accept_${interaction.id}`)
          .setLabel("Accept")
          .setEmoji("👨‍👧")
          .setStyle(ButtonStyle.Success)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId(`adopt_decline_${interaction.id}`)
          .setLabel("Decline")
          .setEmoji("🚪")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(disabled),
      );

    pendingAdoptions.add(interaction.user.id);
    pendingAdoptions.add(target.id);

    const reply = await interaction.reply({
      content: `🍼 ${target}, **${interaction.user.displayName}** would like to adopt you! Do you accept?`,
      components: [buildRow()],
      allowedMentions: { users: [target.id] },
      withResponse: true,
    });

    const message = reply.resource?.message;
    if (!message) {
      pendingAdoptions.delete(interaction.user.id);
      pendingAdoptions.delete(target.id);
      return;
    }

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === target.id ||
        (i.user.id === interaction.user.id &&
          i.customId.startsWith("adopt_decline_")),
      time: PROPOSAL_TIMEOUT,
      max: 1,
    });

    const bystanders = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id !== target.id &&
        !(
          i.user.id === interaction.user.id &&
          i.customId.startsWith("adopt_decline_")
        ),
      time: PROPOSAL_TIMEOUT,
    });
    bystanders.on("collect", (i) =>
      i
        .reply({
          content: "❌ This adoption isn't for you",
          flags: "Ephemeral",
        })
        .catch(() => {}),
    );

    let answered = false;

    collector.on("collect", async (i) => {
      answered = true;
      bystanders.stop();

      try {
        if (i.customId.startsWith("adopt_decline_")) {
          return await i.update({
            content:
              i.user.id === target.id
                ? `🚪 ${target} declined to be adopted by **${interaction.user.displayName}**...`
                : `🚪 **${interaction.user.displayName}** cancelled their adoption request to ${target}...`,
            components: [buildRow(true)],
            allowedMentions: { parse: [] },
          });
        }

        const [freshParent, freshChild] = await Promise.all([
          getUser(interaction.user.id),
          getUser(target.id),
        ]);

        const stale = await getAdoptionProblem(freshParent, freshChild);
        if (stale) {
          return await i.update({
            content: `❌ The adoption can't go through anymore: ${stale}`,
            components: [buildRow(true)],
            allowedMentions: { parse: [] },
          });
        }

        await Promise.all([
          Users.updateOne(
            { id: interaction.user.id },
            { $addToSet: { "family.children": target.id } },
          ),
          Users.updateOne(
            { id: target.id },
            { $addToSet: { "family.parents": interaction.user.id } },
          ),
        ]);

        await i.update({
          content: `👨‍👧 ${interaction.user} has adopted ${target}! Welcome to the family! 🎉`,
          components: [buildRow(true)],
          allowedMentions: { users: [interaction.user.id, target.id] },
        });
      } catch (err) {
        console.error("Adopt accept error:", err);
      }
    });

    collector.on("end", async () => {
      pendingAdoptions.delete(interaction.user.id);
      pendingAdoptions.delete(target.id);
      bystanders.stop();

      if (!answered) {
        await interaction
          .editReply({
            content: `⏳ ${target} didn't answer in time, the adoption request expired`,
            components: [buildRow(true)],
            allowedMentions: { parse: [] },
          })
          .catch(() => {});
      }
    });

    return;
  }

  if (subcommand === "family") {
    const targetUser =
      interaction.options.getUser("target") || interaction.user;

    const doc = await Users.findOne({ id: targetUser.id });
    const parentIds = [...(doc?.family?.parents ?? [])];
    const childIds = [...(doc?.family?.children ?? [])];
    const partnerIds = (doc?.marriage?.partners ?? []).map((p) => p.id);

    const [parentDocs, childDocs] = await Promise.all([
      parentIds.length
        ? Users.find({ id: { $in: parentIds } })
        : Promise.resolve([]),
      childIds.length
        ? Users.find({ id: { $in: childIds } })
        : Promise.resolve([]),
    ]);

    const siblings = new Set();
    for (const p of parentDocs) {
      for (const id of p.family?.children ?? []) {
        if (id !== targetUser.id) siblings.add(id);
      }
    }

    const grandchildren = new Set();
    for (const c of childDocs) {
      for (const id of c.family?.children ?? []) grandchildren.add(id);
    }

    const embed = new EmbedBuilder()
      .setTitle(`🌳 ${targetUser.username}'s Family`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 512 }))
      .addFields(
        { name: "Parents", value: formatList(parentIds), inline: true },
        {
          name: partnerIds.length > 1 ? "Partners" : "Partner",
          value: formatList(partnerIds),
          inline: true,
        },
        { name: "Siblings", value: formatList([...siblings]), inline: true },
        {
          name: `Children (${childIds.length}/${MAX_CHILDREN})`,
          value: formatList(childIds),
        },
        {
          name: `Grandchildren (${grandchildren.size})`,
          value: formatList([...grandchildren], 8),
        },
      );

    return interaction.reply({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  }

  if (subcommand === "disown") {
    const target = interaction.options.getUser("child", true);
    const me = await getUser(interaction.user.id);

    if (!(me.family?.children ?? []).includes(target.id)) {
      return interaction.reply({
        content: `❌ ${target} isn't your child`,
        flags: "Ephemeral",
        allowedMentions: { parse: [] },
      });
    }

    await Promise.all([
      Users.updateOne(
        { id: interaction.user.id },
        { $pull: { "family.children": target.id } },
      ),
      Users.updateOne(
        { id: target.id },
        { $pull: { "family.parents": interaction.user.id } },
      ),
    ]);

    return interaction.reply({
      content: `💔 ${interaction.user} has disowned ${target}`,
      allowedMentions: { parse: [] },
    });
  }

  if (subcommand === "runaway") {
    const parentOption = interaction.options.getUser("parent");
    const me = await getUser(interaction.user.id);
    const parents = [...(me.family?.parents ?? [])];

    if (!parents.length) {
      return interaction.reply({
        content: "❌ You don't have any parents to run away from",
        flags: "Ephemeral",
      });
    }

    let leaving = parents;
    if (parentOption) {
      if (!parents.includes(parentOption.id)) {
        return interaction.reply({
          content: `❌ ${parentOption} isn't your parent`,
          flags: "Ephemeral",
          allowedMentions: { parse: [] },
        });
      }
      leaving = [parentOption.id];
    }

    await Promise.all([
      Users.updateOne(
        { id: interaction.user.id },
        { $pullAll: { "family.parents": leaving } },
      ),
      Users.updateMany(
        { id: { $in: leaving } },
        { $pull: { "family.children": interaction.user.id } },
      ),
    ]);

    return interaction.reply({
      content: `🎒 ${interaction.user} ran away from ${leaving.map((id) => `<@${id}>`).join(" and ")}`,
      allowedMentions: { parse: [] },
    });
  }
};

module.exports = { data, run };
