(function () {
  "use strict";

  const STORAGE_KEY = "tacoBrazaInterest";
  const COOKIE_NAME = "tacoBrazaVisitor";
  const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

  const dom = {
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

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    HeroMedia.init(dom.video);
    LaunchList.init({
      form: dom.form,
      nameInput: dom.nameInput,
      emailInput: dom.emailInput,
      formMessage: dom.formMessage,
      returningMessage: dom.returningMessage
    });
    PreviewMenu.init({
      trigger: dom.previewMenuTrigger,
      modal: dom.modal,
      content: dom.modalContent,
      closeButton: dom.modalCloseButton
    });
  }

  const SafeStorage = {
    read(key) {
      try {
        const value = window.localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        return null;
      }
    },

    write(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        return false;
      }
    }
  };

  const VisitorCookie = {
    has() {
      return document.cookie
        .split(";")
        .map((cookie) => cookie.trim())
        .some((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
    },

    set() {
      const pagePath = window.location.pathname.replace(/\/[^/]*$/, "/") || "/";
      document.cookie = `${COOKIE_NAME}=1; max-age=${VISITOR_COOKIE_MAX_AGE}; path=${pagePath}; SameSite=Lax`;
    }
  };

  const HeroMedia = {
    init(video) {
      if (!video) {
        return;
      }

      const media = video.closest(".hero__media");
      const motionPreference = window.matchMedia(REDUCED_MOTION_QUERY);

      video.addEventListener("playing", () => this.showVideo(video, media));
      video.addEventListener("error", () => this.showPoster(video, media));
      video.addEventListener("abort", () => this.showPoster(video, media));
      video.addEventListener("emptied", () => this.showPoster(video, media));

      if (typeof motionPreference.addEventListener === "function") {
        motionPreference.addEventListener("change", (event) => {
          if (event.matches) {
            video.pause();
            this.showPoster(video, media);
          } else {
            this.tryPlay(video, media);
          }
        });
      }

      if (motionPreference.matches) {
        this.showPoster(video, media);
        return;
      }

      this.tryPlay(video, media);
    },

    tryPlay(video, media) {
      video.classList.remove("is-hidden");
      const playAttempt = video.play();

      if (playAttempt && typeof playAttempt.then === "function") {
        playAttempt
          .then(() => {
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !video.paused) {
              this.showVideo(video, media);
            }
          })
          .catch(() => this.showPoster(video, media));
      } else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !video.paused) {
        this.showVideo(video, media);
      }
    },

    showVideo(video, media) {
      video.classList.remove("is-hidden");
      if (media) {
        media.classList.add("is-playing");
      }
    },

    showPoster(video, media) {
      video.classList.add("is-hidden");
      if (media) {
        media.classList.remove("is-playing");
      }
    }
  };

  const LaunchList = {
    init(elements) {
      this.elements = elements;

      if (!this.hasRequiredElements()) {
        return;
      }

      this.hydrateReturningVisitor();
      [this.elements.nameInput, this.elements.emailInput].forEach((input) => {
        input.addEventListener("input", () => this.clearFieldError(input));
      });
      this.elements.form.addEventListener("submit", (event) => this.handleSubmit(event));
    },

    hasRequiredElements() {
      const { form, nameInput, emailInput, formMessage, returningMessage } = this.elements;
      return Boolean(form && nameInput && emailInput && formMessage && returningMessage);
    },

    hydrateReturningVisitor() {
      const savedInterest = SafeStorage.read(STORAGE_KEY);
      const isReturningVisitor = VisitorCookie.has();

      if (savedInterest) {
        this.elements.nameInput.value = savedInterest.name || "";
        this.elements.emailInput.value = savedInterest.email || "";
      }

      if (isReturningVisitor) {
        const savedName = savedInterest && savedInterest.name ? savedInterest.name.split(" ")[0] : "";
        this.elements.returningMessage.textContent = savedName
          ? `Welcome back, ${savedName} — you’re on the launch list.`
          : "Welcome back — the fire’s still warming up.";
        this.elements.returningMessage.hidden = false;
      } else {
        VisitorCookie.set();
      }
    },

    clearFieldError(input) {
      input.setAttribute("aria-invalid", "false");
      input.setCustomValidity("");
    },

    validate() {
      const { form, nameInput, emailInput } = this.elements;
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();

      nameInput.value = name;
      emailInput.value = email;
      [nameInput, emailInput].forEach((input) => this.clearFieldError(input));

      if (name.length < 2) {
        return this.invalid(nameInput, "Please enter your name using at least 2 characters.");
      }

      if (!email) {
        return this.invalid(emailInput, "Please enter your email address.");
      }

      if (!emailInput.validity.valid) {
        return this.invalid(emailInput, "Please enter a valid email address, like name@example.com.");
      }

      if (!form.checkValidity()) {
        return this.invalid(form.querySelector(":invalid") || emailInput, "Please review the highlighted fields and try again.");
      }

      return { isValid: true, name, email };
    },

    invalid(field, message) {
      field.setAttribute("aria-invalid", "true");
      field.setCustomValidity(message);
      return { isValid: false, message, firstInvalidField: field };
    },

    handleSubmit(event) {
      event.preventDefault();

      const validation = this.validate();
      if (!validation.isValid) {
        this.setMessage(validation.message, true);
        validation.firstInvalidField.focus();
        validation.firstInvalidField.reportValidity();
        return;
      }

      const visitor = {
        name: validation.name,
        email: validation.email,
        submittedAt: new Date().toISOString()
      };

      const saved = SafeStorage.write(STORAGE_KEY, visitor);
      VisitorCookie.set();
      this.elements.returningMessage.textContent = `Welcome back, ${visitor.name.split(" ")[0]} — you’re on the launch list.`;
      this.elements.returningMessage.hidden = false;

      this.setMessage(
        saved
          ? "You’re on the launch list. We’ll send the first taste when the grill is ready."
          : "You’re in for this session. Your browser did not allow saving the confirmation locally.",
        false
      );
    },

    setMessage(message, isError) {
      this.elements.formMessage.textContent = message;
      this.elements.formMessage.classList.toggle("is-error", Boolean(isError));
    }
  };

  const PreviewMenu = {
    lastTrigger: null,
    hasLoaded: false,

    init(elements) {
      this.elements = elements;

      if (!this.hasRequiredElements()) {
        return;
      }

      this.elements.trigger.addEventListener("click", (event) => this.handleTriggerClick(event));
      this.elements.closeButton.addEventListener("click", () => this.close());
      this.elements.modal.addEventListener("click", (event) => this.handleBackdropClick(event));
      this.elements.modal.addEventListener("cancel", () => this.restoreFocus());
      this.elements.modal.addEventListener("close", () => this.restoreFocus());
    },

    hasRequiredElements() {
      const { trigger, modal, content, closeButton } = this.elements;
      return Boolean(trigger && modal && content && closeButton);
    },

    async handleTriggerClick(event) {
      event.preventDefault();
      this.lastTrigger = event.currentTarget;
      this.open();

      if (!this.hasLoaded) {
        await this.load();
      }
    },

    open() {
      if (typeof this.elements.modal.showModal === "function") {
        this.elements.modal.showModal();
      } else {
        this.elements.modal.setAttribute("open", "");
      }

      this.elements.closeButton.focus();
    },

    close() {
      if (typeof this.elements.modal.close === "function") {
        this.elements.modal.close();
      } else {
        this.elements.modal.removeAttribute("open");
        this.restoreFocus();
      }
    },

    restoreFocus() {
      if (this.lastTrigger && typeof this.lastTrigger.focus === "function") {
        this.lastTrigger.focus();
      }
    },

    handleBackdropClick(event) {
      const modalBox = this.elements.modal.querySelector(".menu-modal__inner");
      if (!modalBox) {
        return;
      }

      const box = modalBox.getBoundingClientRect();
      const clickedBackdrop = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;

      if (clickedBackdrop) {
        this.close();
      }
    },

    async load() {
      this.renderStatus("Warming up the grill and loading the preview menu…");
      this.elements.trigger.classList.add("is-loading");
      this.elements.trigger.setAttribute("aria-busy", "true");

      try {
        const response = await fetch(this.elements.trigger.getAttribute("href"), { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Menu request failed with status ${response.status}`);
        }

        const menu = await response.json();
        this.render(menu);
        this.hasLoaded = true;
      } catch (error) {
        this.renderError();
      } finally {
        this.elements.trigger.classList.remove("is-loading");
        this.elements.trigger.removeAttribute("aria-busy");
      }
    },

    renderStatus(message) {
      this.elements.content.innerHTML = `<p class="menu-status">${escapeHtml(message)}</p>`;
    },

    renderError() {
      this.elements.content.innerHTML = `
        <div class="menu-status" role="status">
          <p>Our preview menu is unavailable right now, but the launch list is still open.</p>
          <p>Please try again in a moment or explore the full menu section below.</p>
        </div>
      `;
    },

    render(menu) {
      if (!menu || !Array.isArray(menu.sections)) {
        this.renderError();
        return;
      }

      const sectionsMarkup = menu.sections.map((section) => this.renderSection(section)).join("");
      this.elements.content.innerHTML = `
        <div class="menu-status">
          <strong>${escapeHtml(menu.title || "Taco Braza Menu")}</strong><br>
          ${escapeHtml(menu.subtitle || "")}
        </div>
        ${sectionsMarkup}
      `;
    },

    renderSection(section) {
      const sectionId = slugify(section.name || "menu-section");
      const eyebrowMarkup = section.eyebrow ? `<p class="menu-category__eyebrow">${escapeHtml(section.eyebrow)}</p>` : "";
      const descriptionMarkup = section.description ? `<p>${escapeHtml(section.description)}</p>` : "";
      const items = Array.isArray(section.items) ? section.items : [];
      const itemsMarkup = items.map((item) => this.renderItem(item)).join("");

      return `
        <section class="menu-category" aria-labelledby="${sectionId}">
          <div class="menu-category__header">
            ${eyebrowMarkup}
            <h3 id="${sectionId}">${escapeHtml(section.name || "Menu")}</h3>
            ${descriptionMarkup}
          </div>
          ${itemsMarkup}
        </section>
      `;
    },

    renderItem(item) {
      const details = Array.isArray(item.details) ? item.details : [];
      const detailMarkup = details.length
        ? `<ul>${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>`
        : "";
      const priceMarkup = escapeHtml(item.price || "").replace(/\n/g, "<br>");

      return `
        <article class="menu-item">
          <div class="menu-item__top">
            <h4>${escapeHtml(item.name || "Menu item")}</h4>
            <p class="price">${priceMarkup}</p>
          </div>
          <p>${escapeHtml(item.description || "")}</p>
          ${detailMarkup}
        </article>
      `;
    }
  };

  function slugify(value) {
    return `menu-${String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
