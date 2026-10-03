// Orvosnév-formázó: "Dr., Ph.D Kiss Anna" -> "Dr. Kiss Anna PhD" (pre: Prof. Dr. med. habil. | név | PhD, CSc…)
const DEG = { phd: 'PhD', csc: 'CSc', dsc: 'DSc', mba: 'MBA', frcs: 'FRCS', febs: 'FEBS', facs: 'FACS', edpm: 'EDPM', msc: 'MSc' };
const WORDS = /^(az|mta|orvostudomány|doktora|egyetemi|tanár|tanszékvezető|címzetes)$/i;
export function splitName(full) {
  let toks = String(full || '').replace(/\s+/g, ' ').trim().split(' ');
  const pre = [], suf = [];
  const addSuf = d => { if (!suf.includes(d)) suf.push(d); };
  while (toks.length > 1) {
    let t = toks[0], k = t.toLowerCase().replace(/,+$/, '');
    if (/^dr\.?$/.test(k)) { if (!pre.includes('Dr.')) pre.push('Dr.'); }
    else if (/^prof\.?$/.test(k)) { if (!pre.includes('Prof.')) pre.unshift('Prof.'); }
    else if (/^med\.?$/.test(k)) pre.push('med.');
    else if (/^habil\.?$/.test(k)) pre.push('habil.');
    else if (/^med\.habil\.?$/.test(k)) pre.push('med.', 'habil.');
    else if (/^ph\.?d\.?$/.test(k)) addSuf('PhD');
    else if (k === 'ph.' || k === 'ph') { if (/^d\.?,?$/i.test(toks[1] || '')) toks.shift(); addSuf('PhD'); }
    else if (/^m\.?sc\.?$/.test(k)) addSuf('MSc');
    else if (DEG[k.replace(/\./g, '')] && k.replace(/\./g,'') !== 'msc') addSuf(DEG[k.replace(/\./g, '')]);
    else if (k === 'doktora') addSuf('DSc');
    else if (WORDS.test(k)) { /* leíró szó – kihagyjuk */ }
    else break;
    toks.shift();
  }
  let name = toks.join(' ').replace(/\s+Ph\.?\s?D\.?$/i, () => { addSuf('PhD'); return ''; }).trim();
  // "Dr. med." stb. sorrend: Prof. Dr. med. habil.
  const order = ['Prof.', 'Dr.', 'med.', 'habil.'];
  const p = order.filter(x => pre.includes(x));
  return { pre: p.join(' '), name, suf: suf.join(', ') };
}
export function fmtName(full) { const s = splitName(full); return [s.pre, s.name].filter(Boolean).join(' ') + (s.suf ? ' ' + s.suf : ''); }
export function sortKey(full) { return splitName(full).name; }
export function initials(full) { return splitName(full).name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
