const Users = require("../models/userSchema.js");

async function walkTree(start, direction, stopAt, maxDepth = Infinity) {
  const startId = start.id;
  const depth = new Map([[startId, 0]]);
  let frontier = [];
  for (const id of start.family?.[direction] ?? []) {
    if (!depth.has(id)) {
      depth.set(id, 1);
      frontier.push(id);
    }
  }

  for (
    let level = 1;
    frontier.length && level < maxDepth && !depth.has(stopAt);
    level++
  ) {
    const docs = await Users.find(
      { id: { $in: frontier } },
      { id: 1, [`family.${direction}`]: 1 },
    ).lean();
    const next = [];

    for (const doc of docs) {
      const d = depth.get(doc.id);
      for (const id of doc.family?.[direction] ?? []) {
        if (!depth.has(id)) {
          depth.set(id, d + 1);
          next.push(id);
        }
      }
    }

    frontier = next;
  }

  depth.delete(startId);
  return depth;
}

async function isBlockedMarriage(me, other) {
  const parents = me.family?.parents ?? [];
  const children = me.family?.children ?? [];

  if (parents.includes(other.id) || children.includes(other.id)) return true;
  if (!parents.length && !children.length) return false;

  return Users.exists({
    $or: [
      { id: { $in: children }, "family.children": other.id },
      { id: { $in: parents }, "family.parents": other.id },
    ],
  }).then(Boolean);
}

module.exports = { walkTree, isBlockedMarriage };
