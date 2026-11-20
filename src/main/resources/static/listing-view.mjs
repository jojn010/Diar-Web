/** Price digits stay consistent in both languages; surrounding labels remain translated. */
const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', numberingSystem: 'latn', maximumFractionDigits: 0
});
export const formatPrice = value => priceFormatter.format(Number(value));

/** Other published homes, favoring the same purpose/type without inventing inventory. */
export function relatedHomes(homes, current, limit = 3) {
  const seen = new Set([current.id]);
  const score = home => (home.purpose === current.purpose ? 4 : 0)
    + (home.type === current.type ? 2 : 0)
    + (home.location === current.location ? 1 : 0);
  return homes.filter(home => {
    if (!home.id || seen.has(home.id)) return false;
    seen.add(home.id);
    return true;
  }).map((home, index) => ({home, index, score: score(home)}))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, limit)).map(entry => entry.home);
}
