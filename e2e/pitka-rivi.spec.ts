import { expect, test } from '@playwright/test';
import { avaaLaulu, laulu, PITKA_RIVI } from './apu';

/**
 * Pitkä rivi puhelimen näytöllä.
 *
 * 393 px ja 16 px tasalevyinen fontti on noin 36 merkkiä, joten pitkä
 * sanoitusrivi ei mahdu kerralla eikä voi mahtua. Se mitä voidaan luvata on,
 * että rivi on **ulottuvilla** ja että soinnut pysyvät kirjainten kohdalla
 * myös vieritettynä: teksti ja sointurivi vierittyvät yhtenä.
 */
const pitkaLaulu = () =>
  laulu({
    lines: [
      {
        id: 'l1',
        text: PITKA_RIVI,
        chords: [
          { id: 'c1', pos: 0, symbol: 'Am' },
          { id: 'c2', pos: 70, symbol: 'E7' },
        ],
      },
    ],
  });

test('teksti on yhtä leveä kuin sointurivi', async ({ page }) => {
  await avaaLaulu(page, pitkaLaulu());

  const teksti = await page.locator('.line input.text').first().boundingBox();
  const soinnut = await page.locator('.chord-row').first().boundingBox();
  expect(teksti).not.toBeNull();
  expect(soinnut).not.toBeNull();
  // Sama laskenta molemmissa, joten leveyksien on oltava samat pyöristystä myöten.
  expect(Math.abs(teksti!.width - soinnut!.width)).toBeLessThan(1);
});

test('rivi ylittää näytön leveyden ja on vieritettävissä', async ({ page }) => {
  await avaaLaulu(page, pitkaLaulu());

  const mitat = await page.locator('.lyrics').evaluate((el) => ({
    sisus: el.scrollWidth,
    ikkuna: el.clientWidth,
  }));
  expect(mitat.sisus).toBeGreaterThan(mitat.ikkuna + 50);

  // Sivu itse ei saa levitä: pitkä rivi kuuluu vierittää .lyricsin sisällä.
  const sivu = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(sivu).toBeLessThanOrEqual(0);
});

/*
 * Tämä on se testi joka kaatuu ilman korjausta.
 *
 * Sointurivi kasvatti vieritysleveyttä jo ennestään, joten pelkkä
 * «vierittyykö» ei mittaa mitään. Vika näkyi vasta rivin lopussa: sinne
 * vieritettäessä soinnut olivat näkyvissä mutta tekstikenttä oli jäänyt
 * kauas vasemmalle, eikä sanojen alla ollut mitään.
 */
test('rivin lopussa tekstiä on siellä missä soinnutkin', async ({ page }) => {
  await avaaLaulu(page, pitkaLaulu());

  const lyrics = page.locator('.lyrics');
  await lyrics.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));

  const mitat = await page.evaluate(() => {
    const laatikko = document.querySelector('.lyrics') as HTMLElement;
    const input = document.querySelector('.line input.text') as HTMLInputElement;
    const chord = document.querySelectorAll('.chord-row .chord')[1] as HTMLElement;
    /* Merkkileveys mitataan samasta piilotetusta kymmenen nollan jonosta jota
       komponentti itse käyttää, eikä johdeta laatikon leveydestä. */
    const mitta = document.querySelector('.chord-row span[aria-hidden]') as HTMLElement;
    const merkkileveys = mitta.getBoundingClientRect().width / 10;
    return {
      tekstiOikea: input.getBoundingClientRect().right,
      laatikkoOikea: laatikko.getBoundingClientRect().right,
      sointuX: chord.getBoundingClientRect().left,
      merkkiX: input.getBoundingClientRect().left + 70 * merkkileveys,
    };
  });

  // Teksti ulottuu näkyvän alueen oikeaan reunaan asti eikä lopu kesken.
  expect(mitat.tekstiOikea).toBeGreaterThanOrEqual(mitat.laatikkoOikea - 8);
  // Ja sointu on yhä oman kirjaimensa kohdalla; sarake on noin 9,6 px.
  expect(Math.abs(mitat.sointuX - mitat.merkkiX)).toBeLessThan(5);
});

/** Sointurivin ja tekstikentän piirretyt fonttikoot. */
function koot(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const px = (sel: string) =>
      parseFloat(getComputedStyle(document.querySelector(sel) as Element).fontSize);
    return { soinnut: px('.chord-row'), teksti: px('.line input.text') };
  });
}

test('tekstikoko muuttaa sointurivin ja tekstin yhtä paljon', async ({ page }) => {
  await avaaLaulu(page, pitkaLaulu());

  const alku = await koot(page);
  expect(alku.soinnut).toBe(alku.teksti);

  await page.getByLabel('Smaller lyrics').click();
  const pieni = await koot(page);

  // Molemmat pienenivät, ja **saman verran**: eri koot irrottaisivat soinnut
  // kirjaimistaan, koska sijainti lasketaan fontin omalla merkkileveydellä.
  expect(pieni.soinnut).toBeLessThan(alku.soinnut);
  expect(pieni.teksti).toBe(pieni.soinnut);
});

test('pienempi teksti näyttää enemmän rivistä', async ({ page }) => {
  await avaaLaulu(page, pitkaLaulu());

  const ennen = await page.locator('.lyrics').evaluate((el) => el.scrollWidth);
  await page.getByLabel('Smaller lyrics').click();
  const jalkeen = await page.locator('.lyrics').evaluate((el) => el.scrollWidth);

  // Sama rivi vie vähemmän tilaa, eli näkyvään ikkunaan mahtuu enemmän merkkejä.
  expect(jalkeen).toBeLessThan(ennen);
});

test('tekstikoko säilyy uudelleenlatauksen yli', async ({ page }) => {
  await avaaLaulu(page, pitkaLaulu());

  await page.getByLabel('Smaller lyrics').click();
  const valittu = (await koot(page)).teksti;

  await page.reload();
  await page.locator('.song-card').first().click();
  await page.waitForSelector('.lyrics');

  expect((await koot(page)).teksti).toBe(valittu);
});

test('säädin pysähtyy rajoihinsa', async ({ page }) => {
  await avaaLaulu(page, pitkaLaulu());

  const pienenna = page.getByLabel('Smaller lyrics');
  // Alaraja saavutetaan muutamalla napautuksella; painike menee pois käytöstä
  // eikä koko putoa alle sen, mistä tekstistä ei enää saa selvää.
  for (let i = 0; i < 6; i++) if (await pienenna.isEnabled()) await pienenna.click();
  await expect(pienenna).toBeDisabled();
  expect((await koot(page)).teksti).toBe(12);
});
