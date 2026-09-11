/**
 * Indiana Expungement Assistant - Public Legal Aid & Second Chance Portal
 * Client-Side Interactive Logic & Premium Experience Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initEligibilityCalculator();
  initDatePresets();
  initDocumentModal();
  initRulesEngineModal();
  initGuideTabs();
  initCopyButtons();
  initMobileNav();
  initScrollEffects();
  initHashExpansion();
  initStatutoryBanner();
});

/* ==========================================================================
   1. Theme Toggle (Light & Dark Mode)
   ========================================================================== */
function initThemeToggle() {
  const toggleBtn = document.getElementById('themeToggle');
  if (!toggleBtn) return;

  function getActiveTheme() {
    return document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    toggleBtn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    toggleBtn.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
  }

  toggleBtn.addEventListener('click', () => {
    const current = getActiveTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });

  // Listen for OS color scheme adjustments if not explicitly set
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });
}


/* ==========================================================================
   3. Statutory Eligibility Assessment (IC § 35-38-9)
   ========================================================================== */
const STATUTORY_TIERS = {
  tier1: {
    statute: 'IC § 35-38-9-1',
    name: 'Non-Convictions, Dismissals & Arrests',
    waitingYears: 1,
    grantType: 'Mandatory (Court Shall Grant)',
    isConviction: false,
    courtAction: 'The court SHALL grant expungement if no charges are pending.',
    details: 'Covers dropped charges, acquittals, or arrests where no charges were filed within 1 year. Mandatory statutory grant with no filing fees.'
  },
  tier2: {
    statute: 'IC § 35-38-9-2',
    name: 'Misdemeanors & Reduced Felonies',
    waitingYears: 5,
    grantType: 'Mandatory (Court Shall Grant)',
    isConviction: true,
    courtAction: 'The court SHALL grant expungement if statutory criteria are met.',
    details: 'Covers Class A, B, C misdemeanors and Class D/Level 6 felonies reduced to misdemeanors. Requires 5 years from date of conviction, all fines/restitution paid, and no new convictions.'
  },
  tier3: {
    statute: 'IC § 35-38-9-3',
    name: 'Class D / Level 6 Felonies',
    waitingYears: 8,
    grantType: 'Mandatory (Court Shall Grant)',
    isConviction: true,
    courtAction: 'The court SHALL grant expungement if statutory criteria are met.',
    details: 'Covers Level 6 and Class D felonies that did not result in bodily injury. Requires 8 years from date of conviction (or 3 years from completion of sentence).'
  },
  tier4: {
    statute: 'IC § 35-38-9-4',
    name: 'Major Felonies (Non-Violent Levels 1-5)',
    waitingYears: 8,
    grantType: 'Discretionary (Judicial Review)',
    isConviction: true,
    courtAction: 'The court MAY grant expungement in its judicial discretion.',
    details: 'Covers higher-level felonies (Class A, B, C or Levels 1-5) that did not result in serious bodily injury. Requires 8 years from conviction (or 3 years from sentence completion).'
  },
  tier5: {
    statute: 'IC § 35-38-9-5',
    name: 'Serious Violent Felonies',
    waitingYears: 10,
    grantType: 'Prosecutor Written Consent Required',
    isConviction: true,
    courtAction: 'CANNOT be granted without written consent from the Prosecuting Attorney.',
    details: 'Covers offenses involving serious bodily injury. Requires 10 years and explicit written prosecutor consent.'
  }
};

