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
  'list.emptyTitle': 'No songs yet.',
  'list.emptyHint': 'Tap “New song” to start — lyrics, chords and recordings are stored on your device.',
  'list.meta': '{lines} lines · edited {date}',
  'list.downloadBackup': 'Download backup',
  'list.importBackup': 'Import backup',
  'list.preparingBackup': 'Preparing backup…',
  'list.backupDownloaded': 'Backup downloaded.',
  'list.importing': 'Importing…',
  'list.imported': 'Imported {songs} songs and {recordings} recordings.',

  'editor.back': '‹ Songs',
  'editor.backLabel': 'Back',
  'editor.cloud': 'Cloud',
  'editor.titlePlaceholder': 'Song title',
  'editor.keyPlaceholder': 'Key',
  'editor.transpose': 'Transpose',
  'editor.semitoneDown': 'Down a semitone',
  'editor.semitoneUp': 'Up a semitone',
  'editor.useFlats': 'Write with flats',
  'editor.useSharps': 'Write with sharps',
  'editor.moveSectionUp': 'Move section {name} up',
  'editor.moveSectionDown': 'Move section {name} down',
  'editor.addLine': '+ Line',
  'editor.exportPdf': 'Export PDF',
  'editor.deleteSong': 'Delete song',
  'editor.confirmDeleteSong': 'Delete the song “{title}” and its recordings?',

  'line.addChordHere': 'Tap to add a chord here',
  'line.editSection': 'Edit section',
  'line.startSection': 'Start a section on this line',

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

  'cloud.title': 'Export to cloud: {title}',
  'cloud.description':
    'The lyrics and chords are exported as a JSON file and the recordings as audio files into the song’s own folder.',
  'cloud.exportDropbox': 'Export to Dropbox',
  'cloud.signInDropbox': 'Sign in to Dropbox',
  'cloud.exportDrive': 'Export to Google Drive',
  'cloud.settings': 'Cloud settings…',
  'cloud.needsClientId': '{provider}: add a client id in settings first.',
  'cloud.exporting': 'Exporting to {provider}…',
  'cloud.done': 'Done: {files} files exported ({provider}).',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.dropboxKey': 'Dropbox app key',
  'settings.dropboxHelp':
    'Create a free app at dropbox.com/developers/apps (scoped access, App folder, files.content.write permission) and add this app’s address to the Redirect URIs.',
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
  'list.emptyTitle': 'Ei vielä lauluja.',
  'list.emptyHint':
    'Aloita painamalla ”Uusi laulu” – sanat, soinnut ja nauhoitteet tallentuvat puhelimeesi.',
  'list.meta': '{lines} riviä · muokattu {date}',
  'list.downloadBackup': 'Lataa varmuuskopio',
  'list.importBackup': 'Tuo varmuuskopio',
  'list.preparingBackup': 'Kootaan varmuuskopiota…',
  'list.backupDownloaded': 'Varmuuskopio ladattu.',
  'list.importing': 'Tuodaan…',
  'list.imported': 'Tuotu {songs} laulua ja {recordings} nauhoitetta.',

  'editor.back': '‹ Laulut',
  'editor.backLabel': 'Takaisin',
  'editor.cloud': 'Pilvi',
  'editor.titlePlaceholder': 'Laulun nimi',
  'editor.keyPlaceholder': 'Sävel.',
  'editor.transpose': 'Transponoi',
  'editor.semitoneDown': 'Puolisävelaskel alas',
  'editor.semitoneUp': 'Puolisävelaskel ylös',
  'editor.useFlats': 'Kirjoita alennusmerkein',
  'editor.useSharps': 'Kirjoita ylennysmerkein',
  'editor.moveSectionUp': 'Siirrä osiota {name} ylös',
  'editor.moveSectionDown': 'Siirrä osiota {name} alas',
  'editor.addLine': '+ Rivi',
  'editor.exportPdf': 'Vie PDF',
  'editor.deleteSong': 'Poista laulu',
  'editor.confirmDeleteSong': 'Poistetaanko laulu ”{title}” ja sen nauhoitteet?',

  'line.addChordHere': 'Napauta lisätäksesi soinnun tähän kohtaan',
  'line.editSection': 'Muokkaa osiota',
  'line.startSection': 'Aloita osio tästä rivistä',

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

  'cloud.title': 'Vie pilveen: {title}',
  'cloud.description':
    'Laulun sanat ja soinnut viedään JSON-tiedostona ja nauhoitteet äänitiedostoina laulun omaan kansioon.',
  'cloud.exportDropbox': 'Vie Dropboxiin',
  'cloud.signInDropbox': 'Kirjaudu Dropboxiin',
  'cloud.exportDrive': 'Vie Google Driveen',
  'cloud.settings': 'Pilviasetukset…',
  'cloud.needsClientId': '{provider}: lisää ensin client id asetuksissa.',
  'cloud.exporting': 'Viedään palveluun {provider}…',
  'cloud.done': 'Valmis: {files} tiedostoa viety ({provider}).',

  'settings.title': 'Asetukset',
  'settings.language': 'Kieli',
  'settings.dropboxKey': 'Dropbox app key',
  'settings.dropboxHelp':
    'Luo ilmainen sovellus osoitteessa dropbox.com/developers/apps (scoped access, App folder, oikeus files.content.write) ja lisää tämän sovelluksen osoite Redirect URI -listaan.',
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
