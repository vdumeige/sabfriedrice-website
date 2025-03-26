//
// navbar.js
//

const navbar = document.querySelector('.navbar-togglable');
const navbarCollapse = document.querySelector('.navbar-collapse');
const windowEvents = ['load', 'scroll'];
const logoDesktop = document.querySelector('.navbar-brand.d-none.d-lg-block img');
const logoMobile = document.querySelector('.navbar-brand.d-lg-none img');

let isLight = false;
let isCollapsed = false;

function isUserInDarkMode() {
  // Check if .dark class exists on body or html element
  return document.documentElement.classList.contains('dark') || 
         document.body.classList.contains('dark') || 
         document.querySelector('html[data-bs-theme="dark"]') !== null;
}

function makeNavbarDark(navbar) {
  navbar.classList.add('navbar-dark');
  
  // Always use original (white) version in dark mode for better visibility
  if (logoDesktop) logoDesktop.src = 'assets/img/Sab2-png.png';
  if (logoMobile) logoMobile.src = 'assets/img/Sab2-png.png';
  
  isLight = false;
}

function makeNavbarLight(navbar) {
  navbar.classList.remove('navbar-dark');
  
  // Only use black logo if not in dark mode
  if (!isUserInDarkMode()) {
    if (logoDesktop) logoDesktop.src = 'assets/img/sab-png-black.png';
    if (logoMobile) logoMobile.src = 'assets/img/sab-png-black.png';
  } else {
    // Keep original logo in dark mode
    if (logoDesktop) logoDesktop.src = 'assets/img/Sab2-png.png';
    if (logoMobile) logoMobile.src = 'assets/img/Sab2-png.png';
  }
  
  isLight = true;
}

function toggleNavbar(navbar) {
  const scrollTop = window.pageYOffset;

  if (scrollTop && !isLight) {
    makeNavbarLight(navbar);
  }

  if (!scrollTop && !isCollapsed) {
    makeNavbarDark(navbar);
  }
}

if (navbar) {
  // Toggle navbar on scroll
  windowEvents.forEach(function (event) {
    window.addEventListener(event, function () {
      toggleNavbar(navbar);
    });
  });

  // Toggle navbar on expand
  navbarCollapse.addEventListener('show.bs.collapse', function () {
    isCollapsed = true;

    makeNavbarLight(navbar);
  });

  // Toggle navbar on collapse
  navbarCollapse.addEventListener('hidden.bs.collapse', function () {
    isCollapsed = false;

    if (!window.pageYOffset) {
      makeNavbarDark(navbar);
    }
  });

  // Also listen for dark mode changes
  const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  darkModeMediaQuery.addEventListener('change', function() {
    // Re-apply current navbar state to update logo
    if (isLight) {
      makeNavbarLight(navbar);
    } else {
      makeNavbarDark(navbar);
    }
  });
  
  // Also check for theme toggle buttons if present
  const themeToggles = document.querySelectorAll('[data-bs-toggle="theme"]');
  themeToggles.forEach(toggle => {
    toggle.addEventListener('click', function() {
      // Wait a moment for the theme to actually change
      setTimeout(function() {
        if (isLight) {
          makeNavbarLight(navbar);
        } else {
          makeNavbarDark(navbar);
        }
      }, 50);
    });
  });
}