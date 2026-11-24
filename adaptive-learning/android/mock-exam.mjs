const categories = { vocabulary: 'Vocabulary ও Kanji', grammar: 'Grammar', reading: 'Reading' };
const inScope = (level, id) => typeof id === 'string' &&
  new RegExp('^' + level.toLowerCase() + '-practice-[0-9]{1,3}$').test(id);

export function validateMockPaper(paper, level, entry) {
  if (!paper || !inScope(level, entry.id) || paper.id !== entry.id || paper.level !== level ||
    paper.kind !== 'JLPT' || paper.excluded !== 0 || !Array.isArray(paper.questions) ||
    !paper.questions.length || paper.questions.length !== entry.count) throw new Error('Invalid exam');
  const ids = new Set();
  const sections = new Set();
  for (const question of paper.questions) {
    if (!question || typeof question.id !== 'string' || !question.id || ids.has(question.id) ||
      !Object.prototype.hasOwnProperty.call(categories, question.category) ||
      typeof question.prompt !== 'string' || !question.prompt.trim() ||
      !Array.isArray(question.choices) || question.choices.length < 2 ||
      !question.choices.every(choice => typeof choice === 'string' && choice.trim()) ||
      !Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.choices.length ||
      (question.category === 'reading' && (typeof question.passage !== 'string' || !question.passage.trim()))) {
      throw new Error('Invalid exam question');
    }
    ids.add(question.id);
    sections.add(question.category);
  }
  if (sections.size !== 3) throw new Error('Incomplete exam');
  return paper;
}

export function scoreMockPaper(paper, answers) {
  const sections = {};
  for (const [index, question] of paper.questions.entries()) {
    const section = sections[question.category] ??= { correct: 0, total: 0, answered: 0 };
    section.total++;
    if (answers.has(index)) section.answered++;
    if (answers.get(index) === question.answer) section.correct++;
  }
  return { paper: paper.id, sections };
}

function formatted(text) {
  const template = document.createElement('template');
  template.innerHTML = text || '';
  const output = document.createDocumentFragment();
  function copyChildren(source, target) {
    for (const child of source.childNodes) {
      if (child.nodeType === 3) target.append(document.createTextNode(child.textContent));
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (['script', 'style', 'iframe', 'object'].includes(tag)) continue;
      if (['u', 'b', 'strong', 'em', 'i', 'ruby', 'rt', 'rp', 'br', 'p', 'div', 'span', 'table', 'tbody', 'tr', 'td', 'th', 'ol', 'ul', 'li'].includes(tag)) {
        const clean = document.createElement(tag);
        copyChildren(child, clean);
        target.append(clean);
      } else copyChildren(child, target);
    }
  }
  copyChildren(template.content, output);
  return output;
}

export const writtenMinutes = { N5: 60, N4: 80, N3: 100, N2: 105, N1: 110 };
const pendingLevel = 'nihongo-mock-pending-level';