function initEligibilityCalculator() {
  const tierRadios = document.querySelectorAll('input[name="calcTier"]');
  const dateInput = document.getElementById('calcDate');
  const checkFines = document.getElementById('calcCheckFines');
  const checkPending = document.getElementById('calcCheckPending');
  const pendingAlertNote = document.getElementById('pendingAlertNote');
  const checkConvictions = document.getElementById('calcCheckConvictions');
  const newConvictionContainer = document.getElementById('newConvictionContainer');
  const newConvictionDateInput = document.getElementById('calcNewConvictionDate');
  const checkDiversion = document.getElementById('calcCheckDiversion');
  const checkDiversionRow = document.getElementById('checkDiversionRow');
  const checkSentence = document.getElementById('calcCheckSentence');
  const checkSentenceRow = document.getElementById('checkSentenceRow');
  const checkSentenceText = document.getElementById('checkSentenceText');

  const dateStepLabel = document.getElementById('dateStepLabel');
  const calcDateLabel = document.getElementById('calcDateLabel');
  const calcDateHint = document.getElementById('calcDateHint');

  // Default to 6 years ago for immediate illustration
  if (dateInput && !dateInput.value) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 6);
    dateInput.value = d.toISOString().split('T')[0];
  }

  function update() {
    const selectedRadio = document.querySelector('input[name="calcTier"]:checked');
    const tierKey = selectedRadio ? selectedRadio.value : 'tier2';
    const tier = STATUTORY_TIERS[tierKey];

    // Highlight active option card
    document.querySelectorAll('.tier-item').forEach(card => {
      const radio = card.querySelector('input[type="radio"]');
      if (radio && radio.checked) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    // Update Date prompt & explanation based on conviction vs arrest
    if (tierKey === 'tier1') {
      if (dateStepLabel) dateStepLabel.textContent = 'Date of Dismissal or Arrest';
      if (calcDateLabel) calcDateLabel.textContent = 'Enter date charges were dismissed (or arrest date if no charges filed):';
      if (calcDateHint) {
        calcDateHint.innerHTML = '<strong>Arrest / Dismissal Date:</strong> For non-convictions (dismissals, dropped charges, or acquittals), the 1-year statutory waiting clock runs from the date charges were dismissed or the date of arrest if no charges were filed.';
      }
      if (checkSentenceRow) checkSentenceRow.style.display = 'none';
      if (checkDiversionRow) checkDiversionRow.style.display = 'flex';
    } else {
      if (dateStepLabel) dateStepLabel.textContent = 'Date of Conviction / Sentencing';
      if (calcDateLabel) calcDateLabel.textContent = 'Enter date judgment of conviction / sentence was entered (NOT arrest date):';
      
      const isFelony = tierKey === 'tier3' || tierKey === 'tier4' || tierKey === 'tier5';
      if (calcDateHint) {
        if (isFelony) {
          calcDateHint.innerHTML = '<strong>Sentencing Date, NOT Arrest Date:</strong> Under Indiana Code § 35-38-9, the statutory waiting clock for felony convictions begins on the date of <em>conviction and sentencing</em> by the court, NOT when you were arrested. In addition, at least 3 years must have passed since you fully completed all terms of your sentence.';
        } else {
          calcDateHint.innerHTML = '<strong>Sentencing Date, NOT Arrest Date:</strong> Under Indiana Code § 35-38-9, the statutory waiting clock begins on the date of <em>conviction and sentencing</em> by the court, NOT when you were arrested. Pre-sentence time does not count toward the waiting period.';
        }
      }

      if (checkDiversionRow) checkDiversionRow.style.display = 'none';

      if (checkSentenceRow) {
        if (isFelony) {
          checkSentenceRow.style.display = 'flex';
          const sentYears = tierKey === 'tier5' ? 5 : 3;
          if (checkSentenceText) {
            checkSentenceText.textContent = `At least ${sentYears} years have passed since completing all terms of sentence (probation, parole, or DOC discharge)`;
          }
        } else {
          checkSentenceRow.style.display = 'none';
        }
      }
    }

    // Toggle conditional inputs in UI
    const noPending = checkPending ? checkPending.checked : true;
    if (pendingAlertNote) {
      pendingAlertNote.style.display = noPending ? 'none' : 'block';
    }

    const noNewConvictions = checkConvictions ? checkConvictions.checked : true;
    if (newConvictionContainer) {
      newConvictionContainer.style.display = noNewConvictions ? 'none' : 'block';
    }

    const dateVal = dateInput ? dateInput.value : '';
    const finesPaid = checkFines ? checkFines.checked : true;
    const sentenceComplete = (checkSentenceRow && checkSentenceRow.style.display !== 'none' && checkSentence) ? checkSentence.checked : true;
    const diversionComplete = (checkDiversionRow && checkDiversionRow.style.display !== 'none' && checkDiversion) ? checkDiversion.checked : true;

    // Update progressive disclosure badge state
    const calcDisclosure = document.getElementById('calcDisclosure');
    const calcDisclosureBadge = document.getElementById('calcDisclosureBadge');
    const hasActiveCaveat = !finesPaid || !noPending || !noNewConvictions || !sentenceComplete || !diversionComplete;
    if (calcDisclosureBadge) {
      if (hasActiveCaveat) {
        calcDisclosureBadge.textContent = 'Special Conditions Active';
        calcDisclosureBadge.style.color = '#dc2626';
        calcDisclosureBadge.style.borderColor = 'rgba(220, 38, 38, 0.3)';
        calcDisclosureBadge.style.background = 'rgba(220, 38, 38, 0.08)';
      } else {
        calcDisclosureBadge.textContent = 'Default: Clean Record';
        calcDisclosureBadge.style.color = '';
        calcDisclosureBadge.style.borderColor = '';
        calcDisclosureBadge.style.background = '';
      }
    }
    if (hasActiveCaveat && calcDisclosure && !calcDisclosure.open) {
      calcDisclosure.open = true;
    }

    // Elements
    const statusBadge = document.getElementById('resBadge');
    const headline = document.getElementById('resHeadline');
    const statCitation = document.getElementById('resStatute');
    const waitingPeriodVal = document.getElementById('resWaiting');
    const elapsedVal = document.getElementById('resElapsed');
    const courtStandardVal = document.getElementById('resStandard');
    const explanation = document.getElementById('resExplanation');
    const progressBar = document.getElementById('resProgressBar');
    const progressText = document.getElementById('resProgressText');

    statCitation.textContent = tier.statute;
    waitingPeriodVal.textContent = `${tier.waitingYears} Year${tier.waitingYears > 1 ? 's' : ''}`;
    courtStandardVal.textContent = tier.grantType;

    // Validate date
    if (!dateVal) {
      statusBadge.className = 'status-badge status-badge-warning';
      statusBadge.innerHTML = 'Enter Date';
      headline.textContent = 'Date Required';
      elapsedVal.textContent = 'Enter date above';
      explanation.innerHTML = 'Please enter your date of sentencing, dismissal, or arrest to calculate your statutory waiting period.';
      if (progressBar) progressBar.style.width = '0%';
      if (progressText) progressText.textContent = '0% (Date needed)';
      return;
    }

    const inputDate = new Date(dateVal);
    const today = new Date();

    if (inputDate > today) {
      statusBadge.className = 'status-badge status-badge-danger';
      statusBadge.innerHTML = 'Invalid Date';
      headline.textContent = 'Date Cannot Be in the Future';
      elapsedVal.textContent = 'Invalid (Future date)';
      explanation.innerHTML = 'Please enter a valid past date of conviction, sentencing, dismissal, or arrest.';
      if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.style.background = 'var(--color-danger, #dc2626)';
      }
      if (progressText) progressText.textContent = 'Invalid date';
      return;
    }

    const diffMs = today - inputDate;
    const yearsElapsed = Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 365.25));

    const targetDate = new Date(inputDate);
    targetDate.setFullYear(targetDate.getFullYear() + tier.waitingYears);
    const remainingMs = targetDate - today;
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
    const isTimeMet = yearsElapsed >= tier.waitingYears;

    elapsedVal.textContent = `${yearsElapsed.toFixed(1)} Years elapsed`;

    // Visual progress bar
    const progressPct = Math.min(100, Math.max(0, (yearsElapsed / tier.waitingYears) * 100));
    if (progressBar) {
      progressBar.style.width = `${progressPct.toFixed(0)}%`;
      progressBar.style.background = progressPct >= 100 ? 'var(--color-emerald-600, #059669)' : 'var(--color-blue-600, #2563eb)';
    }
    if (progressText) {
      progressText.textContent = isTimeMet
        ? '100% Waiting Period Complete'
        : `${progressPct.toFixed(0)}% Complete (${daysRemaining} days remaining)`;
    }

    // STATUTORY EVALUATION HIERARCHY
    // 1. Pending Criminal Charges (Absolute Statutory Bar)
    if (!noPending) {
      statusBadge.className = 'status-badge status-badge-danger';
      statusBadge.innerHTML = 'Statutorily Barred: Pending Charges';
      headline.textContent = 'Expungement Barred by Active Pending Charges';
      courtStandardVal.textContent = 'Barred by Statute';
      if (progressBar) {
        progressBar.style.background = 'var(--color-danger, #dc2626)';
      }
      if (progressText) {
        progressText.textContent = 'Barred: Pending Criminal Charges';
      }
      explanation.innerHTML = `Under <b>${tier.statute}</b> and IC § 35-38-9-1(b)(3), § 2(d)(3), § 3(e)(3), § 4(e)(3), and § 5(e)(3), a person is <b>strictly prohibited</b> from petitioning for or receiving an expungement while ANY criminal charges are pending against them in any court.<br><br><b>What you must do:</b> You cannot file an expungement petition until all pending criminal matters reach a final disposition (such as a dismissal, acquittal, or completion of sentence).`;
      return;
    }

    // 2. Subsequent Conviction Invalidation (Clean Period Reset)
    if (!noNewConvictions) {
      const newConvVal = newConvictionDateInput ? newConvictionDateInput.value : '';
      if (newConvVal) {
        const newConvDate = new Date(newConvVal);
        if (newConvDate > today) {
          statusBadge.className = 'status-badge status-badge-danger';
          statusBadge.innerHTML = 'Invalid Subsequent Conviction Date';
          headline.textContent = 'Date Cannot Be in the Future';
          explanation.innerHTML = 'Please enter the actual date on which your subsequent conviction was entered.';
          return;
        }

        const cleanElapsed = Math.max(0, (today - newConvDate) / (1000 * 60 * 60 * 24 * 365.25));
        const cleanTarget = new Date(newConvDate);
        cleanTarget.setFullYear(cleanTarget.getFullYear() + tier.waitingYears);
        const cleanRemainingDays = Math.max(0, Math.ceil((cleanTarget - today) / (1000 * 60 * 60 * 24)));

        if (cleanElapsed < tier.waitingYears) {
          statusBadge.className = 'status-badge status-badge-danger';
          statusBadge.innerHTML = 'Ineligible: Clean Period Reset';
          headline.textContent = 'Waiting Clock Reset by Subsequent Conviction';
          courtStandardVal.textContent = 'Ineligible (Clock Reset)';
          const cleanPct = Math.min(100, Math.max(0, (cleanElapsed / tier.waitingYears) * 100));
          if (progressBar) {
            progressBar.style.width = `${cleanPct.toFixed(0)}%`;
            progressBar.style.background = 'var(--color-danger, #dc2626)';
          }
          if (progressText) {
            progressText.textContent = `Clean Clock: ${cleanPct.toFixed(0)}% (${cleanRemainingDays} days left)`;
          }
          explanation.innerHTML = `Under <b>${tier.statute}</b> (IC § 35-38-9-2(d)(2) &amp; § 3(d)(2)), Indiana law requires that you have <b>NO criminal convictions</b> during the entire statutory waiting period immediately before filing.<br><br>Your conviction on <b>${newConvDate.toLocaleDateString()}</b> reset your clean waiting period. You have completed <b>${cleanElapsed.toFixed(1)}</b> of the required <b>${tier.waitingYears}</b> clean years.<br><b>Projected Eligibility Date:</b> ~${cleanTarget.toLocaleDateString()} (${cleanRemainingDays} days remaining).`;
          return;
        }
      } else {
        statusBadge.className = 'status-badge status-badge-danger';
        statusBadge.innerHTML = 'Ineligible: Subsequent Conviction';
        headline.textContent = 'Clean Waiting Period Broken';
        courtStandardVal.textContent = 'Ineligible (Subsequent Conviction)';
        if (progressBar) progressBar.style.background = 'var(--color-danger, #dc2626)';
        if (progressText) progressText.textContent = 'Clean Period Broken';
        explanation.innerHTML = `Under <b>${tier.statute}</b>, you must not have been convicted of any crime within the statutory waiting window immediately preceding your petition. A subsequent conviction resets your waiting clock. Enter the date of your newest conviction above to see your recalculation.`;
        return;
      }
    }

    // 3. Pretrial Diversion / Deferral (Tier 1 Bar)
    if (tierKey === 'tier1' && !diversionComplete) {
      statusBadge.className = 'status-badge status-badge-warning';
      statusBadge.innerHTML = 'Ineligible: Active Diversion Program';
      headline.textContent = 'Diversion Program Must Be Completed';
      courtStandardVal.textContent = 'Ineligible (Active Diversion)';
      explanation.innerHTML = `Under <b>IC § 35-38-9-1(a)(2)</b>, a person currently participating in a pretrial diversion program, deferral program, or informal adjustment cannot petition to expunge arrest records until the program is fully completed and charges are formally dismissed.`;
      return;
    }

    // 4. Statutory Waiting Period Not Met
    if (!isTimeMet) {
      statusBadge.className = 'status-badge status-badge-warning';
      statusBadge.innerHTML = 'Waiting Period In Progress';
      headline.textContent = `Eligible in ~${daysRemaining} Days`;
      const dateTypeStr = tierKey === 'tier1' ? 'dismissal or arrest' : 'sentencing / conviction';
      explanation.innerHTML = `Under <b>${tier.statute}</b>, you must wait at least <b>${tier.waitingYears} years</b> from the date of ${dateTypeStr}. Based on the date provided, you have completed <b>${yearsElapsed.toFixed(1)}</b> of the required <b>${tier.waitingYears}</b> years. (Note: The Prosecuting Attorney may grant written permission to file early under IC § 35-38-9-9(b)).`;
      return;
    }

    // 5. Statutory Pre-Filing Prerequisites (Fines, Restitution, Sentence completion)
    if (!finesPaid || !sentenceComplete) {
      statusBadge.className = 'status-badge status-badge-danger';
      statusBadge.innerHTML = 'Statutory Prerequisite Required';
      headline.textContent = 'Pre-Filing Requirements Incomplete';
      let missing = [];
      if (!finesPaid) missing.push('All court costs, fines, and victim restitution must be paid in full (IC § 35-38-9-2(d)(1) / § 3(e)(1))');
      if (!sentenceComplete) missing.push('Statutory post-sentence waiting period (3 to 5 years after probation/parole/DOC release) must be complete');
      explanation.innerHTML = `Although the waiting period from sentencing has elapsed, Indiana law requires that all statutory conditions be satisfied prior to filing:<br>• ${missing.join('<br>• ')}`;
      return;
    }

    // 6. Statutorily Eligible
    if (tier.grantType.includes('Mandatory')) {
      statusBadge.className = 'status-badge status-badge-success';
      statusBadge.innerHTML = 'Statutorily Eligible (Mandatory Grant)';
      headline.textContent = 'Court Required By Law To Grant';
      explanation.innerHTML = `Under <b>${tier.statute}</b>, if you satisfy all statutory prerequisites, the Indiana court <b>SHALL</b> grant the expungement. The judge does not have discretion to deny a compliant petition.`;
    } else if (tier.grantType.includes('Discretionary')) {
      statusBadge.className = 'status-badge status-badge-warning';
      statusBadge.innerHTML = 'Statutorily Eligible (Judicial Discretion)';
      headline.textContent = 'Court Holds Judicial Discretion';
      explanation.innerHTML = `Under <b>${tier.statute}</b>, you meet the statutory eligibility threshold to petition the court. The judge <b>MAY</b> grant expungement after evaluating evidence of rehabilitation and prosecutor input.`;
    } else {
      statusBadge.className = 'status-badge status-badge-warning';
      statusBadge.innerHTML = 'Prosecutor Written Consent Required';
      headline.textContent = 'Prosecutor Approval Required Before Filing';
      explanation.innerHTML = `Under <b>${tier.statute}</b>, serious violent felony expungements strictly require the written consent of the Prosecuting Attorney before the court can grant relief.`;
    }
  }

  tierRadios.forEach(r => r.addEventListener('change', update));
  if (dateInput) dateInput.addEventListener('input', update);
  if (checkFines) checkFines.addEventListener('change', update);
  if (checkPending) checkPending.addEventListener('change', update);
  if (checkConvictions) checkConvictions.addEventListener('change', update);
  if (newConvictionDateInput) newConvictionDateInput.addEventListener('input', update);
  if (checkDiversion) checkDiversion.addEventListener('change', update);
  if (checkSentence) checkSentence.addEventListener('change', update);

  window.__recalcExpungement = update;
  update();
}

