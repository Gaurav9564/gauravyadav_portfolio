/* ============================================
   Gaurav Yadav — Portfolio Scripts
   ============================================ */

// --- Theme toggle (light / dark) ---
(function themeInit() {
  const root = document.documentElement;
  const btn = document.querySelector('.theme-toggle');
  const iconEl = btn?.querySelector('.theme-icon');
  const meta = document.querySelector('meta[name="theme-color"]');

  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    if (iconEl) iconEl.textContent = t === 'dark' ? '☀' : '☾';
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0b1020' : '#faf7f2');
    if (btn) btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  const current = root.getAttribute('data-theme') || 'light';
  applyTheme(current);

  if (btn) {
    btn.addEventListener('click', () => {
      const next = (root.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }
})();

// --- Footer year ---
function setFooterYear() {
  document.querySelectorAll('#yr, [data-bind="footer.year"]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });
}
setFooterYear();

// --- Mobile menu toggle ---
const menuBtn = document.querySelector('.menu-btn');
const navLinks = document.querySelector('.nav-links');
if (menuBtn && navLinks) {
  menuBtn.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => navLinks.classList.remove('open'));
  });
  document.addEventListener('click', (e) => {
    if (!navLinks.contains(e.target) && !menuBtn.contains(e.target)) {
      navLinks.classList.remove('open');
    }
  });
}

// --- Active nav highlighting ---
(function highlightNav() {
  const path = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = (a.getAttribute('href') || '').toLowerCase();
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
})();

// --- Reveal on scroll (rebindable so dynamic content also animates) ---
let revealObserver = null;
function bindReveal() {
  if (!('IntersectionObserver' in window)) return;
  if (revealObserver) revealObserver.disconnect();
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal:not(.in)').forEach(el => revealObserver.observe(el));
}
window.__rebindReveal = bindReveal;
bindReveal();

// --- Animate skill bars when visible (rebindable) ---
let skillObserver = null;
function bindSkillBars() {
  if (!('IntersectionObserver' in window)) return;
  if (skillObserver) skillObserver.disconnect();
  skillObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const target = e.target;
        const w = target.getAttribute('data-width');
        setTimeout(() => { target.style.width = w + '%'; }, 100);
        skillObserver.unobserve(target);
      }
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('.skill-bar > span[data-width]').forEach(b => {
    b.style.width = '0'; // reset for re-bind
    skillObserver.observe(b);
  });
}
window.__rebindSkillBars = bindSkillBars;
bindSkillBars();

// --- Contact form (FormSubmit.co AJAX -> sends to Gmail) ---
function getContactEmail() {
  return window.__contactEmail || 'Gauravyadav9564@gmail.com';
}
const form = document.getElementById('contact-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgEl = document.getElementById('form-msg');
    const submitBtn = form.querySelector('button[type="submit"]');
    const CONTACT_EMAIL = getContactEmail();

    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      message: form.message.value.trim(),
      _subject: `New portfolio message from ${form.name.value.trim() || 'visitor'}`,
      _template: 'table',
      _captcha: 'false'
    };

    if (!data.name || !data.email || !data.message) {
      showMsg(msgEl, 'Please fill in all fields.', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      showMsg(msgEl, 'Please enter a valid email address.', 'error');
      return;
    }

    const originalBtn = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Sending...';
    showMsg(msgEl, '', '');

    try {
      const res = await fetch(`https://formsubmit.co/ajax/${CONTACT_EMAIL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (res.ok && (json.success === 'true' || json.success === true)) {
        showMsg(msgEl, '✓ Thank you! Your message has been sent — I will reply soon.', 'success');
        form.reset();
      } else {
        showMsg(msgEl, 'Could not send right now. You can email me directly at ' + CONTACT_EMAIL, 'error');
      }
    } catch (err) {
      const subject = encodeURIComponent(data._subject);
      const body = encodeURIComponent(`${data.message}\n\n— ${data.name}\n${data.email}`);
      showMsg(msgEl, 'Network error. Opening your email client as a fallback...', 'error');
      setTimeout(() => {
        window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
      }, 1000);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtn;
    }
  });
}

function showMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = 'form-msg' + (type ? ' ' + type : '');
}
