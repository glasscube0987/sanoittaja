import { describe, expect, it } from 'vitest';
import { isChordToken } from './chords';
import {
  buildLines,
  classifyLine,
  classifyLines,
  parseSongText,
  sectionFromHeading,
  splitLines,
} from './importText';

describe('isChordToken', () => {
  it('hyväksyy tavalliset sointumerkinnät', () => {
    for (const symbol of ['Am', 'F', 'Bb', 'C#', 'F#m', 'Dm7', 'Cmaj7', 'G/B', 'C#/G#']) {
      expect(isChordToken(symbol), symbol).toBe(true);
    }
  });

  it('hyväksyy monimutkaisemmat laadut', () => {
    for (const symbol of ['F#m7b5', 'C7sus4', 'Dsus2', 'A5', 'Em9', 'Cadd9', 'C(add9)', 'Bm11']) {
      expect(isChordToken(symbol), symbol).toBe(true);
    }
  });

  it('hylkää isolla alkukirjaimella kirjoitetut sanat', () => {
    // parseChord hyväksyisi nämä kaikki: sen laatuosa on [^/]*. Juuri tämän
    // vuoksi tunnistus tarvitsee oman, tiukan sääntönsä.
    for (const word of ['Dance', 'Every', 'Away', 'Baby', 'Alone', 'Fade', 'Cause', 'Been', 'Fool']) {
      expect(isChordToken(word), word).toBe(false);
    }
  });
});

describe('classifyLine', () => {
  it('tunnistaa sointurivin', () => {
    expect(classifyLine('Am      F       C')).toBe('chords');
    expect(classifyLine('  Dm7   G7')).toBe('chords');
  });

  it('tunnistaa sanoitusrivin', () => {
    expect(classifyLine('kuu valaisee yön')).toBe('lyrics');
    // Ratkaiseva tapaus: englantia isoilla alkukirjaimilla.
    expect(classifyLine('Every Baby Dance Alone')).toBe('lyrics');
  });

  it('pitää sekariviä sanoituksena', () => {
    // Yksikin sanaksi tulkittava merkki riittää: sanojen menettäminen on
    // pahempi virhe kuin sointurivin jääminen sanoitukseksi.
    expect(classifyLine('Am ja tie vie')).toBe('lyrics');
  });

  it('tunnistaa tahtirivin', () => {
    expect(classifyLine('| Am | F | C | G |')).toBe('bars');
    expect(classifyLine('|Am F|C|')).toBe('bars');
  });

  it('sallii sointurivillä lisämerkinnät', () => {
    expect(classifyLine('Am  F  x2')).toBe('chords');
    expect(classifyLine('N.C.  Am')).toBe('chords');
  });

  it('tunnistaa tyhjän rivin', () => {
    expect(classifyLine('')).toBe('blank');
    expect(classifyLine('    ')).toBe('blank');
  });
});

describe('sectionFromHeading', () => {
  it('tunnistaa osiot molemmilla kielillä', () => {
    expect(sectionFromHeading('[Chorus]')).toEqual({ kind: 'chorus' });
    expect(sectionFromHeading('Kertosäe:')).toEqual({ kind: 'chorus' });
    expect(sectionFromHeading('Säkeistö 2')).toEqual({ kind: 'verse' });
    expect(sectionFromHeading('Verse 1')).toEqual({ kind: 'verse' });
    expect(sectionFromHeading('[Pre-Chorus]')).toEqual({ kind: 'prechorus' });
    expect(sectionFromHeading('SOOLO')).toEqual({ kind: 'solo' });
  });

  it('säilyttää tuntemattoman hakasulkuotsikon nimenä', () => {
    expect(sectionFromHeading('[Hyräily]')).toEqual({ kind: 'verse', label: 'Hyräily' });
  });

  it('ei tulkitse sanoitusriviä otsikoksi', () => {
    expect(sectionFromHeading('Chorus of angels')).toBeNull();
    expect(sectionFromHeading('kuu valaisee yön')).toBeNull();
  });
});

