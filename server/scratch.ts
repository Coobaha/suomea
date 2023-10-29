import * as fs from 'node:fs';
import * as cheerio from 'cheerio';
import * as path from 'node:path';
import { fileURLToPath } from 'url';

// @ts-ignore
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const main = async () => {
  const html = await fs.promises.readFile(
    path.join(__dirname, 'wk.html'),
    'utf-8',
  );

  const finnish = html
    .split('<hr />')
    .find((section) => section.includes('id="Finnish"'));

  if (!finnish) throw new Error('No Finnish section found');
  const $$ = cheerio.load(finnish);

  const $html = $$.root();
  $html.find('#toc').remove();
  $html.find('.mw-editsection').remove();
  $html.find('*').each((_x, el) => {
    const $el = $$(el);
    if ($el.attr('lang') !== 'fi') {
      $el.removeAttr('lang');
    }
    if ($el.hasClass('term-list-header')) {
      $el.removeClass('term-list-header').addClass('title');
    }
    if ($el.is('style')) {
      $el.remove();
    }
  });
  $html.find('table *').each((_x, el) => {
    $$(el).removeAttr('class').removeAttr('lang');
  });

  let maybeTranslation = $html
    .find('.Latn.headword[lang="fi"]')
    .closest('p')
    .next('ol, ul')
    .text();

  console.log(maybeTranslation);
};

void main();
