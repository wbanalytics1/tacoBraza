(function () {
  "use strict";

  const STORAGE_KEY = "tacoBrazaInterest";
  const COOKIE_NAME = "tacoBrazaVisitor";
  const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

  const elements = {
    form: document.querySelector("#interestForm"),
    nameInput: document.querySelector("#visitorName"),
    emailInput: document.querySelector("#visitorEmail"),
    formMessage: document.querySelector("#formMessage"),
    returningMessage: document.querySelector("#returningMessage"),
    previewMenuTrigger: document.querySelector("#previewMenuLink"),
    modal: document.querySelector("#menuModal"),
    modalContent: document.querySelector("#menuContent"),
    modalCloseButton: document.querySelector("#menuModalClose"),
    video: document.querySelector("#heroVideo")
  };

  let lastMenuTrigger = null;
  let hasLoadedMenu = false;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    hydrateReturningVisitor();
    setupForm();
    setupPreviewMenu();
    setupVideoFallback();
  }

  // Keep storage access safe for private browsing modes and restrictive browsers.
  function readSavedInterest() {
    try {
      const savedValue = window.localStorage.getItem(STORAGE_KEY);
      return savedValue ? JSON.parse(savedValue) : null;
    } catch (error) {
      return null;
    }
  }

  function saveInterest(visitor) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visitor));
      return true;
    } catch (error) {
      return false;
    }
  }

  function hasVisitorCookie() {
    return document.cookie
      .split(";")
      .map((cookie) => cookie.trim())
      .some((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
  }

  function setVisitorCookie() {
    const pagePath = window.location.pathname.replace(/\/[^/]*$/, "/") || "/";
    document.cookie = `${COOKIE_NAME}=1; max-age=${VISITOR_COOKIE_MAX_AGE}; path=${pagePath}; SameSite=Lax`;
  }

  function hydrateReturningVisitor() {
    const savedInterest = readSavedInterest();
    const isReturningVisitor = hasVisitorCookie();

    if (savedInterest) {
      elements.nameInput.value = savedInterest.name || "";
      elements.emailInput.value = savedInterest.email || "";
    }

    if (isReturningVisitor && elements.returningMessage) {
      const savedName = savedInterest && savedInterest.name ? savedInterest.name.split(" ")[0] : "";
      elements.returningMessage.textContent = savedName
        ? `Welcome back, ${savedName} — you’re on the launch list.`
        : "Welcome back — the fire’s still warming up.";
      elements.returningMessage.hidden = false;
    }

    if (!isReturningVisitor) {
      setVisitorCookie();
    }
  }

  function setupForm() {
    if (!elements.form) {
      return;
    }

    [elements.nameInput, elements.emailInput].forEach((input) => {
      input.addEventListener("input", () => {
        input.setAttribute("aria-invalid", "false");
        input.setCustomValidity("");
      });
    });

    elements.form.addEventListener("submit", handleFormSubmit);
  }

  function validateForm() {
    const name = elements.nameInput.value.trim();
    const email = elements.emailInput.value.trim();
    let message = "";
    let firstInvalidField = null;

    elements.nameInput.value = name;
    elements.emailInput.value = email;
    elements.nameInput.setCustomValidity("");
    elements.emailInput.setCustomValidity("");
    elements.nameInput.setAttribute("aria-invalid", "false");
    elements.emailInput.setAttribute("aria-invalid", "false");

    if (name.length < 2) {
      message = "Please enter your name using at least 2 characters.";
      firstInvalidField = elements.nameInput;
      elements.nameInput.setCustomValidity(message);
    } else if (!email) {
      message = "Please enter your email address.";
      firstInvalidField = elements.emailInput;
      elements.emailInput.setCustomValidity(message);
    } else if (!elements.emailInput.validity.valid) {
      message = "Please enter a valid email address, like name@example.com.";
      firstInvalidField = elements.emailInput;
      elements.emailInput.setCustomValidity(message);
    } else if (!elements.form.checkValidity()) {
      message = "Please review the highlighted fields and try again.";
      firstInvalidField = elements.form.querySelector(":invalid");
    }

    if (firstInvalidField) {
      firstInvalidField.setAttribute("aria-invalid", "true");
      return { isValid: false, message, firstInvalidField };
    }

    return { isValid: true, name, email };
  }

  function handleFormSubmit(event) {
    event.preventDefault();

    const validation = validateForm();
    if (!validation.isValid) {
      setFormMessage(validation.message, true);
      validation.firstInvalidField.focus();
      validation.firstInvalidField.reportValidity();
      return;
    }

    const visitor = {
      name: validation.name,
      email: validation.email,
      submittedAt: new Date().toISOString()
    };

    const saved = saveInterest(visitor);
    setVisitorCookie();
    elements.returningMessage.textContent = `Welcome back, ${visitor.name.split(" ")[0]} — you’re on the launch list.`;
    elements.returningMessage.hidden = false;

    if (saved) {
      setFormMessage("You’re on the launch list. We’ll send the first taste when the grill is ready.", false);
    } else {
      setFormMessage("You’re in for this session. Your browser did not allow saving the confirmation locally.", false);
    }
  }

  function setFormMessage(message, isError) {
    elements.formMessage.textContent = message;
    elements.formMessage.classList.toggle("is-error", Boolean(isError));
  }

  function setupPreviewMenu() {
    if (!elements.previewMenuTrigger || !elements.modal) {
      return;
    }

    elements.previewMenuTrigger.addEventListener("click", handlePreviewMenuClick);
    elements.modalCloseButton.addEventListener("click", closeMenuModal);
    elements.modal.addEventListener("click", handleModalBackdropClick);
    elements.modal.addEventListener("close", restoreMenuTriggerFocus);
  }

  async function handlePreviewMenuClick(event) {
    event.preventDefault();
    lastMenuTrigger = event.currentTarget;
    openMenuModal();

    if (!hasLoadedMenu) {
      await loadPreviewMenu();
    }
  }

  function openMenuModal() {
    if (typeof elements.modal.showModal === "function") {
      elements.modal.showModal();
    } else {
      elements.modal.setAttribute("open", "");
    }

    elements.modalCloseButton.focus();
  }

  function closeMenuModal() {
    if (typeof elements.modal.close === "function") {
      elements.modal.close();
    } else {
      elements.modal.removeAttribute("open");
      restoreMenuTriggerFocus();
    }
  }

  function restoreMenuTriggerFocus() {
    if (lastMenuTrigger) {
      lastMenuTrigger.focus();
    }
  }

  function handleModalBackdropClick(event) {
    const modalBox = elements.modal.querySelector(".menu-modal__inner");
    if (!modalBox) {
      return;
    }

    const box = modalBox.getBoundingClientRect();
    const clickedBackdrop = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;

    if (clickedBackdrop) {
      closeMenuModal();
    }
  }

  async function loadPreviewMenu() {
    renderMenuStatus("Warming up the grill and loading the preview menu…");

    try {
      const response = await fetch(elements.previewMenuTrigger.getAttribute("href"), { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Menu request failed with status ${response.status}`);
      }

      const menu = await response.json();
      renderMenu(menu);
      hasLoadedMenu = true;
    } catch (error) {
      renderMenuError();
    }
  }

  function renderMenuStatus(message) {
    elements.modalContent.innerHTML = `<p class="menu-status">${escapeHtml(message)}</p>`;
  }

  function renderMenuError() {
    elements.modalContent.innerHTML = `
      <div class="menu-status" role="status">
        <p>The preview menu could not load right now, but the launch list is still open.</p>
        <p>Please try again in a moment or open the JSON preview directly when hosting allows file requests.</p>
      </div>
    `;
  }

  function renderMenu(menu) {
    const sectionsMarkup = menu.sections.map((section) => {
      const descriptionMarkup = section.description ? `<p>${escapeHtml(section.description)}</p>` : "";
      const itemsMarkup = section.items.map((item) => {
        const detailMarkup = Array.isArray(item.details) && item.details.length
          ? `<ul>${item.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>`
          : "";
        const priceMarkup = escapeHtml(item.price).replace(/\n/g, "<br>");

        return `
          <article class="menu-item">
            <div class="menu-item__top">
              <h4>${escapeHtml(item.name)}</h4>
              <p class="price">${priceMarkup}</p>
            </div>
            <p>${escapeHtml(item.description)}</p>
            ${detailMarkup}
          </article>
        `;
      }).join("");

      return `
        <section class="menu-category" aria-labelledby="${slugify(section.name)}">
          <div class="menu-category__header">
            <h3 id="${slugify(section.name)}">${escapeHtml(section.name)}</h3>
            ${descriptionMarkup}
          </div>
          ${itemsMarkup}
        </section>
      `;
    }).join("");

    elements.modalContent.innerHTML = `
      <div class="menu-status">
        <strong>${escapeHtml(menu.title)}</strong><br>
        ${escapeHtml(menu.subtitle)}
      </div>
      ${sectionsMarkup}
    `;
  }

  function slugify(value) {
    return `menu-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setupVideoFallback() {
    if (!elements.video) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      hideVideo();
      return;
    }

    elements.video.addEventListener("error", hideVideo);
    elements.video.addEventListener("stalled", hideVideo);

    const playAttempt = elements.video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(hideVideo);
    }
  }

  function hideVideo() {
    elements.video.classList.add("is-hidden");
  }
})();
