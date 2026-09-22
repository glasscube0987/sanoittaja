import { describe, expect, it } from 'vitest';
import { keyboardInset } from './keyboard';

describe('keyboardInset', () => {
  it('on nolla kun näkyvä alue täyttää ikkunan', () => {
    expect(keyboardInset({ height: 852, offsetTop: 0 }, 852)).toBe(0);
  });

  it('kertoo näppäimistön peittämän osuuden', () => {
    expect(keyboardInset({ height: 520, offsetTop: 0 }, 852)).toBe(332);
  });

  /* iOS vierittää näkyvää aluetta kun kohdistettu kenttä on matalalla. */
  it('ottaa huomioon näkyvän alueen siirtymän', () => {
    expect(keyboardInset({ height: 520, offsetTop: 100 }, 852)).toBe(232);
  });

  it('ei mene negatiiviseksi', () => {
    expect(keyboardInset({ height: 900, offsetTop: 0 }, 852)).toBe(0);
  });

  /* Murto-osan marginaali on parempi kuin pikselin rako palkin alla. */
  it('pyöristää alaspäin', () => {
    expect(keyboardInset({ height: 520.6, offsetTop: 0 }, 852)).toBe(331);
  });

  it('ilman visualViewportia peittoa ei ole', () => {
    expect(keyboardInset(null, 852)).toBe(0);
  });
});
