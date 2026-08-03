import { describe, expect, it } from 'vitest';
import { detectLang, isLang, KEYS, LANGS, translate } from './i18n';
import { SECTION_KEYS } from './sections';
import type { SectionKind } from './types';

describe('translate', () => {
  it('kääntää molemmille kielille', () => {
    expect(translate('en', 'common.save')).toBe('Save');
    expect(translate('fi', 'common.save')).toBe('Tallenna');
  });

  it('korvaa nimetyt parametrit', () => {
    expect(translate('en', 'chord.position', { pos: 6, max: 16 })).toBe('column 6/16');
    expect(translate('fi', 'list.imported', { songs: 2, recordings: 3 })).toBe(
      'Tuotu 2 laulua ja 3 nauhoitetta.',
    );
  });

  it('jättää tuntemattoman paikanpitäjän koskematta', () => {
    // Puuttuva parametri ei saa tuottaa "undefined"-tekstiä käyttöliittymään.
    expect(translate('en', 'chord.position', { pos: 1 })).toBe('column 1/{max}');
  });
});

describe('käännöstaulut', () => {
  it('sisältävät ei-tyhjän tekstin jokaiselle avaimelle molemmilla kielillä', () => {
    // Puuttuva tai tyhjä käännös näkyisi käyttöliittymässä tyhjänä painikkeena.
    const puuttuvat = LANGS.flatMap((lang) =>
      KEYS.filter((key) => !translate(lang, key).trim()).map((key) => `${lang}:${key}`),
    );
    expect(puuttuvat).toEqual([]);
  });

  it('käyttävät samoja paikanpitäjiä molemmilla kielillä', () => {
    // Eri paikanpitäjä toisessa kielessä jättäisi arvon korvaamatta.
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const eroavat = KEYS.filter(
      (key) =>
        placeholders(translate('en', key)).join() !== placeholders(translate('fi', key)).join(),
    );
    expect(eroavat).toEqual([]);
  });

  it('sisältävät nimen jokaiselle osiolajille', () => {
    for (const kind of Object.keys(SECTION_KEYS) as SectionKind[]) {
      for (const lang of LANGS) {
        expect(translate(lang, SECTION_KEYS[kind]), `${kind}/${lang}`).toBeTruthy();
      }
    }
  });
});

describe('detectLang', () => {
  it('valitsee suomen suomenkieliselle selaimelle', () => {
    expect(detectLang({ language: 'fi-FI' })).toBe('fi');
    expect(detectLang({ language: 'fi' })).toBe('fi');
  });

  it('valitsee englannin muille', () => {
    expect(detectLang({ language: 'en-GB' })).toBe('en');
    expect(detectLang({ language: 'sv-SE' })).toBe('en');
  });
});

describe('isLang', () => {
  it('hyväksyy vain tuetut kielet', () => {
    expect(isLang('fi')).toBe(true);
    expect(isLang('de')).toBe(false);
    expect(isLang(null)).toBe(false);
  });
});
