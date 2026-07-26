(function chooseDecision() {
  "use strict";

  // Choose once, before the page is painted, so the colour theme matches the result.
  let isYes;

  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    const randomByte = new Uint8Array(1);
    window.crypto.getRandomValues(randomByte);
    isYes = randomByte[0] % 2 === 0;
  } else {
    // Older browsers still receive an evenly distributed fallback.
    isYes = Math.random() < 0.5;
  }

  window.cantDecideResult = isYes ? "YES" : "NO";
  document.documentElement.dataset.decision = isYes ? "yes" : "no";
})();
