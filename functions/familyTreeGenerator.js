const { createCanvas, loadImage } = require("@napi-rs/canvas");
const Users = require("../models/userSchema.js");

const MAX_PEOPLE = 60;
const MAX_OUTPUT_WIDTH = 2400;
const MAX_OUTPUT_HEIGHT = 900;

const NODE = 80;
const H_GAP = 36;
const PARTNER_GAP = 24;
const MIN_GAP = 44;
const PAD = 28;
const LABEL_H = 26;
const LANE = 14;
const BACK_COLOR = "#d6336c";
const ARROW_W = 7;
const ARROW_H = 12;

const BG = "#ffffff";
const TEXT = "#000000";
const FOCUS_RING = "#e8590c";
const PARTNER_COLOR = "#e03131";
const FAMILY_COLORS = [
  "#1971c2",
  "#2f9e44",
  "#f08c00",
  "#9c36b5",
  "#0c8599",
  "#c2255c",
  "#5c940d",
  "#6741d9",
  "#e8590c",
  "#495057",
];

async function collectFamily(startId) {
  const people = new Map();
  let frontier = [startId];
  let truncated = false;

  while (frontier.length) {
    const docs = await Users.find({ id: { $in: frontier } });
    const found = new Map(docs.map((d) => [d.id, d]));
    const next = [];

    for (const id of frontier) {
      if (people.has(id)) continue;
      if (people.size >= MAX_PEOPLE) {
        truncated = true;
        continue;
      }

      const doc = found.get(id);
      const node = {
        id,
        parents: [...(doc?.family?.parents ?? [])],
        children: [...(doc?.family?.children ?? [])],
        partner: doc?.marriage?.partner ?? null,
      };
      people.set(id, node);

      for (const rel of [...node.parents, ...node.children, node.partner]) {
        if (rel && !people.has(rel)) next.push(rel);
      }
    }

    frontier = [...new Set(next)];
  }

  for (const p of people.values()) {
    p.parents = p.parents.filter((id) => id !== p.id && people.has(id));
    p.children = p.children.filter((id) => id !== p.id && people.has(id));
    if (p.partner && (p.partner === p.id || !people.has(p.partner)))
      p.partner = null;
  }

  return { people, truncated };
}

function findBackEdges(people) {
  const back = new Set();
  const state = new Map();

  const visit = (id) => {
    state.set(id, 1);
    for (const childId of people.get(id).children) {
      if (!people.has(childId)) continue;
      const s = state.get(childId);
      if (s === 1) back.add(`${id}>${childId}`);
      else if (!s) visit(childId);
    }
    state.set(id, 2);
  };

  for (const p of people.values())
    if (!p.parents.length && !state.has(p.id)) visit(p.id);
  for (const p of people.values()) if (!state.has(p.id)) visit(p.id);

  return back;
}

function tryAssign(people, ignoredPartners) {
  const gen = new Map();
  for (const p of people.values()) gen.set(p.id, 0);

  const ceiling = people.size;

  const limit = people.size * 3 + 6;
  for (let pass = 0; pass < limit; pass++) {
    let changed = false;

    for (const p of people.values()) {
      for (const parentId of p.parents) {
        const want = gen.get(parentId) + 1;
        if (gen.get(p.id) < want) {
          gen.set(p.id, want);
          changed = true;
        }
      }
      if (
        p.partner &&
        people.has(p.partner) &&
        !ignoredPartners.has(pairKey(p.id, p.partner))
      ) {
        const top = Math.max(gen.get(p.id), gen.get(p.partner));
        if (gen.get(p.id) !== top || gen.get(p.partner) !== top) {
          gen.set(p.id, top);
          gen.set(p.partner, top);
          changed = true;
        }
      }
    }

    if ([...gen.values()].some((g) => g >= ceiling)) return { gen, ok: false };
    if (!changed) return { gen, ok: true };
  }

  return { gen, ok: false };
}

const pairKey = (a, b) => [a, b].sort().join(":");

