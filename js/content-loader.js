/* ============================================
   Content loader — fills page elements from data/content.json
   Allows admin.html to preview edits via localStorage override.
   ============================================ */

(function () {
  const LS_KEY = 'gy_content_override';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setText(sel, val) {
    document.querySelectorAll(sel).forEach(el => { el.textContent = val; });
  }
  function setHTML(sel, val) {
    document.querySelectorAll(sel).forEach(el => { el.innerHTML = val; });
  }
  function setAttr(sel, attr, val) {
    document.querySelectorAll(sel).forEach(el => { el.setAttribute(attr, val); });
  }

  async function fetchContent() {
    try {
      const override = localStorage.getItem(LS_KEY);
      if (override) return JSON.parse(override);
    } catch (e) {}
    try {
      const res = await fetch('data/content.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('fetch failed');
      return await res.json();
    } catch (e) {
      console.warn('content.json not loaded — using HTML defaults', e);
      return null;
    }
  }

  function renderNavFooter(c) {
    if (!c) return;
    // Logo text
    document.querySelectorAll('[data-bind="logo"]').forEach(el => {
      el.innerHTML = esc(c.site.logo) + '<span class="dot">.</span>';
    });
    // Footer
    setText('[data-bind="footer.brand"]', c.site.name);
    setText('[data-bind="footer.blurb"]', c.footer.blurb || c.footer.blurbShort);
    setText('[data-bind="footer.credit"]', c.footer.credit);
    setText('[data-bind="footer.year"]', new Date().getFullYear());

    // Footer connect links
    const fEmail = document.querySelector('[data-bind="footer.email"]');
    if (fEmail) { fEmail.textContent = c.contact.email; fEmail.href = 'mailto:' + c.contact.email; }
    const fPhone = document.querySelector('[data-bind="footer.phone"]');
    if (fPhone) { fPhone.textContent = c.contact.phone; fPhone.href = 'tel:' + (c.contact.phoneHref || c.contact.phone.replace(/[^\d+]/g, '')); }
    const fLink = document.querySelector('[data-bind="footer.linkedin"]');
    if (fLink) { fLink.textContent = 'LinkedIn'; fLink.href = c.contact.linkedinUrl; }
  }

  function renderHero(c) {
    const sec = document.querySelector('[data-page="home"]');
    if (!sec || !c) return;

    setText('[data-bind="hero.metaLabel"]', c.hero.metaLabel);
    const title = document.querySelector('[data-bind="hero.title"]');
    if (title) {
      title.innerHTML =
        esc(c.hero.titleStart) +
        '<em>' + esc(c.hero.titleEm) + '</em>' +
        esc(c.hero.titleEnd);
    }
    setText('[data-bind="hero.subtitle"]', c.hero.subtitle);
    const p = document.querySelector('[data-bind="hero.primaryCta"]');
    if (p) { p.innerHTML = esc(c.hero.primaryCtaLabel); p.href = c.hero.primaryCtaHref; }
    const s = document.querySelector('[data-bind="hero.secondaryCta"]');
    if (s) { s.innerHTML = esc(c.hero.secondaryCtaLabel); s.href = c.hero.secondaryCtaHref; }
    setText('[data-bind="hero.portraitInitials"]', c.hero.portraitInitials);
    setText('[data-bind="hero.portraitTag"]', c.hero.portraitTag);

    // Stats
    const statsRow = document.querySelector('[data-bind="stats.row"]');
    if (statsRow && c.stats) {
      statsRow.innerHTML = c.stats.map(s => `
        <div class="stat-cell reveal">
          <span class="num">${esc(s.num)}${s.unit ? `<small>${esc(s.unit)}</small>` : ''}</span>
          <div class="lbl">${esc(s.label)}</div>
        </div>
      `).join('');
    }

    // Preview head
    const ph = document.querySelector('[data-bind="previewHead.title"]');
    if (ph && c.previewHead) {
      ph.innerHTML = esc(c.previewHead.title) + '<em class="italic accent-text">' + esc(c.previewHead.titleEm) + '</em>';
    }
    setText('[data-bind="previewHead.link"]', c.previewHead?.linkLabel);

    // Preview grid (first 4 experiences)
    const grid = document.querySelector('[data-bind="previewGrid"]');
    if (grid && c.experience?.items) {
      grid.innerHTML = c.experience.items.slice(0, 4).map(it => `
        <div class="preview-card reveal">
          <span class="yr">${esc(it.year)}</span>
          <h3>${esc(it.role.split('—')[0].trim())}</h3>
          <p class="co">${esc(it.company)}</p>
          <p>${esc(it.shortDesc || '')}</p>
        </div>
      `).join('');
    }
  }

  function renderAbout(c) {
    const sec = document.querySelector('[data-page="about"]');
    if (!sec || !c) return;

    setText('[data-bind="about.eyebrow"]', c.about.eyebrow);
    const h = document.querySelector('[data-bind="about.head"]');
    if (h) h.innerHTML = esc(c.about.headStart) + '<em class="italic accent-text">' + esc(c.about.headEm) + '</em>';
    setText('[data-bind="about.headSubtitle"]', c.about.headSubtitle);

    setText('[data-bind="about.greeting"]', c.about.greeting);
    const para = document.querySelector('[data-bind="about.paragraphs"]');
    if (para && c.about.paragraphs) {
      para.innerHTML = c.about.paragraphs.map((p, i) => {
        // insert quote between paragraphs[0] and paragraphs[1]
        if (i === 1 && c.about.quote) {
          return `<div class="lead">"${esc(c.about.quote)}"</div><p>${p}</p>`;
        }
        return `<p>${p}</p>`;
      }).join('');
    }

    const facts = document.querySelector('[data-bind="about.facts"]');
    if (facts && c.about.facts) {
      facts.innerHTML = c.about.facts.map(f => `
        <div class="fact-row">
          <span class="lbl">${esc(f.label)}</span>
          <span class="val"${f.highlight ? ' style="color:var(--accent-2);"' : ''}>${esc(f.value)}</span>
        </div>
      `).join('');
    }

    const eduHead = document.querySelector('[data-bind="education.heading"]');
    if (eduHead && c.education) {
      eduHead.innerHTML = esc(c.education.headingStart) + '<em class="italic accent-text">' + esc(c.education.headingEm) + '</em>';
    }
    setText('[data-bind="education.degree"]', c.education?.degree);
    setText('[data-bind="education.school"]', c.education?.school);
    setText('[data-bind="education.description"]', c.education?.description);
    setText('[data-bind="education.score"]', c.education?.score);
    setText('[data-bind="education.duration"]', c.education?.duration);

    setText('[data-bind="certifications.intro"]', c.certifications?.intro);
    const certList = document.querySelector('[data-bind="certifications.list"]');
    if (certList && c.certifications?.items) {
      certList.innerHTML = c.certifications.items.map(it => `
        <div class="cert-item">
          <div class="ico">&#10003;</div>
          <div>
            <h4>${esc(it.title)}</h4>
            <p>${esc(it.issuer)}</p>
          </div>
        </div>
      `).join('');
    }
  }

  function renderExperience(c) {
    const sec = document.querySelector('[data-page="experience"]');
    if (!sec || !c) return;

    setText('[data-bind="experience.eyebrow"]', c.experience.eyebrow);
    const h = document.querySelector('[data-bind="experience.head"]');
    if (h) h.innerHTML = esc(c.experience.headStart) + '<em class="italic accent-text">' + esc(c.experience.headEm) + '</em>';
    setText('[data-bind="experience.headSubtitle"]', c.experience.headSubtitle);

    const timeline = document.querySelector('[data-bind="experience.timeline"]');
    if (timeline && c.experience.items) {
      timeline.innerHTML = c.experience.items.map(it => `
        <div class="tl-item reveal">
          <div class="tl-year">${esc(it.year)}</div>
          <div class="tl-content">
            <h3>${esc(it.role)}</h3>
            <div class="company">${esc(it.company)}</div>
            <div class="period">${esc(it.period)}</div>
            <ul>
              ${(it.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}
            </ul>
          </div>
        </div>
      `).join('');
    }
  }

  function renderSkills(c) {
    const sec = document.querySelector('[data-page="skills"]');
    if (!sec || !c) return;

    setText('[data-bind="skills.eyebrow"]', c.skills.eyebrow);
    const h = document.querySelector('[data-bind="skills.head"]');
    if (h) h.innerHTML = esc(c.skills.headStart) + '<em class="italic accent-text">' + esc(c.skills.headEm) + '</em>';
    setText('[data-bind="skills.headSubtitle"]', c.skills.headSubtitle);

    const intro = document.querySelector('[data-bind="skills.pillars"]');
    if (intro && c.skills.pillars) {
      intro.innerHTML = c.skills.pillars.map(p => `
        <div class="skill-pillar reveal">
          <div class="num">${esc(p.num)}</div>
          <div class="lbl">${esc(p.label)}</div>
        </div>
      `).join('');
    }

    const sh = document.querySelector('[data-bind="skills.subhead"]');
    if (sh) sh.innerHTML = esc(c.skills.subhead) + '<em class="italic accent-text">' + esc(c.skills.subheadEm) + '</em>';

    const grid = document.querySelector('[data-bind="skills.grid"]');
    if (grid && c.skills.items) {
      grid.innerHTML = c.skills.items.map(it => `
        <div class="skill-card reveal">
          <div class="skill-card-top">
            <div class="skill-icon">${esc(it.icon)}</div>
            <span class="pct">${esc(it.percent)}%</span>
          </div>
          <h3>${esc(it.title)}</h3>
          <p>${esc(it.desc)}</p>
          <div class="skill-bar"><span data-width="${esc(it.percent)}"></span></div>
        </div>
      `).join('');
    }
  }

  function renderContact(c) {
    const sec = document.querySelector('[data-page="contact"]');
    if (!sec || !c) return;

    setText('[data-bind="contact.eyebrow"]', c.contact.eyebrow);
    const h = document.querySelector('[data-bind="contact.head"]');
    if (h) h.innerHTML = esc(c.contact.headStart) + '<em class="italic accent-text">' + esc(c.contact.headEm) + '</em>';
    setText('[data-bind="contact.headSubtitle"]', c.contact.headSubtitle);

    const emailLink = document.querySelector('[data-bind="contact.emailLink"]');
    if (emailLink) {
      emailLink.href = 'mailto:' + c.contact.email;
      emailLink.querySelector('.val').textContent = c.contact.email;
    }
    const phoneLink = document.querySelector('[data-bind="contact.phoneLink"]');
    if (phoneLink) {
      phoneLink.href = 'tel:' + (c.contact.phoneHref || c.contact.phone.replace(/[^\d+]/g, ''));
      phoneLink.querySelector('.val').textContent = c.contact.phone;
    }
    const lnLink = document.querySelector('[data-bind="contact.linkedinLink"]');
    if (lnLink) {
      lnLink.href = c.contact.linkedinUrl;
      lnLink.querySelector('.val').textContent = c.contact.linkedinLabel || c.contact.linkedinUrl;
    }
    const locVal = document.querySelector('[data-bind="contact.location"]');
    if (locVal) locVal.textContent = c.contact.location;

    const fh = document.querySelector('[data-bind="contact.formHeading"]');
    if (fh) fh.innerHTML = esc(c.contact.formHeading) + '<em class="italic accent-text">' + esc(c.contact.formHeadingEm) + '</em>';
    setText('[data-bind="contact.formNote"]', c.contact.formNote);

    // expose to main.js for form submit
    window.__contactEmail = c.contact.email;
  }

  function renderAll(c) {
    if (!c) return;
    document.title = (document.title.includes('—')
      ? document.title.split('—')[0].trim() + ' — ' + c.site.name
      : c.site.name);

    renderNavFooter(c);
    renderHero(c);
    renderAbout(c);
    renderExperience(c);
    renderSkills(c);
    renderContact(c);

    // Re-trigger reveal observation on newly inserted .reveal nodes
    if (window.__rebindReveal) window.__rebindReveal();
    if (window.__rebindSkillBars) window.__rebindSkillBars();
  }

  // Boot
  fetchContent().then(c => {
    if (c) renderAll(c);
    document.dispatchEvent(new CustomEvent('content:loaded', { detail: c }));
  });

  // Expose helpers for admin preview
  window.GYContent = {
    LS_KEY,
    apply: renderAll,
    fetch: fetchContent
  };
})();
