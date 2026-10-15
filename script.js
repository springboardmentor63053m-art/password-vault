const form = document.getElementById('registerForm');
const formStatus = document.getElementById('formStatus');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const strengthFill = document.getElementById('strengthFill');
const strengthText = document.getElementById('strengthText');
const passwordStrength = document.getElementById('passwordStrength');

const validateField = (fieldName, value, checked) => {
  switch (fieldName) {
    case 'name':
      return value.trim() ? '' : 'Full name is required.';
    case 'email': {
      if (!value.trim()) return 'Email is required.';
      return /\S+@\S+\.\S+/.test(value) ? '' : 'Please enter a valid email address.';
    }
    case 'role':
      return value ? '' : 'Please select a role.';
    case 'password':
      if (!value) return 'Password is required.';
      if (value.length < 6) return 'Password must be at least 6 characters.';
      return '';
    case 'confirmPassword':
      if (!value) return 'Please confirm your password.';
      if (value !== passwordInput.value) return 'Passwords do not match.';
      return '';
    case 'agree':
      return checked ? '' : 'You must agree to the Terms of Service.';
    default:
      return '';
  }
};

const getPasswordStrengthState = (password) => {
  if (!password) {
    return { label: 'No password', className: 'empty', width: '0%' };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { label: 'Weak', className: 'weak', width: '33%' };
  if (score <= 2) return { label: 'Medium', className: 'medium', width: '66%' };
  if (score <= 3) return { label: 'Strong', className: 'strong', width: '100%' };
  return { label: 'Very strong', className: 'very-strong', width: '100%' };
};

const setFieldError = (fieldName, message) => {
  const field = document.querySelector(`[data-field="${fieldName}"]`);
  const errorEl = field?.querySelector('.error-text');

  if (!field || !errorEl) return;

  if (message) {
    field.classList.add('has-error');
    errorEl.textContent = message;
  } else {
    field.classList.remove('has-error');
    errorEl.textContent = '';
  }
};

const updatePasswordStrength = () => {
  const value = passwordInput.value;
  const strength = getPasswordStrengthState(value);

  if (!value) {
    passwordStrength.hidden = true;
    strengthFill.className = 'strength-fill empty';
    strengthText.className = 'strength-text empty';
    strengthText.textContent = 'No password';
    return;
  }

  passwordStrength.hidden = false;
  strengthFill.style.width = strength.width;
  strengthFill.className = `strength-fill ${strength.className}`;
  strengthText.className = `strength-text ${strength.className}`;
  strengthText.textContent = strength.label;
};

const validateInput = (input) => {
  const fieldName = input.dataset.field;
  const isCheckbox = input.type === 'checkbox';
  const value = isCheckbox ? input.checked : input.value;
  const message = validateField(fieldName, value, input.checked);

  setFieldError(fieldName, message);

  if (fieldName === 'password') {
    updatePasswordStrength();
  }

  if (fieldName === 'confirmPassword' && confirmPasswordInput.value && passwordInput.value !== confirmPasswordInput.value) {
    setFieldError('confirmPassword', 'Passwords do not match.');
  }

  return !message;
};

const toggleButtons = document.querySelectorAll('.password-toggle');

toggleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.target);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  });
});

const allFields = Array.from(document.querySelectorAll('[data-field]'));

allFields.forEach((field) => {
  field.addEventListener('input', (event) => {
    const input = event.target;
    validateInput(input);
  });

  field.addEventListener('change', (event) => {
    const input = event.target;
    validateInput(input);
  });
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  let isValid = true;
  let firstInvalidField = null;

  allFields.forEach((field) => {
    const input = field.querySelector('input, select');
    if (!input) return;

    const fieldName = input.dataset.field;
    const value = input.type === 'checkbox' ? input.checked : input.value;
    const message = validateField(fieldName, value, input.checked);

    setFieldError(fieldName, message);

    if (message && !firstInvalidField) {
      firstInvalidField = input;
      isValid = false;
    }
  });

  if (passwordInput.value) {
    updatePasswordStrength();
  }

  if (!isValid) {
    formStatus.textContent = 'Please fix the highlighted fields.';
    formStatus.className = 'form-status error';
    firstInvalidField?.focus();
    return;
  }

  formStatus.textContent = 'Registration successful!';
  formStatus.className = 'form-status success';
  form.reset();
  passwordStrength.hidden = true;
  strengthFill.className = 'strength-fill empty';
  strengthText.className = 'strength-text empty';
  strengthText.textContent = 'No password';
});

passwordInput.addEventListener('input', () => {
  if (confirmPasswordInput.value) {
    const message = validateField('confirmPassword', confirmPasswordInput.value, true);
    setFieldError('confirmPassword', message);
  }
});
