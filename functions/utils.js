/**
 * Truncates a string to maxLength, appending "..." if it was cut.
 * @param {string} string The string to truncate.
 * @param {number} maxLength The maximum allowed length (including the "...").
 * @returns {string} The original string, or a truncated version ending in "...".
 */
function ellipsis(string, maxLength) {
  if (string.length <= maxLength) return string;
  return string.slice(0, maxLength - 3) + "...";
}

module.exports = { ellipsis };
