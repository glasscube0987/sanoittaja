/** Sointumerkki, joka on ankkuroitu rivin merkkipositioon. */
export interface ChordAnchor {
  id: string;
  /** 0-pohjainen merkki-indeksi rivin tekstissä (voi olla text.length = rivin loppu). */
  pos: number;
  /** Sointusymboli, esim. "Am7", "C#/G#", "Bb". */
  symbol: string;
}

export type SectionKind = 'intro' | 'verse' | 'prechorus' | 'chorus' | 'bridge' | 'solo' | 'outro';

/** Osion alkumerkintä. Osio jatkuu seuraavaan merkintään asti. */
export interface SectionMark {
  kind: SectionKind;
  /** Vapaa nimi, joka korvaa lajin oletusnimen ja numeroinnin. */
  label?: string;
}

export interface LyricLine {
  id: string;
  text: string;
  chords: ChordAnchor[];
  /** Jos asetettu, rivi aloittaa uuden osion. */
  section?: SectionMark;
  /**
   * Tahtilajit tahdeittain: `meters[i]` on voimassa tahdista `i` eteenpäin,
   * esim. "3/4". Merkitään vain siihen tahtiin jossa laji vaihtuu; laulun oma
   * tahtilaji on `Song.meter`.
   */
  meters?: string[];
  /** Vanha, koko riviä koskenut tahtilaji. Luetaan ensimmäisen tahdin lajiksi. */
  meter?: string;
  /**
   * Jos asetettu, rivi on sointurivi: soinnut luetaan tahteina eikä sanoihin
   * ankkuroituna, eikä rivillä ole sanoja. Yksi alkio on yhden tahdin sisältö
   * vapaana tekstinä, esim. "Am", "Am F" tai "%".
   */
  bars?: string[];
}

