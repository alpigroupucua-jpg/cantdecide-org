(function initializeSite() {
  "use strict";

  function updatePage() {
    document.querySelectorAll("[data-current-year]").forEach(function setYear(element) {
      element.textContent = new Date().getFullYear();
    });

    const decisionAnswer = document.querySelector("#decision-answer");
    if (decisionAnswer && window.cantDecideResult) {
      decisionAnswer.textContent = window.cantDecideResult;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updatePage, { once: true });
  } else {
    updatePage();
  }
})();
