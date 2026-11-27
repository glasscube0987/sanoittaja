import { useId, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import { useDialog } from './useDialog';

interface Props {
  title: string;
  label: string;
  initial?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

/*
 * Nimen kysyminen sovelluksen omana lakanana eikä selaimen `prompt`-ikkunana,
 * joka näytti asennetussa sovelluksessa vieraalta. Tyhjää nimeä ei voi
 * tallentaa: tallennuspainike on pois käytöstä, eikä mitään tapahdu
 * hiljaisesti kuten selaimen ikkunassa.
 */
export default function NameSheet({ title, label, initial = '', onSave, onCancel }: Props) {
  const t = useT();
  const ref = useRef<HTMLFormElement>(null);
  const otsikko = useId();
  const kentta = useId();
  const [name, setName] = useState(initial);
  useDialog(ref, onCancel);
  const valmis = name.trim();

  return (
    <div className="overlay" onClick={onCancel}>
      <form
        className="sheet"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={otsikko}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (valmis) onSave(valmis);
        }}
      >
        <h2 id={otsikko}>{title}</h2>
        <div className="field">
          <label htmlFor={kentta}>{label}</label>
          {/* Kohdistus kenttään on tässä tarkoituksellinen: lakanan ainoa tehtävä
              on kirjoittaa nimi, ja käyttäjä avasi sen juuri sitä varten. */}
          <input
            id={kentta}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            autoComplete="off"
            enterKeyHint="done"
          />
        </div>
        <div className="button-row">
          <button type="submit" className="primary" disabled={!valmis}>
            {t('common.save')}
          </button>
          <button type="button" className="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
