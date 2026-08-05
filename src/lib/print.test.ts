import { afterEach, describe, expect, it, vi } from 'vitest';
import { canPrint, printSheet } from './print';

const alkuperainen = globalThis.window;

afterEach(() => {
  if (alkuperainen === undefined) delete (globalThis as { window?: unknown }).window;
  else globalThis.window = alkuperainen;
});

function setWindow(value: unknown) {
  (globalThis as { window?: unknown }).window = value;
}

describe('printSheet', () => {
  it('avaa tulostusvalikon', () => {
    const print = vi.fn();
    setWindow({ print });

    expect(printSheet()).toBe(true);
    expect(print).toHaveBeenCalledOnce();
  });

  it('kertoo kun tulostusta ei ole', () => {
    // Natiivikuoressa window.print puuttuu; kutsu ei saa kaataa sovellusta.
    setWindow({});
    expect(canPrint()).toBe(false);
    expect(printSheet()).toBe(false);
  });
});