export interface Song {
  id: string;
  title: string;
  /** Vapaamuotoinen sävellajimerkintä, esim. "Em". */
  songKey: string;
  /**
   * Laulun tahtilaji, esim. "4/4". Vapaata tekstiä samasta syystä kuin
   * sävellaji: "7/8" ja "12/8" ovat yhtä päteviä eikä listaa kannata rajata.
   */
  meter?: string;
  /**
   * Nettosiirtymä puolisävelaskelina alkuperäisestä sävellajista. Soinnut
   * tallennetaan transponoituina, joten tämä on ainoa muisto siitä mistä
   * lähdettiin – sen avulla laulun voi palauttaa alkuperäiseen sävellajiin.
   */
  transpose?: number;
  lines: LyricLine[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Keikkakohtainen soittolista. Sisältää vain laulujen tunnuksia, ei kopioita,
 * joten sama laulu voi olla useassa setissä ja muokkaus näkyy kaikkialla.
 * ”Kaikki laulut” ei ole tallennettu setti vaan oletusnäkymä – niin mikään
 * laulu ei voi pudota näkyvistä setin mukana.
 */
export interface Setlist {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
  updatedAt: number;
}

/** Yhteinen osa kaikille nuottilehden merkinnöille. */
interface AnnotationBase {
  id: string;
  songId: string;
  /** Rivi, jolta merkintä alkoi. Se saa ulottua rivin ulkopuolelle. */
  lineId: string;
  color: string;
  /**
   * Koordinaattien yksikkö. Ensimmäinen versio suhteutti pisteet rivin
   * leveyteen, jolloin merkinnät eivät seuranneet tekstikokoa; nykyinen yksikkö
   * on rivin fonttikoko. Kenttä erottaa nämä toisistaan, jotta vanhat vedot ei
   * piirry väärään kohtaan väärän kokoisina.
   */
  unit: 'em';
  createdAt: number;
}

/**
 * Käsin piirretty veto nuottilehdellä.
 *
 * Veto kuuluu riviin ja sen pisteet ovat rivin fonttikoon monikertoja. Näin
 * merkintä seuraa riviä kun laulua muokataan tai tekstikoko vaihtuu –
 * näyttöpikselit eivät kelpaisi, koska lehti ladotaan uudelleen jokaisesta
 * muutoksesta.
 *
 * `kind` puuttuu vanhoista tietueista, joten sen puuttuminen tarkoittaa vetoa:
 * uusi laji merkitään erottelevalla kentällä, jolloin kannassa jo olevat
 * merkinnät kelpaavat sellaisinaan eikä versiota tarvitse nostaa.
 */
export interface StrokeAnnotation extends AnnotationBase {
  kind?: 'stroke';
  /** Viivan paksuus samassa yksikössä kuin pisteet. */
  width: number;
  /** Litteä lukulista `[x0, y0, x1, y1, …]`; olio per piste kolminkertaistaisi koon. */
  points: number[];
}

export type TextFont = 'sans' | 'mono' | 'serif';

/**
 * Vapaa tekstikenttä nuottilehdellä: «capo 3», «2x», «hiljaa tässä».
 *
 * Sijainti ja koko ovat samassa em-yksikössä kuin vedoilla, joten teksti seuraa
 * riviään ja kasvaa live-tilan tekstikoon mukana. Leveyttä ei talleteta:
 * laatikko on täsmälleen kirjoitetun tekstin levyinen, ja selain latoo sen –
 * mitattu leveys vanhenisi heti kun fonttia tai kokoa vaihdetaan, eikä sitä
 * voisi lukea tulostuslehdeltä joka on `display: none`.
 */
export interface TextAnnotation extends AnnotationBase {
  kind: 'text';
  /** Laatikon vasen yläkulma rivin koordinaatistossa (em). */
  x: number;
  y: number;
  text: string;
  /** Tekstin koko rivin fonttikoon monikertana. */
  size: number;
  font: TextFont;
  bold: boolean;
  italic: boolean;
  /** Peittävä tausta ja kehys, jotta laatikko erottuu sanoitusten päällä. */
  boxed: boolean;
  /**
   * Tyhjä vetogeometria, jota tekstikenttä ei käytä mihinkään.
   *
   * Kenttä on vanhempaa sovellusversiota varten. Varmuuskopio kulkee laitteelta
   * toiselle, ja vastaanottava laite voi olla vielä vanhassa versiossa, joka ei
   * tunne tekstikenttiä lainkaan: se piirtää jokaisen merkinnän vetona ja lukee
   * `points`-kentän. Ilman tätä se lukisi `undefined.length` ja kaatuisi kesken
   * renderin — koko lehti jäisi valkoiseksi. Tyhjällä listalla `pathData`
   * palauttaa tyhjän merkkijonon, jolloin vanha versio vain ohittaa kentän.
   *
   * Yleinen sääntö: uusi merkintälaji on vanhalle lukijalle vaaraton.
   */
  points: number[];
  width: number;
}

export type Annotation = StrokeAnnotation | TextAnnotation;

export function isText(note: Annotation): note is TextAnnotation {
  return note.kind === 'text';
}

/** Vanha tietue ilman `kind`-kenttää on veto; ks. `StrokeAnnotation`. */
export function isStroke(note: Annotation): note is StrokeAnnotation {
  return note.kind !== 'text';
}

export interface Recording {
  id: string;
  songId: string;
  name: string;
  mimeType: string;
  durationMs: number;
  createdAt: number;
  blob: Blob;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Nimi on oletuksena tyhjä, ei kiinteä teksti: käyttöliittymä näyttää tyhjän
 * nimen tilalla käännetyn ”Nimetön”, joten kieli ei pääse vuotamaan dataan.
 */
export function newSong(title = ''): Song {
  const now = Date.now();
  return {
    id: uid(),
    title,
    songKey: '',
    lines: [{ id: uid(), text: '', chords: [] }],
    createdAt: now,
    updatedAt: now,
  };
}
