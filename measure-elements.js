const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const url = 'http://localhost:8765/01-sky-horizon.html';

  // Measure at 375px
  const page = await browser.newPage();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(url, { waitUntil: 'networkidle' });

  const m375 = await page.evaluate(() => {
    function measure(sel) {
      const el = document.querySelector(sel);
      if (!el) return { error: 'not found' };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        top: Math.round(r.top),
        pt: cs.paddingTop,
        pb: cs.paddingBottom,
        pl: cs.paddingLeft,
        pr: cs.paddingRight,
        fontSize: cs.fontSize,
      };
    }

    const cells = Array.from(document.querySelectorAll('.prayer-cell')).map(c => {
      const r = c.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });

    const navItems = Array.from(document.querySelectorAll('.nav-item')).map(c => {
      const r = c.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });

    const allCards = document.querySelectorAll('.glass-card');
    const visibleAboveFold = Array.from(allCards).filter(c => {
      const r = c.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    });

    const btnPrimary = document.querySelector('.btn-primary');
    btnPrimary && btnPrimary.focus();
    const focusCS = btnPrimary ? getComputedStyle(btnPrimary) : null;

    return {
      toolbar: measure('.demo-toolbar'),
      hero: measure('.hero'),
      prayerStrip: measure('.prayer-strip'),
      prayerStripTop: measure('.prayer-strip').top,
      prayerCell0: measure('.prayer-cell'),
      bottomNav: measure('.bottom-nav'),
      navItem0: measure('.nav-item'),
      btnPrimary: measure('.btn-primary'),
      refreshBtn: measure('.refresh-btn'),
      qiblaIndicator: measure('.qibla-indicator'),
      adhkarItem: measure('.adhkar-item'),
      countdown: measure('.countdown'),
      cells: cells,
      navItems: navItems,
      cardsAboveFold: visibleAboveFold.length,
      focusOutline: focusCS ? { outline: focusCS.outline, offset: focusCS.outlineOffset } : null,
      ayahArabicFont: (() => {
        const el = document.querySelector('.ayah-card .arabic');
        return el ? { fs: getComputedStyle(el).fontSize, ff: getComputedStyle(el).fontFamily.split(',')[0] } : null;
      })(),
      prayerArabicFont: (() => {
        const el = document.querySelector('.prayer-arabic');
        return el ? { fs: getComputedStyle(el).fontSize, ff: getComputedStyle(el).fontFamily.split(',')[0] } : null;
      })(),
      prayerNameArFont: (() => {
        const el = document.querySelector('.prayer-name-ar');
        return el ? { fs: getComputedStyle(el).fontSize, ff: getComputedStyle(el).fontFamily.split(',')[0] } : null;
      })(),
    };
  });

  console.log('=== 375px ===');
  console.log(JSON.stringify(m375, null, 2));

  await page.close();

  // 1024px
  const page2 = await browser.newPage();
  await page2.setViewportSize({ width: 1024, height: 768 });
  await page2.goto(url, { waitUntil: 'networkidle' });

  const m1024 = await page2.evaluate(() => {
    const bodyCS = getComputedStyle(document.body);
    const stripCS = getComputedStyle(document.querySelector('.prayer-strip'));
    const bottomNavCS = getComputedStyle(document.querySelector('.bottom-nav'));
    const sideFlowCS = getComputedStyle(document.querySelector('.today-flow-side'));

    const allCards = document.querySelectorAll('.glass-card');
    const visibleAboveFold = Array.from(allCards).filter(c => {
      const r = c.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    });

    const hero = document.querySelector('.hero');
    const heroR = hero ? hero.getBoundingClientRect() : null;

    const sidebarEl = document.querySelector('.sidebar');

    return {
      bodyDisplay: bodyCS.display,
      bodyGridCols: bodyCS.gridTemplateColumns,
      prayerStripPosition: stripCS.position,
      bottomNavDisplay: bottomNavCS.display,
      sideFlowDisplay: sideFlowCS.display,
      sidebarInDOM: !!sidebarEl,
      heroW: heroR ? Math.round(heroR.width) : null,
      cardsAboveFold: visibleAboveFold.length,
    };
  });

  console.log('\n=== 1024px ===');
  console.log(JSON.stringify(m1024, null, 2));

  await page2.close();

  // 1440px
  const page3 = await browser.newPage();
  await page3.setViewportSize({ width: 1440, height: 900 });
  await page3.goto(url, { waitUntil: 'networkidle' });

  const m1440 = await page3.evaluate(() => {
    const bodyCS = getComputedStyle(document.body);

    const hero = document.querySelector('.hero');
    const heroR = hero ? hero.getBoundingClientRect() : null;
    const heroCS = hero ? getComputedStyle(hero) : null;

    const tfp = document.querySelector('.today-flow-primary');
    const tfpR = tfp ? tfp.getBoundingClientRect() : null;

    const tfs = document.querySelector('.today-flow-side');
    const tfsCS = tfs ? getComputedStyle(tfs) : null;
    const tfsR = tfs ? tfs.getBoundingClientRect() : null;

    const strip = document.querySelector('.prayer-strip');
    const stripR = strip ? strip.getBoundingClientRect() : null;
    const stripCS = strip ? getComputedStyle(strip) : null;

    const sidebar = document.querySelector('.sidebar');
    const sidebarR = sidebar ? sidebar.getBoundingClientRect() : null;

    const ibadahGrid = document.querySelector('.ibadah-grid');

    const allCards = document.querySelectorAll('.glass-card');
    const visibleAboveFold = Array.from(allCards).filter(c => {
      const r = c.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    });

    return {
      bodyDisplay: bodyCS.display,
      bodyGridCols: bodyCS.gridTemplateColumns,
      ibadahGridPresent: !!ibadahGrid,
      heroW: heroR ? Math.round(heroR.width) : null,
      heroLeft: heroR ? Math.round(heroR.left) : null,
      heroMaxWidth: heroCS ? heroCS.maxWidth : null,
      tfpW: tfpR ? Math.round(tfpR.width) : null,
      tfpLeft: tfpR ? Math.round(tfpR.left) : null,
      tfsDisplay: tfsCS ? tfsCS.display : null,
      tfsW: tfsR ? Math.round(tfsR.width) : null,
      tfsLeft: tfsR ? Math.round(tfsR.left) : null,
      stripW: stripR ? Math.round(stripR.width) : null,
      stripPosition: stripCS ? stripCS.position : null,
      sidebarLeft: sidebarR ? Math.round(sidebarR.left) : null,
      sidebarW: sidebarR ? Math.round(sidebarR.width) : null,
      cardsAboveFold: visibleAboveFold.length,
    };
  });

  console.log('\n=== 1440px ===');
  console.log(JSON.stringify(m1440, null, 2));

  await page3.close();
  await browser.close();
})();