function assignGenerations(people) {
  const looseCouples = new Set();

  const couples = [];
  const seen = new Set();
  for (const p of people.values()) {
    if (!p.partner || !people.has(p.partner)) continue;
    const key = pairKey(p.id, p.partner);
    if (seen.has(key)) continue;
    seen.add(key);
    couples.push(key);
  }

  let result = tryAssign(people, looseCouples);

  while (!result.ok && looseCouples.size < couples.length) {
    const depth = parentDepth(people);
    let worst = null;
    let worstGap = -1;
    for (const key of couples) {
      if (looseCouples.has(key)) continue;
      const [a, b] = key.split(":");
      const gap = Math.abs(depth.get(a) - depth.get(b));
      if (gap > worstGap) {
        worstGap = gap;
        worst = key;
      }
    }
    if (!worst) break;
    looseCouples.add(worst);
    result = tryAssign(people, looseCouples);
  }

  return { gen: result.gen, looseCouples };
}

function parentDepth(people) {
  const depth = new Map();
  const visiting = new Set();
  const get = (id) => {
    if (depth.has(id)) return depth.get(id);
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let d = 0;
    for (const par of people.get(id).parents) {
      if (people.has(par)) d = Math.max(d, get(par) + 1);
    }
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const id of people.keys()) get(id);
  return depth;
}

function layout(people, gen, looseCouples = new Set()) {
  const maxGen = Math.max(...gen.values());

  const unitOf = new Map();
  const rows = Array.from({ length: maxGen + 1 }, () => []);

  for (const p of people.values()) {
    if (unitOf.has(p.id)) continue;
    const members = [p.id];

    if (
      p.partner &&
      people.get(p.partner)?.partner === p.id &&
      !looseCouples.has(pairKey(p.id, p.partner))
    ) {
      members.push(p.partner);
    }
    const unit = { members, x: 0 };
    for (const m of members) unitOf.set(m, unit);
    rows[gen.get(p.id)].push(unit);
  }

  const unitParents = (unit) => {
    const set = new Set();
    for (const m of unit.members) {
      for (const par of people.get(m).parents) set.add(unitOf.get(par));
    }
    return [...set];
  };

  const unitWidth = (unit) =>
    unit.members.length * NODE + (unit.members.length - 1) * PARTNER_GAP;

  const order = new Map();
  rows[0].sort((a, b) => a.members[0].localeCompare(b.members[0]));
  rows[0].forEach((u, i) => order.set(u, i));

  for (let g = 1; g <= maxGen; g++) {
    const key = (u) => {
      const ps = unitParents(u).filter((p) => order.has(p));
      if (!ps.length) return Infinity;
      return ps.reduce((s, p) => s + order.get(p), 0) / ps.length;
    };
    rows[g].sort(
      (a, b) => key(a) - key(b) || a.members[0].localeCompare(b.members[0]),
    );
    rows[g].forEach((u, i) => order.set(u, i));
  }

  const rowWidth = (row) =>
    row.reduce((s, u) => s + unitWidth(u), 0) +
    Math.max(0, row.length - 1) * H_GAP;
  const widest = Math.max(...rows.map(rowWidth));

  for (const row of rows) {
    let x = (widest - rowWidth(row)) / 2;
    for (const unit of row) {
      unit.x = x;
      x += unitWidth(unit) + H_GAP;
    }
  }

  const center = (u) => u.x + unitWidth(u) / 2;
  for (let pass = 0; pass < 6; pass++) {
    for (let g = 1; g <= maxGen; g++) {
      const row = rows[g];
      const target = row.map((u) => {
        const ps = unitParents(u);
        if (!ps.length) return center(u);
        return ps.reduce((s, p) => s + center(p), 0) / ps.length;
      });

      let cursor = -Infinity;
      row.forEach((u, i) => {
        const ideal = target[i] - unitWidth(u) / 2;
        u.x = Math.max(ideal, cursor);
        cursor = u.x + unitWidth(u) + H_GAP;
      });
    }
  }

  const minX = Math.min(...rows.flat().map((u) => u.x));
  for (const u of rows.flat()) u.x -= minX;

  const gapBelow = rows.map((_, g) => {
    if (g === rows.length - 1) return 0;
    const lanes = new Set();
    for (const unit of rows[g + 1]) {
      const parents = unitParents(unit);

      lanes.add(
        parents
          .map((pu) => pu.members.join("+"))
          .sort()
          .join("|"),
      );
    }
    lanes.delete("");
    const laneCount = Math.max(1, lanes.size);
    return Math.max(MIN_GAP, 30 + laneCount * LANE);
  });

  const rowTop = [];
  let yCursor = 0;
  rows.forEach((_, g) => {
    rowTop[g] = yCursor;
    yCursor += NODE + LABEL_H + gapBelow[g];
  });

  const pos = new Map();
  rows.forEach((row, g) => {
    for (const unit of row) {
      unit.members.forEach((id, i) => {
        pos.set(id, {
          x: unit.x + i * (NODE + PARTNER_GAP) + NODE / 2,
          y: rowTop[g] + NODE / 2,
        });
      });
    }
  });

  const width = Math.max(...[...pos.values()].map((p) => p.x + NODE / 2));
  const height = Math.max(
    ...[...pos.values()].map((p) => p.y + NODE / 2 + LABEL_H),
  );

  return { pos, width, height };
}

