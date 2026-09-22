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
const BACK_COLOR = "#df4279";
const ARROW_W = 7;
const ARROW_H = 12;

const BG = "#ffffff";
const TEXT = "#000000";
const FOCUS_RING = "#e8590c";
const FAMILY_COLORS = [
  "#1971c2",
  "#2f9e44",
  "#f08c00",
  "#b5369a",
  "#0c8599",
  "#5c940d",
  "#6741d9",
  "#7a3b28",
  "#50ad96",
  "#7a7428",
  "#a550ad",
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

/* DISCLAIMER: Mmm I used the deterministic text -> number
but then I also used EVIL AI to make the color red-ish */
function coupleColor(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h >>>= 0;

  const hue = ((h % 91) - 45 + 360) % 360;
  const sat = 42 + ((h >>> 8) % 20);
  const light = 52 + ((h >>> 16) % 12);

  const s = sat / 100;
  const l = light / 100;
  const f = (n) => {
    const k = (n + hue / 30) % 12;
    const v =
      l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

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

  const busLanes = new Array(rows.length).fill(0);
  const stemLanes = new Array(rows.length).fill(0);
  const seenFamilies = new Set();
  for (const person of people.values()) {
    if (!person.parents.length) continue;
    const lowest = Math.max(...person.parents.map((id) => gen.get(id)));
    if (gen.get(person.id) > lowest + 1) stemLanes[gen.get(person.id) - 1]++;
    const key = [...person.parents].sort().join("|");
    if (seenFamilies.has(key)) continue;
    seenFamilies.add(key);
    busLanes[lowest]++;
    for (const id of person.parents) {
      if (gen.get(id) < lowest) stemLanes[gen.get(id)]++;
    }
  }

  const gapBelow = rows.map((_, g) => {
    if (g === rows.length - 1) return 0;
    const laneCount = Math.max(1, busLanes[g] + stemLanes[g]);
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

  const rowCenters = rowTop.map((t) => t + NODE / 2);

  return { pos, width, height, rowCenters };
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

function buildFamilies(people) {
  const map = new Map();
  for (const child of people.values()) {
    if (!child.parents.length) continue;
    const key = [...child.parents].sort().join("|");
    if (!map.has(key)) map.set(key, { parents: child.parents, kids: [] });
    map.get(key).kids.push(child.id);
  }
  return [...map.values()];
}

function mergeBlocks(blocks) {
  const merged = [];
  for (const [lo, hi] of [...blocks].sort((a, b) => a[0] - b[0])) {
    const last = merged[merged.length - 1];
    if (last && lo <= last[1]) last[1] = Math.max(last[1], hi);
    else merged.push([lo, hi]);
  }
  return merged;
}

function planChannels(people, pos, looseCouples, families, labelHalf) {
  const rowsByY = new Map();
  for (const [id, q] of pos) {
    const key = Math.round(q.y);
    if (!rowsByY.has(key)) rowsByY.set(key, []);
    rowsByY.get(key).push({ id, x: q.x });
  }

  const blocksBetween = (fromY, toY) => {
    const blocks = [];
    for (const [y, members] of rowsByY) {
      if (y <= fromY + 1 || y > toY + 1) continue;
      for (const m of members) {
        const half = Math.max(NODE / 2 + 5, labelHalf(m.id) + 3);
        blocks.push([m.x - half, m.x + half]);
        const partner = people.get(m.id).partner;
        const mate = partner && members.find((o) => o.id === partner);
        if (mate && m.x < mate.x && !looseCouples.has(pairKey(m.id, partner))) {
          blocks.push([m.x, mate.x]);
        }
      }
    }
    return mergeBlocks(blocks);
  };

  const routes = new Map();
  const taken = [];
  let minX = Infinity;
  let maxX = -Infinity;

  const choose = (desired, merged, y0, y1) => {
    const inBlock = (x) => merged.some(([lo, hi]) => x > lo && x < hi);
    const occupied = (x) =>
      taken.some(
        (t) => Math.abs(t.x - x) < 8 && t.y0 <= y1 + 1 && t.y1 >= y0 - 1,
      );
    const ok = (x) => !inBlock(x) && !occupied(x);

    if (ok(desired)) return null;

    const candidates = [];
    for (const off of [9, -9, 18, -18, 27, -27]) candidates.push(desired + off);
    if (merged.length) {
      for (let k = 0; k < 4; k++) {
        candidates.push(merged[0][0] - 14 - k * 9);
        candidates.push(merged[merged.length - 1][1] + 14 + k * 9);
      }
      for (let i = 0; i + 1 < merged.length; i++) {
        const a = merged[i][1];
        const b = merged[i + 1][0];
        if (b - a < 12) continue;
        for (const off of [0, -9, 9]) {
          const c = (a + b) / 2 + off;
          if (c > a + 4 && c < b - 4) candidates.push(c);
        }
      }
    }

    let best = null;
    let bestCost = Infinity;
    for (const c of candidates) {
      if (!ok(c)) continue;
      const cost = Math.abs(c - desired) + (c < desired ? 0.5 : 0);
      if (cost < bestCost) {
        bestCost = cost;
        best = c;
      }
    }
    return best;
  };

  const record = (key, x, y0, y1) => {
    routes.set(key, x);
    taken.push({ x, y0, y1 });
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  };

  families.forEach((family, index) => {
    const lowest = Math.max(...family.parents.map((id) => pos.get(id).y));

    for (const id of family.parents) {
      const from = pos.get(id);
      if (from.y >= lowest - 1) continue;
      const best = choose(
        from.x,
        blocksBetween(from.y, lowest),
        from.y,
        lowest,
      );
      if (best !== null) record(`${index}:${id}`, best, from.y, lowest);
    }

    for (const kidId of family.kids) {
      const to = pos.get(kidId);
      const crossesRow = [...rowsByY.keys()].some(
        (y) => y > lowest + 1 && y < to.y - 1,
      );
      if (!crossesRow) continue;
      const best = choose(to.x, blocksBetween(lowest, to.y - 2), lowest, to.y);
      if (best !== null) record(`${index}:kid:${kidId}`, best, lowest, to.y);
    }
  });

  return { routes, minX, maxX };
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
  const { pos, width, height, rowCenters } = layout(people, gen, looseCouples);

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

  const measure = createCanvas(1, 1).getContext("2d");
  const labelHalf = (id) => {
    measure.font = `${id === focusId ? "bold " : ""}16px sans-serif`;
    const text = truncateText(
      measure,
      info.get(id)?.name ?? "Unknown",
      NODE + H_GAP - 4,
    );
    return measure.measureText(text).width / 2;
  };

  const families = buildFamilies(people);
  const {
    routes,
    minX: chanMin,
    maxX: chanMax,
  } = planChannels(people, pos, looseCouples, families, labelHalf);
  const chanLeft = routes.size ? Math.max(0, 10 - chanMin) : 0;
  const chanRight = routes.size ? Math.max(0, chanMax + 10 - width) : 0;

  const couples = [];
  const seenCouples = new Set();
  for (const p of people.values()) {
    if (!p.partner || !pos.has(p.partner)) continue;
    const key = pairKey(p.id, p.partner);
    if (seenCouples.has(key)) continue;
    seenCouples.add(key);
    couples.push({
      key,
      a: p.id,
      b: p.partner,
      color: coupleColor(key),
      loose: looseCouples.has(key),
      side: "left",
      lane: 0,
    });
  }

  const sideCount = { left: 0, right: 0 };
  for (const c of couples) {
    if (!c.loose) continue;
    const pa = pos.get(c.a);
    const pb = pos.get(c.b);
    const topY = Math.min(pa.y, pb.y);
    const botY = Math.max(pa.y, pb.y);
    let leftmost = Math.min(pa.x, pb.x);
    let rightmost = Math.max(pa.x, pb.x);
    for (const q of pos.values()) {
      if (q.y >= topY - NODE / 2 && q.y <= botY + NODE / 2) {
        leftmost = Math.min(leftmost, q.x);
        rightmost = Math.max(rightmost, q.x);
      }
    }
    const leftCost = pa.x + pb.x - 2 * leftmost;
    const rightCost = 2 * rightmost - (pa.x + pb.x);
    c.side = rightCost < leftCost ? "right" : "left";
    c.lane = sideCount[c.side]++;
  }
  const looseRoom = (n) => (n ? 22 + n * 16 + 8 : 0);
  const rightLooseRoom = looseRoom(sideCount.right);

  const backRoom =
    (backEdges.size ? 26 + backEdges.size * 16 + ARROW_H : 0) +
    chanRight +
    rightLooseRoom;
  const leftRoom = looseRoom(sideCount.left) + chanLeft;
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

  const ringColor = new Map();
  for (const c of couples) {
    if (!ringColor.has(c.a)) ringColor.set(c.a, c.color);
    if (!ringColor.has(c.b)) ringColor.set(c.b, c.color);

    const a = at(c.a);
    const b = at(c.b);

    if (!c.loose) {
      line(c.color, [
        [a.x, a.y],
        [b.x, b.y],
      ]);
      continue;
    }

    const dir = c.side === "left" ? -1 : 1;
    const topY = Math.min(a.y, b.y);
    const botY = Math.max(a.y, b.y);
    let outer = c.side === "left" ? Infinity : -Infinity;
    for (const id of [c.a, c.b, ...people.keys()]) {
      const q = at(id);
      if (q.y >= topY - NODE / 2 && q.y <= botY + NODE / 2) {
        outer = dir < 0 ? Math.min(outer, q.x) : Math.max(outer, q.x);
      }
    }
    const control =
      outer +
      dir * (NODE / 2 + 22 + c.lane * 16) +
      (dir < 0 ? -chanLeft : chanRight);
    ctx.strokeStyle = c.color;
    ctx.beginPath();
    ctx.moveTo(a.x + (dir * NODE) / 2, a.y);
    const dy = b.y - a.y;
    ctx.bezierCurveTo(
      control,
      a.y + dy * 0.2,
      control,
      b.y - dy * 0.2,
      b.x + (dir * NODE) / 2,
      b.y,
    );
    ctx.stroke();
    ctx.fillStyle = c.color;
    for (const pt of [a, b]) {
      ctx.beginPath();
      ctx.arc(pt.x + (dir * NODE) / 2 - dir, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const lanesUsed = new Map();

  families.forEach(({ parents, kids }, index) => {
    const color = FAMILY_COLORS[index % FAMILY_COLORS.length];
    const pts = parents.map(at);
    const lowestY = Math.max(...pts.map((p) => p.y));
    const areCouple =
      parents.length === 2 &&
      people.get(parents[0])?.partner === parents[1] &&
      people.get(parents[1])?.partner === parents[0] &&
      Math.abs(pts[0].y - pts[1].y) < 1;

    const kidPts = kids.map(at);
    const topY = Math.min(...kidPts.map((k) => k.y)) - NODE / 2;

    const lane = lanesUsed.get(lowestY) ?? 0;
    lanesUsed.set(lowestY, lane + 1);
    const busY = Math.min(
      lowestY + NODE / 2 + LABEL_H + 6 + lane * LANE,
      topY - 8,
    );

    const stemXs = [];
    if (areCouple) {
      const anchorX = (pts[0].x + pts[1].x) / 2;
      line(color, [
        [anchorX, lowestY],
        [anchorX, busY],
      ]);
      stemXs.push(anchorX);
    } else {
      parents.forEach((id, i) => {
        const p = pts[i];
        const fromY = p.y + NODE / 2 + LABEL_H;
        const channel = routes.get(`${index}:${id}`);
        if (channel === undefined) {
          line(color, [
            [p.x, fromY],
            [p.x, busY],
          ]);
          stemXs.push(p.x);
          return;
        }
        const stemLane = lanesUsed.get(p.y) ?? 0;
        lanesUsed.set(p.y, stemLane + 1);
        const laneY = fromY + 6 + stemLane * LANE;
        const cx = channel + PAD + leftRoom;
        line(color, [
          [p.x, fromY],
          [p.x, laneY],
          [cx, laneY],
          [cx, busY],
        ]);
        stemXs.push(cx);
      });
    }

    const kidLinks = kids.map((kidId, i) => {
      const k = kidPts[i];
      const channel = routes.get(`${index}:kid:${kidId}`);
      return {
        k,
        cx: channel === undefined ? null : channel + PAD + leftRoom,
        id: kidId,
      };
    });

    const xs = [...stemXs, ...kidLinks.map((l) => l.cx ?? l.k.x)];
    line(color, [
      [Math.min(...xs), busY],
      [Math.max(...xs), busY],
    ]);

    for (const { k, cx, id } of kidLinks) {
      const tipY = k.y - NODE / 2 - 3;
      if (cx === null) {
        line(color, [
          [k.x, busY],
          [k.x, tipY - ARROW_H + 1],
        ]);
      } else {
        const above = rowCenters[gen.get(id) - 1] + PAD;
        const dropLane = lanesUsed.get(above) ?? 0;
        lanesUsed.set(above, dropLane + 1);
        const dropY = above + NODE / 2 + LABEL_H + 6 + dropLane * LANE;
        line(color, [
          [cx, busY],
          [cx, dropY],
          [k.x, dropY],
          [k.x, tipY - ARROW_H + 1],
        ]);
      }
      arrowDown(color, k.x, tipY);
    }
  });

  if (backEdges.size) {
    const bulge = new Map();
    for (const edge of backEdges) {
      const [parentId, childId] = edge.split(">");
      if (!pos.has(parentId) || !pos.has(childId)) continue;

      const from = at(parentId);
      const to = at(childId);

      const n = bulge.get("k") ?? 0;
      bulge.set("k", n + 1);
      const side =
        Math.max(from.x, to.x) +
        NODE / 2 +
        26 +
        n * 16 +
        chanRight +
        rightLooseRoom;

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

  for (const id of ids) {
    const { x, y } = at(id);
    const name = info.get(id)?.name ?? "Unknown";
    const img = avatarMap.get(id);
    const isFocus = id === focusId;

    ctx.fillStyle = isFocus ? FOCUS_RING : (ringColor.get(id) ?? "#000000");
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
