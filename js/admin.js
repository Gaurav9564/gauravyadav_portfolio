/* ============================================
   Admin — edit content.json, preview, export
   ============================================ */

(function () {
  // ---- Configurable password (JS-only gate, not real security) ----
  const ADMIN_PASSWORD = 'gaurav2026';
  const SESSION_KEY = 'gy_admin_session';
  const LS_CONTENT_KEY = 'gy_content_override';
  const GH_CFG_KEY = 'gy_gh_cfg';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  let content = null;
  let dirty = false;

  // ---------- LOGIN ----------
  function checkSession() {
    try { return sessionStorage.getItem(SESSION_KEY) === 'ok'; } catch (e) { return false; }
  }
  function setSession() {
    try { sessionStorage.setItem(SESSION_KEY, 'ok'); } catch (e) {}
  }
  function showAdmin() {
    $('#loginPanel').style.display = 'none';
    $('#adminMain').style.display = 'block';
    boot();
  }

  $('#loginBtn').addEventListener('click', tryLogin);
  $('#adminPass').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
  function tryLogin() {
    const v = $('#adminPass').value;
    if (v === ADMIN_PASSWORD) {
      setSession();
      showAdmin();
    } else {
      $('#loginErr').textContent = 'Incorrect password.';
    }
  }
  if (checkSession()) showAdmin();

  // ---------- BOOT ----------
  async function boot() {
    setStatus('Loading…');
    content = await loadContent();
    renderAll();
    setStatus(localStorage.getItem(LS_CONTENT_KEY) ? 'Local edits loaded' : 'Original content loaded', !!localStorage.getItem(LS_CONTENT_KEY));
    bindGlobalActions();
    bindTabs();
  }

  async function loadContent() {
    // Prefer localStorage override, otherwise fetch
    const ov = localStorage.getItem(LS_CONTENT_KEY);
    if (ov) {
      try { return JSON.parse(ov); } catch (e) {}
    }
    try {
      const res = await fetch('data/content.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('fetch failed');
      return await res.json();
    } catch (e) {
      alert('Could not load data/content.json. Are you serving the site via a web server?\n\nTip: run `python3 -m http.server` in the project folder, then visit http://localhost:8000/admin.html');
      return {};
    }
  }

  function persist() {
    localStorage.setItem(LS_CONTENT_KEY, JSON.stringify(content));
    dirty = false;
    setStatus('Saved locally', true);
  }

  function setStatus(text, saved) {
    const el = $('#status');
    el.textContent = text;
    el.classList.toggle('saved', !!saved);
  }

  // ---------- TABS ----------
  function bindTabs() {
    $$('#tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $$('.admin-panel').forEach(p => p.classList.remove('active'));
        $(`.admin-panel[data-panel="${btn.dataset.tab}"]`).classList.add('active');
      });
    });
  }

  // ---------- GLOBAL ACTIONS ----------
  function bindGlobalActions() {
    $('#exportBtn').addEventListener('click', exportJSON);
    $('#reloadBtn').addEventListener('click', async () => {
      if (dirty && !confirm('Discard unsaved edits and reload from data/content.json?')) return;
      localStorage.removeItem(LS_CONTENT_KEY);
      content = await loadContent();
      renderAll();
      setStatus('Reloaded from file');
    });
    $('#clearBtn').addEventListener('click', () => {
      if (!confirm('Discard local edits in this browser?')) return;
      localStorage.removeItem(LS_CONTENT_KEY);
      location.reload();
    });
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', importJSON);
    bindGitHub();
  }

  // ---------- GITHUB PUBLISH ----------
  function getGhCfg() {
    try { return JSON.parse(localStorage.getItem(GH_CFG_KEY)) || {}; } catch (e) { return {}; }
  }
  function setGhCfg(c) { localStorage.setItem(GH_CFG_KEY, JSON.stringify(c)); }

  function bindGitHub() {
    const panel = $('#ghPanel');
    const cfg = getGhCfg();
    // Sensible defaults so the user only needs to paste a token
    $('#ghToken').value = cfg.token || '';
    $('#ghOwner').value = cfg.owner || 'Gaurav9564';
    $('#ghRepo').value = cfg.repo || 'gauravyadav_portfolio';
    $('#ghBranch').value = cfg.branch || 'main';
    $('#ghPath').value = cfg.path || 'data/content.json';

    $('#ghSettingsBtn').addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      if (panel.style.display === 'block') panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $('#ghCloseBtn').addEventListener('click', () => { panel.style.display = 'none'; });
    $('#ghSaveBtn').addEventListener('click', () => {
      setGhCfg({
        token: $('#ghToken').value.trim(),
        owner: $('#ghOwner').value.trim(),
        repo: $('#ghRepo').value.trim(),
        branch: $('#ghBranch').value.trim() || 'main',
        path: $('#ghPath').value.trim() || 'data/content.json'
      });
      const msg = $('#ghMsg');
      msg.textContent = 'Saved on this device ✓';
      msg.style.color = 'var(--accent)';
      setTimeout(() => { panel.style.display = 'none'; msg.textContent = ''; }, 1200);
    });
    $('#publishBtn').addEventListener('click', publishToGitHub);
  }

  function b64EncodeUnicode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function publishToGitHub() {
    const cfg = getGhCfg();
    if (!cfg.token || !cfg.owner || !cfg.repo) {
      $('#ghPanel').style.display = 'block';
      $('#ghPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('#ghMsg').textContent = 'Add your GitHub token first, then Save.';
      $('#ghMsg').style.color = '';
      return;
    }
    const path = cfg.path || 'data/content.json';
    const branch = cfg.branch || 'main';
    const api = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
    const headers = {
      'Authorization': 'Bearer ' + cfg.token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    setStatus('Publishing…');

    // 1) Get current file SHA (required to update an existing file)
    let sha;
    try {
      const r = await fetch(api + '?ref=' + encodeURIComponent(branch), { headers, cache: 'no-store' });
      if (r.ok) { sha = (await r.json()).sha; }
      else if (r.status !== 404) { throw new Error('GitHub ' + r.status + ': ' + (await r.text())); }
    } catch (e) {
      setStatus('Publish failed');
      alert('Could not reach GitHub: ' + e.message);
      return;
    }

    // 2) PUT the new content
    const body = {
      message: 'Update site content via admin editor',
      content: b64EncodeUnicode(JSON.stringify(content, null, 2)),
      branch: branch
    };
    if (sha) body.sha = sha;

    try {
      const r = await fetch(api, { method: 'PUT', headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error('GitHub ' + r.status + ': ' + (await r.text()));
      setStatus('Published live ✓', true);
      alert('Published! Your live site will refresh in about a minute.');
    } catch (e) {
      setStatus('Publish failed');
      alert('Publish failed: ' + e.message + '\n\nCheck that your token has "Contents: read and write" on this repo.');
    }
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'content.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Exported — replace data/content.json on your host', true);
  }

  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(r.result);
        content = parsed;
        persist();
        renderAll();
        setStatus('Imported file', true);
      } catch (err) {
        alert('Could not parse JSON: ' + err.message);
      }
    };
    r.readAsText(file);
    e.target.value = '';
  }

  // ---------- HELPERS ----------
  function field(label, value, onChange, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'admin-field';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    wrap.appendChild(lbl);
    let input;
    if (opts.textarea) {
      input = document.createElement('textarea');
      input.rows = opts.rows || 3;
    } else {
      input = document.createElement('input');
      input.type = opts.type || 'text';
    }
    input.value = value == null ? '' : value;
    if (opts.placeholder) input.placeholder = opts.placeholder;
    input.addEventListener('input', () => {
      onChange(opts.type === 'number' ? Number(input.value) : input.value);
      dirty = true;
      persist();
    });
    wrap.appendChild(input);
    return wrap;
  }

  function card(title, actionsBuilder) {
    const c = document.createElement('div');
    c.className = 'admin-card';
    if (title) {
      const h = document.createElement('h3');
      h.textContent = title;
      if (actionsBuilder) {
        const actions = document.createElement('span');
        actions.className = 'small-actions';
        actionsBuilder(actions);
        h.appendChild(actions);
      }
      c.appendChild(h);
    }
    return c;
  }

  function grid2(...nodes) {
    const g = document.createElement('div');
    g.className = 'admin-grid-2';
    nodes.forEach(n => g.appendChild(n));
    return g;
  }

  function miniBtn(label, onClick, danger) {
    const b = document.createElement('button');
    b.className = 'admin-mini-btn' + (danger ? ' danger' : '');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  // ---------- PANEL RENDERERS ----------
  function renderAll() {
    renderSitePanel();
    renderHeroPanel();
    renderStatsPanel();
    renderAboutPanel();
    renderEducationPanel();
    renderExperiencePanel();
    renderSkillsPanel();
    renderContactPanel();
    renderFilesPanel();
  }

  function renderSitePanel() {
    const p = $('.admin-panel[data-panel="site"]');
    p.innerHTML = '';
    if (!content.site) content.site = {};
    if (!content.footer) content.footer = {};

    const c1 = card('Site');
    c1.appendChild(field('Brand name', content.site.name, v => content.site.name = v));
    c1.appendChild(field('Logo text', content.site.logo, v => content.site.logo = v));
    c1.appendChild(field('Tagline', content.site.tagline, v => content.site.tagline = v));
    p.appendChild(c1);

    const c2 = card('Footer');
    c2.appendChild(field('Footer blurb', content.footer.blurb, v => content.footer.blurb = v, { textarea: true }));
    c2.appendChild(field('Credit line', content.footer.credit, v => content.footer.credit = v));
    p.appendChild(c2);
  }

  function renderHeroPanel() {
    const p = $('.admin-panel[data-panel="hero"]');
    p.innerHTML = '';
    if (!content.hero) content.hero = {};
    const c = card('Home hero');
    c.appendChild(field('Meta label (top)', content.hero.metaLabel, v => content.hero.metaLabel = v));
    c.appendChild(field('Title — start', content.hero.titleStart, v => content.hero.titleStart = v));
    c.appendChild(field('Title — italic accent', content.hero.titleEm, v => content.hero.titleEm = v));
    c.appendChild(field('Title — end', content.hero.titleEnd, v => content.hero.titleEnd = v));
    c.appendChild(field('Subtitle', content.hero.subtitle, v => content.hero.subtitle = v, { textarea: true, rows: 4 }));
    c.appendChild(grid2(
      field('Primary button label', content.hero.primaryCtaLabel, v => content.hero.primaryCtaLabel = v),
      field('Primary button link', content.hero.primaryCtaHref, v => content.hero.primaryCtaHref = v)
    ));
    c.appendChild(grid2(
      field('Secondary button label', content.hero.secondaryCtaLabel, v => content.hero.secondaryCtaLabel = v),
      field('Secondary button link', content.hero.secondaryCtaHref, v => content.hero.secondaryCtaHref = v)
    ));
    c.appendChild(grid2(
      field('Portrait initials (shown if no photo)', content.hero.portraitInitials, v => content.hero.portraitInitials = v),
      field('Portrait tag', content.hero.portraitTag, v => content.hero.portraitTag = v)
    ));
    c.appendChild(field('Profile photo — upload in “Files & Media”, then paste its path here (e.g. profile.jpg). Shows on Home + About; leave blank to use initials.', content.hero.photo, v => content.hero.photo = v, { placeholder: 'profile.jpg' }));
    p.appendChild(c);

    if (!content.previewHead) content.previewHead = {};
    const c2 = card('Home — Selected experience header');
    c2.appendChild(grid2(
      field('Heading — start', content.previewHead.title, v => content.previewHead.title = v),
      field('Heading — italic accent', content.previewHead.titleEm, v => content.previewHead.titleEm = v)
    ));
    c2.appendChild(field('Link label', content.previewHead.linkLabel, v => content.previewHead.linkLabel = v));
    p.appendChild(c2);
  }

  function renderStatsPanel() {
    const p = $('.admin-panel[data-panel="stats"]');
    p.innerHTML = '';
    if (!Array.isArray(content.stats)) content.stats = [];

    const head = card('Stats strip (home)', actions => {
      actions.appendChild(miniBtn('+ Add stat', () => {
        content.stats.push({ num: '', unit: '', label: '' });
        persist();
        renderStatsPanel();
      }));
    });
    p.appendChild(head);

    content.stats.forEach((s, i) => {
      const c = card(`Stat #${i + 1}`, actions => {
        actions.appendChild(miniBtn('↑', () => move(content.stats, i, -1) && (persist(), renderStatsPanel())));
        actions.appendChild(miniBtn('↓', () => move(content.stats, i, 1) && (persist(), renderStatsPanel())));
        actions.appendChild(miniBtn('Remove', () => {
          content.stats.splice(i, 1); persist(); renderStatsPanel();
        }, true));
      });
      c.appendChild(grid2(
        field('Number', s.num, v => content.stats[i].num = v),
        field('Unit (e.g. %)', s.unit, v => content.stats[i].unit = v)
      ));
      c.appendChild(field('Label', s.label, v => content.stats[i].label = v));
      p.appendChild(c);
    });
  }

  function renderAboutPanel() {
    const p = $('.admin-panel[data-panel="about"]');
    p.innerHTML = '';
    if (!content.about) content.about = {};
    if (!Array.isArray(content.about.paragraphs)) content.about.paragraphs = [];
    if (!Array.isArray(content.about.facts)) content.about.facts = [];

    const c = card('About — header');
    c.appendChild(field('Eyebrow', content.about.eyebrow, v => content.about.eyebrow = v));
    c.appendChild(grid2(
      field('Heading — start', content.about.headStart, v => content.about.headStart = v),
      field('Heading — italic accent', content.about.headEm, v => content.about.headEm = v)
    ));
    c.appendChild(field('Subtitle', content.about.headSubtitle, v => content.about.headSubtitle = v));
    p.appendChild(c);

    const c2 = card('About — body');
    c2.appendChild(field('Greeting heading', content.about.greeting, v => content.about.greeting = v));
    c2.appendChild(field('Pull-quote', content.about.quote, v => content.about.quote = v, { textarea: true, rows: 2 }));
    p.appendChild(c2);

    const c3 = card('Paragraphs', actions => {
      actions.appendChild(miniBtn('+ Add paragraph', () => {
        content.about.paragraphs.push(''); persist(); renderAboutPanel();
      }));
    });
    content.about.paragraphs.forEach((para, i) => {
      const wrap = document.createElement('div');
      wrap.style.position = 'relative';
      wrap.style.marginBottom = '14px';
      wrap.appendChild(field(`Paragraph #${i + 1} (HTML allowed for <strong>, <em>)`, para, v => content.about.paragraphs[i] = v, { textarea: true, rows: 4 }));
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '6px';
      row.style.marginTop = '-4px';
      row.appendChild(miniBtn('↑', () => move(content.about.paragraphs, i, -1) && (persist(), renderAboutPanel())));
      row.appendChild(miniBtn('↓', () => move(content.about.paragraphs, i, 1) && (persist(), renderAboutPanel())));
      row.appendChild(miniBtn('Remove', () => {
        content.about.paragraphs.splice(i, 1); persist(); renderAboutPanel();
      }, true));
      wrap.appendChild(row);
      c3.appendChild(wrap);
    });
    p.appendChild(c3);

    const c4 = card('"At a glance" facts', actions => {
      actions.appendChild(miniBtn('+ Add fact', () => {
        content.about.facts.push({ label: '', value: '' }); persist(); renderAboutPanel();
      }));
    });
    content.about.facts.forEach((f, i) => {
      const sub = card(`Fact #${i + 1}`, actions => {
        actions.appendChild(miniBtn('↑', () => move(content.about.facts, i, -1) && (persist(), renderAboutPanel())));
        actions.appendChild(miniBtn('↓', () => move(content.about.facts, i, 1) && (persist(), renderAboutPanel())));
        actions.appendChild(miniBtn('Remove', () => {
          content.about.facts.splice(i, 1); persist(); renderAboutPanel();
        }, true));
      });
      sub.style.background = 'var(--bg-2)';
      sub.appendChild(grid2(
        field('Label', f.label, v => content.about.facts[i].label = v),
        field('Value', f.value, v => content.about.facts[i].value = v)
      ));
      const hl = document.createElement('label');
      hl.style.display = 'flex';
      hl.style.gap = '8px';
      hl.style.alignItems = 'center';
      hl.style.fontSize = '13px';
      hl.style.color = 'var(--muted)';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!f.highlight;
      cb.style.width = 'auto';
      cb.style.minHeight = 'auto';
      cb.addEventListener('change', () => { content.about.facts[i].highlight = cb.checked; persist(); });
      hl.appendChild(cb);
      hl.appendChild(document.createTextNode('Highlight value in green'));
      sub.appendChild(hl);
      c4.appendChild(sub);
    });
    p.appendChild(c4);
  }

  function renderEducationPanel() {
    const p = $('.admin-panel[data-panel="education"]');
    p.innerHTML = '';
    if (!content.education) content.education = {};
    if (!content.certifications) content.certifications = { items: [] };
    if (!Array.isArray(content.certifications.items)) content.certifications.items = [];

    const c = card('Education section heading');
    c.appendChild(grid2(
      field('Heading — start', content.education.headingStart, v => content.education.headingStart = v),
      field('Heading — italic accent', content.education.headingEm, v => content.education.headingEm = v)
    ));
    p.appendChild(c);

    const c2 = card('Education card');
    c2.appendChild(field('Degree', content.education.degree, v => content.education.degree = v));
    c2.appendChild(field('School', content.education.school, v => content.education.school = v));
    c2.appendChild(field('Description', content.education.description, v => content.education.description = v, { textarea: true }));
    c2.appendChild(grid2(
      field('Score', content.education.score, v => content.education.score = v),
      field('Duration', content.education.duration, v => content.education.duration = v)
    ));
    p.appendChild(c2);

    const c3 = card('Certifications', actions => {
      actions.appendChild(miniBtn('+ Add certification', () => {
        content.certifications.items.push({ title: '', issuer: '' }); persist(); renderEducationPanel();
      }));
    });
    c3.appendChild(field('Intro', content.certifications.intro, v => content.certifications.intro = v));
    content.certifications.items.forEach((it, i) => {
      const sub = card(`Cert #${i + 1}`, actions => {
        actions.appendChild(miniBtn('↑', () => move(content.certifications.items, i, -1) && (persist(), renderEducationPanel())));
        actions.appendChild(miniBtn('↓', () => move(content.certifications.items, i, 1) && (persist(), renderEducationPanel())));
        actions.appendChild(miniBtn('Remove', () => {
          content.certifications.items.splice(i, 1); persist(); renderEducationPanel();
        }, true));
      });
      sub.style.background = 'var(--bg-2)';
      sub.appendChild(grid2(
        field('Title', it.title, v => content.certifications.items[i].title = v),
        field('Issuer', it.issuer, v => content.certifications.items[i].issuer = v)
      ));
      c3.appendChild(sub);
    });
    p.appendChild(c3);
  }

  function renderExperiencePanel() {
    const p = $('.admin-panel[data-panel="experience"]');
    p.innerHTML = '';
    if (!content.experience) content.experience = { items: [] };
    if (!Array.isArray(content.experience.items)) content.experience.items = [];

    const c = card('Experience — header');
    c.appendChild(field('Eyebrow', content.experience.eyebrow, v => content.experience.eyebrow = v));
    c.appendChild(grid2(
      field('Heading — start', content.experience.headStart, v => content.experience.headStart = v),
      field('Heading — italic accent', content.experience.headEm, v => content.experience.headEm = v)
    ));
    c.appendChild(field('Subtitle', content.experience.headSubtitle, v => content.experience.headSubtitle = v));
    p.appendChild(c);

    const head = card('Roles', actions => {
      actions.appendChild(miniBtn('+ Add role', () => {
        content.experience.items.unshift({ year: '', role: '', company: '', period: '', shortDesc: '', bullets: [''] });
        persist(); renderExperiencePanel();
      }));
    });
    p.appendChild(head);

    content.experience.items.forEach((it, i) => {
      const c2 = card(`${it.year || '—'} · ${it.role || 'New role'}`, actions => {
        actions.appendChild(miniBtn('↑', () => move(content.experience.items, i, -1) && (persist(), renderExperiencePanel())));
        actions.appendChild(miniBtn('↓', () => move(content.experience.items, i, 1) && (persist(), renderExperiencePanel())));
        actions.appendChild(miniBtn('Remove', () => {
          if (!confirm('Delete this role?')) return;
          content.experience.items.splice(i, 1); persist(); renderExperiencePanel();
        }, true));
      });
      c2.appendChild(grid2(
        field('Year (badge)', it.year, v => content.experience.items[i].year = v),
        field('Period (full)', it.period, v => content.experience.items[i].period = v)
      ));
      c2.appendChild(field('Role title', it.role, v => content.experience.items[i].role = v));
      c2.appendChild(field('Company', it.company, v => content.experience.items[i].company = v));
      c2.appendChild(field('Short description (home preview card)', it.shortDesc, v => content.experience.items[i].shortDesc = v, { textarea: true, rows: 2 }));

      const bulletsWrap = document.createElement('div');
      const lbl = document.createElement('label');
      lbl.textContent = 'Bullets (timeline)';
      lbl.style.display = 'block';
      lbl.style.fontSize = '12px';
      lbl.style.letterSpacing = '0.1em';
      lbl.style.textTransform = 'uppercase';
      lbl.style.color = 'var(--muted)';
      lbl.style.fontWeight = '500';
      lbl.style.marginBottom = '6px';
      bulletsWrap.appendChild(lbl);

      (it.bullets || []).forEach((b, j) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.marginBottom = '8px';
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = b;
        inp.style.flex = '1';
        inp.style.padding = '10px 12px';
        inp.style.background = 'var(--input-bg)';
        inp.style.border = '1px solid var(--border)';
        inp.style.borderRadius = '10px';
        inp.style.color = 'var(--text)';
        inp.style.fontFamily = 'inherit';
        inp.style.fontSize = '14px';
        inp.style.minHeight = '40px';
        inp.addEventListener('input', () => {
          content.experience.items[i].bullets[j] = inp.value;
          persist();
        });
        row.appendChild(inp);
        row.appendChild(miniBtn('×', () => {
          content.experience.items[i].bullets.splice(j, 1); persist(); renderExperiencePanel();
        }, true));
        bulletsWrap.appendChild(row);
      });
      const addBullet = miniBtn('+ Add bullet', () => {
        content.experience.items[i].bullets = content.experience.items[i].bullets || [];
        content.experience.items[i].bullets.push(''); persist(); renderExperiencePanel();
      });
      bulletsWrap.appendChild(addBullet);
      c2.appendChild(bulletsWrap);

      p.appendChild(c2);
    });
  }

  function renderSkillsPanel() {
    const p = $('.admin-panel[data-panel="skills"]');
    p.innerHTML = '';
    if (!content.skills) content.skills = { pillars: [], items: [] };
    if (!Array.isArray(content.skills.pillars)) content.skills.pillars = [];
    if (!Array.isArray(content.skills.items)) content.skills.items = [];

    const c = card('Skills — header');
    c.appendChild(field('Eyebrow', content.skills.eyebrow, v => content.skills.eyebrow = v));
    c.appendChild(grid2(
      field('Heading — start', content.skills.headStart, v => content.skills.headStart = v),
      field('Heading — italic accent', content.skills.headEm, v => content.skills.headEm = v)
    ));
    c.appendChild(field('Subtitle', content.skills.headSubtitle, v => content.skills.headSubtitle = v));
    c.appendChild(grid2(
      field('Detailed subhead — start', content.skills.subhead, v => content.skills.subhead = v),
      field('Detailed subhead — italic', content.skills.subheadEm, v => content.skills.subheadEm = v)
    ));
    p.appendChild(c);

    const pillarHead = card('Top stat pillars', actions => {
      actions.appendChild(miniBtn('+ Add pillar', () => {
        content.skills.pillars.push({ num: '', label: '' }); persist(); renderSkillsPanel();
      }));
    });
    content.skills.pillars.forEach((pi, i) => {
      const sub = card(`Pillar #${i + 1}`, actions => {
        actions.appendChild(miniBtn('↑', () => move(content.skills.pillars, i, -1) && (persist(), renderSkillsPanel())));
        actions.appendChild(miniBtn('↓', () => move(content.skills.pillars, i, 1) && (persist(), renderSkillsPanel())));
        actions.appendChild(miniBtn('Remove', () => {
          content.skills.pillars.splice(i, 1); persist(); renderSkillsPanel();
        }, true));
      });
      sub.style.background = 'var(--bg-2)';
      sub.appendChild(grid2(
        field('Number', pi.num, v => content.skills.pillars[i].num = v),
        field('Label', pi.label, v => content.skills.pillars[i].label = v)
      ));
      pillarHead.appendChild(sub);
    });
    p.appendChild(pillarHead);

    const cardsHead = card('Skill cards', actions => {
      actions.appendChild(miniBtn('+ Add skill', () => {
        content.skills.items.push({ icon: '★', title: '', desc: '', percent: 75 });
        persist(); renderSkillsPanel();
      }));
    });
    content.skills.items.forEach((it, i) => {
      const sub = card(it.title || `Skill #${i + 1}`, actions => {
        actions.appendChild(miniBtn('↑', () => move(content.skills.items, i, -1) && (persist(), renderSkillsPanel())));
        actions.appendChild(miniBtn('↓', () => move(content.skills.items, i, 1) && (persist(), renderSkillsPanel())));
        actions.appendChild(miniBtn('Remove', () => {
          content.skills.items.splice(i, 1); persist(); renderSkillsPanel();
        }, true));
      });
      sub.style.background = 'var(--bg-2)';
      sub.appendChild(grid2(
        field('Icon (emoji)', it.icon, v => content.skills.items[i].icon = v),
        field('Percent (0-100)', it.percent, v => content.skills.items[i].percent = Math.max(0, Math.min(100, Number(v) || 0)), { type: 'number' })
      ));
      sub.appendChild(field('Title', it.title, v => content.skills.items[i].title = v));
      sub.appendChild(field('Description', it.desc, v => content.skills.items[i].desc = v, { textarea: true, rows: 2 }));
      cardsHead.appendChild(sub);
    });
    p.appendChild(cardsHead);
  }

  function renderContactPanel() {
    const p = $('.admin-panel[data-panel="contact"]');
    p.innerHTML = '';
    if (!content.contact) content.contact = {};

    const c = card('Contact — header');
    c.appendChild(field('Eyebrow', content.contact.eyebrow, v => content.contact.eyebrow = v));
    c.appendChild(grid2(
      field('Heading — start', content.contact.headStart, v => content.contact.headStart = v),
      field('Heading — italic accent', content.contact.headEm, v => content.contact.headEm = v)
    ));
    c.appendChild(field('Subtitle', content.contact.headSubtitle, v => content.contact.headSubtitle = v, { textarea: true }));
    p.appendChild(c);

    const c2 = card('Contact details');
    c2.appendChild(field('Email', content.contact.email, v => content.contact.email = v, { type: 'email' }));
    c2.appendChild(grid2(
      field('Phone (display)', content.contact.phone, v => content.contact.phone = v),
      field('Phone (tel: link)', content.contact.phoneHref, v => content.contact.phoneHref = v, { placeholder: '+917999690106' })
    ));
    c2.appendChild(grid2(
      field('LinkedIn URL', content.contact.linkedinUrl, v => content.contact.linkedinUrl = v),
      field('LinkedIn label', content.contact.linkedinLabel, v => content.contact.linkedinLabel = v)
    ));
    c2.appendChild(field('Location', content.contact.location, v => content.contact.location = v));
    p.appendChild(c2);

    const c3 = card('Contact form text');
    c3.appendChild(grid2(
      field('Form heading — start', content.contact.formHeading, v => content.contact.formHeading = v),
      field('Form heading — italic', content.contact.formHeadingEm, v => content.contact.formHeadingEm = v)
    ));
    c3.appendChild(field('Form note', content.contact.formNote, v => content.contact.formNote = v, { textarea: true, rows: 2 }));
    p.appendChild(c3);
  }

  // ---------- FILES & MEDIA (GitHub-backed) ----------
  let filesCurrentDir = '';

  function ghHeaders() {
    const cfg = getGhCfg();
    return {
      'Authorization': 'Bearer ' + cfg.token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  function renderFilesPanel() {
    const p = $('.admin-panel[data-panel="files"]');
    if (!p) return;
    p.innerHTML = '';
    const cfg = getGhCfg();

    if (!cfg.token || !cfg.owner || !cfg.repo) {
      const c = card('Files & Media');
      const msg = document.createElement('p');
      msg.style.color = 'var(--muted)';
      msg.style.fontSize = '14px';
      msg.innerHTML = 'Connect GitHub first (tap <strong>⚙ GitHub</strong> at the top) to upload, add, and delete files.';
      c.appendChild(msg);
      p.appendChild(c);
      return;
    }

    // Upload card
    const up = card('Upload a file');
    const hint = document.createElement('p');
    hint.style.cssText = 'color:var(--muted);font-size:13px;margin:0 0 12px;';
    hint.innerHTML = 'Pick any file (image, PDF, etc.). It uploads into the current folder: <code style="background:var(--bg-2);padding:2px 6px;border-radius:4px;">' + (filesCurrentDir || '/') + '</code>';
    up.appendChild(hint);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.cssText = 'width:100%;margin-bottom:10px;';
    up.appendChild(fileInput);

    const nameField = field('Save as (filename — optional, blank = original name)', '', () => {}, { placeholder: 'e.g. profile.jpg' });
    up.appendChild(nameField);

    const upBtn = document.createElement('button');
    upBtn.className = 'btn btn-primary';
    upBtn.textContent = '↑ Upload to GitHub';
    upBtn.style.marginTop = '4px';
    upBtn.addEventListener('click', () => {
      const f = fileInput.files[0];
      if (!f) { alert('Choose a file first.'); return; }
      const custom = nameField.querySelector('input').value.trim();
      uploadFile(f, custom || f.name);
    });
    up.appendChild(upBtn);
    p.appendChild(up);

    // Browser card
    const browse = card('Repository files', actions => {
      actions.appendChild(miniBtn('↻ Refresh', () => listDir(filesCurrentDir)));
    });
    const crumb = document.createElement('div');
    crumb.style.cssText = 'font-size:13px;color:var(--muted);margin-bottom:10px;word-break:break-all;';
    crumb.innerHTML = '📁 <strong>/' + (filesCurrentDir || '') + '</strong>';
    browse.appendChild(crumb);

    const list = document.createElement('div');
    list.id = 'filesList';
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Loading…</p>';
    browse.appendChild(list);
    p.appendChild(browse);

    listDir(filesCurrentDir);
  }

  async function listDir(dir) {
    const cfg = getGhCfg();
    const list = $('#filesList');
    if (!list) return;
    list.innerHTML = '<p style="color:var(--muted);font-size:14px;">Loading…</p>';
    const api = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + encodeURI(dir) + '?ref=' + encodeURIComponent(cfg.branch || 'main');
    let items;
    try {
      const r = await fetch(api, { headers: ghHeaders(), cache: 'no-store' });
      if (!r.ok) throw new Error('GitHub ' + r.status + ': ' + (await r.text()));
      items = await r.json();
    } catch (e) {
      list.innerHTML = '<p class="err">Could not load files: ' + e.message + '</p>';
      return;
    }
    if (!Array.isArray(items)) { list.innerHTML = '<p class="err">Unexpected response.</p>'; return; }

    list.innerHTML = '';
    // Up a level
    if (dir) {
      const upRow = fileRow('⬆', '.. (up a level)', null);
      upRow.style.cursor = 'pointer';
      upRow.addEventListener('click', () => { filesCurrentDir = dir.split('/').slice(0, -1).join('/'); renderFilesPanel(); });
      list.appendChild(upRow);
    }
    // Folders first, then files
    items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
    items.forEach(it => {
      const isDir = it.type === 'dir';
      const row = fileRow(isDir ? '📁' : fileIcon(it.name), it.name, isDir ? null : it.size);
      if (isDir) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => { filesCurrentDir = it.path; renderFilesPanel(); });
      } else {
        const acts = document.createElement('span');
        acts.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';
        const view = document.createElement('a');
        view.href = it.html_url;
        view.target = '_blank';
        view.className = 'admin-mini-btn';
        view.textContent = 'View';
        view.style.textDecoration = 'none';
        acts.appendChild(view);
        const copy = miniBtn('Copy path', () => {
          navigator.clipboard && navigator.clipboard.writeText(it.path);
          copy.textContent = 'Copied!';
          setTimeout(() => copy.textContent = 'Copy path', 1200);
        });
        acts.appendChild(copy);
        acts.appendChild(miniBtn('Delete', () => deleteFile(it.path, it.sha, it.name), true));
        row.appendChild(acts);
      }
      list.appendChild(row);
    });
    if (!items.length) list.innerHTML += '<p style="color:var(--muted);font-size:14px;">Empty folder.</p>';
  }

  function fileRow(icon, name, size) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 8px;border-bottom:1px solid var(--border);font-size:14px;';
    const ic = document.createElement('span');
    ic.textContent = icon;
    ic.style.flexShrink = '0';
    row.appendChild(ic);
    const nm = document.createElement('span');
    nm.textContent = name + (size != null ? '  (' + fmtSize(size) + ')' : '');
    nm.style.cssText = 'flex:1;word-break:break-all;';
    row.appendChild(nm);
    return row;
  }

  function fileIcon(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(ext)) return '🖼';
    if (ext === 'pdf') return '📄';
    if (['html', 'htm'].includes(ext)) return '🌐';
    if (['js', 'css', 'json'].includes(ext)) return '⚙';
    return '📎';
  }

  function fmtSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  function uploadFile(file, name) {
    const cfg = getGhCfg();
    const reader = new FileReader();
    reader.onload = async () => {
      // reader.result is a data URL: strip the prefix to get base64
      const b64 = String(reader.result).split(',')[1];
      const path = (filesCurrentDir ? filesCurrentDir + '/' : '') + name;
      const api = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + encodeURI(path);
      setStatus('Uploading ' + name + '…');

      // Check if it already exists (need sha to overwrite)
      let sha;
      try {
        const r = await fetch(api + '?ref=' + encodeURIComponent(cfg.branch || 'main'), { headers: ghHeaders(), cache: 'no-store' });
        if (r.ok) {
          if (!confirm(name + ' already exists. Overwrite it?')) { setStatus('Upload cancelled'); return; }
          sha = (await r.json()).sha;
        }
      } catch (e) {}

      const body = { message: 'Upload ' + path + ' via admin editor', content: b64, branch: cfg.branch || 'main' };
      if (sha) body.sha = sha;
      try {
        const r = await fetch(api, { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) });
        if (!r.ok) throw new Error('GitHub ' + r.status + ': ' + (await r.text()));
        setStatus('Uploaded ✓', true);
        alert('Uploaded "' + name + '". Live in ~1 minute.\n\nPath to use in content: ' + path);
        listDir(filesCurrentDir);
      } catch (e) {
        setStatus('Upload failed');
        alert('Upload failed: ' + e.message + '\n\nNote: very large files may be rejected by the GitHub API.');
      }
    };
    reader.readAsDataURL(file);
  }

  async function deleteFile(path, sha, name) {
    if (!confirm('Delete "' + name + '" from the repository? This cannot be undone.')) return;
    const cfg = getGhCfg();
    const api = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + encodeURI(path);
    setStatus('Deleting ' + name + '…');
    try {
      const r = await fetch(api, {
        method: 'DELETE',
        headers: ghHeaders(),
        body: JSON.stringify({ message: 'Delete ' + path + ' via admin editor', sha: sha, branch: cfg.branch || 'main' })
      });
      if (!r.ok) throw new Error('GitHub ' + r.status + ': ' + (await r.text()));
      setStatus('Deleted ✓', true);
      listDir(filesCurrentDir);
    } catch (e) {
      setStatus('Delete failed');
      alert('Delete failed: ' + e.message);
    }
  }

  // ---------- UTILITIES ----------
  function move(arr, i, delta) {
    const j = i + delta;
    if (j < 0 || j >= arr.length) return false;
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    return true;
  }
})();
