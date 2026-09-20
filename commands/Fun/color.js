const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  EmbedBuilder,
} = require("discord.js");
const { createCanvas } = require("@napi-rs/canvas");
const { random } = require("../../functions/utils.js");

const data = new SlashCommandBuilder()
  .setName("color")
  .setDescription("Fun | Generate random colors or get info on a color")
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
    sub.setName("random").setDescription("Generate a random color"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("info")
      .setDescription("Get info and conversions for a color")
      .addStringOption((opt) =>
        opt
          .setName("color")
          .setDescription(
            "Hex, rgb(), hsl(), hsv(), cmyk(), or a CSS color name",
          )
          .setRequired(true),
      ),
  );

const NAMED_COLORS = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  lime: "#00ff00",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  aqua: "#00ffff",
  magenta: "#ff00ff",
  fuchsia: "#ff00ff",
  silver: "#c0c0c0",
  gray: "#808080",
  grey: "#808080",
  maroon: "#800000",
  olive: "#808000",
  purple: "#800080",
  teal: "#008080",
  navy: "#000080",
  orange: "#ffa500",
  pink: "#ffc0cb",
  hotpink: "#ff69b4",
  brown: "#a52a2a",
  gold: "#ffd700",
  coral: "#ff7f50",
  salmon: "#fa8072",
  crimson: "#dc143c",
  indigo: "#4b0082",
  violet: "#ee82ee",
  turquoise: "#40e0d0",
  tan: "#d2b48c",
  beige: "#f5f5dc",
  ivory: "#fffff0",
  khaki: "#f0e68c",
  lavender: "#e6e6fa",
  plum: "#dda0dd",
  orchid: "#da70d6",
  chocolate: "#d2691e",
  tomato: "#ff6347",
  skyblue: "#87ceeb",
  steelblue: "#4682b4",
  royalblue: "#4169e1",
  slateblue: "#6a5acd",
  forestgreen: "#228b22",
  seagreen: "#2e8b57",
  limegreen: "#32cd32",
  springgreen: "#00ff7f",
  chartreuse: "#7fff00",
  firebrick: "#b22222",
  darkred: "#8b0000",
  darkgreen: "#006400",
  darkblue: "#00008b",
  lightblue: "#add8e6",
  lightgreen: "#90ee90",
  lightgray: "#d3d3d3",
  lightgrey: "#d3d3d3",
  darkgray: "#a9a9a9",
  darkgrey: "#a9a9a9",
  rebeccapurple: "#663399",
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function rgbToHex({ r, g, b }) {
  return (
    "#" +
    [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")
  );
}

function rgbToHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function rgbToHsv({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : d / max;
  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    v: Math.round(max * 100),
  };
}

function rgbToCmyk({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };

  return {
    c: Math.round(((1 - r - k) / (1 - k)) * 100),
    m: Math.round(((1 - g - k) / (1 - k)) * 100),
    y: Math.round(((1 - b - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

function hslToRgb({ h, s, l }) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function hsvToRgb({ h, s, v }) {
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function cmykToRgb({ c, m, y, k }) {
  c /= 100;
  m /= 100;
  y /= 100;
  k /= 100;
  return {
    r: Math.round(255 * (1 - c) * (1 - k)),
    g: Math.round(255 * (1 - m) * (1 - k)),
    b: Math.round(255 * (1 - y) * (1 - k)),
  };
}

/**
 * Parse a user-provided color string into RGB.
 * @param {string} input The raw user input.
 * @returns {{r: number, g: number, b: number} | null} RGB (0-255) or null if unparseable.
 */
function parseColor(input) {
  const str = input.trim().toLowerCase();

  const named = NAMED_COLORS[str.replace(/[\s_-]/g, "")];
  if (named) return parseColor(named);

  const hex = str.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    let value = hex[1];
    if (value.length === 3) {
      value = value
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }

  const fn = str.match(/^(rgb|hsl|hsv|hsb|cmyk)a?\s*\(?\s*([^)]*?)\s*\)?$/);
  if (fn) {
    const nums = fn[2]
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((v) => Number(v.replace(/[%°]|deg/g, "")));

    if (nums.some((n) => !Number.isFinite(n))) return null;

    switch (fn[1]) {
      case "rgb":
        if (nums.length < 3) return null;
        return {
          r: clamp(Math.round(nums[0]), 0, 255),
          g: clamp(Math.round(nums[1]), 0, 255),
          b: clamp(Math.round(nums[2]), 0, 255),
        };
      case "hsl":
        if (nums.length < 3) return null;
        return hslToRgb({
          h: ((nums[0] % 360) + 360) % 360,
          s: clamp(nums[1], 0, 100),
          l: clamp(nums[2], 0, 100),
        });
      case "hsv":
      case "hsb":
        if (nums.length < 3) return null;
        return hsvToRgb({
          h: ((nums[0] % 360) + 360) % 360,
          s: clamp(nums[1], 0, 100),
          v: clamp(nums[2], 0, 100),
        });
      case "cmyk":
        if (nums.length < 4) return null;
        return cmykToRgb({
          c: clamp(nums[0], 0, 100),
          m: clamp(nums[1], 0, 100),
          y: clamp(nums[2], 0, 100),
          k: clamp(nums[3], 0, 100),
        });
    }
  }

  if (/^\d+$/.test(str)) {
    const num = Number(str);
    if (num <= 0xffffff) {
      return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }
  }

  return null;
}

function relativeLuminance({ r, g, b }) {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function nearestNamedColor(rgb) {
  let best = null;
  let bestDist = Infinity;

  for (const [name, hex] of Object.entries(NAMED_COLORS)) {
    const c = parseColor(hex);
    const dist = (c.r - rgb.r) ** 2 + (c.g - rgb.g) ** 2 + (c.b - rgb.b) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }

  return { name: best, exact: bestDist === 0 };
}

async function renderSwatch(rgb) {
  const hex = rgbToHex(rgb);
  const canvas = createCanvas(300, 150);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 300, 150);

  const textColor =
    contrastRatio(rgb, { r: 255, g: 255, b: 255 }) >=
    contrastRatio(rgb, { r: 0, g: 0, b: 0 })
      ? "#ffffff"
      : "#000000";

  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText(hex.toUpperCase(), 150, 75);

  return new AttachmentBuilder(await canvas.encode("png"), {
    name: "color.png",
  });
}

function buildEmbed(rgb) {
  const hex = rgbToHex(rgb);
  const hsl = rgbToHsl(rgb);
  const hsv = rgbToHsv(rgb);
  const cmyk = rgbToCmyk(rgb);
  const nearest = nearestNamedColor(rgb);
  const decimal = (rgb.r << 16) | (rgb.g << 8) | rgb.b;

  const onWhite = contrastRatio(rgb, { r: 255, g: 255, b: 255 });
  const onBlack = contrastRatio(rgb, { r: 0, g: 0, b: 0 });

  return new EmbedBuilder()
    .setTitle(
      nearest.exact
        ? `🎨 ${nearest.name} (${hex.toUpperCase()})`
        : `🎨 ${hex.toUpperCase()}`,
    )
    .setColor(decimal)
    .setImage("attachment://color.png")
    .addFields(
      { name: "Hex", value: `\`${hex.toUpperCase()}\``, inline: true },
      {
        name: "RGB",
        value: `\`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})\``,
        inline: true,
      },
      { name: "Decimal", value: `\`${decimal}\``, inline: true },
      {
        name: "HSL",
        value: `\`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)\``,
        inline: true,
      },
      {
        name: "HSV",
        value: `\`hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)\``,
        inline: true,
      },
      {
        name: "CMYK",
        value: `\`cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)\``,
        inline: true,
      },
      {
        name: "Closest named color",
        value: nearest.exact ? nearest.name : `~${nearest.name}`,
        inline: true,
      },
      {
        name: "Contrast",
        value: `White: ${onWhite.toFixed(2)}:1\nBlack: ${onBlack.toFixed(2)}:1`,
        inline: true,
      },
    );
}

const run = async (interaction = ChatInputCommandInteraction.prototype) => {
  const subcommand = interaction.options.getSubcommand();

  let rgb;
  if (subcommand === "random") {
    rgb = { r: random(0, 255), g: random(0, 255), b: random(0, 255) };
  } else {
    const input = interaction.options.getString("color", true);
    rgb = parseColor(input);

    if (!rgb) {
      return interaction.reply({
        content:
          "❌ I couldn't understand that color. Try something like `#ff8800`, `rgb(255, 136, 0)`, `hsl(32, 100%, 50%)`, `hsv(32, 100%, 100%)`, `cmyk(0, 47, 100, 0)` or `orange`",
        flags: "Ephemeral",
      });
    }
  }

  const swatch = await renderSwatch(rgb);

  return interaction.reply({
    embeds: [buildEmbed(rgb)],
    files: [swatch],
  });
};

module.exports = { data, run };