function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  while (text.length > 1 && ctx.measureText(text + "…").width > maxWidth) {
    text = text.slice(0, -1);
  }
  return text + "…";
}

function drawFallbackAvatar(ctx, x, y, name) {
  ctx.fillStyle = "#adb5bd";
  ctx.beginPath();
  ctx.arc(x, y, NODE / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((name?.[0] ?? "?").toUpperCase(), x, y + 2);
}

async function renderFamilyTree(allPeople, focusId, resolveUser) {
  const backEdges = findBackEdges(allPeople);
  const people = new Map();
  for (const [id, p] of allPeople) {
    people.set(id, {
      ...p,
      parents: p.parents.filter((par) => !backEdges.has(`${par}>${id}`)),
      children: p.children.filter((kid) => !backEdges.has(`${id}>${kid}`)),
    });
  }

  const { gen, looseCouples } = assignGenerations(people);
  const { pos, width, height } = layout(people, gen, looseCouples);

  const backRoom = backEdges.size ? 26 + backEdges.size * 16 + ARROW_H : 0;

  const leftRoom = looseCouples.size ? 22 + looseCouples.size * 16 + 8 : 0;
  const canvasW = Math.ceil(width + PAD * 2 + backRoom + leftRoom);
  const canvasH = Math.ceil(height + PAD * 2);

  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvasW, canvasH);

  const at = (id) => ({
    x: pos.get(id).x + PAD + leftRoom,
    y: pos.get(id).y + PAD,
  });
  const line = (color, points) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };

  const arrowDown = (color, x, y) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - ARROW_W, y - ARROW_H);
    ctx.lineTo(x + ARROW_W, y - ARROW_H);
    ctx.closePath();
    ctx.fill();
  };

  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const drawnCouples = new Set();
  let looseIndex = 0;
  for (const p of people.values()) {
    if (!p.partner || !pos.has(p.partner)) continue;
    const key = [p.id, p.partner].sort().join(":");
    if (drawnCouples.has(key)) continue;
    drawnCouples.add(key);
    const a = at(p.id);
    const b = at(p.partner);

    if (!looseCouples.has(key)) {
      line(PARTNER_COLOR, [
        [a.x, a.y],
        [b.x, b.y],
      ]);
      continue;
    }

    const topY = Math.min(a.y, b.y);
    const botY = Math.max(a.y, b.y);
    let leftmost = Math.min(a.x, b.x);
    for (const id of people.keys()) {
      const q = at(id);
      if (q.y >= topY - NODE / 2 && q.y <= botY + NODE / 2) {
        leftmost = Math.min(leftmost, q.x);
      }
    }
    const left = leftmost - NODE / 2 - 22 - looseIndex * 16;
    looseIndex++;
    ctx.strokeStyle = PARTNER_COLOR;
    ctx.beginPath();
    ctx.moveTo(a.x - NODE / 2, a.y);
    ctx.bezierCurveTo(left, a.y, left, b.y, b.x - NODE / 2, b.y);
    ctx.stroke();
    ctx.fillStyle = PARTNER_COLOR;
    for (const pt of [a, b]) {
      ctx.beginPath();
      ctx.arc(pt.x - NODE / 2 - 1, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const families = new Map();
  for (const child of people.values()) {
    if (!child.parents.length) continue;
    const key = [...child.parents].sort().join("|");
    if (!families.has(key))
      families.set(key, { parents: child.parents, kids: [] });
    families.get(key).kids.push(child.id);
  }

  const lanesUsed = new Map();
  let colorIndex = 0;

  for (const { parents, kids } of families.values()) {
    const color = FAMILY_COLORS[colorIndex++ % FAMILY_COLORS.length];
    const pts = parents.map(at);
    const areCouple =
      parents.length === 2 &&
      people.get(parents[0])?.partner === parents[1] &&
      people.get(parents[1])?.partner === parents[0];

    const rowY = Math.max(...pts.map((p) => p.y));
    const anchorX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;

    const anchorY = areCouple ? rowY : rowY + NODE / 2;

    const kidPts = kids.map(at);
    const topY = Math.min(...kidPts.map((k) => k.y)) - NODE / 2;

    const lane = lanesUsed.get(rowY) ?? 0;
    lanesUsed.set(rowY, lane + 1);
    const channelTop = rowY + NODE / 2 + LABEL_H + 6;
    const busY = Math.min(channelTop + lane * LANE, topY - 8);

    const belowLabelY = rowY + NODE / 2 + LABEL_H;
    if (!areCouple && parents.length === 2) {
      for (const p of pts)
        line(color, [
          [p.x, belowLabelY],
          [p.x, busY],
        ]);
    } else if (areCouple) {
      line(color, [
        [anchorX, anchorY],
        [anchorX, busY],
      ]);
    } else {
      line(color, [
        [anchorX, belowLabelY],
        [anchorX, busY],
      ]);
    }

    const xs = [anchorX, ...kidPts.map((k) => k.x)];
    line(color, [
      [Math.min(...xs), busY],
      [Math.max(...xs), busY],
    ]);

    for (const k of kidPts) {
      const tipY = k.y - NODE / 2 - 3;
      line(color, [
        [k.x, busY],
        [k.x, tipY - ARROW_H + 1],
      ]);
      arrowDown(color, k.x, tipY);
    }
  }

  if (backEdges.size) {
    const bulge = new Map();
    for (const edge of backEdges) {
      const [parentId, childId] = edge.split(">");
      if (!pos.has(parentId) || !pos.has(childId)) continue;

      const from = at(parentId);
      const to = at(childId);

      const n = bulge.get("k") ?? 0;
      bulge.set("k", n + 1);
      const side = Math.max(from.x, to.x) + NODE / 2 + 26 + n * 16;

      const startX = from.x + NODE / 2;
      const endX = to.x + NODE / 2;

      ctx.strokeStyle = BACK_COLOR;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(startX, from.y);
      ctx.bezierCurveTo(side, from.y, side, to.y, endX + 2, to.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = BACK_COLOR;
      ctx.beginPath();
      ctx.moveTo(endX + 2, to.y);
      ctx.lineTo(endX + 2 + ARROW_H, to.y - ARROW_W);
      ctx.lineTo(endX + 2 + ARROW_H, to.y + ARROW_W);
      ctx.closePath();
      ctx.fill();
    }
  }

  const ids = [...people.keys()];
  const info = new Map(
    await Promise.all(ids.map(async (id) => [id, await resolveUser(id)])),
  );
  const avatarMap = new Map(
    await Promise.all(
      ids.map(async (id) => {
        const url = info.get(id)?.avatarURL;
        if (!url) return [id, null];
        try {
          return [id, await loadImage(url)];
        } catch {
          return [id, null];
        }
      }),
    ),
  );

  for (const id of ids) {
    const { x, y } = at(id);
    const name = info.get(id)?.name ?? "Unknown";
    const img = avatarMap.get(id);
    const isFocus = id === focusId;

    ctx.fillStyle = isFocus ? FOCUS_RING : "#000000";
    ctx.beginPath();
    ctx.arc(x, y, NODE / 2 + (isFocus ? 4 : 2), 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, NODE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (img) {
      ctx.drawImage(img, x - NODE / 2, y - NODE / 2, NODE, NODE);
    } else {
      ctx.fillStyle = BG;
      ctx.fillRect(x - NODE / 2, y - NODE / 2, NODE, NODE);
    }
    ctx.restore();
    if (!img) drawFallbackAvatar(ctx, x, y, name);

    ctx.font = `${isFocus ? "bold " : ""}16px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const label = truncateText(ctx, name, NODE + H_GAP - 4);
    const labelY = y + NODE / 2 + 8;

    ctx.fillStyle = TEXT;
    ctx.fillText(label, x, labelY);
  }

  const scale = Math.min(
    1,
    MAX_OUTPUT_WIDTH / canvasW,
    MAX_OUTPUT_HEIGHT / canvasH,
  );
  if (scale < 1) {
    const out = createCanvas(
      Math.round(canvasW * scale),
      Math.round(canvasH * scale),
    );
    const octx = out.getContext("2d");
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(canvas, 0, 0, out.width, out.height);
    return out.toBuffer("image/png");
  }

  return canvas.toBuffer("image/png");
}

module.exports = { collectFamily, renderFamilyTree, MAX_PEOPLE };