export function mountMockExam({ menu, level, native, button }) {
  if (!/^N[1-5]$/.test(level) || typeof native?.recordMockResult !== 'function') return;
  const doc = menu.ownerDocument;
  const view = doc.defaultView;
  const panel = doc.createElement('dialog');
  panel.className = 'mock-screen';
  panel.setAttribute('aria-label', 'JLPT Mock Test');
  panel.setAttribute('aria-modal', 'true');
  const header = doc.createElement('header');
  const title = doc.createElement('h2');
  const output = doc.createElement('section');
  output.className = 'mock-screen-content';
  const back = button('←', () => goBack());
  back.setAttribute('aria-label', 'ফিরে যান');
  header.append(back, title);
  panel.append(header, output);
  doc.body.append(panel);
  if (!doc.querySelector('#mock-exam-styles')) {
    const link = doc.createElement('link');
    link.id = 'mock-exam-styles';
    link.rel = 'stylesheet';
    link.href = 'mock-exam.css';
    doc.head.append(link);
  }
  let request = 0;
  let interval;
  let goBack = close;
  function stopTimer() {
    if (interval !== undefined) clearInterval(interval);
    interval = undefined;
  }
  function close() {
    request++;
    stopTimer();
    if (panel.close && panel.open) panel.close();
    else panel.removeAttribute('open');
    output.textContent = '';
    open.focus();
  }
  panel.addEventListener('cancel', event => { event.preventDefault(); goBack(); });
  const previousBack = view.readerBack;
  view.readerBack = () => {
    if (!panel.hasAttribute('open')) return previousBack ? previousBack() : false;
    goBack();
    return true;
  };
  function screen(label, previous) {
    title.textContent = label;
    goBack = previous;
    output.textContent = '';
    panel.scrollTop = 0;
  }
  function element(tag, label, css, parent = output) {
    const node = doc.createElement(tag);
    node.textContent = label;
    if (css) node.className = css;
    parent.append(node);
    return node;
  }
  function action(label, callback, css, parent = output) {
    const node = button(label, callback);
    if (css) node.className = css;
    parent.append(node);
    return node;
  }
  function renderFormatted(text, css, parent = output) {
    if (!text) return;
    element('div', '', css, parent).append(formatted(text));
  }
  const load = async path => {
    const response = await fetch('mock/' + level.toLowerCase() + '/' + path + '.json');
    if (!response.ok) throw new Error('Exam unavailable');
    return response.json();
  };

  function details(paper) {
    screen(paper.title, list);
    element('h3', 'পরীক্ষার বিবরণ', 'mock-hero');
    const stats = element('div', '', 'mock-stats');
    element('strong', paper.questions.length + ' প্রশ্ন', '', stats);
    element('strong', writtenMinutes[level] + ' মিনিট', '', stats);
    element('p', 'লিখিত অনুশীলন · Vocabulary ও Kanji, Grammar, Reading');
    for (const [category, label] of Object.entries(categories)) {
      const match = paper.questions.map((q, i) => q.category === category ? i + 1 : 0).filter(Boolean);
      const range = match.every((n, i) => n === match[0] + i)
        ? [match[0], match[match.length - 1]].join('–') : match.join(', ');
      element('p', label + ' · ' + match.length + ' প্রশ্ন (' + range + ')', 'mock-section-row');
    }
    action('▶ পরীক্ষা শুরু', () => start(paper), 'mock-primary');
  }

  function start(paper) {
    const answers = new Map();
    const marked = new Set();
    const deadline = Date.now() + writtenMinutes[level] * 60000;
    let submitted = false;
    let index = 0;
    let countdown;
    const leave = () => {
      if (typeof view.confirm !== 'function' || view.confirm('পরীক্ষা ছেড়ে দিলে এই চেষ্টা সেভ হবে না।')) {
        stopTimer();
        details(paper);
      }
    };
    function tick() {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (!seconds) { showResult(); return; }
      const parts = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];
      countdown.textContent = 'সময় · ' + parts.map(value => String(value).padStart(2, '0')).join(':');
    }
    function showQuestion() {
      screen(paper.title, leave);
      const q = paper.questions[index];
      const stats = element('div', '', 'mock-stats');
      countdown = element('strong', '', '', stats);
      element('strong', 'প্রশ্ন ' + (index + 1) + ' / ' + paper.questions.length, '', stats);
      const progress = element('progress', '', 'mock-progress');
      progress.max = paper.questions.length;
      progress.value = answers.size;
      progress.setAttribute('aria-label', 'উত্তর দেওয়া প্রশ্ন');
      const tabs = element('nav', '', 'mock-tabs');
      tabs.setAttribute('aria-label', 'পরীক্ষার বিভাগ');
      for (const [category, label] of Object.entries(categories)) {
        const tab = action(label, () => {
          index = paper.questions.findIndex(question => question.category === category);
          showQuestion();
        }, 'mock-chip', tabs);
        tab.setAttribute('aria-pressed', String(category === q.category));
      }
      element('h3', 'প্রশ্ন ' + (index + 1), 'mock-question-label');
      renderFormatted(q.instruction, 'mock-instruction');
      renderFormatted(q.passage, 'mock-passage');
      renderFormatted(q.prompt, 'mock-prompt');
      q.choices.forEach((choice, n) => {
        const option = action('', () => {
          if (Date.now() >= deadline) { showResult(); return; }
          answers.set(index, n);
          for (const node of output.querySelectorAll('.mock-choice')) node.setAttribute('aria-pressed', 'false');
          option.setAttribute('aria-pressed', 'true');
          progress.value = answers.size;
        }, 'mock-choice');
        element('span', String(n + 1), 'mock-choice-number', option);
        renderFormatted(choice, '', option);
        option.setAttribute('aria-pressed', String(answers.get(index) === n));
      });
      const controls = element('footer', '', 'mock-controls');
      const previous = action('← আগের প্রশ্ন', () => { index--; showQuestion(); }, 'mock-secondary', controls);
      previous.disabled = index === 0;
      const flag = action(marked.has(index) ? '★' : '☆', () => {
        if (marked.has(index)) marked.delete(index);
        else marked.add(index);
        flag.textContent = marked.has(index) ? '★' : '☆';
        flag.setAttribute('aria-pressed', String(marked.has(index)));
      }, 'mock-secondary', controls);
      flag.setAttribute('aria-label', 'প্রশ্ন চিহ্নিত করুন');
      flag.setAttribute('aria-pressed', String(marked.has(index)));
      if (index < paper.questions.length - 1) {
        action('পরের প্রশ্ন →', () => { index++; showQuestion(); }, 'mock-primary', controls);
      } else action('ফল দেখুন', showResult, 'mock-primary', controls);
      tick();
    }
    function showResult() {
      if (submitted) return;
      submitted = true;
      stopTimer();
      const result = scoreMockPaper(paper, answers);
      let saved = false;
      try { saved = native.recordMockResult(JSON.stringify(result)); } catch (_) {}
      renderResult(result, saved);
    }
    function renderResult(result, saved) {
      screen('পরীক্ষার ফল', list);
      const correct = Object.values(result.sections).reduce((total, row) => total + row.correct, 0);
      element('h3', correct + ' / ' + paper.questions.length + ' সঠিক', 'mock-hero');
      for (const [key, value] of Object.entries(result.sections)) {
        element('p', categories[key] + ' · ' + value.correct + '/' + value.total +
          ' · বাদ ' + (value.total - value.answered), 'mock-section-row');
      }
      if (!saved) element('p', 'এই ফলটি সেভ করা যায়নি।');
      action('উত্তর ও ব্যাখ্যা দেখুন', () => {
        screen('উত্তর ও ব্যাখ্যা', () => renderResult(result, saved));
        for (const [position, question] of paper.questions.entries()) {
          const review = element('article', '', 'mock-section-row');
          element('h4', 'প্রশ্ন ' + (position + 1), '', review);
          renderFormatted(question.passage, 'mock-passage', review);
          renderFormatted(question.prompt, '', review);
          const selected = answers.get(position);
          if (selected !== undefined) {
            element('p', 'তোমার উত্তর', '', review);
            renderFormatted(question.choices[selected], '', review);
          }
          element('p', 'সঠিক উত্তর', '', review);
          renderFormatted(question.choices[question.answer], '', review);
          renderFormatted(question.explanation, '', review);
        }
      }, 'mock-primary');
    }
    showQuestion();
    if (!submitted) interval = setInterval(tick, 1000);
  }

  async function list() {
    const version = ++request;
    if (!panel.hasAttribute('open')) {
      if (panel.showModal) panel.showModal();
      else panel.setAttribute('open', '');
    }
    screen('JLPT Mock Test', close);
    const levels = element('nav', '', 'mock-tabs');
    levels.setAttribute('aria-label', 'JLPT লেভেল');
    for (const next of Object.keys(writtenMinutes)) {
      const chip = action(next, () => {
        if (typeof native.selectStudyLevel !== 'function' || next === level) return;
        try { view.localStorage.setItem(pendingLevel, JSON.stringify({ level: next, expires: Date.now() + 60000 })); } catch (_) {}
        close();
        native.selectStudyLevel(next, 'vocab');
      }, 'mock-chip', levels);
      chip.setAttribute('aria-pressed', String(next === level));
      chip.disabled = next !== level && typeof native.selectStudyLevel !== 'function';
    }
    const status = element('p', 'পরীক্ষার তালিকা আনা হচ্ছে…');
    try {
      const catalog = await load('catalog');
      if (version !== request) return;
      if (!Array.isArray(catalog)) throw new Error('Invalid catalog');
      const entries = catalog.filter(row => row && inScope(level, row.id) && Number.isInteger(row.count) && row.count > 0);
      status.textContent = entries.length ? level + ' লিখিত মক পরীক্ষা' : 'এই লেভেলে এখন পরীক্ষা নেই।';
      entries.forEach((entry, index) => {
        const card = action('', async () => {
          const selection = ++request;
          screen(entry.title, list);
          element('p', 'পরীক্ষা আনা হচ্ছে…');
          try {
            const paper = validateMockPaper(await load(entry.id), level, entry);
            if (selection === request) details(paper);
          } catch {
            if (selection === request) { screen(entry.title, list); element('p', 'পরীক্ষাটি এখন খোলা যাচ্ছে না।'); }
          }
        }, 'mock-paper-card');
        const copy = element('span', '', '', card);
        element('strong', level + ' 模擬試験 ' + String(index + 1).padStart(2, '0'), '', copy);
        element('small', entry.count + ' প্রশ্ন · ' + writtenMinutes[level] + ' মিনিট', '', copy);
        element('span', '▶', 'mock-play', card);
      });
    } catch {
      if (version === request) status.textContent = 'পরীক্ষার তালিকা এখন পাওয়া যাচ্ছে না।';
    }
  }

  const open = action('Mock Test', list, '', menu);
  try {
    const queued = JSON.parse(view.localStorage.getItem(pendingLevel) || 'null');
    if (queued?.level === level || (queued && queued.expires <= Date.now())) view.localStorage.removeItem(pendingLevel);
    if (queued?.level === level && queued.expires > Date.now()) list();
  } catch (_) {}
}

export function mockStudyPriority(native) {
  try {
    const result = JSON.parse(native.lastMockResult?.() || 'null');
    const score = kind => {
      const row = result?.sections?.[kind];
      if (!row || !Number.isInteger(row.total) || row.total < 1 ||
        !Number.isInteger(row.correct) || row.correct < 0 || row.correct > row.total) return 0;
      return (1 - row.correct / row.total) * 0.08;
    };
    return { vocab: score('vocabulary'), kanji: score('vocabulary'), grammar: score('grammar') };
  } catch {
    return {};
  }
}