/* Quick Date Presets */
function initDatePresets() {
  const presets = document.querySelectorAll('[data-preset-years]');
  const dateInput = document.getElementById('calcDate');
  if (!dateInput) return;

  presets.forEach(btn => {
    btn.addEventListener('click', () => {
      const years = parseFloat(btn.getAttribute('data-preset-years'));
      const d = new Date();
      d.setFullYear(d.getFullYear() - years);
      dateInput.value = d.toISOString().split('T')[0];
      if (window.__recalcExpungement) window.__recalcExpungement();
    });
  });
}

/* ==========================================================================
   4. Document Details Modal
   ========================================================================== */
const DOCUMENT_DETAILS = {
  'doc-00-a': {
    title: 'Consolidated Pro Se Petition Packet (All Documents Combined)',
    code: 'DOC 00-A',
    authority: 'Indiana Trial Rules & Rules of Court',
    destination: 'Trial Court Clerk / Odyssey E-Filing',
    desc: 'The master combined PDF containing all 10 pleadings ordered in statutory filing sequence for single-upload electronic filing or physical clerk window delivery.',
    notes: 'Generated automatically with page numbers and standard caption block.'
  },
  'doc-00-b': {
    title: 'Step-by-Step Pro Se Instructions & Warning Guide',
    code: 'DOC 00-B',
    authority: 'IC § 35-38-9-9(i) Advisory',
    destination: 'Petitioner Copy (Keep for Records)',
    desc: 'Provides a clear 6-step walkthrough for filing pro se in Indiana courts, serving the prosecutor, setting court hearings, and monitoring Odyssey docket updates.',
    notes: 'Includes critical warnings regarding the irreversible Lifetime One-Shot rule.'
  },
  'doc-01': {
    title: 'Appearance Form for Self-Represented Person in Civil Case',
    code: 'DOC 01',
    authority: 'Indiana Trial Rule 3.1',
    destination: 'County Clerk & Case File',
    desc: 'Officially registers your appearance as an unrepresented pro se petitioner in the new Miscellaneous (XP) civil expungement cause.',
    notes: 'Provides service address and contact details for official court notices.'
  },
  'doc-02': {
    title: 'Notice of Exclusion of Confidential Information from Public Access',
    code: 'DOC 02',
    authority: 'Indiana Access to Court Records (ACR) Rule 5',
    destination: 'Public Court Record',
    desc: 'Mandatory formal notification declaring that confidential identifiers (Social Security Number, Date of Birth, Driver’s License) are excluded from the public court docket.',
    notes: 'Placed in the public file to satisfy mandatory Indiana public access requirements.'
  },
  'doc-03': {
    title: 'Confidential Information Sheet (Form ACR - Green Paper)',
    code: 'DOC 03',
    authority: 'ACR Rule 5 & IC § 35-38-9-8(b)',
    destination: 'Sealed Confidential Court Envelope',
    desc: 'Contains your sensitive personal identifiers (full SSN, DOB, driver\'s license number, and 10-year address history) required by court administration for background verification.',
    notes: 'Filed separately under seal or marked confidential in the E-Filing system.'
  },
  'doc-04': {
    title: 'Verified Petition for Expungement of Conviction & Arrest Records',
    code: 'DOC 04',
    authority: 'Indiana Code §§ 35-38-9-1 through 35-38-9-8',
    destination: 'Presiding Judge',
    desc: 'The substantive core petition itemizing all qualifying Indiana cause numbers, charges, disposition dates, and affirmations required by statute, verified under penalty of perjury.',
    notes: 'Must include all convictions in the county to comply with the Lifetime One-Shot rule.'
  },
  'doc-05': {
    title: 'Notice of Filing to Prosecuting Attorney',
    code: 'DOC 05',
    authority: 'Indiana Code § 35-38-9-9(g)',
    destination: 'County Prosecuting Attorney',
    desc: 'Formal 30-day statutory notice delivered to the County Prosecutor advising them of the expungement filing, initiating the statutory prosecutorial response window.',
    notes: 'The prosecutor has 30 days to file a response or consent to expungement.'
  },
  'doc-06': {
    title: 'Certificate of Service',
    code: 'DOC 06',
    authority: 'Indiana Trial Rule 5',
    destination: 'Trial Court File',
    desc: 'Sworn affirmation specifying the precise method and date on which the Petition and Notice were served upon the Prosecuting Attorney (Certified Mail, IEFS E-Service, or Hand Delivery).',
    notes: 'Essential proof required before the judge can enter an expungement order.'
  },
  'doc-07': {
    title: 'Proposed Order Granting Expungement of Records',
    code: 'DOC 07',
    authority: 'Indiana Code §§ 35-38-9-1 through 35-38-9-6',
    destination: 'Presiding Judge Signature',
    desc: 'Court-ready draft order containing specific statutory sealing mandates directing the Indiana State Police, Bureau of Motor Vehicles, local law enforcement agencies, and Court Technology to redact/seal the records.',
    notes: 'Signed by the judge upon approval and transmitted to all state repositories.'
  },
  'doc-08': {
    title: 'Verified Request for Fee Waiver & Proposed Order (Indigency)',
    code: 'DOC 08',
    authority: 'Indiana Code § 33-37-3-2',
    destination: 'Presiding Judge',
    desc: 'Indigent petition and proposed judicial order requesting waiver of the standard $157 civil filing fee for petitioners receiving public assistance or demonstrating financial hardship.',
    notes: 'Optional pleading included automatically for petitioners who cannot afford court costs.'
  }
};

