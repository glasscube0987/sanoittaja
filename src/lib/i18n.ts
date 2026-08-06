/**
 * Kevyt käännöskerros ilman kirjastoa: litteä avain–teksti-taulu kummallekin
 * kielelle, `{nimi}`-korvaukset ja React-konteksti.
 *
 * Kieli ei koskaan päädy tallennettuun lauluun: osiot säilytetään
 * kielineutraalina `SectionKind`-arvona ja käännetään vasta piirrettäessä.
 * Näin kielen voi vaihtaa milloin tahansa ilman datamuunnoksia.
 */
import { createContext, useContext } from 'react';

export type Lang = 'en' | 'fi';

export const LANGS: Lang[] = ['en', 'fi'];
export const LANG_NAMES: Record<Lang, string> = { en: 'English', fi: 'Suomi' };

const STORAGE_KEY = 'sanoittaja.lang';
const DATE_LOCALE: Record<Lang, string> = { en: 'en-GB', fi: 'fi-FI' };

const en = {
  'app.untitled': 'Untitled',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.close': 'Close',
  'common.error': 'Error: {message}',

  'list.settings': 'Settings',
  'list.newSong': '+ New song',
  'list.newTitle': 'New song',
  'list.newBlank': 'Blank song',
  'list.newFromText': 'Import from text',
  'list.emptyTitle': 'No songs yet.',
  'list.emptyHint': 'Tap “New song” to start — lyrics, chords and recordings are stored on your device.',
  'list.meta': '{lines} lines · edited {date}',
  'list.downloadBackup': 'Back up',
  'list.cloudBackup': 'To cloud',
  'list.importBackup': 'Restore',
  'list.preparingBackup': 'Preparing backup…',
  'list.backupDownloaded': 'Backup saved.',
  'list.backupNever': 'No backup yet — songs live only on this device.',
  'list.backupToday': 'Backed up today.',
  'list.backupDays': 'Backed up {days} days ago.',
  'list.backupStale': 'Last backup {days} days ago — worth taking a new one.',
  'list.importing': 'Importing…',
  'list.imported': 'Imported {songs} songs and {recordings} recordings.',

  'editor.backLabel': 'Songs',
  'editor.undo': 'Undo',
  'editor.titlePlaceholder': 'Song title',
  'editor.keyPlaceholder': 'Key',
  'editor.keyLabel': 'Key',
  'editor.meterPlaceholder': 'Time',
  'editor.meterLabel': 'Time signature',
  'editor.transpose': 'Transpose',
  'editor.semitoneDown': 'Down a semitone',
  'editor.semitoneUp': 'Up a semitone',
  'editor.useFlats': 'Write with flats',
  'editor.useSharps': 'Write with sharps',
  'editor.transposedBy': 'Transposed {offset} semitones from the original key',
  'editor.resetKey': 'Back to original key',
  'editor.duplicateSection': 'Duplicate section {name}',
  'editor.moveSectionUp': 'Move section {name} up',
  'editor.moveSectionDown': 'Move section {name} down',
  'editor.addLine': '+ Line',
  'editor.exportPdf': 'Export PDF',
  'editor.live': 'Live',
  'editor.deleteSong': 'Delete song',

  'live.play': 'Play',
  'live.pause': 'Pause',
  'live.slower': 'Slower',
  'live.faster': 'Faster',
  'live.speed': 'Speed {speed}',
  'live.smallerText': 'Smaller text',
  'live.largerText': 'Larger text',
  'live.exit': 'Exit live mode',
  'live.previousSong': 'Previous song',
  'live.nextSong': 'Next song',
  'live.position': '{index}/{count}',
  'draw.toggle': 'Draw on the sheet',
  'draw.color': 'Colour {color}',
  'draw.eraser': 'Erase',
  'draw.undo': 'Undo stroke',
  'draw.finger': 'Finger draws',
  'draw.fingerShort': 'Finger',
  'editor.confirmDeleteSong': 'Delete the song “{title}” and its recordings?',

  'line.addChordHere': 'Tap to add a chord here',
  'line.editSection': 'Line settings',
  'line.startSection': 'Line settings',
  'line.title': 'Line',
  'line.type': 'Line type',
  'line.typeLyrics': 'Lyrics',
  'line.typeBars': 'Chord bars',
  'line.sectionMarker': 'Section marker',
  'line.editBars': 'Edit chord bars',
  'line.delete': 'Delete line',

  'bars.title': 'Chord bars',
  'bars.position': 'bar {index}/{count}',
  'bars.hint': 'arrow keys move between bars',
  'bars.placeholder': 'e.g. Am, Am F, %',
  'bars.add': '+ Bar',
  'bars.remove': '− Bar',
  'bars.split': 'Split bar',
  'bars.meter': 'Time signature from bar {index} on',
  'bars.meterPlaceholder': 'e.g. 3/4',

  'chord.edit': 'Edit chord',
  'chord.add': 'Add chord',
  'chord.moveLeft': 'Move one character left',
  'chord.moveRight': 'Move one character right',
  'chord.position': 'column {pos}/{max}',
  'chord.arrowHint': 'arrow keys move it',
  'chord.placeholder': 'e.g. Am7, C#/G#, Bb',

  'section.edit': 'Edit section',
  'section.start': 'Start a section here',
  'section.customName': 'Custom name',
  'section.numberingHint': 'Leave empty and repeated sections are numbered automatically, e.g. Verse 1 and Verse 2.',
  'section.removeMarker': 'Remove marker',
  'section.intro': 'Intro',
  'section.verse': 'Verse',
  'section.prechorus': 'Pre-chorus',
  'section.chorus': 'Chorus',
  'section.bridge': 'Bridge',
  'section.solo': 'Solo',
  'section.outro': 'Outro',

  'set.all': 'All songs',
  'set.new': '+ New set',
  'set.namePrompt': 'Name of the set',
  'set.rename': 'Rename',
  'set.delete': 'Delete',
  'set.confirmDelete': 'Delete the set “{name}”? The songs themselves stay.',
  'set.addSongs': 'Add songs',
  'set.addTitle': 'Add songs to “{name}”',
  'set.empty': 'No songs in this set yet.',
  'set.emptyHint': 'Tap “Add songs” to build the set for a gig.',
  'sort.label': 'Sort',
  'sort.edited': 'Edited',
  'sort.az': 'A–Z',
  'sort.za': 'Z–A',
  'set.removeSong': 'Remove {title} from the set',
  'set.removeAction': 'Remove',
  'set.moveUp': 'Move {title} up',
  'set.moveDown': 'Move {title} down',
  'set.playLive': 'Live',
  'set.count': '{count} songs',

  'import.open': 'Import text',
  'import.title': 'Import a song from text',
  'import.appendTitle': 'Paste text into this song',
  'import.placeholder': 'Paste lyrics with chords above them…',
  'import.chooseFile': 'Choose a .txt file',
  'import.spacingHint':
    'Chords land where they sit above the words, so keep the spacing as it was. If a chord ends up a character off, the arrow keys in the editor move it.',
  'import.songTitle': 'Song title',
  'import.preview': 'How each line was read',
  'import.rowKind': 'Type of line {row}',
  'import.usedAsTitle': '→ used as the song title',
  'import.kindLyrics': 'Lyrics',
  'import.kindChords': 'Chords',
  'import.kindBars': 'Bars',
  'import.kindSection': 'Section',
  'import.kindBlank': 'Blank',
  'import.create': 'Create song',
  'import.append': 'Add to song',
  'import.pasteText': 'Paste text',

  'cloud.title': 'Back up to cloud',
  'cloud.description':
    'The whole library — songs, chords and recordings — goes into your own cloud account as one file that “Restore” reads back. One file per day, so older backups stay.',
  'cloud.exportDropbox': 'Back up to Dropbox',
  'cloud.signInDropbox': 'Sign in to Dropbox',
  'cloud.exportDrive': 'Back up to Google Drive',
  'cloud.settings': 'Cloud settings…',
  'cloud.needsClientId': '{provider}: add a client id in settings first.',
  'cloud.signingIn': 'Signing in to {provider}…',
  'cloud.exporting': 'Backing up to {provider}…',
  'cloud.done': 'Backed up to {provider} as {file}.',

  'settings.title': 'Settings',
  'settings.library': 'Library',
  'settings.preferences': 'General',
  'settings.credentials': 'Cloud credentials',
  'settings.language': 'Language',
  'settings.dropboxKey': 'Dropbox app key (optional)',
  'settings.dropboxHelp':
    'Leave this empty to use the built-in Dropbox app — signing in is enough. Fill it in only to use your own app: create one at dropbox.com/developers/apps (Scoped access → App folder), tick files.content.write and files.content.read on the Permissions tab and press Submit, then add this app’s address to the Redirect URIs.',
  'settings.autoBackup': 'Back up to Dropbox automatically',
  'settings.autoBackupHelp':
    'Once signed in to Dropbox, the library is backed up in the background a few times a day whenever something has changed. Dropbox only — the Google sign-in expires with the session.',
  'settings.gdriveKey': 'Google OAuth client id',
  'settings.gdriveHelp':
    'Create an OAuth client id (Web application) at console.cloud.google.com, enable the Drive API and add this app’s address to the allowed JavaScript origins.',

  'rec.title': 'Recordings',
  'rec.record': '● Record',
  'rec.stop': '■ Stop',
  'rec.defaultName': 'Recording {date}',
  'rec.micFailed': 'Could not access the microphone: {message}',
  'rec.confirmDelete': 'Delete the recording “{name}”?',
  'rec.deleteLabel': 'Delete recording',
} as const;

