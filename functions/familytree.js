const { createCanvas, loadImage } = require("@napi-rs/canvas");
const Users = require("../models/userSchema.js");

const MAX_PEOPLE = 60;
const MAX_OUTPUT_WIDTH = 2400;

const NODE = 96;
const H_GAP = 44;
const PARTNER_GAP = 28;
const V_GAP = 130;
const PAD = 60;
const LABEL_H = 34;
const TITLE_H = 70;

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
    p.parents = p.parents.filter((id) => people.has(id));
    p.children = p.children.filter((id) => people.has(id));
    if (p.partner && !people.has(p.partner)) p.partner = null;
  }

  return { people, truncated };
}

function assignGenerations(people) {
  const gen = new Map();
  for (const p of people.values()) gen.set(p.id, 0);

  const limit = people.size + 2;
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
      if (p.partner) {
        const top = Math.max(gen.get(p.id), gen.get(p.partner));
        if (gen.get(p.id) !== top || gen.get(p.partner) !== top) {
          gen.set(p.id, top);
          gen.set(p.partner, top);
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  return gen;
}

function layout(people, gen) {
  const maxGen = Math.max(...gen.values());

  const unitOf = new Map();
  const rows = Array.from({ length: maxGen + 1 }, () => []);

  for (const p of people.values()) {
    if (unitOf.has(p.id)) continue;
    const members = [p.id];
    if (p.partner && people.get(p.partner)?.partner === p.id) {
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

  const pos = new Map();
  rows.forEach((row, g) => {
    for (const unit of row) {
      unit.members.forEach((id, i) => {
        pos.set(id, {
          x: unit.x + i * (NODE + PARTNER_GAP) + NODE / 2,
          y: g * V_GAP + g * (NODE + LABEL_H) + NODE / 2,
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
  ctx.fillStyle = "#5865f2";
  ctx.beginPath();
  ctx.arc(x, y, NODE / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((name?.[0] ?? "?").toUpperCase(), x, y + 2);
}

async function renderFamilyTree(people, focusId, resolveUser, title) {
  const gen = assignGenerations(people);
  const { pos, width, height } = layout(people, gen);

  const canvasW = Math.max(Math.ceil(width + PAD * 2), 480);
  const canvasH = Math.ceil(height + PAD * 2 + TITLE_H);
  const offsetX = (canvasW - width) / 2;
  const offsetY = PAD + TITLE_H;

  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#1e1f22";
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, canvasW / 2, PAD / 2 + TITLE_H / 2);

  const at = (id) => ({
    x: pos.get(id).x + offsetX,
    y: pos.get(id).y + offsetY,
  });

  ctx.lineWidth = 3;
  ctx.lineJoin = "round";

  const drawnCouples = new Set();
  for (const p of people.values()) {
    if (!p.partner || !pos.has(p.partner)) continue;
    const key = [p.id, p.partner].sort().join(":");
    if (drawnCouples.has(key)) continue;
    drawnCouples.add(key);

    const a = at(p.id);
    const b = at(p.partner);
    ctx.strokeStyle = "#ed4245";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#80848e";

  const families = new Map();
  for (const child of people.values()) {
    if (!child.parents.length) continue;
    const key = [...child.parents].sort().join("|");
    if (!families.has(key))
      families.set(key, { parents: child.parents, kids: [] });
    families.get(key).kids.push(child.id);
  }

  for (const { parents, kids } of families.values()) {
    const pts = parents.map(at);
    const [firstId, secondId] = parents;
    const areCouple =
      parents.length === 2 &&
      people.get(firstId)?.partner === secondId &&
      people.get(secondId)?.partner === firstId;

    const anchorX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const rowY = Math.max(...pts.map((p) => p.y));
    const anchorY = areCouple ? rowY : rowY + NODE / 2;

    const kidPts = kids.map(at);
    const topY = Math.min(...kidPts.map((k) => k.y)) - NODE / 2;
    const busY = anchorY + (topY - anchorY) / 2 + (areCouple ? NODE / 4 : 0);

    if (!areCouple && parents.length === 2) {
      for (const p of pts) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + NODE / 2);
        ctx.lineTo(p.x, busY);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(anchorX, busY);
      ctx.stroke();
    }

    const xs = [anchorX, ...kidPts.map((k) => k.x)];
    ctx.beginPath();
    ctx.moveTo(Math.min(...xs), busY);
    ctx.lineTo(Math.max(...xs), busY);
    ctx.stroke();

    for (const k of kidPts) {
      ctx.beginPath();
      ctx.moveTo(k.x, busY);
      ctx.lineTo(k.x, k.y - NODE / 2);
      ctx.stroke();
    }
  }

  for (const key of drawnCouples) {
    const [idA, idB] = key.split(":");
    const a = at(idA);
    const b = at(idB);
    const mx = (a.x + b.x) / 2;
    ctx.fillStyle = "#1e1f22";
    ctx.beginPath();
    ctx.arc(mx, a.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ed4245";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("♥", mx, a.y + 1);
  }

  const resolved = await Promise.all(
    [...people.keys()].map(async (id) => [id, await resolveUser(id)]),
  );
  const info = new Map(resolved);

  const avatars = await Promise.all(
    [...people.keys()].map(async (id) => {
      const url = info.get(id)?.avatarURL;
      if (!url) return [id, null];
      try {
        return [id, await loadImage(url)];
      } catch {
        return [id, null];
      }
    }),
  );
  const avatarMap = new Map(avatars);

  for (const id of people.keys()) {
    const { x, y } = at(id);
    const name = info.get(id)?.name ?? "Unknown";
    const img = avatarMap.get(id);
    const isFocus = id === focusId;

    ctx.fillStyle = isFocus ? "#fee75c" : "#383a40";
    ctx.beginPath();
    ctx.arc(x, y, NODE / 2 + (isFocus ? 5 : 3), 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, NODE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (img) ctx.drawImage(img, x - NODE / 2, y - NODE / 2, NODE, NODE);
    ctx.restore();
    if (!img) drawFallbackAvatar(ctx, x, y, name);

    ctx.fillStyle = isFocus ? "#fee75c" : "#dbdee1";
    ctx.font = `${isFocus ? "bold " : ""}18px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      truncateText(ctx, name, NODE + H_GAP - 6),
      x,
      y + NODE / 2 + 10,
    );
  }

  if (canvasW > MAX_OUTPUT_WIDTH) {
    const scale = MAX_OUTPUT_WIDTH / canvasW;
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
