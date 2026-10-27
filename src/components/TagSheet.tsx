import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { normalizeTag, sameTag, uniqueTags } from '../lib/tags';

interface Props {
  /** Laulun nykyiset tagit. */
  tags: string[];
  /** Kirjastossa jo käytetyt tagit; tulevat `App`ista, jolla laulut ovat. */
  known: string[];
  onSave: (tags: string[]) => void;
  onClose: () => void;
}

/**
 * Laulun tagien valinta.
 *
 * Yksi lista, ei kahta: kirjaston tagit ja laulun omat ovat samassa
 * valitsimessa, jossa jokainen chip on päälle–pois. Erillinen «laulun tagit» ja
 * «kirjaston tagit» näyttäisi saman tagin kahdesti, ja silloin kahdesta
 * samannimisestä painikkeesta ei näkisi kumpi tekee mitä.
 *
 * Olemassa olevien tarjoaminen on tämän lakanan tärkein tehtävä: kirjoitusvirhe
 * tekee uuden tagin, eikä sitä huomaa mistään – tagilista vain kasvaa hiljaa
 * kaksoiskappaleilla.
 */
export default function TagSheet({ tags, known, onSave, onClose }: Props) {
  const { t, lang } = useI18n();
  const [valitut, setValitut] = useState<string[]>(tags);
  const [uusi, setUusi] = useState('');

  /*
   * Näytettävät chipit: laulun omat ja kirjaston tagit yhtenä joukkona.
   * Aakkostettu, jottei juuri lisätty tagi ilmesty eri paikkaan kuin se on
   * lakanan seuraavalla avauksella.
   */
  const kaikki = useMemo(() => uniqueTags([...valitut, ...known], lang), [valitut, known, lang]);
  const paalla = (tag: string) => valitut.some((v) => sameTag(v, tag));

  function vaihda(tag: string) {
    setValitut((prev) => (paalla(tag) ? prev.filter((v) => !sameTag(v, tag)) : [...prev, tag]));
  }

  function lisaaUusi() {
    const tag = normalizeTag(uusi);
    setUusi('');
    if (!tag || paalla(tag)) return;
    setValitut((prev) => [...prev, tag]);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          // Kesken oleva kenttä otetaan mukaan: kirjoitettu tagi jota ei ole
          // vielä lisätty katoaisi muuten tallennuksessa huomaamatta.
          const tag = normalizeTag(uusi);
          onSave(tag && !paalla(tag) ? [...valitut, tag] : valitut);
        }}
      >
        <h2>{t('tags.sheetTitle')}</h2>

        {kaikki.length === 0 ? (
          <p className="empty-note">{t('tags.none')}</p>
        ) : (
          <div className="tag-bar">
            {kaikki.map((tag) => (
              <button
                type="button"
                key={tag}
                className={paalla(tag) ? 'tag current' : 'tag'}
                aria-pressed={paalla(tag)}
                onClick={() => vaihda(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="field">
          <label htmlFor="tag-new">{t('tags.newLabel')}</label>
          <div className="button-row">
            <input
              id="tag-new"
              value={uusi}
              onChange={(e) => setUusi(e.target.value)}
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
            />
            {/* `type="button"`, jottei Enter-näppäin lisäisi tagia ja
                tallentaisi samalla painalluksella. */}
            <button type="button" disabled={normalizeTag(uusi) === ''} onClick={lisaaUusi}>
              {t('tags.addNew')}
            </button>
          </div>
          <small>{t('tags.hint')}</small>
        </div>

        <div className="button-row">
          <button type="submit" className="primary">
            {t('common.save')}
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
