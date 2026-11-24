"""Import reviewed standalone exercises from the existing first free Sakura paper."""
import csv
import io
import json
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_starttag(self, tag, attrs):
        if tag == 'u':
            self.parts.append('【')
        elif tag in {'p', 'br', 'div'}:
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag == 'u':
            self.parts.append('】')


def text(value):
    parser = PlainText()
    parser.feed(value)
    parser.close()
    return ''.join(parser.parts).strip()


with zipfile.ZipFile(sys.argv[1]) as archive:
    reviewed = {
        row['question_id'] for row in csv.DictReader(io.StringIO(archive.read('question-audit.csv').decode('utf-8-sig')))
        if row['review_status'] == 'reviewed_sample' and not row['flags'] and row['exam'] == 'JLPT'
    }
    catalog = json.loads(archive.read('catalog-v2.json'))
    entry = next(p for p in catalog['papers'] if p['id'] == 'n5-practice-1' and p['level'] == 'N5')
    paper = json.loads(archive.read(entry['path']))
    imported = []
    for row in paper['questions']:
        if row['id'] not in reviewed or row['category'] not in {'vocabulary', 'grammar', 'reading'}:
            continue
        choices = list(map(text, row['choices']))
        answer = row['answer']
        if len(choices) != 4 or len(set(choices)) != 4 or not all(choices) or type(answer) is not int or not 0 <= answer < 4:
            continue
        prompt = text(row['prompt'])
        passage = text(row.get('passage') or '')
        if not prompt or (row['category'] == 'reading' and not passage):
            continue
        imported.append(dict(
            id=row['id'], kind='vocab' if row['category'] == 'vocabulary' else 'grammar',
            prompt=prompt, choices=choices, answer=answer, passage=passage,
            instruction=text(row.get('instruction') or ''), explanation=text(row.get('explanation') or ''),
        ))
    if not imported:
        raise SystemExit('No reviewed exercises in the first free N5 paper')
    Path(sys.argv[2]).write_text(json.dumps(dict(level='N5', source=paper['source'], questions=imported),
                                           ensure_ascii=False), encoding='utf-8')
    print(f'{len(imported)} standalone adaptive questions')
