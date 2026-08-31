import { describe, expect, it } from 'vitest';
import { isChordToken, parseChord, respellChord, transposeBar, transposeChord } from './chords';

describe('parseChord', () => {
  it('jäsentää perussoinnut', () => {
    expect(parseChord('C')).toEqual({ root: 'C', quality: '', bass: undefined });
    expect(parseChord('Am7')).toEqual({ root: 'A', quality: 'm7', bass: undefined });
    expect(parseChord('F#sus4')).toEqual({ root: 'F#', quality: 'sus4', bass: undefined });
  });

  it('jäsentää bassosävelen', () => {
    expect(parseChord('C/G')).toEqual({ root: 'C', quality: '', bass: 'G' });
    expect(parseChord('Dm7/Bb')).toEqual({ root: 'D', quality: 'm7', bass: 'Bb' });
  });

  it('hylkää tunnistamattomat', () => {
    // H kelpaa nykyään: se on sama sävel kuin B. Tunnistamaton on I ja
    // eteenpäin — sekä tyhjä ja pelkkä numero.
    expect(parseChord('I7')).toBeNull();
    expect(parseChord('')).toBeNull();
    expect(parseChord('7')).toBeNull();
  });
});

describe('transposeChord', () => {
  it('transponoi ylös ja alas', () => {
    expect(transposeChord('C', 2)).toBe('D');
    expect(transposeChord('Am', -2)).toBe('Gm');
    expect(transposeChord('G7', 5)).toBe('C7');
  });

  it('kiertää oktaavin yli', () => {
    expect(transposeChord('B', 1)).toBe('C');
    expect(transposeChord('C', -1)).toBe('B');
    expect(transposeChord('D', 12)).toBe('D');
  });

  it('säilyttää laadun ja transponoi basson', () => {
    expect(transposeChord('Am7/G', 2)).toBe('Bm7/A');
    expect(transposeChord('Csus2/E', 1)).toBe('C#sus2/F');
  });

  it('kunnioittaa etumerkkiasetusta', () => {
    expect(transposeChord('C', 1, 'flat')).toBe('Db');
    expect(transposeChord('C', 1, 'sharp')).toBe('C#');
  });

  it('päättelee etumerkin alkuperäisestä symbolista', () => {
    expect(transposeChord('Bb', 2)).toBe('C');
    expect(transposeChord('Bb', 1)).toBe('B');
    expect(transposeChord('A#', 1)).toBe('B');
    expect(transposeChord('F#m', 2)).toBe('G#m');
  });

  it('palauttaa tunnistamattoman symbolin muuttumattomana', () => {
    expect(transposeChord('N.C.', 3)).toBe('N.C.');
    expect(transposeChord('riffi', 3)).toBe('riffi');
  });
});

describe('respellChord', () => {
  it('vaihtaa enharmonisen kirjoitusasun', () => {
    expect(respellChord('C#m', 'flat')).toBe('Dbm');
    expect(respellChord('Dbm', 'sharp')).toBe('C#m');
    expect(respellChord('C', 'flat')).toBe('C');
  });
});

describe('transposeBar', () => {
  it('transponoi tahdin jokaisen soinnun erikseen', () => {
    // Koko sisältöä ei voi antaa transposeChordille: se jäsentäisi "Am F"
    // juureksi A ja laaduksi "m F", jolloin F jäisi transponoimatta.
    expect(transposeChord('Am F', 2)).toBe('Bm F');
    expect(transposeBar('Am F', 2)).toBe('Bm G');
  });

  it('säilyttää välit sellaisinaan', () => {
    expect(transposeBar('Am   F', 2)).toBe('Bm   G');
    expect(transposeBar('  Am F  ', 2)).toBe('  Bm G  ');
  });

  it('jättää muut merkinnät koskematta', () => {
    expect(transposeBar('%', 5)).toBe('%');
    expect(transposeBar('Am % N.C.', 2)).toBe('Bm % N.C.');
  });

  it('transponoi yksittäisen soinnun kuten ennenkin', () => {
    expect(transposeBar('F#m7', 1)).toBe('Gm7');
    expect(transposeBar('C/G', 2)).toBe('D/A');
  });

  it('kelpaa myös kirjoitusasun vaihtoon', () => {
    expect(transposeBar('C#m F#', 0, 'flat')).toBe('Dbm Gb');
  });

  it('sietää tyhjän tahdin', () => {
    expect(transposeBar('', 2)).toBe('');
  });
});

