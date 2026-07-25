$(()=> {
  var blocks = document.querySelectorAll("pre code");
  if (window.hljs) {
    if (typeof hljs.highlightElement === 'function') {
      blocks.forEach(function(block){ hljs.highlightElement(block); });
    } else if (typeof hljs.highlightBlock === 'function') {
      blocks.forEach(function(block){ hljs.highlightBlock(block); });
    }
  }
});