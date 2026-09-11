import { AppState } from './state.js';
import { $, $$, escapeHtml } from './utils.js';
import { showToast, updateChecklist } from './ui.js';


  // ─── Profile Form ──────────────────────────────────────────────────
  const profileForm = $('#profileForm');
  const addressContainer = $('#addressHistory');

  // Load saved profile
  export async function loadProfile() {
    try {
      let result = null;
      try {
        result = await chrome?.runtime?.sendMessage?.({ action: 'loadPetitionerProfile' });
      } catch (e) {
        console.warn('Unable to load petitioner profile from extension runtime:', e);
      }
      if (!result?.profile) {
        const stored = localStorage.getItem('petitionerProfile');
        if (stored) result = { profile: JSON.parse(stored) };
      }
      if (result?.profile) {
        AppState.petitionerProfile = result.profile;
        fillProfileForm(result.profile);
      } else {
        addAddressEntry(); // Start with one empty entry
      }
    } catch (_) {
      addAddressEntry();
    }
    updateChecklist();
  }


  // ─── Input Formatting & Validation Helpers ─────────────────────────
  function formatSSN(val) {
    const digits = val.replace(/\D/g, '').slice(0, 9);
    if (digits.length === 0) return '';
    if (digits.length < 3) return digits;
    if (digits.length === 3) return String(val).endsWith('-') ? `${digits}-` : digits;
    if (digits.length <= 5) {
      const base = `${digits.slice(0, 3)}-${digits.slice(3)}`;
      return (digits.length === 5 && String(val).endsWith('-')) ? `${base}-` : base;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }

  function formatDL(val) {
    const clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
    if (clean.length <= 4) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6)}`;
  }

  function formatPhone(val) {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function formatZIP(val) {
    const digits = val.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  function formatResidenceDate(val, isToField = false) {
    if (!val) return '';
    const trimmed = String(val).trim();
    if (isToField && /^p/i.test(trimmed)) {
      return 'Present';
    }
    const digits = trimmed.replace(/\D/g, '').slice(0, 6);
    if (digits.length === 0) return '';
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  function validateResidenceDateStr(val, isToField = false) {
    if (!val || val.trim().length === 0) {
      return { isValid: true, isEmpty: true };
    }
    const trimmed = val.trim();
    if (isToField && /^present$/i.test(trimmed)) {
      const now = new Date();
      return { isValid: true, isPresent: true, year: now.getFullYear(), month: now.getMonth() + 1 };
    }
    const match = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
    if (!match) {
      return { isValid: false, errorMsg: 'Use MM/YYYY format (e.g. 05/2014)' };
    }
    const month = parseInt(match[1], 10);
    const year = parseInt(match[2], 10);
    const currentYear = new Date().getFullYear();

    if (month < 1 || month > 12) {
      return { isValid: false, errorMsg: 'Month must be 01 to 12' };
    }
    if (year < 1900 || year > currentYear + 1) {
      return { isValid: false, errorMsg: `Year must be between 1900 and ${currentYear + 1}` };
    }
    return { isValid: true, month, year, isEmpty: false };
  }

  function validateAddressDates(entry) {
    const fromInput = entry.querySelector('.address-from');
    const toInput = entry.querySelector('.address-to');
    const fromErr = entry.querySelector('.err-address-from');
    const toErr = entry.querySelector('.err-address-to');
    if (!fromInput || !toInput) return true;

    const fromVal = fromInput.value.trim();
    const toVal = toInput.value.trim();

    let isValid = true;

    if (fromErr) { fromErr.textContent = ''; fromErr.classList.remove('active'); }
    if (toErr) { toErr.textContent = ''; toErr.classList.remove('active'); }
    fromInput.classList.remove('is-invalid', 'is-valid');
    toInput.classList.remove('is-invalid', 'is-valid');

    const fromRes = validateResidenceDateStr(fromVal, false);
    if (!fromRes.isValid) {
      if (fromErr) { fromErr.textContent = fromRes.errorMsg; fromErr.classList.add('active'); }
      fromInput.classList.add('is-invalid');
      isValid = false;
    } else if (!fromRes.isEmpty) {
      fromInput.classList.add('is-valid');
    }

    const toRes = validateResidenceDateStr(toVal, true);
    if (!toRes.isValid) {
      if (toErr) { toErr.textContent = toRes.errorMsg; toErr.classList.add('active'); }
      toInput.classList.add('is-invalid');
      isValid = false;
    } else if (!toRes.isEmpty) {
      toInput.classList.add('is-valid');
    }

    // Chronological check: from <= to
    if (isValid && !fromRes.isEmpty && !toRes.isEmpty) {
      const fromTotal = fromRes.year * 12 + fromRes.month;
      const toTotal = toRes.year * 12 + toRes.month;
      if (fromTotal > toTotal) {
        if (toErr) {
          toErr.textContent = "'To' date must be after 'From' date";
          toErr.classList.add('active');
        }
        toInput.classList.remove('is-valid');
        toInput.classList.add('is-invalid');
        isValid = false;
      }
    }

    return isValid;
  }

  function setFieldError(fieldId, errorMsg) {
    const input = $(`#${fieldId}`);
    const errSpan = $(`#err-${fieldId}`);
    if (input) {
      input.classList.remove('is-valid');
      input.classList.add('is-invalid');
    }
    if (errSpan) {
      errSpan.textContent = errorMsg;
      errSpan.classList.add('active');
    }
  }

  function clearFieldError(fieldId) {
    const input = $(`#${fieldId}`);
    const errSpan = $(`#err-${fieldId}`);
    if (input) {
      input.classList.remove('is-invalid');
      if (input.value.trim().length > 0) {
        input.classList.add('is-valid');
      } else {
        input.classList.remove('is-valid');
      }
    }
    if (errSpan) {
      errSpan.textContent = '';
      errSpan.classList.remove('active');
    }
  }

  // Set up real-time mask formatters and toggle buttons
  export function setupInputFormatting() {
    const ssnInput = $('#ssn');
    const dlInput = $('#driverLicense');
    const phoneInput = $('#phone');
    const dobInput = $('#dob');
    const zipInput = $('#zipCode');
    const toggleSSN = $('#btnToggleSSN');

    // DOB age constraint (at least 18 years old)
    if (dobInput) {
      const today = new Date();
      const maxYear = today.getFullYear() - 18;
      const maxMonth = String(today.getMonth() + 1).padStart(2, '0');
      const maxDay = String(today.getDate()).padStart(2, '0');
      dobInput.max = `${maxYear}-${maxMonth}-${maxDay}`;
      dobInput.min = '1900-01-01';

      dobInput.addEventListener('change', () => {
        validateField('dob');
      });
    }

    // SSN format as user types
    if (ssnInput) {
      ssnInput.addEventListener('input', (e) => {
        e.target.value = formatSSN(e.target.value);
        clearFieldError('ssn');
      });
      ssnInput.addEventListener('blur', () => validateField('ssn'));
    }

    // Toggle SSN visibility
    if (toggleSSN && ssnInput) {
      toggleSSN.addEventListener('click', () => {
        const isPass = ssnInput.type === 'password';
        ssnInput.type = isPass ? 'text' : 'password';
        toggleSSN.textContent = isPass ? '🔒' : '👁';
      });
    }

    // DL format as user types
    if (dlInput) {
      dlInput.addEventListener('input', (e) => {
        e.target.value = formatDL(e.target.value);
        clearFieldError('driverLicense');
      });
      dlInput.addEventListener('blur', () => validateField('driverLicense'));
    }

    // ZIP format as user types
    if (zipInput) {
      zipInput.addEventListener('input', (e) => {
        e.target.value = formatZIP(e.target.value);
        clearFieldError('zipCode');
      });
      zipInput.addEventListener('blur', () => validateField('zipCode'));
    }

    // Phone format as user types
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        e.target.value = formatPhone(e.target.value);
        clearFieldError('phone');
      });
      phoneInput.addEventListener('blur', () => validateField('phone'));
    }

    // Full name, street address, city, state, email live checks
    $('#fullName')?.addEventListener('blur', () => validateField('fullName'));
    $('#streetAddress')?.addEventListener('blur', () => validateField('streetAddress'));
    $('#city')?.addEventListener('blur', () => validateField('city'));
    $('#state')?.addEventListener('change', () => validateField('state'));
    $('#email')?.addEventListener('blur', () => validateField('email'));
  }

  function validateField(fieldId) {
    const input = $(`#${fieldId}`);
    if (!input) return true;
    const val = input.value.trim();

    if (fieldId === 'fullName') {
      if (!val) {
        setFieldError('fullName', 'Full legal name is required');
        return false;
      }
      const words = val.split(/\s+/).filter(Boolean);
      if (words.length < 2) {
        setFieldError('fullName', 'Please enter full first and last name');
        return false;
      }
      if (!/^[A-Za-z\s.'-]+$/.test(val)) {
        setFieldError('fullName', 'Name contains invalid characters');
        return false;
      }
      clearFieldError('fullName');
      return true;
    }

    if (fieldId === 'dob') {
      if (!val) {
        clearFieldError('dob');
        return true;
      }
      const d = new Date(val + 'T00:00:00');
      if (isNaN(d.getTime())) {
        setFieldError('dob', 'Invalid date format');
        return false;
      }
      const today = new Date();
      if (d > today) {
        setFieldError('dob', 'DOB cannot be in the future');
        return false;
      }
      const ageYears = (today - d) / (365.25 * 24 * 60 * 60 * 1000);
      if (ageYears < 18) {
        setFieldError('dob', 'Petitioner must be at least 18 years old');
        return false;
      }
      if (ageYears > 120) {
        setFieldError('dob', 'Please enter a valid birth year');
        return false;
      }
      clearFieldError('dob');
      return true;
    }

    if (fieldId === 'ssn') {
      const clean = val.replace(/\D/g, '');
      if (!clean) {
        clearFieldError('ssn');
        return true;
      }
      if (clean.length !== 9) {
        setFieldError('ssn', `Must be exactly 9 digits (entered ${clean.length})`);
        return false;
      }
      if (clean === '000000000' || clean.startsWith('000') || clean.startsWith('666') || clean.startsWith('9')) {
        setFieldError('ssn', 'Invalid SSN');
        return false;
      }
      // Normalize input value to XXX-XX-XXXX
      input.value = `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5)}`;
      clearFieldError('ssn');
      return true;
    }

    if (fieldId === 'driverLicense') {
      if (!val) {
        clearFieldError('driverLicense');
        return true; // Optional on some pleadings
      }
      // Indiana DL: 10 digits formatted as XXXX-XX-XXXX or 9-10 alphanumeric
      const clean = val.replace(/[^A-Za-z0-9]/g, '');
      if (clean.length < 9 || clean.length > 10) {
        setFieldError('driverLicense', 'Indiana DL must be 9–10 digits (XXXX-XX-XXXX)');
        return false;
      }
      clearFieldError('driverLicense');
      return true;
    }

    if (fieldId === 'streetAddress') {
      if (!val) {
        clearFieldError('streetAddress');
        return true;
      }
      if (val.length < 4) {
        setFieldError('streetAddress', 'Please enter a valid street address');
        return false;
      }
      clearFieldError('streetAddress');
      return true;
    }

    if (fieldId === 'city') {
      if (!val) {
        clearFieldError('city');
        return true;
      }
      if (!/^[A-Za-z\s.'-]+$/.test(val)) {
        setFieldError('city', 'City contains invalid characters');
        return false;
      }
      clearFieldError('city');
      return true;
    }

    if (fieldId === 'state') {
      if (!val) {
        clearFieldError('state');
        return true;
      }
      clearFieldError('state');
      return true;
    }

    if (fieldId === 'zipCode') {
      if (!val) {
        clearFieldError('zipCode');
        return true;
      }
      const clean = val.replace(/\D/g, '');
      if (clean.length !== 5 && clean.length !== 9) {
        setFieldError('zipCode', 'Must be 5 or 9 digits (XXXXX or XXXXX-XXXX)');
        return false;
      }
      clearFieldError('zipCode');
      return true;
    }

    if (fieldId === 'phone') {
      if (!val) {
        clearFieldError('phone');
        return true; // Optional
      }
      if (!/^\(\d{3}\)\s\d{3}-\d{4}$/.test(val)) {
        setFieldError('phone', 'Must be a complete 10-digit number: (XXX) XXX-XXXX');
        return false;
      }
      clearFieldError('phone');
      return true;
    }

    if (fieldId === 'email') {
      if (!val) {
        clearFieldError('email');
        return true; // Optional
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        setFieldError('email', 'Please enter a valid email address');
        return false;
      }
      clearFieldError('email');
      return true;
    }

    return true;
  }

  function fillProfileForm(profile) {
    if (profile.fullName) $('#fullName').value = profile.fullName;
    if (profile.aliases) $('#aliases').value = profile.aliases;
    if (profile.dob) $('#dob').value = profile.dob;
    if (profile.ssn) $('#ssn').value = formatSSN(profile.ssn);
    if (profile.driverLicense) $('#driverLicense').value = formatDL(profile.driverLicense);
    if (profile.streetAddress) $('#streetAddress').value = profile.streetAddress;
    if (profile.city) $('#city').value = profile.city;
    if (profile.state) $('#state').value = profile.state;
    if (profile.zipCode) $('#zipCode').value = formatZIP(profile.zipCode);

    // Fallback if legacy profile only had single currentAddress
    if (!profile.streetAddress && profile.currentAddress) {
      const match = profile.currentAddress.match(/^([^,]+),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      if (match) {
        $('#streetAddress').value = match[1].trim();
        $('#city').value = match[2].trim();
        $('#state').value = match[3].toUpperCase().trim();
        $('#zipCode').value = match[4].trim();
      } else {
        $('#streetAddress').value = profile.currentAddress;
      }
    }

    if (profile.phone) $('#phone').value = formatPhone(profile.phone);
    if (profile.email) $('#email').value = profile.email;

    // Addresses
    const container = $('#addressHistory') || addressContainer;
    if (container) {
      container.innerHTML = '';
      if (profile.addresses && profile.addresses.length > 0) {
        profile.addresses.forEach(addr => addAddressEntry(addr));
      } else {
        addAddressEntry();
      }
    }
  }

  function escapeAttr(value) {
    return escapeHtml(String(value ?? '')).replace(/"/g, '&quot;');
  }

  function parseAddressEntry(value = '') {
    if (typeof value === 'object' && value !== null) {
      return {
        street: value.street || value.streetAddress || '',
        city: value.city || '',
        state: value.state || 'IN',
        zipCode: value.zipCode || value.zip || '',
        fromDate: value.fromDate || value.from || '',
        toDate: value.toDate || value.to || ''
      };
    }

    const parsed = {
      street: '',
      city: '',
      state: 'IN',
      zipCode: '',
      fromDate: '',
      toDate: ''
    };
    let text = String(value || '').trim();
    const datesMatch = text.match(/\(([^)]*)\)\s*$/);

    if (datesMatch) {
      const dates = datesMatch[1].split(/\s*(?:-|to|through)\s*/i).filter(Boolean);
      parsed.fromDate = dates[0] || datesMatch[1];
      parsed.toDate = dates[1] || '';
      text = text.slice(0, datesMatch.index).trim();
    }

    const stateZipMatch = text.match(/,\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
    if (!stateZipMatch) {
      parsed.street = text;
      return parsed;
    }

    parsed.state = stateZipMatch[1].toUpperCase();
    parsed.zipCode = stateZipMatch[2];

    const beforeState = text.slice(0, stateZipMatch.index).trim();
    const cityBreak = beforeState.lastIndexOf(',');
    if (cityBreak >= 0) {
      parsed.street = beforeState.slice(0, cityBreak).trim();
      parsed.city = beforeState.slice(cityBreak + 1).trim();
    } else {
      parsed.street = beforeState;
    }

    return parsed;
  }

  function getStateOptionsHtml(selectedState = 'IN') {
    const stateSelect = $('#state');
    const selected = String(selectedState || 'IN').toUpperCase();

    if (stateSelect && stateSelect.options && stateSelect.options.length > 0) {
      return Array.from(stateSelect.options).map(option => {
        const value = option.value;
        const disabled = option.disabled ? ' disabled' : '';
        const isSelected = value === selected ? ' selected' : '';
        return `<option value="${escapeAttr(value)}"${disabled}${isSelected}>${escapeHtml(option.textContent)}</option>`;
      }).join('');
    }

    const fallbackStates = ['IN', 'IL', 'KY', 'MI', 'OH', 'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IA', 'KS', 'LA', 'ME', 'MD', 'MA', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'];
    return fallbackStates.map(st => `<option value="${st}"${st === selected ? ' selected' : ''}>${st}</option>`).join('');
  }

  function formatAddressLine(address) {
    const street = (address.street || '').trim();
    const city = (address.city || '').trim();
    const state = (address.state || '').trim();
    const zip = (address.zipCode || '').trim();

    return [
      street,
      city,
      `${state} ${zip}`.trim()
    ].filter(Boolean).join(', ');
  }

  function renumberAddressCards() {
    const container = $('#addressHistory') || addressContainer;
    if (!container) return;
    const cards = container.querySelectorAll('.address-entry');
    cards.forEach((card, idx) => {
      const badgeText = card.querySelector('.badge-text');
      if (badgeText) badgeText.textContent = `Prior Address #${idx + 1}`;
    });
  }

  export function addAddressEntry(value = '', shouldFocus = false) {
    const container = $('#addressHistory') || addressContainer;
    if (!container || typeof container.appendChild !== 'function') return;

    const address = parseAddressEntry(value);
    const count = container.querySelectorAll('.address-entry').length + 1;
    const entry = document.createElement('div');
    entry.className = 'address-entry';
    entry.innerHTML = `
      <div class="address-card-header">
        <span class="address-index-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span class="badge-text">Prior Address #${count}</span>
        </span>
        <button type="button" class="btn-remove btn-remove-address" title="Remove this address entry">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Remove
        </button>
      </div>

      <div class="form-group">
        <div class="label-row">
          <label>Street Address</label>
          <span class="field-hint">House #, Street, Apt/Suite</span>
        </div>
        <input type="text" class="address-street" placeholder="e.g. 500 N Capitol Ave, Apt 2" value="${escapeAttr(address.street)}" autocomplete="street-address">
      </div>

      <div class="form-row form-row-city-state-zip">
        <div class="form-group">
          <div class="label-row">
            <label>City</label>
          </div>
          <input type="text" class="address-city" placeholder="Indianapolis" value="${escapeAttr(address.city)}" autocomplete="address-level2">
        </div>
        <div class="form-group">
          <div class="label-row">
            <label>State</label>
          </div>
          <select class="address-state" autocomplete="address-level1">
            ${getStateOptionsHtml(address.state)}
          </select>
        </div>
        <div class="form-group">
          <div class="label-row">
            <label>ZIP</label>
            <span class="field-hint">5 digits</span>
          </div>
          <input type="text" class="address-zip" placeholder="46204" maxlength="10" value="${escapeAttr(formatZIP(address.zipCode))}" autocomplete="postal-code">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <div class="label-row">
            <label>Dates of Residence — From</label>
            <span class="field-hint">MM/YYYY</span>
          </div>
          <input type="text" class="address-from" placeholder="05/2014" maxlength="7" value="${escapeAttr(address.fromDate)}">
          <span class="field-error err-address-from"></span>
        </div>
        <div class="form-group">
          <div class="label-row">
            <label>To</label>
            <span class="field-hint">MM/YYYY or Present</span>
          </div>
          <input type="text" class="address-to" placeholder="08/2018 or Present" maxlength="10" value="${escapeAttr(address.toDate)}">
          <span class="field-error err-address-to"></span>
        </div>
      </div>
    `;

    // Live ZIP code formatting
    entry.querySelector('.address-zip')?.addEventListener('input', (e) => {
      e.target.value = formatZIP(e.target.value);
    });

    // Live Residence Date formatting & validation
    const fromInput = entry.querySelector('.address-from');
    const toInput = entry.querySelector('.address-to');

    fromInput?.addEventListener('input', (e) => {
      e.target.value = formatResidenceDate(e.target.value, false);
    });
    fromInput?.addEventListener('blur', () => {
      validateAddressDates(entry);
    });

    toInput?.addEventListener('input', (e) => {
      e.target.value = formatResidenceDate(e.target.value, true);
    });
    toInput?.addEventListener('blur', () => {
      validateAddressDates(entry);
    });

    // Remove button listener
    entry.querySelector('.btn-remove')?.addEventListener('click', () => {
      entry.remove();
      renumberAddressCards();
    });

    container.appendChild(entry);
    renumberAddressCards();

    if (shouldFocus) {
      entry.querySelector('.address-street')?.focus();
    }
  }

  $('#btnAddAddress')?.addEventListener('click', () => addAddressEntry('', true));

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Enforce validation on all fields
    const fieldsToValidate = [
      'fullName', 'dob', 'ssn', 'driverLicense',
      'streetAddress', 'city', 'state', 'zipCode',
      'phone', 'email'
    ];
    let firstInvalid = null;
    let hasError = false;

    for (const f of fieldsToValidate) {
      const isValid = validateField(f);
      if (!isValid) {
        hasError = true;
        if (!firstInvalid) firstInvalid = $(`#${f}`);
      }
    }

    // Validate residence history dates
    const addressListContainer = $('#addressHistory') || addressContainer;
    const addressEntries = addressListContainer ? addressListContainer.querySelectorAll('.address-entry') : [];
    let dateErrorFound = false;

    for (const entry of addressEntries) {
      const areDatesValid = validateAddressDates(entry);
      if (!areDatesValid) {
        hasError = true;
        dateErrorFound = true;
        if (!firstInvalid) {
          firstInvalid = entry.querySelector('.is-invalid') || entry.querySelector('.address-from');
        }
      }
    }

    if (hasError) {
      const msg = dateErrorFound
        ? 'Please correct the invalid residence dates (format: MM/YYYY or Present)'
        : 'Please correct the highlighted form errors';
      showToast(msg, 'error', 4000);
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    const street = $('#streetAddress').value.trim();
    const city = $('#city').value.trim();
    const state = $('#state').value.trim();
    const zip = $('#zipCode').value.trim();
    const fullAddress = `${street}, ${city}, ${state} ${zip}`;

    const addresses = Array.from(addressListContainer ? addressListContainer.querySelectorAll('.address-entry') : [])
      .map(entry => {
        const address = {
          street: entry.querySelector('.address-street')?.value.trim() || '',
          city: entry.querySelector('.address-city')?.value.trim() || '',
          state: entry.querySelector('.address-state')?.value.trim() || 'IN',
          zipCode: entry.querySelector('.address-zip')?.value.trim() || '',
          fromDate: entry.querySelector('.address-from')?.value.trim() || '',
          toDate: entry.querySelector('.address-to')?.value.trim() || ''
        };
        address.line = formatAddressLine(address);
        return address;
      })
      .filter(address => address.line.length > 0 || address.fromDate.length > 0 || address.toDate.length > 0);

    AppState.petitionerProfile = {
      fullName: $('#fullName').value.trim(),
      aliases: $('#aliases')?.value.trim() || '',
      dob: $('#dob').value,
      ssn: $('#ssn').value.trim(),
      driverLicense: $('#driverLicense').value.trim(),
      streetAddress: street,
      city: city,
      state: state,
      zipCode: zip,
      currentAddress: fullAddress,
      phone: $('#phone').value.trim(),
      email: $('#email').value.trim(),
      addresses
    };

    try {
      await chrome?.runtime?.sendMessage?.({ action: 'savePetitionerProfile', profile: AppState.petitionerProfile });
    } catch (e) {
      console.warn('Unable to save petitioner profile to extension runtime:', e);
    }
    try {
      localStorage.setItem('petitionerProfile', JSON.stringify(AppState.petitionerProfile));
    } catch (e) {
      console.warn('Unable to save petitioner profile to localStorage:', e);
    }

    showToast('✓ Profile validated & saved to secure local storage', 'success', 3500);
    updateChecklist();
  });

