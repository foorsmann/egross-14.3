// assets/slider-qty-fix.js
(function () {
  const SLIDER_TYPES = new Set([
    'recently-viewed',
    'product-recommendations',
    'foxkit-related-products',
    'featured-collection',
    'product-tabs'
  ]);

  function isSliderInput(input) {
    const sec = input.closest('[data-section-type]');
    return sec && SLIDER_TYPES.has(sec.getAttribute('data-section-type'));
  }

  function findDoubleQtyButton(scope) {
    if (!scope) return null;
    // Detectie robustă pentru toate variantele întâlnite în temă
    return (
      scope.querySelector('[data-collection-double-qty]') ||
      scope.querySelector('.collection-double-qty-btn') ||
      scope.querySelector('.double-qty-btn') ||
      scope.querySelector('button[name="addAnother"], button[data-add-another]')
    );
  }

  function setDoubleBtnDisabled(btn, disabled) {
    if (!btn) return;
    // 1) Starea semantică
    btn.toggleAttribute('disabled', disabled);
    btn.setAttribute('aria-disabled', String(disabled));
    btn.classList.toggle('is-disabled', disabled);

    // 2) Curățare stiluri inline moștenite din patch-urile anterioare
    if (btn.style.pointerEvents) btn.style.pointerEvents = '';
    if (btn.style.opacity) btn.style.opacity = '';
  }

  function initInput(input) {
    if (!isSliderInput(input)) return;

    const step = parseInt(input.getAttribute('data-collection-min-qty'), 10) ||
                 parseInt(input.step || '1', 10) || 1;
    const max  = parseInt(input.max || '0', 10) || 0;

    // Ce afișăm: stocul dacă este sub pas, altfel pasul
    const display = (max > 0 && max < step) ? max : step;

    // Setăm atât prop cât și atributul value
    input.value = String(display);
    input.setAttribute('value', String(display));

    // Highlight cand valoarea afisata atinge stocul disponibil
    const isLow = (max > 0 && max < step);
    const highlight = (max > 0 && display >= max);
    if (highlight) {
      input.classList.add('text-red-600');
      input.style.color = '#e3342f';
    } else {
      input.classList.remove('text-red-600');
      input.style.color = '';
    }

    // Actualizăm starea butoanelor +/-
    const wrap = input.closest('collection-quantity-input') || input.parentElement;
    if (wrap) {
      const plus  = wrap.querySelector('[data-collection-quantity-selector="increase"]');
      const minus = wrap.querySelector('[data-collection-quantity-selector="decrease"]');
      if (plus)  plus.disabled  = isFinite(max) && display >= max;
      if (minus) minus.disabled = display <= step;
    }

    // „Adaugă încă …” trebuie dezactivat când stoc < pas
    const card = input.closest('.sf__pcard, .p-card, .product-card, .sf__col-item, [data-product-id], .swiper-slide, [data-section-type]');
    const dblBtn = findDoubleQtyButton(card);
    setDoubleBtnDisabled(dblBtn, isLow);
  }

  function processContainer(container) {
    container.querySelectorAll('input[data-collection-quantity-input]').forEach(initInput);
  }

  function init() {
    document.querySelectorAll('[data-section-type]').forEach(sec => {
      if (SLIDER_TYPES.has(sec.getAttribute('data-section-type'))) {
        processContainer(sec);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Supraveghează injecțiile dinamice (recent/recommendations/etc.)
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      m.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches && node.matches('input[data-collection-quantity-input]')) {
          initInput(node);
        } else if (node.querySelectorAll) {
          node.querySelectorAll('input[data-collection-quantity-input]').forEach(initInput);
        }
      });
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

