const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
  EmbedBuilder,
} = require("discord.js");
const Users = require("../../models/userSchema.js");
const { random } = require("../../functions/utils.js");

const data = new SlashCommandBuilder()
  .setName("crime")
  .setDescription("Economy | Commit a crime for quick cash (risky!)")
  .setContexts(
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel,
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  )
  .addStringOption((option) =>
    option
      .setName("crime")
      .setDescription("The crime to commit")
      .setRequired(true)
      .setChoices(
        { name: "Jaywalking (safe, low reward)", value: "jaywalking" },
        { name: "Shoplifting (medium risk)", value: "shoplifting" },
        { name: "Pickpocketing (medium-high risk)", value: "pickpocketing" },
        { name: "Bank Heist (high risk, big reward)", value: "heist" },
        { name: "Tax Fraud (extreme risk, huge reward)", value: "taxfraud" },
      ),
  );

const COOLDOWN_MS = 20 * 60 * 1000;
const CRIMES = {
  jaywalking: {
    label: "jaywalking",
    verb: "jaywalked across a busy street",
    failChance: 0.1,
    min: 5,
    max: 20,
    failPenalty: [1, 6],
  },
  shoplifting: {
    label: "shoplifting",
    verb: "shoplifted from a corner store",
    failChance: 0.3,
    min: 20,
    max: 60,
    failPenalty: [10, 25],
  },
  pickpocketing: {
    label: "pickpocketing",
    verb: "pickpocketed a stranger downtown",
    failChance: 0.45,
    min: 40,
    max: 100,
    failPenalty: [20, 50],
  },
  heist: {
    label: "bank heist",
    verb: "attempted a bank heist",
    failChance: 0.6,
    min: 100,
    max: 250,
    failPenalty: [50, 120],
  },
  taxfraud: {
    label: "tax fraud",
    verb: "committed tax fraud",
    failChance: 0.8,
    min: 250,
    max: 600,
    failPenalty: [100, 250],
  },
};

const BOSS_MESSAGES = [
  "yo i saw you on the news. we need to talk. my office. NOW",
  "so a little birdy told me you {crime}. explain yourself before i explain your severance package",
  "just got a call from the cops asking about one of MY employees. wanna guess why",
  "i know it was you who {crime}. i have eyes everywhere. EYES EVERYWHERE",
  "heard you {crime} lol nice going genius, you're paying for that PR mess",
  "not you getting caught after you {crime}... buddy i can't keep bailing you out",
  "the security footage of you is uh. not great. we're deducting for damages",
  "bro i literally just told corporate you were 'reliable' and then you go and {crime}??",
  "my nephew saw you {crime} on his phone. it's already a meme. you're paying the fine",
  "i'm not mad i'm just disappointed. also you're fined. mostly the fine part tbh",
];

function getRandomBossMessage(crimeVerb) {
  const template = BOSS_MESSAGES[random(0, BOSS_MESSAGES.length)];
  return template.replace("{crime}", crimeVerb);
}

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const crimeKey = interaction.options.getString("crime");
  const crime = CRIMES[crimeKey];
  const rud = interaction.client.getEmoji("rud");

  let user = await Users.findOne({ id: interaction.user.id });
  if (!user) {
    user = await Users.create({ id: interaction.user.id });
  }

  if (user.economy.crime?.lastCommitted) {
    const nextTime = new Date(
      user.economy.crime.lastCommitted.getTime() + COOLDOWN_MS,
    );
    if (new Date() < nextTime) {
      const unix = Math.floor(nextTime.getTime() / 1000);
      return interaction.reply({
        content: `❌ Lay low for a bit! Try again <t:${unix}:R>.`,
        flags: "Ephemeral",
      });
    }
  }

  user.economy.crime = { lastCommitted: new Date() };

  const success = Math.random() > crime.failChance;

  if (success) {
    const earnings = random(crime.min, crime.max);
    user.economy.ruds += earnings;
    await user.save();

    return interaction.reply({
      content: `✅ You ${crime.verb} and got away with **${earnings}** ${rud}!`,
    });
  }

  const penalty = random(crime.failPenalty[0], crime.failPenalty[1]);
  user.economy.ruds = Math.max(0, user.economy.ruds - penalty);
  await user.save();

  const caughtMessage = `❌ You got caught while you ${crime.verb}! You paid **${penalty}** ${rud} in fines.`;

  if (!user.economy.job?.type) {
    return interaction.reply({
      content: caughtMessage,
    });
  }

  const bossEmbed = new EmbedBuilder()
    .setColor("Red")
    .setAuthor({
      name: "Your Boss",
      iconURL: `https://cdn.discordapp.com/embed/avatars/${random(1, 5)}.png`,
    })
    .setDescription(getRandomBossMessage(crime.verb));

  return interaction.reply({
    content: caughtMessage,
    embeds: [bossEmbed],
  });
};

module.exports = { data, run };
