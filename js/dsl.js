const ALIASES = {
  AGE: 'age', MTH: 'monthOfYear', SEX: 'sex',
  INT: 'INT', PER: 'PER', MNY: 'MNY', SOC: 'SOC', APP: 'APP', HLT: 'HLT', HAP: 'HAP',
  IQ: 'INT', STR: 'PER', HEA: 'HLT',
  SCHOOL: 'school', PROF: 'profession', school: 'school', profession: 'profession',
  HS: 'hsType', hsType: 'hsType',
  OVERSEAS: 'overseas', overseas: 'overseas'
};

function readVar(state, key) {
  const mapped = ALIASES[key] ?? key;
  return state[mapped];
}

function compare(a, op, b) {
  if (typeof a === 'string' || typeof b === 'string') {
    if (op === '=' || op === '==') return String(a) === String(b);
    if (op === '!=') return String(a) !== String(b);
    return false;
  }
  const na = Number(a), nb = Number(b);
  switch (op) {
    case '=': case '==': return na === nb;
    case '!=': return na !== nb;
    case '>': return na > nb;
    case '>=': return na >= nb;
    case '<': return na < nb;
    case '<=': return na <= nb;
  }
  return false;
}

function evalAtom(state, atom) {
  // EVT?[id] — check if event has been fired
  const evtMatch = atom.match(/^EVT\?\[(\d+)\]$/);
  if (evtMatch) {
    return state.firedEvents && state.firedEvents.has(Number(evtMatch[1]));
  }
  const m = atom.match(/^([A-Za-z_]+)\s*(>=|<=|!=|==|=|>|<)\s*(.+)$/);
  if (!m) return false;
  const [, key, op, rawVal] = m;
  const left = readVar(state, key);
  let right = rawVal.trim();
  if (/^-?\d+(\.\d+)?$/.test(right)) right = Number(right);
  return compare(left, op, right);
}

/**
 * Evaluate a condition expression with support for:
 *   & (AND), | (OR), parentheses, EVT?[id]
 * Examples:
 *   "SOC<4"
 *   "(MNY<4)&(SOC>8)"
 *   "(SOC<3)&(EVT?[11002])"
 */
export function evalCondition(state, expr) {
  if (!expr) return true;
  // Strip outer whitespace
  expr = expr.trim();
  // Tokenize: split into parenthesized groups and bare atoms, joined by & or |
  return evalOr(state, expr);
}

function evalOr(state, expr) {
  const parts = splitTopLevel(expr, '|');
  return parts.some(p => evalAnd(state, p.trim()));
}

function evalAnd(state, expr) {
  const parts = splitTopLevel(expr, '&');
  return parts.every(p => evalUnit(state, p.trim()));
}

function evalUnit(state, expr) {
  // If wrapped in parens, unwrap
  if (expr.startsWith('(') && findClosingParen(expr, 0) === expr.length - 1) {
    return evalOr(state, expr.slice(1, -1));
  }
  return evalAtom(state, expr);
}

/** Split expr by delim, but only at top level (not inside parens) */
function splitTopLevel(expr, delim) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === '(') depth++;
    else if (expr[i] === ')') depth--;
    else if (depth === 0 && expr[i] === delim) {
      parts.push(expr.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(expr.slice(start));
  return parts;
}

function findClosingParen(expr, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < expr.length; i++) {
    if (expr[i] === '(') depth++;
    else if (expr[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
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

/**
 * Weighted branch: format "id:weight"
 * Picks one randomly based on weights.
 */
export function pickWeightedBranch(branches) {
  if (!branches || !branches.length) return null;
  const items = branches.map(b => {
    const [idStr, wStr] = b.split(':');
    return { id: Number(idStr.trim()), weight: Number(wStr?.trim() ?? 1) };
  });
  const totalW = items.reduce((s, it) => s + it.weight, 0);
  let roll = Math.random() * totalW;
  for (const it of items) {
    roll -= it.weight;
    if (roll <= 0) return it.id;
  }
  return items[items.length - 1].id;
}
