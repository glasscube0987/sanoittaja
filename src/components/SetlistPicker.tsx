import { useState } from 'react';
import { useT } from '../lib/i18n';
import type { Setlist, Song } from '../lib/types';

interface Props {
  setlist: Setlist;
  songs: Song[];
  onAdd: (songIds: string[]) => void;
  onClose: () => void;
}

/**
 * Laulujen valinta settiin.
 *
 * Koko kirjasto kerralla ja monivalintana: keikan setti kootaan yleensä yhdeltä
 * istumalta, ja laulu kerrallaan avautuva valinta tekisi siitä turhan hitaan.
 * Jo setissä olevat näkyvät valittuina eikä niitä voi lisätä toiseen kertaan.
 */
export default function SetlistPicker({ setlist, songs, onAdd, onClose }: Props) {
  const t = useT();
  const [valitut, setValitut] = useState<string[]>([]);

  function toggle(songId: string) {
    setValitut((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId],
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(valitut);
        }}
      >
        <h2>{t('set.addTitle', { name: setlist.name })}</h2>

        <div className="picker-list">
          {songs.map((song) => {
            const jo = setlist.songIds.includes(song.id);
            return (
              <label key={song.id} className={jo ? 'picker-row already' : 'picker-row'}>
                <input
                  type="checkbox"
                  checked={jo || valitut.includes(song.id)}
                  disabled={jo}
                  onChange={() => toggle(song.id)}
                />
                <span className="picker-title">{song.title || t('app.untitled')}</span>
                {song.songKey && <span className="picker-key">{song.songKey}</span>}
              </label>
            );
          })}
        </div>

        <div className="button-row">
          <button type="submit" className="primary" disabled={valitut.length === 0}>
            {t('set.addSongs')}
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
