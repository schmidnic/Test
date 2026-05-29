/* ── Nav logo fold animation ───────────────────────────────── */
const navLogo = document.querySelector('.nav-logo');
if (navLogo) {
  const text = navLogo.textContent.trim();
  navLogo.innerHTML = [...text].map((char, i) =>
    `<span class="nlc" style="--i:${i}">${char === ' ' ? '&nbsp;' : char}</span>`
  ).join('');
  const readyDelay = text.length * 65 + 200 + 750;
  setTimeout(() => navLogo.classList.add('nlc-ready'), readyDelay);
}

/* ── Navigation: scroll-shadow ─────────────────────────────── */
const nav = document.getElementById('nav');

if (nav && !nav.classList.contains('scrolled')) {
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ── Mobile menu ───────────────────────────────────────────── */
const navToggle  = document.getElementById('navToggle');
const navMobile  = document.getElementById('navMobile');

if (navToggle && navMobile) {
  navToggle.addEventListener('click', () => {
    const isOpen = navMobile.classList.toggle('open');
    navToggle.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
}

function closeMobileMenu() {
  if (navMobile) navMobile.classList.remove('open');
  if (navToggle) navToggle.classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Accordion ─────────────────────────────────────────────── */
document.querySelectorAll('.accordion-trigger').forEach(trigger => {
  trigger.addEventListener('click', () => {
    const item   = trigger.closest('.accordion-item');
    const isOpen = item.classList.contains('open');

    /* close all */
    document.querySelectorAll('.accordion-item').forEach(el => {
      el.classList.remove('open');
      el.querySelector('.accordion-trigger').setAttribute('aria-expanded', 'false');
    });

    /* toggle clicked */
    if (!isOpen) {
      item.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });
});

/* ── Scroll-reveal ─────────────────────────────────────────── */
const revealEls = document.querySelectorAll('.reveal');

if (revealEls.length) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealEls.forEach(el => observer.observe(el));
}

/* ── Cookie banner ─────────────────────────────────────────── */
const cookieBanner = document.getElementById('cookieBanner');

if (cookieBanner) {
  if (localStorage.getItem('cookiesAccepted')) {
    cookieBanner.classList.add('hidden');
  }
}

function acceptCookies() {
  localStorage.setItem('cookiesAccepted', '1');
  if (cookieBanner) cookieBanner.classList.add('hidden');
}