describe('buildLines', () => {
  it('ankkuroi soinnut sarakkeisiin, joista ne alkoivat', () => {
    const teksti = ['Am      F', 'kuu valaisee yön'].join('\n');
    const { lines } = parseSongText(teksti);

    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('kuu valaisee yön');
    expect(lines[0].chords.map((c) => [c.pos, c.symbol])).toEqual([
      [0, 'Am'],
      [8, 'F'],
    ]);
  });

  it('tekee yksinäisestä sointurivistä sanattoman rivin', () => {
    const { lines } = parseSongText('Am   F   G');
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('');
    expect(lines[0].chords.map((c) => c.symbol)).toEqual(['Am', 'F', 'G']);
  });

  it('rajaa liian suuren sarakkeen riville mahtuvaksi', () => {
    // Sointu 60 merkin päässä lyhyen sanoitusrivin yllä: ankkuri ei voi
    // karata rivin ulottumattomiin.
    const teksti = [' '.repeat(60) + 'Am', 'lyhyt'].join('\n');
    const { lines } = parseSongText(teksti);
    expect(lines[0].chords[0].pos).toBe(32);
  });

  it('kokoaa tahdit tahtirivistä', () => {
    const { lines } = parseSongText('| Am | F | C G | %  |');
    expect(lines[0].bars).toEqual(['Am', 'F', 'C G', '%']);
  });

  it('liittää osiomerkinnän seuraavaan riviin', () => {
    const { lines } = parseSongText(['[Chorus]', 'G', 'älä katso taakse'].join('\n'));
    expect(lines[0].section).toEqual({ kind: 'chorus' });
    expect(lines[0].text).toBe('älä katso taakse');
  });

  it('tiivistää peräkkäiset tyhjät rivit eikä jätä tyhjää otsikon eteen', () => {
    const teksti = ['eka', '', '', '[Chorus]', 'toka'].join('\n');
    const { lines } = parseSongText(teksti);
    expect(lines.map((l) => l.text)).toEqual(['eka', 'toka']);
    expect(lines[1].section).toEqual({ kind: 'chorus' });
  });

  it('säilyttää tyhjän rivin erottimena sisällön välissä', () => {
    const { lines } = parseSongText(['eka', '', 'toka'].join('\n'));
    expect(lines.map((l) => l.text)).toEqual(['eka', '', 'toka']);
  });

  it('ottaa ensimmäisen rivin nimeksi kun sitä seuraa tyhjä rivi', () => {
    const teksti = ['Kuu valaisee', '', 'Am', 'kuu valaisee yön'].join('\n');
    const tulos = parseSongText(teksti, { withTitle: true });
    expect(tulos.title).toBe('Kuu valaisee');
    expect(tulos.titleIndex).toBe(0);
    expect(tulos.lines.map((l) => l.text)).toEqual(['kuu valaisee yön']);
  });

  it('ei ota nimeä ilman erillistä pyyntöä', () => {
    const teksti = ['Kuu valaisee', '', 'kuu valaisee yön'].join('\n');
    const tulos = parseSongText(teksti);
    expect(tulos.title).toBeUndefined();
    expect(tulos.lines.map((l) => l.text)).toEqual(['Kuu valaisee', '', 'kuu valaisee yön']);
  });

  it('ei ota nimeä sointurivin alta', () => {
    const teksti = ['Am', 'kuu valaisee yön', '', 'ja tie vie'].join('\n');
    expect(parseSongText(teksti, { withTitle: true }).title).toBeUndefined();
  });

  it('noudattaa käyttäjän korjaamaa rivityyppiä', () => {
    // "Am F" tunnistuu soinnuiksi, mutta jos se onkin sanoitusta, korjaus
    // muuttaa myös pariutumisen: alla oleva rivi jää omakseen.
    const raw = ['Am  F', 'kuu valaisee yön'];
    const kinds = classifyLines(raw);
    expect(kinds).toEqual(['chords', 'lyrics']);

    const korjattu = buildLines(raw, ['lyrics', 'lyrics']);
    expect(korjattu.lines.map((l) => l.text)).toEqual(['Am  F', 'kuu valaisee yön']);
    expect(korjattu.lines[0].chords).toEqual([]);
  });

  it('lukee kokonaisen laulupaperin', () => {
    const teksti = [
      'Kuu valaisee',
      '',
      '[Intro]',
      '| Am | F |',
      '',
      'Verse 1',
      'Am           F',
      'kuu valaisee yön',
      '        C',
      'ja tie vie pohjoiseen',
      '',
      'Kertosäe',
      'G',
      'älä katso taakse',
    ].join('\n');

    const { title, lines } = parseSongText(teksti, { withTitle: true });

    expect(title).toBe('Kuu valaisee');
    expect(lines.map((l) => l.text)).toEqual([
      '',
      'kuu valaisee yön',
      'ja tie vie pohjoiseen',
      'älä katso taakse',
    ]);
    expect(lines[0].bars).toEqual(['Am', 'F']);
    expect(lines[0].section).toEqual({ kind: 'intro' });
    expect(lines[1].section).toEqual({ kind: 'verse' });
    expect(lines[1].chords.map((c) => [c.pos, c.symbol])).toEqual([
      [0, 'Am'],
      [13, 'F'],
    ]);
    expect(lines[2].chords.map((c) => [c.pos, c.symbol])).toEqual([[8, 'C']]);
    expect(lines[3].section).toEqual({ kind: 'chorus' });
  });
});

describe('splitLines', () => {
  it('sietää eri rivinvaihtotyylit', () => {
    expect(splitLines('a\r\nb\rc\nd')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('levittää sarkaimet sarakkeiksi', () => {
    // Sarkain ei ole sarake; ilman levitystä sointujen kohdistusta ei voi lukea.
    expect(splitLines('Am\tF')).toEqual(['Am  F']);
    expect(splitLines('A\tB')).toEqual(['A   B']);
  });
});