describe('H-merkintä', () => {
  /*
   * Suomalais-saksalaisessa perinteessä h-sävel kirjoitetaan H:lla. Sovellus ei
   * tunnistanut sitä lainkaan, joten H-alkuiset soinnut palautuivat
   * transponoinnista muuttumattomina — sävellajin vaihto rikkoi lapun hiljaa.
   */
  it('tunnistaa H:n samaksi säveleksi kuin B', () => {
    expect(parseChord('H')).toEqual({ root: 'H', quality: '', bass: undefined });
    expect(transposeChord('H', 1)).toBe('C');
    expect(transposeChord('B', 1)).toBe('C');
    expect(transposeChord('H', -1)).toBe('A#');
  });

  it('transponoi H-soinnut laatuineen ja bassoineen', () => {
    expect(transposeChord('Hm', 1)).toBe('Cm');
    expect(transposeChord('H7', 2)).toBe('C#7');
    expect(transposeChord('Hm7/F#', 1)).toBe('Cm7/G');
  });

  it('kirjoittaa h-sävelen valitulla merkinnällä', () => {
    expect(transposeChord('A', 2, 'sharp', 'H')).toBe('H');
    expect(transposeChord('A', 2, 'sharp', 'B')).toBe('B');
    expect(transposeChord('A', 2, 'flat', 'H')).toBe('H');
    // Oletus on B, jolloin nykyinen käytös säilyy kutsujille jotka eivät välitä.
    expect(transposeChord('A', 2, 'sharp')).toBe('B');
  });

  it('ei tuota koskaan pelkkää B:tä H-merkinnässä', () => {
    /*
     * Perinteisessä merkinnässä pelkkä B tarkoittaa b-säveltä, joten sen
     * kirjoittaminen h-sävelen viereen olisi juuri se sekaannus jota tässä
     * yritetään välttää. Sävelluokka 10 on aina A# tai Bb.
     */
    for (let i = 0; i < 12; i++) {
      for (const prefer of ['sharp', 'flat'] as const) {
        expect(transposeChord('C', i, prefer, 'H')).not.toBe('B');
      }
    }
    expect(transposeChord('Bb', 0, 'flat', 'H')).toBe('Bb');
    expect(transposeChord('A#', 0, 'sharp', 'H')).toBe('A#');
  });

  it('säilyttää merkintätavan myös bassosävelessä ja tahdissa', () => {
    expect(transposeChord('C/A', 2, 'sharp', 'H')).toBe('D/H');
    expect(transposeBar('A E', 2, 'sharp', 'H')).toBe('H F#');
  });

  it('lukee myös Hb:n ja H#:n', () => {
    // Epätavallisia mutta yksiselitteisiä; sama logiikka kuin B#:lla ja Cb:llä.
    expect(transposeChord('Hb', 0, 'flat')).toBe('Bb');
    expect(transposeChord('H#', 0, 'sharp')).toBe('C');
  });

  it('enharmoninen vaihto muuntaa merkintätavan', () => {
    // Sivutuote, joka on hyödyllinen: ♯-painike kirjoittaa B:t H:ksi.
    expect(respellChord('B', 'sharp', 'H')).toBe('H');
    expect(respellChord('H', 'sharp', 'B')).toBe('B');
  });
});

describe('isChordToken H:n kanssa', () => {
  it('hyväksyy H-soinnut', () => {
    expect(isChordToken('H')).toBe(true);
    expect(isChordToken('Hm')).toBe(true);
    expect(isChordToken('H7')).toBe(true);
    expect(isChordToken('Hmaj7/D#')).toBe(true);
  });

  it('ei lue suomen sanoja soinnuiksi', () => {
    /*
     * H:n lisääminen tunnistimeen kasvattaa riskiä, että sanoitusrivi luetaan
     * sointuriviksi ja sanat katoavat. Laatuosa on lueteltu, joten H:lla alkava
     * sana ei kelpaa soinnuksi ellei loppu ole sointulaatua.
     */
    for (const sana of ['Hei', 'Hän', 'Halloween', 'Huomenna', 'Hiljaa']) {
      expect(isChordToken(sana)).toBe(false);
    }
  });
});
