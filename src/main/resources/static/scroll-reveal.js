let observer, stopMotionListener;
const selector = '.hero-image, .intro-strip > div, .section-top, .property-card, .invitation, .detail-copy, .detail-panel';
const show = element => {
  element.classList.remove('is-pending');
  element.dataset.revealed = 'true';
};

/** Below-the-fold content eases in once. Already visible content never flashes or disappears. */
export function revealOnScroll(root = document) {
  observer?.disconnect();
  stopMotionListener?.();
  const elements = [...root.querySelectorAll(selector)];
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches || !('IntersectionObserver' in window)) {
    elements.forEach(show);
    return;
  }
  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        show(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, {threshold: 0.06, rootMargin: '0px 0px -16px 0px'});
  elements.forEach(element => {
    if (element.dataset.revealed || element.getBoundingClientRect().top < window.innerHeight - 24) {
      show(element);
    } else {
      element.classList.add('scroll-reveal', 'is-pending');
      observer.observe(element);
    }
  });
  const reduceMotion = () => {
    if (preference.matches) {
      observer.disconnect();
      elements.forEach(show);
    }
  };
  preference.addEventListener('change', reduceMotion);
  stopMotionListener = () => preference.removeEventListener('change', reduceMotion);
}

// A keyboard user can focus a card before its observer callback; reveal it immediately.
document.addEventListener('focusin', event => {
  const element = event.target.closest('.is-pending');
  if (element) show(element);
});
