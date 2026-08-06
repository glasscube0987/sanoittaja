/**
 * Käyttöliittymän kuvakkeet yhtenä joukkona.
 *
 * Aiemmin painikkeissa oli tekstisymboleita (§, ↶, ⚙︎). Ne piirtyvät eri
 * kokoisina ja eri paksuisina laitteesta ja fontista riippuen, ja jäivät
 * puhelimessa pieniksi ja epäselviksi. Piirretyt kuvakkeet ovat samankokoisia
 * kaikkialla, ja viivanpaksuus on valittu erottumaan tummalla taustalla.
 *
 * Kuvakkeet ovat koristeita: painikkeen nimi tulee aina aria-labelista.
 */

export type IconName =
  | 'back'
  | 'copy'
  | 'undo'
  | 'settings'
  | 'cloud'
  | 'chevronUp'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'lineSettings'
  | 'play'
  | 'pause'
  | 'pen';

interface Props {
  name: IconName;
  /** Kuvakkeen sivun pituus pikseleinä. */
  size?: number;
}

/** Viivapiirrokset; täytetyt muodot erikseen alla. */
const PATHS: Record<IconName, string> = {
  back: 'M15 4 7 12l8 8',
  // Kaksi lomittaista arkkia: kopio syntyy alkuperäisen viereen.
  copy: 'M9 9h9.5a1.5 1.5 0 0 1 1.5 1.5V20a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 20v-9.5A1.5 1.5 0 0 1 9 9M4.5 15A1.5 1.5 0 0 1 3 13.5V4a1.5 1.5 0 0 1 1.5-1.5H14A1.5 1.5 0 0 1 15.5 4v1.5',
  // Nuoli kaartuu takaisin vasemmalle: kumoaminen, ei pelkkä "edellinen".
  undo: 'M8 7 3 12l5 5M3 12h10a5 5 0 0 1 0 10h-2',
  // Hammaspyörä: napa, runko ja kahdeksan hammasta. Pelkät säteittäiset viivat
  // ilman runkoa näyttivät auringolta, joten runkoympyrä on olennainen.
  settings:
    'M19.4 12h2.2M2.4 12h2.2M12 19.4v2.2M12 2.4v2.2M17.2 17.2l1.6 1.6M5.2 5.2l1.6 1.6M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6',
  cloud: 'M7.5 19h9.5a4 4 0 0 0 .4-8 6 6 0 0 0-11.4-1.2A3.7 3.7 0 0 0 7.5 19M12 16v-6M9.5 12.5 12 10l2.5 2.5',
  chevronUp: 'M5 15l7-7 7 7',
  chevronDown: 'M5 9l7 7 7-7',
  chevronLeft: 'M15 4 7 12l8 8',
  chevronRight: 'M9 4l8 8-8 8',
  // Tekstirivit ja niiden edessä merkintäpalkki: rivin asetukset.
  lineSettings: 'M4 5v14M9 6.5h11M9 12h8M9 17.5h10',
  // Kynä kärki alaviistoon: piirtotila.
  pen: 'M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5 4 20M13.5 7l3 3',
  play: '',
  pause: '',
};

export default function Icon({ name, size = 22 }: Props) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'play' && <path d="M7.5 4.8v14.4L19.5 12z" fill="currentColor" stroke="none" />}
      {name === 'pause' && (
        <>
          <rect x="6.5" y="5" width="4" height="14" rx="1.4" fill="currentColor" stroke="none" />
          <rect x="13.5" y="5" width="4" height="14" rx="1.4" fill="currentColor" stroke="none" />
        </>
      )}
      {name === 'settings' && (
        <>
          <circle cx="12" cy="12" r="7.2" />
          <circle cx="12" cy="12" r="2.7" />
        </>
      )}
      {PATHS[name] && <path d={PATHS[name]} />}
    </svg>
  );
}
