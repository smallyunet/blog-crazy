/*
  Dependency-free lightbox for post images
  - Click an article image to open original in overlay
  - ESC or click on overlay to close
  - Opt-out: add class="no-lightbox" or data-no-lightbox to the image or its parent link
  - Works with images wrapped in <a> (prefers href as the large source)
*/
(function(){
  function ready(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
  }

  ready(function(){
    // Create overlay once
    var overlay = document.createElement('div');
    overlay.className = 'lb-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = '<img alt="" />';
    overlay.style.display = 'none';
    var imgEl = overlay.querySelector('img');
    document.body.appendChild(overlay);

    function open(src, alt){
      if (!src) return;
      imgEl.src = src;
      if (alt) imgEl.alt = alt;
    overlay.classList.add('open');
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
      // prevent background scroll
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
    function close(){
    overlay.classList.remove('open');
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
      imgEl.src = '';
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }

    overlay.addEventListener('click', function(e){
      // clicking anywhere closes
      e.preventDefault();
      close();
    });

    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });

    function shouldSkip(node){
      if (!node) return true;
      if (node.classList && (node.classList.contains('no-lightbox'))) return true;
      if (node.hasAttribute && (node.hasAttribute('data-no-lightbox'))) return true;
      return false;
    }

    // Delegate: images inside post content
    document.body.addEventListener('click', function(e){
      var target = e.target;
      if (!target || target.tagName !== 'IMG') return;

      // Only within main content; avoid navbar/logo/etc.
      // Accept images inside typical content containers used by theme:
      // - .inner / .inner-narrow (post pages)
      // - .outer (homepage and some page layouts)
      var inPost = false;
      var p = target;
      while (p && p !== document.body){
        if (p.classList && (
          p.classList.contains('inner') ||
          p.classList.contains('inner-narrow') ||
          p.classList.contains('outer')
        )) { inPost = true; break; }
        p = p.parentNode;
      }
      if (!inPost) return;

      // Opt-out
      if (shouldSkip(target) || shouldSkip(target.parentNode)) return;

      // Prevent default if image is wrapped by link
      var src = target.currentSrc || target.src;
      var alt = target.alt || '';
      var anchor = target.closest && target.closest('a');
      if (anchor && anchor.getAttribute('href')) {
        // Only open lightbox for image links or when href is probably an image
        var href = anchor.getAttribute('href');
        var isImg = /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(href);
        if (isImg) src = href;
        e.preventDefault();
      }

      open(src, alt);
    }, false);
  });
})();
