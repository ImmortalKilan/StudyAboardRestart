const ALIASES = {
  AGE: 'age', MTH: 'monthOfYear', SEX: 'sex',
  IQ: 'IQ', STR: 'STR', MNY: 'MNY', SOC: 'SOC', APP: 'APP', HEA: 'HEA', HAP: 'HAP',
  SCHOOL: 'school', PROF: 'profession', school: 'school', profession: 'profession'
};

function readVar(state, key) {
  const mapped = ALIASES[key] ?? key;
  return state[mapped];
}

function compare(a, op, b) {
  if (typeof a === 'string' || typeof b === 'string') {
    if (op === '=') return String(a) === String(b);
    if (op === '!=') return String(a) !== String(b);
    return false;
  }
  const na = Number(a), nb = Number(b);
  switch (op) {
    case '=': return na === nb;
    case '!=': return na !== nb;
    case '>': return na > nb;
    case '>=': return na >= nb;
    case '<': return na < nb;
    case '<=': return na <= nb;
  }
  return false;
}

function evalAtom(state, atom) {
  const m = atom.match(/^([A-Za-z_]+)\s*(>=|<=|!=|=|>|<)\s*(.+)$/);
  if (!m) return false;
  const [, key, op, rawVal] = m;
  const left = readVar(state, key);
  let right = rawVal.trim();
  if (/^-?\d+(\.\d+)?$/.test(right)) right = Number(right);
  return compare(left, op, right);
}

export function evalCondition(state, expr) {
  if (!expr) return true;
  return expr.split('|').some(orPart =>
    orPart.split('&').every(andPart => evalAtom(state, andPart.trim()))
  );
}

export function pickBranch(state, branches) {
  if (!branches || !branches.length) return null;
  for (const b of branches) {
    const idx = b.indexOf('?');
    if (idx < 0) continue;
    const cond = b.slice(0, idx).trim();
    const id = Number(b.slice(idx + 1).trim());
    if (cond === '' || evalCondition(state, cond)) return id;
  }
  return null;
}
