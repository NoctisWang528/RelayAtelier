// Index JSON member boundaries so edits leave foreign number literals, escaping,
// whitespace, order and line endings intact. JSON.parse checks the grammar.
export function indexJson(text) {
  try {
    JSON.parse(text.replace(/^\uFEFF/, ''));
    const tokens = text.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],:]|[^\s{}\[\],:"]+/g);
    const take = () => tokens.next().value;
    function read(token, from = token.index) {
      const node = { from, start: token.index, end: token.index + token[0].length };
      if (token[0] !== '{' && token[0] !== '[') return node;
      node.items = [];
      if (token[0] === '{') node.fields = new Map();
      let next = take();
      while (next[0] !== '}' && next[0] !== ']') {
        const first = next.index;
        let key;
        if (node.fields) {
          key = JSON.parse(next[0]);
          if (node.fields.has(key)) throw new Error();
          take(); // colon
          next = take();
        }
        const child = read(next, first);
        node.items.push(child);
        node.fields?.set(key, child);
        next = take();
        if (next[0] === ',') next = take();
      }
      node.end = next.index + 1;
      return node;
    }
    const root = read(take());
    if (!root.fields) throw new Error();
    return root;
  } catch {
    throw conflict('配置需要是有效的 JSON 对象，且字段名不能重复。');
  }
}

export function conflict(message) {
  return Object.assign(new Error(message), { state: 'conflict' });
}

export function insertMember(text, parent, value, depth, key) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const indent = '  '.repeat(depth);
  const insert = parent.items.at(-1)?.end ?? parent.start + 1;
  const fragment = JSON.stringify(value, null, 2).replaceAll('\n', eol + indent);
  return text.slice(0, insert) + (parent.items.length ? ',' : '') + eol + indent +
    (key === undefined ? '' : JSON.stringify(key) + ': ') + fragment + text.slice(insert);
}

export function removeMember(text, parent, node) {
  const index = parent.items.indexOf(node);
  const following = parent.items[index + 1];
  // Insertion appends immediately after the previous value (or opening token).
  if (index === 0 && following) return text.slice(0, node.from) + text.slice(following.from);
  const start = parent.items[index - 1]?.end ?? parent.start + 1;
  return text.slice(0, start) + text.slice(node.end);
}
