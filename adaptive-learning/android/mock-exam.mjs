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

export function mountMockExam({ menu, level, native, button }) {
  if (!/^N[1-5]$/.test(level) || typeof native?.recordMockResult !== 'function') return;
  const panel = document.createElement('section');
  panel.hidden = true;
  const output = document.createElement('div');
  let request = 0;
  const renderText = (text, tag = 'p') => {
    const element = document.createElement(tag);
    element.textContent = text;
    output.append(element);
  };
  const renderFormatted = text => {
    if (!text) return;
    const paragraph = document.createElement('div');
    paragraph.append(formatted(text));
    output.append(paragraph);
  };
  const load = async path => {
    const response = await fetch('mock/' + level.toLowerCase() + '/' + path + '.json');
    if (!response.ok) throw new Error('Exam unavailable');
    return response.json();
  };
  function start(paper) {
    const answers = new Map();
    let index = 0;
    function showQuestion() {
      output.textContent = '';
      const q = paper.questions[index];
      renderText(paper.title, 'h3');
      renderText(categories[q.category] + ' · ' + (index + 1) + ' / ' + paper.questions.length);
      renderFormatted(q.instruction);
      renderFormatted(q.passage);
      renderFormatted(q.prompt);
      q.choices.forEach((choice, n) => {
        const option = button('', () => { answers.set(index, n); showQuestion(); });
        option.append(formatted(choice));
        option.setAttribute('aria-pressed', String(answers.get(index) === n));
        output.append(option);
      });
      if (index > 0) output.append(button('আগের প্রশ্ন', () => { index--; showQuestion(); }));
      if (index < paper.questions.length - 1) output.append(button('পরের প্রশ্ন', () => { index++; showQuestion(); }));
      if (index === paper.questions.length - 1) output.append(button('ফল দেখুন', showResult));
    }
    function showResult() {
      const result = scoreMockPaper(paper, answers);
      const saved = native.recordMockResult(JSON.stringify(result));
      output.textContent = '';
      renderText('পরীক্ষার ফল', 'h3');
      for (const [key, value] of Object.entries(result.sections)) {
        renderText(categories[key] + ' · ' + value.correct + '/' + value.total +
          ' · বাদ ' + (value.total - value.answered));
      }
      if (!saved) renderText('এই ফলটি সেভ করা যায়নি।');
      output.append(button('উত্তর ও ব্যাখ্যা দেখুন', () => {
        output.textContent = '';
        for (const [position, question] of paper.questions.entries()) {
          renderText(String(position + 1), 'h4');
          renderFormatted(question.passage);
          renderFormatted(question.prompt);
          const selected = answers.get(position);
          if (selected !== undefined) {
            renderText('তোমার উত্তর');
            renderFormatted(question.choices[selected]);
          }
          renderText('সঠিক উত্তর');
          renderFormatted(question.choices[question.answer]);
          renderFormatted(question.explanation);
        }
      }));
    }
    showQuestion();
  }
  const open = button('Mock Test', async () => {
    const version = ++request;
    panel.hidden = false;
    output.textContent = '';
    renderText('পরীক্ষার তালিকা আনা হচ্ছে…');
    try {
      const catalog = await load('catalog');
      if (version !== request) return;
      if (!Array.isArray(catalog)) throw new Error('Invalid catalog');
      output.textContent = '';
      renderText(level + ' লিখিত মক পরীক্ষা', 'h3');
      for (const entry of catalog.filter(row => row && inScope(level, row.id) && Number.isInteger(row.count))) {
        output.append(button(entry.title + ' · ' + entry.count + ' প্রশ্ন', async () => {
          const selection = ++request;
          output.textContent = '';
          renderText('পরীক্ষা আনা হচ্ছে…');
          try {
            const paper = validateMockPaper(await load(entry.id), level, entry);
            if (selection === request) start(paper);
          } catch {
            if (selection === request) { output.textContent = ''; renderText('পরীক্ষাটি এখন খোলা যাচ্ছে না।'); }
          }
        }));
      }
    } catch {
      if (version === request) { output.textContent = ''; renderText('পরীক্ষার তালিকা এখন পাওয়া যাচ্ছে না।'); }
    }
  });
  panel.append(button('পরীক্ষা বন্ধ করুন', () => { request++; panel.hidden = true; output.textContent = ''; }), output);
  menu.after(panel);
  menu.append(open);
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
