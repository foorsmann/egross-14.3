// double-qty.js - Doar funcționalitate, fără injectare buton
// Autor: Saga Media / Egross
// Asigură funcționalitatea butonului care adaugă cantitatea minimă (pasul minim) pe orice element cu clasa .double-qty-btn existent în pagină

(function(){
  // Funcție comună pentru validare și highlight roșu la atingerea stocului
  function snapDown(val, step, min){
    if(!isFinite(val)) return min;
    if(val < min) return min;
    return Math.floor((val - min) / step) * step + min;
  }

  function clampAndSnap(val, step, min, max, snap){
    val = Math.min(val, max);
    if(val < min) val = min;
    if(snap && val !== max){
      val = snapDown(val, step, min);
    }
    return val;
  }

  // ---- Slider Qty Guard (context-aware) ----
  const QG_SLIDER_TYPES = new Set([
    'recently-viewed',
    'product-recommendations',
    'foxkit-related-products',
    'featured-collection',
    'product-tabs'
  ]);

  function qgIsSliderInput(input) {
    const sec = input && input.closest('[data-section-type]');
    if (!sec) return false;
    return QG_SLIDER_TYPES.has(sec.getAttribute('data-section-type'));
  }

  function qgEnforceSliderInput(input) {
    if (!input || !qgIsSliderInput(input)) return false;

    const step = parseInt(input.getAttribute('data-min-qty') || input.getAttribute('step') || '1', 10) || 1;
    const max  = parseInt(input.getAttribute('max') || '0', 10) || 0;

    const display = (max > 0 && max < step) ? max : step;

    input.min = String(display);
    input.setAttribute('min', String(display));
    input.step = String(step);
    input.setAttribute('step', String(step));
    input.value = String(display);
    input.setAttribute('value', String(display));

    const isLow = (max > 0 && max < step);
    const highlight = (max > 0 && display >= max);
    input.classList.toggle('is-low-stock', isLow);
    input.classList.toggle('text-red-600', highlight);
    if (highlight) {
      input.style.setProperty('color', '#e3342f', 'important');
    } else {
      input.style.removeProperty('color');
    }

    const card = input.closest('.sf__pcard, .p-card, .product-card, .sf__col-item, [data-product-id], .swiper-slide') || document;
    const dbl  = card.querySelector('[data-collection-double-qty], .collection-double-qty-btn, .double-qty-btn');
    if (dbl) {
      const disabled = !(max >= step);
      if (disabled) {
        dbl.setAttribute('disabled', 'true');
        dbl.setAttribute('aria-disabled', 'true');
        dbl.classList.add('is-disabled');
      } else {
        dbl.removeAttribute('disabled');
        dbl.removeAttribute('aria-disabled');
        dbl.classList.remove('is-disabled');
      }
    }

    input.setAttribute('data-qg-fixed', '1');
    return true;
  }

  function validateAndHighlightQty(input){
    if(qgIsSliderInput(input)){
      return;
    }
    // allow user to temporarily clear the field without forcing it back to 1
    if(input.value === ''){
      input.classList.remove('text-red-600');
      input.style.color = '';
      return;
    }
    var min = input.min ? parseInt(input.min,10) : 1;
    var step = parseInt(input.getAttribute('data-min-qty'), 10) || parseInt(input.step,10) || 1;
    var max = input.max ? parseInt(input.max, 10) : Infinity;
    var val = parseInt(input.value, 10);
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

  // Actualizează starea butoanelor +/- în funcţie de valoarea curentă
  function updateQtyButtonsState(input){
    var container = input.closest('.quantity-input') || input.parentNode;
    if(!container) return;
    var plus = container.querySelector('[data-quantity-selector="increase"],[data-qty-change="inc"]');
    var minus = container.querySelector('[data-quantity-selector="decrease"],[data-qty-change="dec"]');

    var max = input.max ? parseInt(input.max, 10) : Infinity;
    var step = parseInt(input.getAttribute('data-min-qty'), 10) || parseInt(input.step,10) || 1;
    var minQty = step;
    var val = parseInt(input.value, 10);
    if(isNaN(val)) val = 0; // treat empty input as 0 so minus stays disabled

    if(plus) plus.disabled = isFinite(max) && val >= max;
    if(minus){
      // minus devine inactiv când valoarea curentă este sub sau egală cu minQty
      // adaugă verificarea pentru input manual mai mic decât min_qty
      minus.disabled = val <= minQty;
    }
  }

  // păstrăm pentru compatibilitate cu codul existent
  var updateIncreaseBtnState = updateQtyButtonsState;

  window.validateAndHighlightQty = validateAndHighlightQty;
  // expunem helperii pentru a putea fi folosiți și în cart/drawer
  window.updateQtyButtonsState = updateQtyButtonsState;
  window.adjustQuantityHelper = adjustQuantity;

var BUTTON_CLASS = 'double-qty-btn';


  function applyMinQty(){
    document.querySelectorAll('[data-min-qty]').forEach(function(input){
      if (qgEnforceSliderInput(input)) return;
      var min = parseInt(input.getAttribute('data-min-qty'), 10);
      if(min && min > 0){
        input.min = 1; // allow manual quantities below min_qty everywhere
        input.step = min;
        // nu forţăm valoarea dacă este sub min_qty; doar actualizăm starea butoanelor
        validateAndHighlightQty(input);
        updateQtyButtonsState(input);
      }
    });
  }

  function syncOtherQtyInputs(changedInput){
    if(qgIsSliderInput(changedInput)) return;
    var productId = changedInput.dataset.productId;
    if(!productId) return;
    var value = changedInput.value;
    document.querySelectorAll('input[data-product-id="' + productId + '"][data-quantity-input]').forEach(function(input){
      if(input === changedInput) return;
      if(input.value !== value){
        input.value = value;
        validateAndHighlightQty(input);
        updateQtyButtonsState(input);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function applyCappedQtyState(sourceInput){
    var productId = sourceInput.dataset.productId;
    if(!productId) return;
    var inputs = document.querySelectorAll('input[data-product-id="' + productId + '"][data-quantity-input]');
    inputs.forEach(function(input){
      input.dataset.prevMin = input.min;
      var prevAttr = input.getAttribute('data-min-qty');
      if(prevAttr !== null) {
        input.dataset.prevMinQtyAttr = prevAttr;
      }
      input.removeAttribute('data-min-qty');
      input.min = 0;
      input.value = 0;
      input.classList.add('text-red-600');
      input.style.color = '#e3342f';
      if(typeof updateQtyButtonsState === 'function'){
        updateQtyButtonsState(input);
      }
      setTimeout(function(){
        input.value = 0;
        if(typeof updateQtyButtonsState === 'function'){
          updateQtyButtonsState(input);
        }
      },0);
      var clearWarning = function(){
        input.classList.remove('text-red-600');
        input.style.color = '';
        if(input.dataset.prevMin){
          input.min = input.dataset.prevMin;
          delete input.dataset.prevMin;
        }
        if(input.dataset.prevMinQtyAttr !== undefined){
          input.setAttribute('data-min-qty', input.dataset.prevMinQtyAttr);
          delete input.dataset.prevMinQtyAttr;
        }
        input.removeEventListener('input', clearWarning);
        input.removeEventListener('change', clearWarning);
        if(typeof window.syncOtherQtyInputs === 'function'){
          window.syncOtherQtyInputs(input);
        }
      };
      input.addEventListener('input', clearWarning, { once: true });
      input.addEventListener('change', clearWarning, { once: true });
    });
    if(typeof window.collectionApplyCappedQtyState === 'function'){
      var cInput = document.querySelector('input[data-collection-product-id="' + productId + '"][data-collection-quantity-input]');
      if(cInput){ window.collectionApplyCappedQtyState(cInput); }
    }
  }

  window.syncOtherQtyInputs = syncOtherQtyInputs;
  window.applyCappedQtyState = applyCappedQtyState;

    function handleQtyInputEvent(e){
      var input = e.target.closest('.quantity-input__element, .scd-item__qty_input, input[data-quantity-input]');
      if(!input) return;
      validateAndHighlightQty(input);
      updateQtyButtonsState(input);
      syncOtherQtyInputs(input);
      updateDoubleQtyState(input);
    }

    function handleQtyKeypress(e){
      if(e.key !== 'Enter') return;
      var input = e.target.closest('.quantity-input__element, .scd-item__qty_input, input[data-quantity-input]');
      if(!input) return;
      validateAndHighlightQty(input);
      updateQtyButtonsState(input);
      syncOtherQtyInputs(input);
      updateDoubleQtyState(input);
    }

  // Nu validăm logică pentru cart/drawer (lăsăm tema să o gestioneze separat!)
  var qtyBtnListenerAdded = false;
  function attachQtyButtonListeners(){
    if(qtyBtnListenerAdded) return;
    qtyBtnListenerAdded = true;
    document.addEventListener('click', function(e){
      var btn = e.target.closest('[data-quantity-selector],[data-qty-change]');
      if(!btn) return;

      // Nu interferăm cu butoanele din cart/drawer – tema le gestionează!
      if(btn.closest('.scd-item') || btn.closest('[data-cart-item]')) return;

      var container = btn.closest('.quantity-input') || btn.parentNode;
      var input = container.querySelector('input[type="number"]');
      if(input){
        var before = input.value;
        setTimeout(function(){
          var action = btn.getAttribute('data-quantity-selector') || btn.getAttribute('data-qty-change');
          if(action === 'increase' || action === 'inc'){
            adjustQuantity(input, 1, before);
          }else if(action === 'decrease' || action === 'dec'){
            adjustQuantity(input, -1, before);
          }else{
            validateAndHighlightQty(input);
            updateQtyButtonsState(input);
          }
        }, 0);
      }
    }, true);
  }

  function adjustQuantity(input, delta, baseVal){
    var step = parseInt(input.getAttribute('data-min-qty'), 10) || 1;
    var max = input.max ? parseInt(input.max, 10) : Infinity;
    var minQty = step; // valoarea minimă configurată
    var val = baseVal !== undefined ? parseInt(baseVal,10) : parseInt(input.value, 10);
    if(isNaN(val)) val = 1;

    // Dacă suntem la maxim, doar validează și colorează
    if(delta > 0 && isFinite(max) && val >= max){
      validateAndHighlightQty(input);
      updateQtyButtonsState(input);
      return;
    }

    if(delta < 0){
      // Snap la multiplu inferior plecând de la minQty
      if((val - minQty) % step !== 0){
        val = Math.floor((val - minQty) / step) * step + minQty;
      }else{
        val -= step;
      }
      if(val < minQty) val = minQty;
    }else{
      // Snap la multiplu superior plecând de la minQty
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
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    updateQtyButtonsState(input);
  }

    function findQtyInput(btn){
      var container = btn.closest('.quantity-input');
      if(container){
        var input = container.querySelector('input[type="number"]');
        if(input) return input;
      }
      var pid = btn.getAttribute('data-product-id');
      if(pid){
        return document.querySelector('input[data-product-id="'+pid+'"][data-quantity-input]');
      }
      return null;
    }

    function setupDoubleQtyButton(btn){
      if (btn.hasAttribute('data-collection-double-qty') || btn.classList.contains('collection-double-qty-btn')) return;
      var input = findQtyInput(btn);
      if(!input) return;
      var storedMin = parseInt(btn.getAttribute('data-original-min-qty'), 10);
      var min = isNaN(storedMin) ? (parseInt(input.getAttribute('data-min-qty'), 10) || 1) : storedMin;
      if(isNaN(storedMin)){
        btn.setAttribute('data-original-min-qty', min);
      }
      var template = btn.getAttribute('data-label-template') || btn.textContent;
      var label = template.replace('{min_qty}', min);
      btn.setAttribute('aria-label', label);
      btn.textContent = label;
      var max = input.max ? parseInt(input.max, 10) : 9999;
      var val = parseInt(input.value, 10) || 1;
      btn.disabled = val >= max;
    }

    function setupDoubleQtyButtons(){
      document.querySelectorAll('.' + BUTTON_CLASS).forEach(setupDoubleQtyButton);
    }

    function updateDoubleQtyState(input){
      var pid = input.dataset.productId;
      if(!pid) return;
      document.querySelectorAll('.' + BUTTON_CLASS + '[data-product-id="'+pid+'"]').forEach(function(btn){
        setupDoubleQtyButton(btn);
      });
    }

    function handleDoubleQtyClick(e){
      var btn = e.target.closest('.' + BUTTON_CLASS);
      if(!btn || btn.hasAttribute('data-collection-double-qty') || btn.classList.contains('collection-double-qty-btn')) return;
      e.preventDefault();
      var input = findQtyInput(btn);
      if(!input) return;
      var step = parseInt(input.getAttribute('data-min-qty'), 10) || parseInt(input.step,10) || 1;
      var max = input.max ? parseInt(input.max, 10) : Infinity;
      var current = parseInt(input.value, 10);
      if(isNaN(current)) current = 0;
      var newVal = current + step;
      if(newVal > max) newVal = max;
      input.value = newVal;
      validateAndHighlightQty(input);
      updateQtyButtonsState(input);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      updateDoubleQtyState(input);
    }

    function handleDoubleQtyFocus(e){
      var btn = e.target.closest('.' + BUTTON_CLASS);
      if(btn) btn.classList.add('focus');
    }

    function handleDoubleQtyBlur(e){
      var btn = e.target.closest('.' + BUTTON_CLASS);
      if(btn) btn.classList.remove('focus');
    }

    document.addEventListener('input', handleQtyInputEvent, true);
    document.addEventListener('change', handleQtyInputEvent, true);
    document.addEventListener('blur', handleQtyInputEvent, true);
    document.addEventListener('keypress', handleQtyKeypress, true);
    document.addEventListener('click', handleDoubleQtyClick, true);
    document.addEventListener('focus', handleDoubleQtyFocus, true);
    document.addEventListener('blur', handleDoubleQtyBlur, true);

    function initAll(){
      applyMinQty();
      setupDoubleQtyButtons();
      attachQtyButtonListeners();
    }
    document.addEventListener('DOMContentLoaded', initAll);
    window.addEventListener('shopify:section:load', initAll);
    window.addEventListener('shopify:cart:updated', initAll);
    window.addEventListener('shopify:product:updated', initAll);

    window.doubleQtyInit = setupDoubleQtyButtons;
  })();








