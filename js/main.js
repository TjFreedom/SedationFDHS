/**
 * FDHS Sedation Dentistry — Main JavaScript
 * Handles: mobile nav, FAQ accordion, form validation, footer year
 */

(function () {
  'use strict';

  /* ===== MOBILE NAVIGATION ===== */
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.getElementById('mobile-nav');

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', function () {
      const isOpen = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!isOpen));
      mobileNav.setAttribute('aria-hidden', String(isOpen));
    });

    // Close mobile nav when a link is clicked
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        hamburger.setAttribute('aria-expanded', 'false');
        mobileNav.setAttribute('aria-hidden', 'true');
      });
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!hamburger.contains(e.target) && !mobileNav.contains(e.target)) {
        hamburger.setAttribute('aria-expanded', 'false');
        mobileNav.setAttribute('aria-hidden', 'true');
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        hamburger.setAttribute('aria-expanded', 'false');
        mobileNav.setAttribute('aria-hidden', 'true');
        hamburger.focus();
      }
    });
  }

  /* ===== FAQ ACCORDION ===== */
  const faqQuestions = document.querySelectorAll('.faq-question');

  faqQuestions.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      const answerId = btn.getAttribute('aria-controls');
      const answer = document.getElementById(answerId);

      // Close all other open items
      faqQuestions.forEach(function (otherBtn) {
        if (otherBtn !== btn) {
          const otherAnswer = document.getElementById(otherBtn.getAttribute('aria-controls'));
          otherBtn.setAttribute('aria-expanded', 'false');
          if (otherAnswer) otherAnswer.hidden = true;
        }
      });

      // Toggle this item
      btn.setAttribute('aria-expanded', String(!isExpanded));
      if (answer) answer.hidden = isExpanded;
    });
  });

  /* ===== SMOOTH SCROLL (for browsers without CSS scroll-behavior support) ===== */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'), 10) || 72;
        const top = target.getBoundingClientRect().top + window.scrollY - headerH - 16;
        window.scrollTo({ top: top, behavior: 'smooth' });
        // Move focus to section for accessibility
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  });

  /* ===== STICKY HEADER SHADOW ===== */
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', function () {
      header.style.boxShadow = window.scrollY > 10
        ? '0 4px 16px rgba(0,0,0,0.10)'
        : '0 1px 3px rgba(0,0,0,0.08)';
    }, { passive: true });
  }

  /* ===== CONTACT FORM ===== */
  const form = document.getElementById('appointment-form');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Basic client-side validation
      let isValid = true;
      const required = form.querySelectorAll('[required]');

      required.forEach(function (field) {
        const existingError = field.parentElement.querySelector('.field-error');
        if (existingError) existingError.remove();
        field.classList.remove('field-invalid');

        if (!field.value.trim() && field.type !== 'checkbox') {
          isValid = false;
          field.classList.add('field-invalid');
          const err = document.createElement('span');
          err.className = 'field-error';
          err.textContent = 'This field is required.';
          err.setAttribute('role', 'alert');
          field.parentElement.appendChild(err);
        }
        if (field.type === 'checkbox' && !field.checked) {
          isValid = false;
          const label = field.parentElement.querySelector('label');
          const err = document.createElement('span');
          err.className = 'field-error';
          err.textContent = 'Please accept to continue.';
          err.setAttribute('role', 'alert');
          if (label) label.after(err);
        }
      });

      // Email validation if provided
      const emailField = form.querySelector('#email');
      if (emailField && emailField.value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailField.value.trim())) {
          isValid = false;
          emailField.classList.add('field-invalid');
          const existingError = emailField.parentElement.querySelector('.field-error');
          if (existingError) existingError.remove();
          const err = document.createElement('span');
          err.className = 'field-error';
          err.textContent = 'Please enter a valid email address.';
          err.setAttribute('role', 'alert');
          emailField.parentElement.appendChild(err);
        }
      }

      if (!isValid) {
        const firstError = form.querySelector('.field-invalid, [type="checkbox"].field-invalid');
        if (firstError) firstError.focus();
        return;
      }

      // Success state
      const submitBtn = form.querySelector('[type="submit"]');
      submitBtn.textContent = '✓ Request Submitted!';
      submitBtn.disabled = true;
      submitBtn.style.background = '#059669';

      const successMsg = document.createElement('div');
      successMsg.className = 'form-success';
      successMsg.setAttribute('role', 'status');
      successMsg.innerHTML = '<strong>Thank you!</strong> We\'ve received your appointment request and will contact you within one business day. For immediate assistance, call <a href="tel:+13026130041">(302) 613-0041</a>.';
      form.appendChild(successMsg);

      // Scroll success message into view
      successMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    // Live field validation on blur
    form.querySelectorAll('input, select, textarea').forEach(function (field) {
      field.addEventListener('blur', function () {
        const existingError = field.parentElement.querySelector('.field-error');
        if (field.classList.contains('field-invalid') && field.value.trim()) {
          field.classList.remove('field-invalid');
          if (existingError) existingError.remove();
        }
      });
    });
  }

  /* ===== LOCATION MAP TABS ===== */
  const locTabs = document.querySelectorAll('.loc-tab');

  if (locTabs.length) {
    locTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        const targetId = tab.getAttribute('data-map');

        // Update tab states
        locTabs.forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        // Show the correct map panel
        document.querySelectorAll('.map-panel').forEach(function (panel) {
          panel.hidden = panel.id !== 'map-' + targetId;
        });
      });
    });
  }

  /* ===== FOOTER YEAR ===== */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ===== INTERSECTION OBSERVER — Animate sections in ===== */
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll(
      '.option-card, .benefit-item, .step, .faq-item, .trust-stat'
    ).forEach(function (el) {
      el.classList.add('animate-on-scroll');
      observer.observe(el);
    });
  }

  /* ===== ADD FORM & ANIMATION STYLES ===== */
  const style = document.createElement('style');
  style.textContent = `
    .field-invalid {
      border-color: #dc2626 !important;
      box-shadow: 0 0 0 3px rgba(220,38,38,0.15) !important;
    }
    .field-error {
      color: #dc2626;
      font-size: 0.8rem;
      font-weight: 500;
      margin-top: 0.25rem;
    }
    .form-success {
      background: #d1fae5;
      border: 1px solid #6ee7b7;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      font-size: 0.9rem;
      color: #065f46;
      margin-top: 0.5rem;
    }
    .form-success a { color: #047857; font-weight: 600; }

    .animate-on-scroll {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.5s ease, transform 0.5s ease;
    }
    .animate-on-scroll.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);

})();
