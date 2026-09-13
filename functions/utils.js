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

/**
 * Get a random number from a range (inclusive).
 * @param {number} min Minimum number.
 * @param {number} max Maximum number.
 * @returns {number} The random number.
 */
function random(min, max) {
  if (min > max) [min, max] = [max, min];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = { ellipsis, random };