export type Key = keyof typeof en;

/** Kaikki avaimet; tyyppi takaa parin käännösajassa, tämä ajonaikaisen sisällön. */
export const KEYS = Object.keys(en) as Key[];

const fi: Record<Key, string> = {
  'app.untitled': 'Nimetön',
  'common.save': 'Tallenna',
  'common.cancel': 'Peruuta',
  'common.delete': 'Poista',
  'common.close': 'Sulje',
  'common.error': 'Virhe: {message}',

  'list.settings': 'Asetukset',
  'list.newSong': '+ Uusi laulu',
  'list.newTitle': 'Uusi laulu',
  'list.newBlank': 'Tyhjä laulu',
  'list.newFromText': 'Tuo tekstistä',
  'list.emptyTitle': 'Ei vielä lauluja.',
  'list.emptyHint':
    'Aloita painamalla ”Uusi laulu” – sanat, soinnut ja nauhoitteet tallentuvat puhelimeesi.',
  'list.meta': '{lines} riviä · muokattu {date}',
  'list.downloadBackup': 'Varmuuskopioi',
  'list.cloudBackup': 'Pilveen',
  'list.importBackup': 'Palauta',
  'list.preparingBackup': 'Kootaan varmuuskopiota…',
  'list.backupDownloaded': 'Varmuuskopio tallennettu.',
  'list.backupNever': 'Ei varmuuskopiota — laulut ovat vain tässä laitteessa.',
  'list.backupToday': 'Varmuuskopioitu tänään.',
  'list.backupDays': 'Varmuuskopioitu {days} päivää sitten.',
  'list.backupStale': 'Edellisestä varmuuskopiosta {days} päivää — kannattaa ottaa uusi.',
  'list.importing': 'Tuodaan…',
  'list.imported': 'Tuotu {songs} laulua ja {recordings} nauhoitetta.',

  'editor.backLabel': 'Laulut',
  'editor.undo': 'Kumoa',
  'editor.titlePlaceholder': 'Laulun nimi',
  'editor.keyPlaceholder': 'Sävel.',
  'editor.keyLabel': 'Sävellaji',
  'editor.meterPlaceholder': 'Tahti',
  'editor.meterLabel': 'Tahtilaji',
  'editor.transpose': 'Transponoi',
  'editor.semitoneDown': 'Puolisävelaskel alas',
  'editor.semitoneUp': 'Puolisävelaskel ylös',
  'editor.useFlats': 'Kirjoita alennusmerkein',
  'editor.useSharps': 'Kirjoita ylennysmerkein',
  'editor.transposedBy': 'Transponoitu {offset} puolisävelaskelta alkuperäisestä',
  'editor.resetKey': 'Takaisin alkuperäiseen sävellajiin',
  'editor.duplicateSection': 'Kopioi osio {name}',
  'editor.moveSectionUp': 'Siirrä osiota {name} ylös',
  'editor.moveSectionDown': 'Siirrä osiota {name} alas',
  'editor.addLine': '+ Rivi',
  'editor.exportPdf': 'Vie PDF',
  'editor.live': 'Live',
  'editor.deleteSong': 'Poista laulu',

  'live.play': 'Toista',
  'live.pause': 'Tauko',
  'live.slower': 'Hitaammin',
  'live.faster': 'Nopeammin',
  'live.speed': 'Nopeus {speed}',
  'live.smallerText': 'Pienempi teksti',
  'live.largerText': 'Suurempi teksti',
  'live.exit': 'Poistu live-tilasta',
  'live.previousSong': 'Edellinen laulu',
  'live.nextSong': 'Seuraava laulu',
  'live.position': '{index}/{count}',
  'draw.toggle': 'Piirrä lehdelle',
  'draw.color': 'Väri {color}',
  'draw.eraser': 'Pyyhi',
  'draw.undo': 'Kumoa veto',
  'draw.finger': 'Sormi piirtää',
  'draw.fingerShort': 'Sormi',
  'editor.confirmDeleteSong': 'Poistetaanko laulu ”{title}” ja sen nauhoitteet?',

  'line.addChordHere': 'Napauta lisätäksesi soinnun tähän kohtaan',
  'line.editSection': 'Rivin asetukset',
  'line.startSection': 'Rivin asetukset',
  'line.title': 'Rivi',
  'line.type': 'Rivin tyyppi',
  'line.typeLyrics': 'Sanoitus',
  'line.typeBars': 'Sointurivi',
  'line.sectionMarker': 'Osiomerkintä',
  'line.editBars': 'Muokkaa sointuriviä',
  'line.delete': 'Poista rivi',

  'bars.title': 'Sointurivi',
  'bars.position': 'tahti {index}/{count}',
  'bars.hint': 'nuolinäppäimet siirtävät tahdista toiseen',
  'bars.placeholder': 'esim. Am, Am F, %',
  'bars.add': '+ Tahti',
  'bars.remove': '− Tahti',
  'bars.split': 'Jaa tahti',
  'bars.meter': 'Tahtilaji tahdista {index} alkaen',
  'bars.meterPlaceholder': 'esim. 3/4',

  'chord.edit': 'Muokkaa sointua',
  'chord.add': 'Lisää sointu',
  'chord.moveLeft': 'Siirrä merkki vasemmalle',
  'chord.moveRight': 'Siirrä merkki oikealle',
  'chord.position': 'merkki {pos}/{max}',
  'chord.arrowHint': 'nuolinäppäimet siirtävät',
  'chord.placeholder': 'esim. Am7, C#/G#, Bb',

  'section.edit': 'Muokkaa osiota',
  'section.start': 'Aloita osio tästä',
  'section.customName': 'Oma nimi',
  'section.numberingHint':
    'Tyhjänä osiot numeroidaan automaattisesti, esim. Säkeistö 1 ja Säkeistö 2.',
  'section.removeMarker': 'Poista merkintä',
  'section.intro': 'Intro',
  'section.verse': 'Säkeistö',
  'section.prechorus': 'Nousu',
  'section.chorus': 'Kertosäe',
  'section.bridge': 'C-osa',
  'section.solo': 'Soolo',
  'section.outro': 'Outro',

  'set.all': 'Kaikki laulut',
  'set.new': '+ Uusi setti',
  'set.namePrompt': 'Setin nimi',
  'set.rename': 'Nimeä',
  'set.delete': 'Poista',
  'set.confirmDelete': 'Poistetaanko setti ”{name}”? Laulut itsessään säilyvät.',
  'set.addSongs': 'Lisää lauluja',
  'set.addTitle': 'Lisää lauluja settiin ”{name}”',
  'set.empty': 'Setissä ei ole vielä lauluja.',
  'set.emptyHint': 'Kokoa keikan setti painamalla ”Lisää lauluja”.',
  'sort.label': 'Järjestys',
  'sort.edited': 'Muokattu',
  'sort.az': 'A–Ö',
  'sort.za': 'Ö–A',
  'set.removeSong': 'Poista {title} setistä',
  'set.removeAction': 'Poista',
  'set.moveUp': 'Siirrä {title} ylös',
  'set.moveDown': 'Siirrä {title} alas',
  'set.playLive': 'Live',
  'set.count': '{count} laulua',

  'import.open': 'Tuo teksti',
  'import.title': 'Tuo laulu tekstistä',
  'import.appendTitle': 'Liitä tekstiä tähän lauluun',
  'import.placeholder': 'Liitä sanoitus, jonka yllä on soinnut…',
  'import.chooseFile': 'Valitse .txt-tiedosto',
  'import.spacingHint':
    'Soinnut asettuvat siihen kohtaan, jossa ne ovat sanojen yllä, joten jätä välit ennalleen. Jos sointu menee merkin verran sivuun, editorin nuolinäppäimet siirtävät sen.',
  'import.songTitle': 'Laulun nimi',
  'import.preview': 'Miten rivit tulkittiin',
  'import.rowKind': 'Rivin {row} tyyppi',
  'import.usedAsTitle': '→ otetaan laulun nimeksi',
  'import.kindLyrics': 'Sanat',
  'import.kindChords': 'Soinnut',
  'import.kindBars': 'Tahdit',
  'import.kindSection': 'Osio',
  'import.kindBlank': 'Tyhjä',
  'import.create': 'Luo laulu',
  'import.append': 'Lisää lauluun',
  'import.pasteText': 'Liitä tekstiä',

  'cloud.title': 'Varmuuskopioi pilveen',
  'cloud.description':
    'Koko kirjasto — laulut, soinnut ja nauhoitteet — menee omalle pilvitilillesi yhtenä tiedostona, jonka ”Palauta” lukee takaisin. Yksi tiedosto päivää kohti, joten vanhat kopiot säilyvät.',
  'cloud.exportDropbox': 'Varmuuskopioi Dropboxiin',
  'cloud.signInDropbox': 'Kirjaudu Dropboxiin',
  'cloud.exportDrive': 'Varmuuskopioi Google Driveen',
  'cloud.settings': 'Pilviasetukset…',
  'cloud.needsClientId': '{provider}: lisää ensin client id asetuksissa.',
  'cloud.signingIn': 'Kirjaudutaan palveluun {provider}…',
  'cloud.exporting': 'Varmuuskopioidaan palveluun {provider}…',
  'cloud.done': 'Varmuuskopioitu palveluun {provider} nimellä {file}.',

  'settings.title': 'Asetukset',
  'settings.library': 'Kirjasto',
  'settings.preferences': 'Yleiset',
  'settings.credentials': 'Pilvitunnukset',
  'settings.language': 'Kieli',
  'settings.dropboxKey': 'Dropbox app key (valinnainen)',
  'settings.dropboxHelp':
    'Jätä tyhjäksi, niin käytössä on sovelluksen oma Dropbox-sovellus – pelkkä kirjautuminen riittää. Täytä vain jos haluat käyttää omaa sovellustasi: luo se osoitteessa dropbox.com/developers/apps (Scoped access → App folder), rastita Permissions-välilehdellä files.content.write ja files.content.read ja paina Submit, ja lisää tämän sovelluksen osoite Redirect URI -listaan.',
  'settings.autoBackup': 'Varmuuskopioi Dropboxiin automaattisesti',
  'settings.autoBackupHelp':
    'Kun Dropboxiin on kirjauduttu, kirjasto varmuuskopioidaan taustalla muutaman kerran päivässä aina kun jotain on muuttunut. Vain Dropbox — Google-kirjautuminen vanhenee istunnon mukana.',
  'settings.gdriveKey': 'Google OAuth client id',
  'settings.gdriveHelp':
    'Luo OAuth client id (Web application) osoitteessa console.cloud.google.com, ota Drive API käyttöön ja lisää tämän sovelluksen osoite sallittuihin JavaScript-lähteisiin.',

  'rec.title': 'Nauhoitteet',
  'rec.record': '● Nauhoita',
  'rec.stop': '■ Pysäytä',
  'rec.defaultName': 'Nauhoite {date}',
  'rec.micFailed': 'Mikrofonia ei saatu käyttöön: {message}',
  'rec.confirmDelete': 'Poistetaanko nauhoite ”{name}”?',
  'rec.deleteLabel': 'Poista nauhoite',
};

