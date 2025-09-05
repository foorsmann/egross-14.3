/**
 * collection-quick-add.js - isolated quantity + double qty + ajax add-to-cart for collection cards
 * Mirrors product-page quantity logic with collection-specific hooks.
 */
(function(){
  var addToCartLocks = new WeakSet();
  var qgFirstPaintDone = false;
  function qgMarkListingReady(){
    if(qgFirstPaintDone) return;
    var listing = document.querySelector('.sf__product-listing[data-product-container]');
    if(listing){
      listing.setAttribute('data-qg-ready','1');
    }
    // Fallback global (dacă nu există containerul dintr-un motiv sau altul)
    try { document.documentElement.removeAttribute('data-qg'); } catch(e){}
    qgFirstPaintDone = true;
  }
  function snapDown(val, step, min){
    if(!isFinite(val)) return min;
    if(val < min) return min;
    return Math.floor((val - min)/step)*step + min;
  }
  function clampAndSnap(val, step, min, max, snap){
    val = Math.min(val, max);
    if(val < min) val = min;
    if(snap && val !== max){
      val = snapDown(val, step, min);
    }
    return val;
  }
  function clearTextSelection(){
    var sel = window.getSelection ? window.getSelection() : null;
    if(sel && sel.removeAllRanges){ sel.removeAllRanges(); }
  }
  // ---- Slider context helpers ----
  var QG_SLIDER_TYPES = new Set([
    'recently-viewed',
    'product-recommendations',
    'foxkit-related-products',
    'featured-collection',
    'product-tabs'
  ]);

  function qgIsSliderNode(node) {
    if (!node) return false;
    var sec = node.closest ? node.closest('[data-section-type]') : null;
    return !!(sec && QG_SLIDER_TYPES.has(sec.getAttribute('data-section-type')));
  }

// Theming-safe UI update for a collection-qty input inside sliders
function qgSyncSliderQtyUI(qtyEl, sendQty) {
  if (!qtyEl) return;

  var step = parseInt(qtyEl.getAttribute('data-collection-min-qty') || qtyEl.step || '1', 10) || 1;
  var max  = parseInt(qtyEl.getAttribute('max') || qtyEl.max || '0', 10) || 0;

  if (isFinite(max) && max > 0 && sendQty > max) {
    sendQty = max;
  }
  if (sendQty < 1) {
    sendQty = 1;
  }

  // set both prop and attribute (unele scripturi citesc atributul)
  qtyEl.value = String(sendQty);
  qtyEl.setAttribute('value', String(sendQty));

  var atMax     = isFinite(max) && sendQty >= max;
  var highlight = max > 0 && sendQty >= max;

  // highlight când se atinge stocul disponibil
  qtyEl.classList.toggle('text-red-600', highlight);
  if (highlight) {
    qtyEl.style.setProperty('color', '#e3342f', 'important');
  } else {
    qtyEl.style.removeProperty('color');
  }

  // update +/- states
  var wrap = qtyEl.closest('collection-quantity-input') || qtyEl.parentNode;
  if (wrap) {
    var plus  = wrap.querySelector('[data-collection-quantity-selector="increase"]');
    var minus = wrap.querySelector('[data-collection-quantity-selector="decrease"]');
    if (plus)  plus.disabled  = atMax;
    if (minus) minus.disabled = sendQty <= step;
  }

  // update “Adauga inca …”
  var card = qtyEl.closest('.sf__pcard, .p-card, .product-card, .sf__col-item, [data-product-id], .swiper-slide, [data-section-type]');
  var dbl  = card && (card.querySelector('[data-collection-double-qty]') || card.querySelector('.collection-double-qty-btn') || card.querySelector('.double-qty-btn'));
  if (dbl) {
    var lowStock = max > 0 && max < step;
    var disabled = atMax || lowStock;
    dbl.disabled = disabled;
    dbl.toggleAttribute('disabled', disabled);
    dbl.setAttribute('aria-disabled', String(disabled));
    dbl.classList.toggle('is-disabled', disabled);
    if (lowStock) {
      dbl.setAttribute('title', 'Stoc insuficient pentru cantitatea minimă');
    } else {
      dbl.removeAttribute('title');
    }
  }

  // sincronizează duplicatele (dacă există utilitare)
  if (typeof window.collectionSyncOtherQtyInputs === 'function') {
    window.collectionSyncOtherQtyInputs(qtyEl);
  } else if (typeof window.syncOtherQtyInputs === 'function') {
    window.syncOtherQtyInputs(qtyEl);
  }

  if (typeof window.updateQtyButtonsState === 'function') {
    window.updateQtyButtonsState(qtyEl);
  }
  if (typeof window.updateCollectionDoubleQtyState === 'function') {
    window.updateCollectionDoubleQtyState(qtyEl);
  }
}



  // ---- Slider Qty Guard (context-aware) ----
  function qgIsSliderInput(input) {
    return qgIsSliderNode(input);
  }

  function qgEnforceSliderInput(input) {
    if (!input || !qgIsSliderInput(input)) return false;

    const step = parseInt(input.getAttribute('data-collection-min-qty') || input.getAttribute('step') || '1', 10) || 1;
    const max  = parseInt(input.getAttribute('max') || '0', 10) || 0;

    // display: daca stoc < min_qty => stoc; altfel min_qty
    const display = (max > 0 && max < step) ? max : step;

    // setam atat prop cat si atribute
    input.min = String(display);
    input.setAttribute('min', String(display));
    input.step = String(step);
    input.setAttribute('step', String(step));
    input.value = String(display);
    input.setAttribute('value', String(display));

    // highlight cand valoarea afisata atinge stocul disponibil
    const isLow = (max > 0 && max < step);
    const highlight = (max > 0 && display >= max);
    input.classList.toggle('is-low-stock', isLow);
    input.classList.toggle('text-red-600', highlight);
    if (highlight) {
      input.style.setProperty('color', '#e3342f', 'important');
    } else {
      input.style.removeProperty('color');
    }

    // buton „Adauga inca …”
    const card = input.closest('.sf__pcard, .p-card, .product-card, .sf__col-item, [data-product-id], .swiper-slide') || document;
    const dbl  = card.querySelector('[data-collection-double-qty], .collection-double-qty-btn, .double-qty-btn');
    if (dbl) {
      const lowStock = !(max >= step);
      if (lowStock) {
        dbl.setAttribute('disabled', 'true');
        dbl.setAttribute('aria-disabled', 'true');
        dbl.classList.add('is-disabled');
        dbl.setAttribute('title', 'Stoc insuficient pentru cantitatea minimă');
      } else {
        dbl.removeAttribute('disabled');
        dbl.removeAttribute('aria-disabled');
        dbl.classList.remove('is-disabled');
        dbl.removeAttribute('title');
      }
    }

    // marcare pt. idempotenta
    input.setAttribute('data-qg-fixed', '1');
    return true;
  }
  function validateAndHighlight(input){
      if(qgIsSliderInput(input)){
        return;
    }
      if(input.value === ''){
        input.classList.remove('text-red-600');
        input.style.color = '';
        return;
    }
    var min = input.min ? parseInt(input.min,10) : 1;
    var step = parseInt(input.getAttribute('data-collection-min-qty'),10) || parseInt(input.step,10) || 1;
    var max = input.max ? parseInt(input.max,10) : Infinity;
    var val = parseInt(input.value,10);
    if(isNaN(val)) val = min;
    val = clampAndSnap(val, step, min, max, false);
    input.value = val;
    if(val >= max){
      input.classList.add('text-red-600');
      input.style.color = '#e3342f';
    }else{
      input.classList.remove('text-red-600');
      input.style.color = '';
    }
    return val;
  }
  function updateQtyButtonsState(input){
    var wrap = input.closest('collection-quantity-input');
    if(!wrap) return;
    var plus = wrap.querySelector('[data-collection-quantity-selector="increase"]');
    var minus = wrap.querySelector('[data-collection-quantity-selector="decrease"]');
    var max = input.max ? parseInt(input.max,10) : Infinity;
    var step = parseInt(input.getAttribute('data-collection-min-qty'),10) || parseInt(input.step,10) || 1;
    var minQty = step;
    var val = parseInt(input.value,10);
    if(isNaN(val)) val = 0;
    if(plus) plus.disabled = isFinite(max) && val >= max;
    if(minus) minus.disabled = val <= minQty;
  }
  function syncOtherQtyInputs(changed){
    if(qgIsSliderInput(changed)) return;
    var pid = changed.dataset.collectionProductId;
    if(!pid) return;
    var value = changed.value;
    document.querySelectorAll('input[data-collection-product-id="'+pid+'"][data-collection-quantity-input]').forEach(function(inp){
      if(inp === changed) return;
      if(inp.value !== value){
        inp.value = value;
        validateAndHighlight(inp);
        updateQtyButtonsState(inp);
        inp.dispatchEvent(new Event('input',{bubbles:true}));
        inp.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });
  }
  function applyMinQty(){
    document.querySelectorAll('input[data-collection-min-qty]').forEach(function(input){
      // SLIDER: folosim regula proprie si iesim
      if (qgEnforceSliderInput(input)) return;
      var min = parseInt(input.getAttribute('data-collection-min-qty'),10);
      if(min && min > 0){
        input.min = 1;
        input.step = min;
        validateAndHighlight(input);
        updateQtyButtonsState(input);
      }
    });
  }
  function applyCappedQtyState(source){
    var pid = source.dataset.collectionProductId;
    var inputs = document.querySelectorAll('input[data-collection-product-id="'+pid+'"][data-collection-quantity-input]');
    inputs.forEach(function(input){
      input.dataset.prevMin = input.min;
      var prevAttr = input.getAttribute('data-collection-min-qty');
      if(prevAttr !== null) input.dataset.prevMinQtyAttr = prevAttr;
      input.removeAttribute('data-collection-min-qty');
      input.min = 0;
      input.value = 0;
      input.classList.add('text-red-600');
      input.style.color = '#e3342f';
      updateQtyButtonsState(input);
      updateCollectionDoubleQtyState(input);
      setTimeout(function(){
        input.value = 0;
        updateQtyButtonsState(input);
        updateCollectionDoubleQtyState(input);
      },0);
      var clearWarning = function(){
        input.classList.remove('text-red-600');
        input.style.color = '';
        if(input.dataset.prevMin){
          input.min = input.dataset.prevMin;
          delete input.dataset.prevMin;
        }
        if(input.dataset.prevMinQtyAttr !== undefined){
          input.setAttribute('data-collection-min-qty', input.dataset.prevMinQtyAttr);
          delete input.dataset.prevMinQtyAttr;
        }
        input.removeEventListener('input', clearWarning);
        input.removeEventListener('change', clearWarning);
        syncOtherQtyInputs(input);
        updateCollectionDoubleQtyState(input);
      };
      input.addEventListener('input', clearWarning, {once:true});
      input.addEventListener('change', clearWarning, {once:true});
    });
  }
  window.collectionApplyCappedQtyState = applyCappedQtyState;
  function handleQtyInputEvent(e){
    var input = e.target.closest('input[data-collection-quantity-input]');
    if(!input) return;
    if (qgIsSliderInput(input)) {
      // Allow user to clear the field while typing. Only enforce the
      // minimum quantity when the value is not empty.
      if (e.type === 'input' && input.value === '') {
        var step = parseInt(input.getAttribute('data-collection-min-qty') || input.step || '1', 10) || 1;
        var max  = parseInt(input.getAttribute('max') || input.max || '0', 10) || 0;
        var lowStock = isFinite(max) && max < step;
        input.classList.remove('text-red-600');
        input.style.removeProperty('color');

        var wrap = input.closest('collection-quantity-input') || input.parentNode;
        if (wrap) {
          var plus  = wrap.querySelector('[data-collection-quantity-selector="increase"]');
          var minus = wrap.querySelector('[data-collection-quantity-selector="decrease"]');
          if (plus)  plus.disabled  = lowStock;
          if (minus) minus.disabled = true;
        }

        var card = input.closest('.sf__pcard, .p-card, .product-card, .sf__col-item, [data-product-id], .swiper-slide, [data-section-type]');
        var dbl  = card && (card.querySelector('[data-collection-double-qty]') || card.querySelector('.collection-double-qty-btn') || card.querySelector('.double-qty-btn'));
        if (dbl) {
          var disabled = lowStock;
          dbl.disabled = disabled;
          dbl.toggleAttribute('disabled', disabled);
          dbl.setAttribute('aria-disabled', String(disabled));
          dbl.classList.toggle('is-disabled', disabled);
          if (lowStock) {
            dbl.setAttribute('title', 'Stoc insuficient pentru cantitatea minimă');
          } else {
            dbl.removeAttribute('title');
          }
        }
        return;
      }

      var val = parseInt(input.value, 10);
      if (!isFinite(val)) {
        val = parseInt(input.getAttribute('data-collection-min-qty') || input.step || '1', 10) || 1;
      }
      qgSyncSliderQtyUI(input, val);
    } else {
      validateAndHighlight(input);
      updateQtyButtonsState(input);
      syncOtherQtyInputs(input);
      updateCollectionDoubleQtyState(input);
    }
  }

  function handleQtyKeypress(e){
    if(e.key !== 'Enter') return;
    var input = e.target.closest('input[data-collection-quantity-input]');
    if(!input) return;
    if (qgIsSliderInput(input)) {
      var val = parseInt(input.value, 10);
      if (!isFinite(val)) {
        val = parseInt(input.getAttribute('data-collection-min-qty') || input.step || '1', 10) || 1;
      }
      qgSyncSliderQtyUI(input, val);
    } else {
      validateAndHighlight(input);
      updateQtyButtonsState(input);
      syncOtherQtyInputs(input);
      updateCollectionDoubleQtyState(input);
    }
  }
  function adjustQuantity(input, delta, baseVal){
    var stepAttr = input.getAttribute('data-collection-min-qty');
    if(!stepAttr && input.dataset.prevMinQtyAttr){
      stepAttr = input.dataset.prevMinQtyAttr;
    }
    var step = parseInt(stepAttr,10) || parseInt(input.step,10) || 1;
    var max = input.max ? parseInt(input.max,10) : Infinity;
    var minQty = step;
    var val = baseVal !== undefined ? parseInt(baseVal,10) : parseInt(input.value,10);
    if(isNaN(val)) val = 1;
    if(delta > 0 && isFinite(max) && val >= max){
      validateAndHighlight(input);
      updateQtyButtonsState(input);
      return;
    }
    if(delta < 0){
      if((val - minQty) % step !== 0){
        val = Math.floor((val - minQty) / step) * step + minQty;
      }else{
        val -= step;
      }
      if(val < minQty) val = minQty;
    }else{
      if((val - minQty) % step !== 0){
        val = Math.ceil((val - minQty) / step) * step + minQty;
      }else{
        val += step;
      }
      if(val > max) val = max;
    }
    var newVal = clampAndSnap(val, step, parseInt(input.min,10) || 1, max);
    input.value = newVal;
    if(newVal >= max){
      input.classList.add('text-red-600');
      input.style.color = '#e3342f';
    }else{
      input.classList.remove('text-red-600');
      input.style.color = '';
    }
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    updateQtyButtonsState(input);
  }
  var qtyButtonListenerBound = false;
  function attachQtyButtonListeners(){
    if(qtyButtonListenerBound) return;
    qtyButtonListenerBound = true;
    document.addEventListener('click', function(e){
      var btn = e.target.closest('[data-collection-quantity-selector]');
      if(!btn) return;
      var wrap = btn.closest('collection-quantity-input') || btn.parentNode;
      var input = wrap ? wrap.querySelector('input[data-collection-quantity-input]') : null;
      if(!input) return;
      var before = input.value;
      var action = btn.getAttribute('data-collection-quantity-selector');
      if(action === 'increase'){
        adjustQuantity(input,1,before);
      }else if(action === 'decrease'){
        adjustQuantity(input,-1,before);
      }else{
        validateAndHighlight(input);
        updateQtyButtonsState(input);
      }
      clearTextSelection();
      btn.blur();
    }, true);
  }

  var noHighlightListenerBound = false;
  function attachNoHighlightListeners(){
    if(noHighlightListenerBound) return;
    noHighlightListenerBound = true;
    document.addEventListener('click', function(e){
      var btn = e.target.closest('.collection-add-to-cart, .collection-double-qty-btn, .collection-qty-button, .sf__btn');
      if(!btn || !btn.closest('.sf__pcard-quick-add-col')) return;
      clearTextSelection();
      btn.blur();
    }, true);
  }
  function isDuplicateSlide(el){
    return !!(el && (el.classList && el.classList.contains('swiper-slide-duplicate') || el.closest('.swiper-slide-duplicate')));
  }
  function findRealCardByPid(card, pid){
    var wrapper = card.closest('.swiper-wrapper') || document;
    var selector = '.swiper-slide:not(.swiper-slide-duplicate) [data-product-id="'+pid+'"], .swiper-slide:not(.swiper-slide-duplicate) [data-collection-product-id="'+pid+'"]';
    var found = wrapper.querySelector(selector);
    return found ? found.closest('[data-product-id],[data-collection-product-id]') : null;
  }
  function findQtyEl(root){
    return root ? root.querySelector('[data-collection-quantity-input], .quantity-input__element, input[name="quantity"]') : null;
  }
  function getVisibleQty(card){
    var baseCard = card;
    var pid = card.getAttribute('data-product-id') || card.getAttribute('data-collection-product-id');
    if(isDuplicateSlide(card)){
      var real = findRealCardByPid(card, pid);
      if(real) baseCard = real;
    }
    var qtyEl = findQtyEl(baseCard);
    var val = parseInt(qtyEl && (qtyEl.value || qtyEl.getAttribute('value')) || '1',10);
    if(!isFinite(val) || val < 1) val = 1;
    var max = parseInt(qtyEl && (qtyEl.max || '999999'),10) || 999999;
    if(val > max) val = max;
    return { val: val, baseCard: baseCard, qtyEl: qtyEl };
  }
  function findQtyInput(btn){
    var group = btn.closest('.collection-qty-group');
    if(group){
      var inp = group.querySelector('input[data-collection-quantity-input]');
      if(inp) return inp;
    }
    var pid = btn.getAttribute('data-collection-product-id');
    if(pid){
      return document.querySelector('input[data-collection-product-id="'+pid+'"][data-collection-quantity-input]');
    }
    return null;
  }

  function setupCollectionDoubleQtyButton(btn){
    var input = findQtyInput(btn);
    if(!input) return;
    var storedMin = parseInt(btn.getAttribute('data-collection-original-min-qty'),10);
    var min = isNaN(storedMin) ? (parseInt(input.getAttribute('data-collection-min-qty'),10) || 1) : storedMin;
    if(isNaN(storedMin)){
      btn.setAttribute('data-collection-original-min-qty', min);
    }
    var template = btn.getAttribute('data-collection-label-template') || btn.textContent;
    var label = template.replace('{min_qty}', min);
    btn.setAttribute('aria-label', label);
    btn.textContent = label;
    var max = input.max ? parseInt(input.max,10) : 9999;
    var val = parseInt(input.value,10) || 1;
    var lowStock = max > 0 && max < min;
    var disabled = val >= max || lowStock;
    btn.disabled = disabled;
    btn.toggleAttribute('disabled', disabled);
    btn.setAttribute('aria-disabled', String(disabled));
    btn.classList.toggle('is-disabled', disabled);
    if (lowStock) {
      btn.setAttribute('title', 'Stoc insuficient pentru cantitatea minimă');
    } else {
      btn.removeAttribute('title');
    }
  }

  function setupCollectionDoubleQtyButtons(root){
    var scope = root || document;
    if(scope.matches && scope.matches('.collection-double-qty-btn')){
      setupCollectionDoubleQtyButton(scope);
    }
    scope.querySelectorAll && scope.querySelectorAll('.collection-double-qty-btn').forEach(setupCollectionDoubleQtyButton);
  }

  function updateCollectionDoubleQtyState(input){
    var pid = input.dataset.collectionProductId;
    if(!pid) return;
    document.querySelectorAll('.collection-double-qty-btn[data-collection-product-id="'+pid+'"]').forEach(function(btn){
      setupCollectionDoubleQtyButton(btn);
    });
  }

async function handleDelegatedAddToCart(e){
  var btn = e.target.closest('[data-collection-add-to-cart], .collection-add-to-cart, .add-to-cart');
  if(!btn) return;
  if(!btn.closest('.sf__pcard')) return;              // rulează doar în cadrul cardurilor de produs

  e.preventDefault();
  if(addToCartLocks.has(btn) || btn.disabled || btn.getAttribute('aria-busy') === 'true') return;

  addToCartLocks.add(btn);
  btn.disabled = true;
  btn.setAttribute('aria-busy','true');

  var card = btn.closest('.sf__pcard') || btn.closest('[data-product-id],[data-collection-product-id]');
  if(!card){
    btn.removeAttribute('aria-busy');
    btn.disabled = false;
    addToCartLocks.delete(btn);
    return;
  }

  // găsește sau creează containerul .collection-pcard-error pentru acest card
  let errorEl = card.querySelector('.collection-pcard-error');
  const imageWrapper = card.querySelector('.sf__pcard-image') || card;
  if(!errorEl){
    errorEl = document.createElement('div');
    errorEl.className = 'collection-pcard-error';
    const span = document.createElement('span');
    span.className = 'collection-pcard-error__msg';
    errorEl.append(span);
  }
  if(errorEl.parentElement !== imageWrapper){
    imageWrapper.prepend(errorEl);
  }
  // reutilizează instanța CollectionPCardError dacă există pentru a evita timerele paralele
  const error = errorEl.__errorInstance || (errorEl.__errorInstance = new CollectionPCardError(errorEl));

  try{
    var info = getVisibleQty(card);
    var form = info.baseCard.querySelector('form.product-card-form, form[action*="/cart/add"]');
    if(!form) return;
    var idInput = form.querySelector('[name="id"]');
    var variantId = parseInt(idInput && idInput.value,10);
    if(!variantId) return;
    var qtyEl = info.qtyEl || form.querySelector('input[name="quantity"]');
    var requestedQty = info.val;
    if (qtyEl && parseInt(qtyEl.value, 10) === 0) {
      qtyEl.value = requestedQty;
      qtyEl.setAttribute('value', String(requestedQty));
      qtyEl.dispatchEvent(new Event('input', { bubbles: true }));
      qtyEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var maxQty = qtyEl && qtyEl.max ? parseInt(qtyEl.max,10) : Infinity;

    var cartQty = 0;
    try{
      var cart = await fetch('/cart.js').then(function(r){ return r.json(); });
      cartQty = cart.items?.find(function(it){ return it.variant_id === variantId; })?.quantity || 0;
    }catch(err){ cartQty = 0; }

    var available = Math.max(maxQty - cartQty, 0);
    var pid = (qtyEl && qtyEl.dataset.collectionProductId) || card.getAttribute('data-collection-product-id') || card.getAttribute('data-product-id');

    if(available <= 0){
      error.show(window.ConceptSGMStrings?.cartLimit || 'Cantitatea maxima pentru acest produs este deja in cos.');
      if(typeof window.applyCappedQtyState === 'function'){
        window.applyCappedQtyState({ dataset: { productId: pid } });
      }else if(qtyEl){
        applyCappedQtyState(qtyEl);
      }
      return;
    }

    var inSlider = qgIsSliderNode(btn || form || qtyEl);
    if (inSlider && qtyEl) {
      requestedQty = parseInt(qtyEl.value, 10);
      if (!isFinite(requestedQty) || requestedQty <= 0) requestedQty = 1;
    }

    const exceed = requestedQty > available;      // cerere > disponibil
    const resetQty = requestedQty >= available;   // cerere >= disponibil → vrem reset ca pe product page

    let sendQty = exceed ? available : requestedQty;

    if (inSlider && qtyEl) {
      qgSyncSliderQtyUI(qtyEl, sendQty);
      qtyEl.dispatchEvent(new Event('input', { bubbles: true }));
      qtyEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    var fd = new FormData(form);
    fd.set('quantity', String(sendQty));

    var res = await fetch('/cart/add.js', {
      method:'POST',
      headers:{ 'Accept':'application/json' },
      body: fd
    });
    var body;
    try{ body = await res.json(); }catch(parseErr){ body = {}; }
    if(!res.ok || body.status){
      var msg = body.description || body.message || body.errors || window.ConceptSGMStrings?.cartError || 'Error';
      if(typeof msg === 'object'){
        if(Array.isArray(msg)) msg = msg[0];
        else{
          var key = Object.keys(msg)[0];
          msg = Array.isArray(msg[key]) ? msg[key][0] : msg[key];
        }
      }
      if(!msg || typeof msg !== 'string' || /<\/?html/i.test(msg)){
        msg = window.ConceptSGMStrings?.cartError || 'Error';
      }
      error.show(msg);
      return;
    }

    window.ConceptSGMEvents?.emit('COLLECTION_ITEM_ADDED', body);
    window.Shopify?.onItemAdded?.(body);
    document.dispatchEvent(new CustomEvent('cart:updated', { detail:{ source:'collection-quick-add' } }));

    if (resetQty) {
      // încearcă să obții inputul vizibil din cardul curent
      const targetInput =
        (info && info.qtyEl) ||
        qtyEl ||
        form.querySelector('input[data-collection-quantity-input]');

      // reset la 0 + highlight roșu, ca pe pagina de produs, dar pentru colecții
      if (targetInput && typeof window.collectionApplyCappedQtyState === 'function') {
        window.collectionApplyCappedQtyState(targetInput);
      } else if (targetInput && typeof window.applyCappedQtyState === 'function') {
        window.applyCappedQtyState(targetInput);
      }

      // mesajul de limită doar dacă s-a depășit (nu și la egal cu disponibilul)
      if (exceed) {
        error.show(window.ConceptSGMStrings?.cartLimit || 'Cantitatea maxima pentru acest produs este deja in cos.');
      } else {
        error.hide();
      }
    } else {
      error.hide();
    }
  }catch(err){
    console.error('[quick-add] error:', err);
    var msg = err && (err.message || err.description || err.errors);
    if(typeof msg === 'object'){
      if(Array.isArray(msg)) msg = msg[0];
      else{
        var key = Object.keys(msg)[0];
        msg = Array.isArray(msg[key]) ? msg[key][0] : msg[key];
      }
    }
    if(!msg || typeof msg !== 'string' || /<\/?html/i.test(msg)){
      msg = window.ConceptSGMStrings?.cartError || 'Error';
    }
    error.show(msg);
  }finally{
    btn.removeAttribute('aria-busy');
    btn.disabled = false;
    addToCartLocks.delete(btn);
  }
}

  function handleDoubleQtyClick(e){
    var btn = e.target.closest('.collection-double-qty-btn');
    if(!btn) return;
    e.preventDefault();
    var card = btn.closest('[data-product-id],[data-collection-product-id]');
    if(card === btn){
      card = btn.parentElement && btn.parentElement.closest('[data-product-id],[data-collection-product-id]');
    }
    var pid = card && (card.getAttribute('data-product-id') || card.getAttribute('data-collection-product-id'));
    var dup = card && isDuplicateSlide(card);
    var realCard = dup ? findRealCardByPid(card, pid) : card;
    var qtyEl = findQtyEl(realCard);
    if(!qtyEl){
      qtyEl = findQtyInput(btn);
      if(!qtyEl) return;
    }
    var step = parseInt(qtyEl.getAttribute('data-collection-min-qty'),10) || parseInt(qtyEl.step,10) || 1;
    var max = qtyEl.max ? parseInt(qtyEl.max,10) : Infinity;
    var current = parseInt(qtyEl.value,10);
    if(isNaN(current)) current = 0;
    var newVal = current + step;
    if(newVal > max) newVal = max;
    qtyEl.value = newVal;
    validateAndHighlight(qtyEl);
    updateQtyButtonsState(qtyEl);
    qtyEl.dispatchEvent(new Event('input',{bubbles:true}));
    qtyEl.dispatchEvent(new Event('change',{bubbles:true}));
    updateCollectionDoubleQtyState(qtyEl);
    if(dup){
      var cloneQty = findQtyEl(card);
      if(cloneQty && cloneQty !== qtyEl){ cloneQty.value = newVal; }
    }
    clearTextSelection();
    btn.blur();
  }

  function handleDoubleQtyFocus(e){
    var btn = e.target.closest('.collection-double-qty-btn');
    if(btn) btn.classList.add('focus');
  }

  function handleDoubleQtyBlur(e){
    var btn = e.target.closest('.collection-double-qty-btn');
    if(btn) btn.classList.remove('focus');
  }
  function updateQtyGroupLayout(){
    document.querySelectorAll('.collection-qty-group').forEach(function(group){
      var input = group.querySelector('input[data-collection-quantity-input]');
      var btn = group.querySelector('.collection-double-qty-btn');
      var actions = group.closest('.collection-form__actions');
      if(!input || !btn){
        if(actions) actions.classList.remove('add-to-cart--compact');
        return;
      }
      var wrapped = btn.offsetTop > input.offsetTop;
      group.classList.toggle('is-wrapped', wrapped);
      if(actions) actions.classList.toggle('add-to-cart--compact', !wrapped);
    });
  }
  var qtyLayoutListenerBound = false;
  var qtyResizeObserver = window.ResizeObserver ? new ResizeObserver(updateQtyGroupLayout) : null;
  function watchQtyGroupLayout(){
    updateQtyGroupLayout();
    qgMarkListingReady(); // <- marchează containerul ca ready imediat după prima măsurare
    if(qtyLayoutListenerBound) return;
    qtyLayoutListenerBound = true;
    window.addEventListener('resize', updateQtyGroupLayout);
    window.addEventListener('load', function(){ updateQtyGroupLayout(); qgMarkListingReady(); });
    if(document.fonts && document.fonts.ready){
      document.fonts.ready.then(function(){ updateQtyGroupLayout(); qgMarkListingReady(); });
    }
    var container = document.querySelector('[data-product-container]');
    if(container && qtyResizeObserver){
      container.querySelectorAll('.collection-qty-group').forEach(function(group){
        qtyResizeObserver.observe(group);
      });
    }
    if(container && window.MutationObserver){
      var observer = new MutationObserver(function(mutations){
        updateQtyGroupLayout();
        qgMarkListingReady(); // în caz că primul paint se întâmplă după primul append
        mutations.forEach(function(m){
          m.addedNodes.forEach(function(node){
            if(!(node instanceof HTMLElement)) return;
            var root = node;
            setupCollectionDoubleQtyButtons(root);
            var inputs = [];
            if(root.matches && root.matches('input.collection-qty-element[data-collection-quantity-input]')){
              inputs.push(root);
            }
            root.querySelectorAll && root.querySelectorAll('input.collection-qty-element[data-collection-quantity-input]').forEach(function(inp){
              inputs.push(inp);
            });
            inputs.forEach(function(inp){
              if(qgIsSliderInput(inp)) qgEnforceSliderInput(inp);
            });
            if(qtyResizeObserver){
              var groups = [];
              if(root.matches && root.matches('.collection-qty-group')) groups.push(root);
              root.querySelectorAll && root.querySelectorAll('.collection-qty-group').forEach(function(g){ groups.push(g); });
              groups.forEach(function(g){ qtyResizeObserver.observe(g); });
            }
          });
        });
      });
      observer.observe(container, { childList:true, subtree:true });
    }
  }
  document.addEventListener('input', handleQtyInputEvent, true);
  document.addEventListener('change', handleQtyInputEvent, true);
  document.addEventListener('blur', handleQtyInputEvent, true);
  document.addEventListener('keypress', handleQtyKeypress, true);
  document.addEventListener('click', handleDelegatedAddToCart, true);
  document.addEventListener('click', handleDoubleQtyClick, true);
  document.addEventListener('focus', handleDoubleQtyFocus, true);
  document.addEventListener('blur', handleDoubleQtyBlur, true);

  function initAll(){
    applyMinQty();
    setupCollectionDoubleQtyButtons();
    attachQtyButtonListeners();
    attachNoHighlightListeners();
    watchQtyGroupLayout();
    // Dacă initAll rulează din alte evenimente (ex. shopify:section:load),
    // asigură-te că marcăm ready după prima măsurare:
    qgMarkListingReady();
  }
  document.addEventListener('DOMContentLoaded', initAll);
  window.addEventListener('shopify:section:load', initAll);
  window.addEventListener('shopify:cart:updated', initAll);
  window.addEventListener('shopify:product:updated', initAll);
  class CollectionProductForm extends HTMLElement{
    constructor(){
      super();
      this.form = this.querySelector('form');
      this.submitButton = this.querySelector('.collection-add-to-cart');
      this.idInput = this.form ? this.form.querySelector('[name="id"]') : null;
      if(this.idInput){ this.idInput.disabled = false; }
      // determină cardul de produs asociat
      const card = this.closest('.sf__pcard');

      // caută containerul de eroare
      let errorEl = card ? card.querySelector('.collection-pcard-error') : null;
      const imageWrapper = card && (card.querySelector('.sf__pcard-image') || card);

      // dacă nu există containerul de eroare, creează-l
      if(!errorEl && card){
        errorEl = document.createElement('div');
        errorEl.className = 'collection-pcard-error';
        const span = document.createElement('span');
        span.className = 'collection-pcard-error__msg';
        errorEl.append(span);
      }
      // atașează containerul la wrapperul de imagine (sau card) dacă este nevoie
      if(card && errorEl && imageWrapper && errorEl.parentElement !== imageWrapper){
        imageWrapper.prepend(errorEl);
      }

      // folosește elementul găsit sau creat când instanțiezi CollectionPCardError
      this.error = errorEl ? (errorEl.__errorInstance || (errorEl.__errorInstance = new CollectionPCardError(errorEl))) : new CollectionPCardError(null);
      this.addEventListener('submit', this.onSubmit.bind(this));
    }
    toggleSpinner(show){
      if(this.submitButton){
        this.submitButton.toggleAttribute('aria-busy', show);
        this.submitButton.disabled = show;
      }
      this.classList[show ? 'add' : 'remove']('adding');
    }
    async onSubmit(e){
      e.preventDefault();
      this.toggleSpinner(true);
      const formData = new FormData(this.form);
      const variantId = parseInt(formData.get('id'),10);
      if(!variantId){
        this.error.show(window.ConceptSGMStrings?.noVariant || 'Selecteaza o varianta');
        this.toggleSpinner(false);
        return;
      }
      const qtyInput = this.form.querySelector('input[name="quantity"]');
      const requestedQty = parseInt(formData.get('quantity')) || 1;
      const maxQty = parseInt(qtyInput?.max) || Infinity;
      let cartQty = 0;
      try{
        const cart = await fetch('/cart.js').then(r=>r.json());
        cartQty = cart.items?.find(it=>it.variant_id === variantId)?.quantity || 0;
      }catch(err){ cartQty = 0; }
      const available = Math.max(maxQty - cartQty,0);
      let resetQty = false;
      let sendQty = requestedQty;
      if(available <= 0){
        this.error.show(window.ConceptSGMStrings?.cartLimit || 'Cantitatea maxima pentru acest produs este deja in cos.');
        this.toggleSpinner(false);
        return;
      }

      var inSlider = qgIsSliderNode(this.form || qtyInput);
      if (inSlider && qtyInput) {
        let requested = parseInt(qtyInput.value, 10);
        if (!isFinite(requested) || requested <= 0) requested = 1;
        sendQty = requested > available ? available : requested;
        if (requested > available) {
          this.error.show(window.ConceptSGMStrings?.cartLimit || 'Cantitatea maxima pentru acest produs este deja in cos.');
          resetQty = true;
        } else {
          resetQty = sendQty >= available;
        }
        formData.set('quantity', String(sendQty));
      } else {
        if(requestedQty >= available){
          if(requestedQty > available){
            sendQty = available;
            this.error.show(window.ConceptSGMStrings?.cartLimit || 'Cantitatea maxima pentru acest produs este deja in cos.');
          } else {
            sendQty = available;
          }
          resetQty = true;
        }
        formData.set('quantity', String(sendQty));
      }
      if (inSlider && qtyInput) {
        qgSyncSliderQtyUI(qtyInput, sendQty);
        qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
        qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const config = {
        method:'POST',
        headers:{Accept:'application/javascript','X-Requested-With':'XMLHttpRequest'},
        body: formData
      };
      const settings = window.ConceptSGMSettings || {};
        fetch(`${settings.routes?.cart_add_url || '/cart/add'}`, config)
          .then(async r => {
            let body;
            try{
              const ct = r.headers.get('content-type');
              if(ct && ct.includes('application/json')){
                body = await r.json();
              }else{
                const text = await r.text();
                body = { message: text };
              }
            }catch(parseErr){
              body = {};
            }
            return { statusCode: r.status, statusText: r.statusText, body };
          })
          .then(({ statusCode, statusText, body }) => {
            if(statusCode >= 400 || body.status){
              let msg = body.description || body.message || statusText;
              if(msg && typeof msg === 'string' && /<\/?html/i.test(msg)){
                msg = window.ConceptSGMStrings?.cartError || 'Error';
              }
              const errData = body.errors;
              if(!msg && errData){
                if(typeof errData === 'string') msg = errData;
                else if(Array.isArray(errData)) msg = errData[0];
                else if(typeof errData === 'object'){
                  const key = Object.keys(errData)[0];
                  msg = Array.isArray(errData[key]) ? errData[key][0] : errData[key];
                }
              }
              if(statusCode === 429){
                msg = 'Ati trimis prea multe cereri. Va rugam sa incercati din nou mai tarziu.';
              }
              this.error.show(msg);
            }else{
              window.ConceptSGMEvents?.emit('COLLECTION_ITEM_ADDED', body);
              window.Shopify?.onItemAdded?.(body);
              if(resetQty){
                const pid = this.dataset.collectionProductId;
                if(typeof window.applyCappedQtyState === 'function'){
                  window.applyCappedQtyState({ dataset: { productId: pid } });
                } else if(qtyInput){
                  applyCappedQtyState(qtyInput);
                }
              }
              this.error.hide();
            }
          })
          .catch(err => {
            let msg = err && err.message || '';
            if(!msg || /<\/?html/i.test(msg)){
              msg = window.ConceptSGMStrings?.cartError || 'Error';
            }
            this.error.show(msg);
          })
          .finally(()=>{ this.toggleSpinner(false); });
    }
  }
  if(!customElements.get('collection-product-form')){
    customElements.define('collection-product-form', CollectionProductForm);
  }
})();

