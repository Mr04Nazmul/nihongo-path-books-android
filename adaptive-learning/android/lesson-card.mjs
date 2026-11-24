const pageSize = 5;
const selections = new Map();

export function renderLessonCard({ root, rows, level, kind, preview, learned, open, refresh }) {
  if (!rows.length) { root.replaceChildren(); return rows; }
  const scope = [level, kind, preview].join(':');
  const current = selections.get(scope) ?? { lesson: 0, item: 0 };
  selections.set(scope, current);
  const pageCount = Math.ceil(rows.length / pageSize);
  current.lesson = Math.min(current.lesson, pageCount - 1);
  const offset = current.lesson * pageSize;
  const items = rows.slice(offset, offset + pageSize);
  current.item = Math.min(current.item, items.length - 1);

  function element(tag, name, label) {
    const node = document.createElement(tag);
    if (name) node.className = name;
    if (label) node.textContent = label;
    return node;
  }
  function control(label, name, action) {
    const node = element('button', name, label);
    node.type = 'button';
    node.onclick = action;
    return node;
  }
  function move(lesson) {
    current.lesson = lesson;
    current.item = 0;
    refresh();
  }

  const card = element('section', 'lesson-card');
  card.setAttribute('aria-label', preview ? 'ফ্রি নমুনা পাঠ' : 'লেভেলের পাঠ');
  const heading = element('div', 'lesson-card-heading');
  const icon = element('span', 'lesson-card-icon subject-art vocab-art');
  icon.setAttribute('aria-hidden', 'true');
  const copy = element('div', 'lesson-card-copy');
  copy.append(element('h2', '', preview ? 'ফ্রি নমুনা পাঠ' : level + ' পাঠ'),
    element('p', '', 'Lesson অনুযায়ী শেখা শুরু করুন'));
  const count = element('span', 'lesson-card-count', '◎ ' + items.filter(learned).length + ' / ' + items.length + ' শেখা');
  count.setAttribute('aria-live', 'polite');
  heading.append(icon, copy, count);
  const steps = element('div', 'lesson-card-steps');
  steps.setAttribute('aria-label', 'পাঠের ধাপ');
  items.forEach((item, i) => {
    const step = control(String(i + 1), learned(item) ? 'is-learned' : '', () => {
      current.item = i;
      refresh();
      open(item);
    });
    step.setAttribute('aria-label', 'পাঠ ' + (offset + i + 1) + (learned(item) ? ' শেখা হয়েছে' : ''));
    step.setAttribute('aria-current', i === current.item ? 'step' : 'false');
    steps.append(step);
  });
  const selector = element('select', 'lesson-card-select');
  selector.setAttribute('aria-label', 'Lesson নির্বাচন');
  for (let i = 0; i < pageCount; i++) {
    const first = i * pageSize + 1;
    const option = element('option', '', 'Lesson ' + (i + 1) + ' (' + first + ' – ' + Math.min(rows.length, first + pageSize - 1) + ')');
    option.value = String(i);
    if (i === current.lesson) option.setAttribute("selected", "");
    selector.append(option);
  }
  selector.onchange = () => move(Number(selector.value));
  const actions = element('div', 'lesson-card-actions');
  const prev = control('← আগের', '', () => move(current.lesson - 1));
  const next = control('পরের →', '', () => move(current.lesson + 1));
  prev.disabled = current.lesson === 0;
  next.disabled = current.lesson + 1 === pageCount;
  actions.append(prev, control('▶ পাঠ শুরু', 'lesson-card-start', () => open(items[current.item])), next);
  card.append(heading, steps, selector, actions);
  root.replaceChildren(card);
  return items;
}