const TABLES: Record<Lang, Record<Key, string>> = { en, fi };

export type Params = Record<string, string | number>;
export type T = (key: Key, params?: Params) => string;

export function translate(lang: Lang, key: Key, params?: Params): string {
  const text = TABLES[lang][key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

export function isLang(value: string | null): value is Lang {
  return value === 'en' || value === 'fi';
}

/** Selaimen kieli, jos se on tuettu; muuten englanti. */
export function detectLang(nav: Pick<Navigator, 'language'> = navigator): Lang {
  return nav.language?.toLowerCase().startsWith('fi') ? 'fi' : 'en';
}

export function loadLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isLang(stored) ? stored : detectLang();
}

export function storeLang(lang: Lang): void {
  localStorage.setItem(STORAGE_KEY, lang);
}

export function formatDate(ts: number, lang: Lang): string {
  return new Date(ts).toLocaleDateString(DATE_LOCALE[lang], {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(ts: number, lang: Lang): string {
  return new Date(ts).toLocaleString(DATE_LOCALE[lang], {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface I18n {
  lang: Lang;
  t: T;
  setLang: (lang: Lang) => void;
}

export const LangContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('LangContext puuttuu – onko App renderöity providerin sisällä?');
  return ctx;
}

export function useT(): T {
  return useI18n().t;
}
