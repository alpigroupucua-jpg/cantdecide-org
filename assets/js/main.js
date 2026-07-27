document.documentElement.classList.add("js");

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

    const menuToggle = document.querySelector(".menu-toggle");
    const siteNavigation = document.querySelector(".site-nav");

    if (menuToggle && siteNavigation) {
      const menuLabel = menuToggle.querySelector(".menu-toggle-label");

      function setMenuState(isOpen) {
        menuToggle.setAttribute("aria-expanded", String(isOpen));
        siteNavigation.classList.toggle("is-open", isOpen);
        if (menuLabel) {
          menuLabel.textContent = isOpen ? "Close" : "Menu";
        }
      }

      menuToggle.addEventListener("click", function toggleMenu() {
        setMenuState(menuToggle.getAttribute("aria-expanded") !== "true");
      });

      menuToggle.addEventListener("keydown", function toggleMenuWithKeyboard(event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setMenuState(menuToggle.getAttribute("aria-expanded") !== "true");
        }
      });

      siteNavigation.addEventListener("click", function closeAfterNavigation(event) {
        if (event.target.closest("a")) {
          setMenuState(false);
        }
      });

      document.addEventListener("keydown", function closeWithEscape(event) {
        if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
          setMenuState(false);
          menuToggle.focus();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updatePage, { once: true });
  } else {
    updatePage();
  }
})();