function initDocumentModal() {
  const modal = document.getElementById('docModal');
  const closeBtn = document.getElementById('modalCloseBtn');
  const items = document.querySelectorAll('.doc-list-item');
  if (!modal) return;

  function openModal(key) {
    const data = DOCUMENT_DETAILS[key];
    if (!data) return;

    document.getElementById('modalDocCode').textContent = data.code;
    document.getElementById('modalDocTitle').textContent = data.title;
    document.getElementById('modalDocAuthority').textContent = data.authority;
    document.getElementById('modalDocDest').textContent = data.destination;
    document.getElementById('modalDocDesc').textContent = data.desc;
    document.getElementById('modalDocNotes').textContent = data.notes;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  items.forEach(item => {
    item.addEventListener('click', () => {
      const key = item.getAttribute('data-doc-key');
      if (key) openModal(key);
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
}

/* ==========================================================================
   4b. Statutory Rules Engine Floating Modal
   ========================================================================== */
function initRulesEngineModal() {
  const modal = document.getElementById('rulesEngineModal');
  const closeBtn = document.getElementById('rulesModalCloseBtn');
  const openBtns = document.querySelectorAll('#openRulesModalBtn, .open-rules-btn-alt, a[href="#assessment"], a[href="#eligibility"]');
  if (!modal) return;

  function openModal() {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    const selectedRadio = document.querySelector('input[name="calcTier"]:checked');
    if (selectedRadio) {
      selectedRadio.dispatchEvent(new Event('change'));
    }
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  openBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  if (window.location.hash === '#assessment' || window.location.hash === '#eligibility') {
    openModal();
  }
}

/* ==========================================================================
   5. User Guide Tabs
   ========================================================================== */
function initGuideTabs() {
  const tabBtns = document.querySelectorAll('.guide-tab-btn');
  const tabPanes = document.querySelectorAll('.guide-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Handle direct hash navigation to instructions or usage
  function checkHash() {
    if (window.location.hash === '#instructions' || window.location.hash === '#tab-usage' || window.location.hash === '#usage') {
      const usageBtn = document.querySelector('.guide-tab-btn[data-tab="tab-usage"]');
      if (usageBtn) usageBtn.click();
    }
  }
  checkHash();
  window.addEventListener('hashchange', checkHash);
}

/* ==========================================================================
   7. Copy Buttons
   ========================================================================== */
function initCopyButtons() {
  const copyBtns = document.querySelectorAll('.btn-snippet-copy');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pre = btn.parentElement.querySelector('pre');
      if (!pre) return;
      const text = pre.innerText;

      navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied';
        btn.style.backgroundColor = 'rgba(16, 185, 129, 0.5)';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.backgroundColor = '';
        }, 2000);
      });
    });
  });

  const bookmarkletCopyBtns = document.querySelectorAll('.btn-bookmarklet-copy');
  bookmarkletCopyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-copy-code') || "javascript:(function(){const s=document.createElement('script');s.src='https://cambrianminds.github.io/exp-2/bookmarklet.js?v='+Date.now();document.body.appendChild(s);})();";
      navigator.clipboard.writeText(code).then(() => {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>✓ Copied to Clipboard!</span>';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.classList.remove('copied');
        }, 2500);
      });
    });
  });
}

