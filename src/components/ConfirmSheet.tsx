import { useId, useRef } from 'react';
import { useT } from '../lib/i18n';
import { useDialog } from './useDialog';

interface Props {
  title: string;
  message?: string;
  /** Vahvistuspainikkeen teksti; kertoo mitä tapahtuu, ei pelkkä «OK». */
  confirmLabel: string;
  /** Poisto ja muu peruuttamaton: painike huomiovärillä. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/*
 * Vahvistus sovelluksen omana lakanana eikä selaimen `confirm`-ikkunana.
 * Selaimen ikkuna näytti asennetussa sovelluksessa vieraalta, sen painikkeet
 * olivat «OK» ja «Peruuta» eivätkä kertoneet mitä tapahtuu, eikä sitä voinut
 * muotoilla eikä kääntää.
 */
export default function ConfirmSheet({ title, message, confirmLabel, danger, onConfirm, onCancel }: Props) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const otsikko = useId();
  useDialog(ref, onCancel);

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="sheet confirm-sheet"
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={otsikko}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={otsikko}>{title}</h2>
        {message && <p className="confirm-message">{message}</p>}
        <div className="button-row">
          <button className={danger ? 'danger-solid' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
