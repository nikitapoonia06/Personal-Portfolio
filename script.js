
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-header nav');
menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.querySelector('span').textContent = open ? '−' : '＋';
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
  if (menuButton) menuButton.querySelector('span').textContent = '＋';
}));

const cursor = document.querySelector('.cursor-dot');
if (window.matchMedia('(pointer:fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  window.addEventListener('pointermove', event => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
  });
}

if (window.matchMedia('(pointer:fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.querySelectorAll('.tilt-card').forEach(card => {
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      card.style.transform = `translateY(-5px) rotateX(${-y * 2}deg) rotateY(${x * 2}deg)`;
    });
    card.addEventListener('pointerleave', () => card.style.transform = '');
  });
});

const form = document.querySelector('.contact-form');
if (form) {
  const status = form.querySelector('.form-status');
  const submitButton = form.querySelector('.send-button');
  const emailInput = form.querySelector('#email');
  const nameInput = form.querySelector('#name');
  const messageInput = form.querySelector('#message');

  const setStatus = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setStatus('', '');

    if (!form.reportValidity()) return;
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const message = messageInput.value.trim();
    const reason = form.querySelector('#reason').value;

    if (name.length < 2 || name.length > 80 || /[<>]/.test(name)) {
      setStatus('Please enter a valid name (2–80 characters).', 'error');
      nameInput.focus();
      return;
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setStatus('Please enter a valid email address.', 'error');
      emailInput.focus();
      return;
    }
    if (message.length < 10 || message.length > 5000) {
      setStatus('Please write a message between 10 and 5,000 characters.', 'error');
      messageInput.focus();
      return;
    }
    if (!reason) {
      setStatus('Please choose what your message is about.', 'error');
      form.querySelector('#reason').focus();
      return;
    }

    const lastSubmission = localStorage.getItem('portfolio_last_submission');

    if (
      lastSubmission &&
      Number.isFinite(Number(lastSubmission)) &&
      Date.now() - Number(lastSubmission) < 86400000
    ) {
      setStatus('You can send another message after 24 hours.', 'error');
      return;
    }

    const captchaResponse = form.querySelector(
      'textarea[name="h-captcha-response"]'
    )?.value;

    if (!captchaResponse) {
      setStatus('Please complete the CAPTCHA before sending.', 'error');
      return;
    }

    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    const originalButton = submitButton.innerHTML;
    submitButton.textContent = 'SENDING…';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          access_key: form.elements.access_key.value,
          name,
          email,
          reason,
          message,
          website: form.elements.website.value,
          'h-captcha-response': captchaResponse
        })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.message || 'Message could not be sent. Please try again.'
        );
      }

      localStorage.setItem(
        'portfolio_last_submission',
        Date.now().toString()
      );

      form.reset();
      setStatus('Message sent!', 'success');

    } catch (error) {
      setStatus(
        error.message || 'Something went wrong. Please try again later.',
        'error'
      );

    } finally {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
      submitButton.innerHTML = originalButton;
    }

  });
}
