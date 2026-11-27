import { useId, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import { SECTION_KINDS, sectionName } from '../lib/sections';
import type { LyricLine, SectionKind, SectionMark } from '../lib/types';
import { useDialog } from './useDialog';

/**
 * Rivitoiminnot asuvat täällä eivätkä kohdistetun rivin työkalurivissä, koska
 * sointurivillä ei ole tekstikenttää eikä se voi saada kohdistusta – rivin
 * asetukset on ainoa paikka joka on kaikilla rivityypeillä.
 */
export type LineAction = 'addBelow' | 'duplicate' | 'copy' | 'pasteBelow';

export interface LineSettings {
  /** null = rivi ei aloita osiota. */
  section: SectionMark | null;
  /** true = rivi on sointurivi. */
  bars: boolean;
}

interface Props {
  line: LyricLine;
  /** Viimeistä riviä ei voi poistaa: laulussa on aina oltava jotain. */
  canDelete: boolean;
  /** Onko leikepöydällä riviä liitettäväksi. */
  canPaste: boolean;
  /**
   * Toiminto kulkee tallennuksen mukana eikä omana kutsunaan: erillinen kutsu
   * laskisi muutoksensa vanhasta laulusta ja ylikirjoittaisi juuri tallennetut
   * asetukset.
   */
  onSave: (settings: LineSettings, action?: LineAction) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Rivin asetukset yhdessä paikassa: aloittaako rivi osion ja onko se
 * sanoitus- vai sointurivi. Molemmat ovat rivin ominaisuuksia, ja välisoitto
 * merkitään käytännössä aina molemmiksi kerralla.
 */
export default function LineSheet({
  line,
  canDelete,
  canPaste,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const t = useT();
  const dialogi = useRef<HTMLFormElement>(null);
  const otsikko = useId();
  useDialog(dialogi, onClose);
  const [bars, setBars] = useState(Boolean(line.bars));
  const [kind, setKind] = useState<SectionKind | null>(line.section?.kind ?? null);
  const [label, setLabel] = useState(line.section?.label ?? '');

  function save(action?: LineAction) {
    const trimmed = label.trim();
    onSave(
      {
        section: kind ? (trimmed ? { kind, label: trimmed } : { kind }) : null,
        bars,
      },
      action,
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        ref={dialogi}
        role="dialog"
        aria-modal="true"
        aria-labelledby={otsikko}
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h2 id={otsikko}>{t('line.title')}</h2>

        <div className="field">
          <label>{t('line.type')}</label>
          <div className="chip-row">
            <button type="button" className={bars ? '' : 'primary'} onClick={() => setBars(false)}>
              {t('line.typeLyrics')}
            </button>
            <button type="button" className={bars ? 'primary' : ''} onClick={() => setBars(true)}>
              {t('line.typeBars')}
            </button>
          </div>
        </div>

        <div className="field">
          <label>{t('line.sectionMarker')}</label>
          <div className="chip-row">
            <button type="button" className={kind ? '' : 'primary'} onClick={() => setKind(null)}>
              —
            </button>
            {SECTION_KINDS.map((k) => (
              <button
                type="button"
                key={k}
                className={k === kind ? 'primary' : ''}
                onClick={() => setKind(k)}
              >
                {sectionName(k, t)}
              </button>
            ))}
          </div>
        </div>

        {kind && (
          <div className="field">
            <label htmlFor="section-label">{t('section.customName')}</label>
            <input
              id="section-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={sectionName(kind, t)}
              autoComplete="off"
            />
            <small>{t('section.numberingHint')}</small>
          </div>
        )}

        {/* Asetukset tallennetaan, toiminnot tapahtuvat heti. Ne olivat samassa
            jonossa, ja tallennuspainike oli toimintojen alla, joten ei näkynyt
            kumpi tarvitsee tallennuksen. Nyt tallennus on heti asetusten alla
            ja toiminnot viivan takana omana ryhmänään. */}
        <div className="button-row">
          <button type="submit" className="primary">
            {t('common.save')}
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>

        <div className="field sheet-actions">
          <label>{t('line.actions')}</label>
          <div className="chip-row">
            <button type="button" onClick={() => save('addBelow')}>
              {t('line.addBelow')}
            </button>
            <button type="button" onClick={() => save('duplicate')}>
              {t('line.duplicate')}
            </button>
            <button type="button" onClick={() => save('copy')}>
              {t('line.copy')}
            </button>
            <button type="button" disabled={!canPaste} onClick={() => save('pasteBelow')}>
              {t('line.pasteBelow')}
            </button>
            {/* Rivin asetukset on ainoa paikka, joka on kaikilla rivityypeillä:
                sointuriviltä puuttuu tekstikenttä eikä sitä saanut muuten pois. */}
            <button type="button" className="danger" disabled={!canDelete} onClick={onDelete}>
              {t('line.delete')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
