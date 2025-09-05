// assets/slider-qty-enforcer.js
(function () {
  // Rulăm doar în secțiuni de tip slider (nu pe colecții/pagina de produs)
  const SEC_TYPES = new Set([
    'recently-viewed',
    'product-recommendations',
    'foxkit-related-products',
    'featured-collection',
    'product-tabs'
  ]);

  function raf2(fn){ requestAnimationFrame(() => requestAnimationFrame(fn)); }
  function getInt(x, d){ const n = parseInt(x, 10); return Number.isNaN(n) ? d : n; }

  function isInSlider(el){
    const sec = el.closest('[data-section-type]');
    if (!sec) return false;
    return SEC_TYPES.has(sec.getAttribute('data-section-type'));
  }

  function enforceOnInput(input){
    if (!isInSlider(input)) return;

    const stepAttr = parseInt(input.getAttribute('data-collection-min-qty') || input.getAttribute('step') || '1',10) || 1;
    const maxAttr  = parseInt(input.getAttribute('max') || '0',10) || 0;
    const display  = (maxAttr > 0 && maxAttr < stepAttr) ? maxAttr : stepAttr;

    input.min = String(display);
    input.setAttribute('min', String(display));
    input.step = String(stepAttr);
    input.setAttribute('step', String(stepAttr));
    input.value = String(display);
    input.setAttribute('value', String(display));

    const low = (maxAttr > 0 && maxAttr < stepAttr);
    const highlight = (maxAttr > 0 && display >= maxAttr);
    input.classList.toggle('is-low-stock', low);
    input.classList.toggle('text-red-600', highlight);
    if (highlight) input.style.setProperty('color', '#e3342f', 'important');
    else input.style.removeProperty('color');

    const card = input.closest('.sf__pcard, .p-card, .product-card, .sf__col-item, [data-product-id], .swiper-slide') || document;
    const dbl  = card.querySelector('[data-collection-double-qty], .collection-double-qty-btn, .double-qty-btn');
    if (dbl){
      const lowStock = !(maxAttr >= stepAttr);
      if (lowStock){
        dbl.setAttribute('disabled','true');
        dbl.setAttribute('aria-disabled','true');
        dbl.classList.add('is-disabled');
        dbl.setAttribute('title','Stoc insuficient pentru cantitatea minimă');
      } else {
        dbl.removeAttribute('disabled');
        dbl.removeAttribute('aria-disabled');
        dbl.classList.remove('is-disabled');
        dbl.removeAttribute('title');
      }
    }
  }

  function enforce(root){
    const scope = root || document;
    const inputs = scope.querySelectorAll('input.collection-qty-element[data-collection-quantity-input]');
    inputs.forEach(enforceOnInput);
  }

  function run(root){ raf2(() => enforce(root)); }

  // Evenimente „târzii” – rulăm după ce alte scripturi au inițializat/reevaluat DOM-ul
  document.addEventListener('DOMContentLoaded', () => run());
  window.addEventListener('load', () => run());
  document.addEventListener('shopify:section:load', e => run(e.target));
  document.addEventListener('shopify:cart:updated', () => run());
  // după injectarea cardurilor în slidere
  document.addEventListener('sf:slider-products-loaded', e => run(e.detail && e.detail.root ? e.detail.root : undefined));

  // fallback general (ex. când recommendations/recent viewed injectează asincron)
  const mo = new MutationObserver(() => run());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // expunere pentru debug
  window.SliderQtyEnforcer = { run, enforce };
})();