/* ==========================================================================
   8. Mobile Navigation
   ========================================================================== */
function initMobileNav() {
  const toggle = document.querySelector('.mobile-nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (toggle && navLinks) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = navLinks.classList.toggle('mobile-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.textContent = isOpen ? '✕ Close' : 'Menu';
    });

    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = 'Menu';
      });
    });

    document.addEventListener('click', (e) => {
      if (!navLinks.contains(e.target) && !toggle.contains(e.target)) {
        navLinks.classList.remove('mobile-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = 'Menu';
      }
    });
  }
}

/* ==========================================================================
   9. Scroll Effects & Back to Top
   ========================================================================== */
function initScrollEffects() {
  const navbar = document.querySelector('.navbar');
  const backToTopBtn = document.getElementById('backToTop');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;

    // Navbar shadow & glassmorphism boost
    if (navbar) {
      if (scrollY > 20) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }

    // Back to top visibility
    if (backToTopBtn) {
      if (scrollY > 400) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    }
  }, { passive: true });

  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

/* ==========================================================================
   10. Hash Navigation & Details Auto-Expansion
   ========================================================================== */
function initHashExpansion() {
  function expandTarget(targetId) {
    if (!targetId) return;
    const cleanId = targetId.replace(/^#/, '');
    if (!cleanId) return;

    const target = document.getElementById(cleanId);
    if (!target) return;

    if (target.tagName === 'DETAILS') {
      target.open = true;
    } else {
      const parentDetails = target.closest('details');
      if (parentDetails) {
        parentDetails.open = true;
      }
      if (cleanId === 'assessment' || cleanId === 'eligibility') {
        const rulesModal = document.getElementById('rulesEngineModal');
        if (rulesModal) {
          rulesModal.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
      } else if (cleanId === 'documents' || cleanId === 'pleadings') {
        const pld = document.getElementById('pleadings-details');
        if (pld) pld.open = true;
      }
    }

    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  if (window.location.hash) {
    expandTarget(window.location.hash);
  }

  window.addEventListener('hashchange', () => {
    expandTarget(window.location.hash);
  });

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      const href = link.getAttribute('href');
      if (href && href.length > 1) {
        expandTarget(href);
      }
    });
  });
}

/* ==========================================================================
   11. Persistent Statutory Notice Banner
   ========================================================================== */
function initStatutoryBanner() {
  const banner = document.getElementById('statutoryBanner');
  const toggleBtn = document.getElementById('btnToggleStatutoryBanner');
  const pillBtn = document.getElementById('statutoryBannerPill');
  if (!banner || !toggleBtn || !pillBtn) return;

  const isDismissed = localStorage.getItem('statutory_banner_minimized') === 'true';
  if (isDismissed) {
    banner.classList.add('minimized');
    pillBtn.style.display = 'block';
    document.body.classList.add('statutory-banner-dismissed');
  }

  toggleBtn.addEventListener('click', () => {
    banner.classList.add('minimized');
    pillBtn.style.display = 'block';
    document.body.classList.add('statutory-banner-dismissed');
    localStorage.setItem('statutory_banner_minimized', 'true');
  });

  pillBtn.addEventListener('click', () => {
    banner.classList.remove('minimized');
    pillBtn.style.display = 'none';
    document.body.classList.remove('statutory-banner-dismissed');
    localStorage.setItem('statutory_banner_minimized', 'false');
  });
}

