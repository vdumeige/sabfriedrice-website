//
// theme.js
//
// Everything the site needs, hand-written. The previous build shipped a 2.99 MB
// vendor bundle (949 KB compressed) on every page: mapbox-gl for one static pin,
// the FontAwesome SVG-with-JS packs for ten icons, plus Bootstrap JS, Flickity,
// Isotope, Jarallax and BigPicture. All of it is replaced here or in CSS.

// ---------------------------------------------------------------------------
// Navbar (replaces Bootstrap Collapse)
// ---------------------------------------------------------------------------

function initNavbar() {
  const toggler = document.querySelector('[data-nav-toggle]');
  const collapse = document.getElementById('navbarCollapse');
  if (!toggler || !collapse) return;

  const setOpen = (open) => {
    collapse.classList.toggle('show', open);
    toggler.setAttribute('aria-expanded', String(open));
  };

  toggler.addEventListener('click', () => {
    setOpen(!collapse.classList.contains('show'));
  });

  // Close when a link is followed, and on Escape.
  collapse.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && collapse.classList.contains('show')) {
      setOpen(false);
      toggler.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Open / closed status chip
// ---------------------------------------------------------------------------

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// The restaurant's clock, not the visitor's. Someone checking from another
// timezone still needs to know whether the kitchen in Fort Smith is open.
const RESTAURANT_TZ = 'America/Chicago';

function restaurantNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: RESTAURANT_TZ,
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value;
  // Intl can return "24" for midnight; normalise it.
  const hour = parseInt(get('hour'), 10) % 24;

  return {
    weekday: get('weekday'),
    minutes: hour * 60 + parseInt(get('minute'), 10),
  };
}

function formatHour(minutes) {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function nextOpenDay(openDays, fromWeekday) {
  const start = DAY_NAMES.indexOf(fromWeekday);
  for (let i = 1; i <= 7; i += 1) {
    const candidate = DAY_NAMES[(start + i) % 7];
    if (openDays.includes(candidate)) {
      return { name: candidate, isTomorrow: i === 1 };
    }
  }
  return null;
}

function initStatusChips() {
  const chips = document.querySelectorAll('[data-status-chip]');
  if (!chips.length) return;

  chips.forEach((chip) => {
    const openDays = (chip.dataset.openDays || '').split(',').filter(Boolean);
    const opens = toMinutes(chip.dataset.opens || '11:00');
    const closes = toMinutes(chip.dataset.closes || '20:00');
    if (!openDays.length) return;

    const now = restaurantNow();
    const label = chip.querySelector('[data-status-label]');
    if (!label) return;

    const openToday = openDays.includes(now.weekday);
    let state = 'closed';
    let text;

    if (openToday && now.minutes >= opens && now.minutes < closes) {
      state = 'open';
      text = `Open now until ${formatHour(closes)}`;
    } else if (openToday && now.minutes < opens) {
      text = `Opens today at ${formatHour(opens)}`;
    } else {
      const next = nextOpenDay(openDays, now.weekday);
      const when = next ? (next.isTomorrow ? 'tomorrow' : next.name) : 'soon';
      text = `Closed now · Opens ${when} at ${formatHour(opens)}`;
    }

    chip.dataset.state = state;
    label.textContent = text;
    // Built client-side, so announce it once rather than leaving a stale
    // server-rendered value in the accessibility tree.
    chip.setAttribute('aria-label', text);
  });
}

// ---------------------------------------------------------------------------
// Menu category nav (replaces the Bootstrap tab component)
//
// The old build put all six categories in tab panes. Five were display:none,
// but the browser still downloaded every image in them. This is one scrolling
// document with a sticky category rail instead.
// ---------------------------------------------------------------------------

function initMenuNav() {
  const nav = document.querySelector('[data-menu-nav]');
  if (!nav) return;

  const links = Array.from(nav.querySelectorAll('[data-menu-link]'));
  const sections = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  if (!sections.length) return;

  const setActive = (id) => {
    links.forEach((link) => {
      const active = link.getAttribute('href') === `#${id}`;
      link.classList.toggle('is-active', active);
      if (active) {
        link.setAttribute('aria-current', 'true');
        // Keep the active pill in view on narrow screens.
        link.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else {
        link.removeAttribute('aria-current');
      }
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id);
    },
    // Bias the band toward the top of the viewport so the highlighted category
    // matches the heading the reader is actually under.
    { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
  );

  sections.forEach((section) => observer.observe(section));
}

// ---------------------------------------------------------------------------
// Gallery lightbox (replaces BigPicture) — native <dialog>, so focus trapping,
// Escape handling and inertness come from the platform.
// ---------------------------------------------------------------------------

function initLightbox() {
  const triggers = document.querySelectorAll('[data-lightbox]');
  if (!triggers.length || !window.HTMLDialogElement) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.innerHTML =
    '<form method="dialog">' +
    '<button class="lightbox__close" aria-label="Close image">&times;</button>' +
    '</form><img alt="">';
  document.body.appendChild(dialog);

  const image = dialog.querySelector('img');

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      image.src = trigger.dataset.lightbox;
      image.alt = trigger.dataset.lightboxAlt || '';
      dialog.showModal();
    });
  });

  // Click the backdrop to dismiss.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  // Deliberately no 'close' cleanup: the src stays set so reopening is instant
  // and does not refetch. (An earlier version cleared it on the dialog's 'close'
  // event, which was verified never to fire here.)
}

// ---------------------------------------------------------------------------

function init() {
  initNavbar();
  initStatusChips();
  initMenuNav();
  initLightbox();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
