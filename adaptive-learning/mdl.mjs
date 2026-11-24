// Two-part MDL over verified rewrite functions. A rule must reconstruct its
// examples exactly. Encoding costs are UTF-8 literal bytes and Elias gamma
// integer codes, including the cost of selecting rules and references.
const encoder = new TextEncoder();
const gammaBits = positive => 1 + 2 * Math.floor(Math.log2(positive));
const textBits = value => {
  const bytes = encoder.encode(value).length;
  return gammaBits(bytes + 1) + 8 * bytes;
};

export function selectGrammarRules(examples, verifiedRules) {
  const literalCosts = examples.map(({ surface }) => textBits(surface));
  const selected = [];
  let dataBits = literalCosts.reduce((sum, bits) => sum + 1 + bits, 0);
  let modelBits = gammaBits(1);
  for (const rule of [...verifiedRules].sort((a, b) => a.id.localeCompare(b.id))) {
    const index = selected.length + 1;
    const ruleBits = textBits(rule.id) + textBits(rule.description);
    const modelChange = ruleBits + gammaBits(index + 1) - gammaBits(index);
    const savings = examples.map(({ base, surface, form }, row) => {
      if (rule.apply(base, form) !== surface) return 0;
      return Math.max(0, literalCosts[row] - gammaBits(index) - textBits(base) - textBits(form));
    });
    if (savings.reduce((sum, bits) => sum + bits, 0) <= modelChange) continue;
    selected.push(rule.id);
    modelBits += modelChange;
    savings.forEach((bits, row) => {
      dataBits -= bits;
      literalCosts[row] -= bits;
    });
  }
  return { rules: selected, modelBits, dataBits };
}
