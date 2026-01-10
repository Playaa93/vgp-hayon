// VGP Hayon - Application JavaScript

// Theme Toggle (système par défaut, override manuel possible)
const themeToggle = document.getElementById('theme-toggle');
const iconSun = document.getElementById('icon-sun');
const iconMoon = document.getElementById('icon-moon');
const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

function setTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
  iconSun.style.display = isDark ? 'none' : 'block';
  iconMoon.style.display = isDark ? 'block' : 'none';
}

// Initialize from saved preference or system
const savedTheme = localStorage.getItem('vgp-theme');
if (savedTheme) {
  setTheme(savedTheme === 'dark');
} else {
  setTheme(darkModeQuery.matches);
}

// Listen for system theme changes (only if no manual preference)
darkModeQuery.addEventListener('change', (e) => {
  if (!localStorage.getItem('vgp-theme')) {
    setTheme(e.matches);
  }
});

// Manual toggle
themeToggle.addEventListener('click', () => {
  const isDark = !document.documentElement.classList.contains('dark');
  setTheme(isDark);
  localStorage.setItem('vgp-theme', isDark ? 'dark' : 'light');
});

// ========== TAB NAVIGATION ==========

const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

function switchTab(tabName) {
  // Update buttons
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update panels
  tabPanels.forEach(panel => {
    panel.classList.toggle('active', panel.dataset.panel === tabName);
  });

  // Scroll to top of main content
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Save current tab
  localStorage.setItem('vgp-current-tab', tabName);
}

// Tab click handlers
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

// Update tab status badges
function updateTabStatuses() {
  const sections = {
    'docs': { tab: 'tab-status-docs', total: 6 },
    'visuel': { tab: 'tab-status-visuel', total: 14 },
    'securite': { tab: 'tab-status-securite', total: 7 },
    'essais': { tab: 'tab-status-essais', total: 4 }
  };

  Object.keys(sections).forEach(sectionName => {
    const items = document.querySelectorAll(`.check-item[data-section="${sectionName}"]`);
    let completed = 0;

    items.forEach(item => {
      const status = item.dataset.status;
      if (status === 'c' || status === 'na') completed++;
    });

    const statusEl = document.getElementById(sections[sectionName].tab);
    if (statusEl) {
      statusEl.textContent = `${completed}/${sections[sectionName].total}`;

      // Mark tab as complete if all items done
      const tabBtn = statusEl.closest('.tab-btn');
      if (tabBtn) {
        tabBtn.classList.toggle('complete', completed === sections[sectionName].total);
      }
    }
  });
}

// Restore last tab on load
const savedTab = localStorage.getItem('vgp-current-tab');
if (savedTab) {
  switchTab(savedTab);
}

// ========== END TAB NAVIGATION ==========

// Service Worker Registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log('Service Worker registered'))
    .catch(err => console.log('SW registration failed:', err));
}

// ========== DYNAMIC SECTIONS BASED ON EQUIPMENT TYPE ==========

const typeEquipementSelect = document.getElementById('type-equipement');
const marquageCeSelect = document.getElementById('marquage-ce');
const hauteurLevageInput = document.getElementById('hauteur-levage');
const immatGroup = document.getElementById('immat-group');
const hintGardeCorps = document.getElementById('hint-garde-corps');
const calcBoxCe = document.getElementById('calc-box-ce');
const calcBoxNonCe = document.getElementById('calc-box-non-ce');

// Hide all conditional sections initially
function hideAllConditionalSections() {
  document.querySelectorAll('.conditional-section').forEach(section => {
    section.style.display = 'none';
  });
}

// Update visible sections based on equipment type
function updateVisibleSections() {
  const type = typeEquipementSelect.value;
  const hauteur = parseFloat(hauteurLevageInput.value) || 0;

  // Hide all conditional sections first
  hideAllConditionalSections();

  // Show/hide immatriculation based on type
  if (type.startsWith('table-')) {
    immatGroup.style.display = 'none';
  } else {
    immatGroup.style.display = 'block';
  }

  // Show relevant sections based on type
  if (type) {
    document.querySelectorAll('.conditional-section').forEach(section => {
      const requires = section.dataset.requires.split(',');
      if (requires.includes(type)) {
        section.style.display = 'block';
      }
    });
  }

  // Show garde-corps section if hauteur > 1.6m
  const gardeCorpsSection = document.getElementById('section-garde-corps');
  if (hauteur > 1.6) {
    gardeCorpsSection.style.display = 'block';
    hintGardeCorps.style.display = 'block';
  } else {
    hintGardeCorps.style.display = 'none';
  }

  // Update section status for newly visible sections
  updateAllSectionStatuses();
}

// Update all section statuses
function updateAllSectionStatuses() {
  const sections = ['docs', 'visuel', 'securite', 'essais', 'chassis', 'stabilisateurs', 'energie', 'poste', 'garde-corps'];
  sections.forEach(section => {
    const sectionEl = document.getElementById(section);
    if (sectionEl && sectionEl.closest('.card').style.display !== 'none') {
      updateSectionStatus(section);
    }
  });
}

// Event listeners for dynamic updates
typeEquipementSelect.addEventListener('change', updateVisibleSections);
hauteurLevageInput.addEventListener('input', updateVisibleSections);

// CE / Non-CE coefficient toggle
marquageCeSelect.addEventListener('change', () => {
  const isCe = marquageCeSelect.value === 'ce';
  calcBoxCe.style.display = isCe ? 'block' : 'none';
  calcBoxNonCe.style.display = isCe ? 'none' : 'block';
  updateCharges();
});

// Initialize - hide conditional sections
hideAllConditionalSections();

// ========== END DYNAMIC SECTIONS ==========

// ========== REQUIRED QUESTIONS SYSTEM ==========

// Define required questions based on equipment type
// 'all' = required for all types
// 'hayon-*' = required for all hayon types
// 'table-*' = required for all table types
// specific type = required only for that type
const requiredQuestions = {
  // Documents - always required
  'docs-0': ['all'],  // Plaque signalétique
  'docs-1': ['all'],  // CMU / Abaque
  'docs-3': ['all'],  // Certificat CE

  // Contrôle visuel - structure
  'visuel-0': ['all'],  // Fixation châssis
  'visuel-2': ['all'],  // État général

  // Contrôle visuel - hydraulique
  'visuel-5': ['all'],  // Flexibles
  'visuel-6': ['all'],  // Vérins

  // Contrôle visuel - spécifique hayons
  'visuel-7': ['hayon-rabattable', 'hayon-repliable', 'hayon-gerbeur', 'hayon-potence', 'hayon-lateral'],  // Verrouillage position route

  // Sécurité - always required
  'securite-0': ['all'],  // Limiteur de charge
  'securite-1': ['all'],  // Limiteur de débit
  'securite-2': ['all'],  // Freinage vertical

  // Sécurité - spécifique hayons
  'securite-3': ['hayon-rabattable', 'hayon-repliable', 'hayon-gerbeur', 'hayon-potence', 'hayon-lateral'],  // Stop palette
  'securite-4': ['hayon-rabattable', 'hayon-repliable', 'hayon-gerbeur', 'hayon-potence', 'hayon-lateral'],  // Drapeaux

  // Essais - always required
  'essais-0': ['all'],  // Mouvements fonctionnels
  'essais-1': ['all'],  // Épreuve dynamique
  'essais-2': ['all'],  // Épreuve statique
  'essais-3': ['all'],  // Maintien de charge

  // Sections conditionnelles - required when visible
  'chassis-0': ['table-mobile'],
  'chassis-1': ['table-mobile'],
  'chassis-2': ['table-mobile'],

  'stab-0': ['table-fixe', 'table-mobile'],
  'stab-1': ['table-fixe', 'table-mobile'],
  'stab-2': ['table-fixe', 'table-mobile'],

  'energie-0': ['table-fixe', 'table-mobile', 'hayon-gerbeur'],
  'energie-1': ['table-fixe', 'table-mobile', 'hayon-gerbeur'],
  'energie-2': ['table-fixe', 'table-mobile', 'hayon-gerbeur'],

  'poste-0': ['hayon-gerbeur', 'table-mobile'],
  'poste-1': ['hayon-gerbeur', 'table-mobile'],

  // Garde-corps - required when height > 1.6m (handled separately)
  'gc-0': ['hauteur-1.6'],
  'gc-1': ['hauteur-1.6'],
  'gc-2': ['hauteur-1.6']
};

// Check if a question is required for the current equipment type
function isQuestionRequired(questionId) {
  const currentType = typeEquipementSelect.value;
  const hauteur = parseFloat(hauteurLevageInput.value) || 0;

  if (!currentType) return false;

  const requirements = requiredQuestions[questionId];
  if (!requirements) return false;

  // Check hauteur condition
  if (requirements.includes('hauteur-1.6')) {
    return hauteur > 1.6;
  }

  // Check if always required
  if (requirements.includes('all')) return true;

  // Check specific type match
  if (requirements.includes(currentType)) return true;

  // Check hayon-* wildcard
  if (currentType.startsWith('hayon-') && requirements.some(r => r.startsWith('hayon-'))) {
    return requirements.includes(currentType);
  }

  // Check table-* wildcard
  if (currentType.startsWith('table-') && requirements.some(r => r.startsWith('table-'))) {
    return requirements.includes(currentType);
  }

  return false;
}

// Update required visual state for all questions
function updateRequiredQuestions() {
  document.querySelectorAll('.check-item').forEach(item => {
    const questionId = item.dataset.id;
    const isRequired = isQuestionRequired(questionId);

    item.classList.toggle('required', isRequired);

    // Update label with required indicator
    const label = item.querySelector('.item-label');
    if (label) {
      // Remove existing indicator
      const existingIndicator = label.querySelector('.required-indicator');
      if (existingIndicator) existingIndicator.remove();

      // Add indicator if required
      if (isRequired) {
        const indicator = document.createElement('span');
        indicator.className = 'required-indicator';
        indicator.textContent = '*';
        label.appendChild(indicator);
      }
    }
  });
}

// Validate all required questions are answered
function validateRequiredQuestions() {
  const currentType = typeEquipementSelect.value;
  if (!currentType) {
    return { valid: false, missing: [], message: 'Veuillez sélectionner un type d\'équipement' };
  }

  const missing = [];

  document.querySelectorAll('.check-item.required').forEach(item => {
    // Skip if in hidden section
    const section = item.closest('.card');
    if (section && section.style.display === 'none') return;

    const status = item.dataset.status;
    if (!status) {
      const label = item.querySelector('.item-label');
      const text = label ? label.textContent.replace('*', '').trim() : item.dataset.id;
      missing.push({
        id: item.dataset.id,
        label: text,
        section: item.dataset.section
      });
    }
  });

  return {
    valid: missing.length === 0,
    missing: missing,
    message: missing.length > 0
      ? `${missing.length} question(s) obligatoire(s) non renseignée(s)`
      : ''
  };
}

// Show validation errors
function showValidationErrors(validation) {
  if (validation.valid) return;

  // Highlight missing questions
  validation.missing.forEach(q => {
    const item = document.querySelector(`.check-item[data-id="${q.id}"]`);
    if (item) {
      item.classList.add('validation-error');
      setTimeout(() => item.classList.remove('validation-error'), 3000);
    }
  });

  // Show alert with missing questions
  const missingList = validation.missing.slice(0, 5).map(q => `• ${q.label}`).join('\n');
  const moreText = validation.missing.length > 5
    ? `\n... et ${validation.missing.length - 5} autre(s)`
    : '';

  alert(`${validation.message}\n\n${missingList}${moreText}`);

  // Navigate to first missing question's tab
  if (validation.missing.length > 0) {
    const firstMissing = validation.missing[0];
    const tabMapping = {
      'docs': 'documents',
      'visuel': 'controle',
      'securite': 'securite',
      'essais': 'essais',
      'chassis': 'controle',
      'stabilisateurs': 'controle',
      'energie': 'controle',
      'poste': 'controle',
      'garde-corps': 'controle'
    };
    const targetTab = tabMapping[firstMissing.section];
    if (targetTab) {
      switchTab(targetTab);
      // Scroll to the item
      setTimeout(() => {
        const item = document.querySelector(`.check-item[data-id="${firstMissing.id}"]`);
        if (item) {
          item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }
}

// Update required questions when type changes
typeEquipementSelect.addEventListener('change', updateRequiredQuestions);
hauteurLevageInput.addEventListener('input', updateRequiredQuestions);

// Initial update
setTimeout(updateRequiredQuestions, 100);

// ========== END REQUIRED QUESTIONS SYSTEM ==========

// DOM Elements
const cmuInput = document.getElementById('cmu');
const chargeDyn = document.getElementById('charge-dyn');
const chargeStat = document.getElementById('charge-stat');
const chargeDynNc = document.getElementById('charge-dyn-nc');
const chargeStatNc = document.getElementById('charge-stat-nc');
const dateInspection = document.getElementById('date-inspection');

// Initialize date to today
dateInspection.valueAsDate = new Date();

// VGP periodicity by equipment type (in months)
// Based on arrêté du 1er mars 2004 and usage intensity
function getVgpDelayMonths(equipmentType) {
  const delays = {
    'hayon-rabattable': 12,    // Standard
    'hayon-repliable': 12,     // Standard
    'hayon-gerbeur': 6,        // Usage intensif, gerbage
    'hayon-potence': 12,       // Standard
    'hayon-lateral': 12,       // Standard
    'table-fixe': 12,          // Standard
    'table-mobile': 6          // Mobile = plus de risques
  };
  return delays[equipmentType] || 12;
}

// Calculate next VGP date based on equipment type
function updateProchaineVgp() {
  const type = typeEquipementSelect.value;
  const delayMonths = getVgpDelayMonths(type);
  const baseDate = dateInspection.valueAsDate || new Date();
  const nextVgp = new Date(baseDate);
  nextVgp.setMonth(nextVgp.getMonth() + delayMonths);
  prochaineVgp.valueAsDate = nextVgp;
}

const prochaineVgp = document.getElementById('prochaine-vgp');

// Set initial next VGP (default 12 months)
const nextYear = new Date();
nextYear.setFullYear(nextYear.getFullYear() + 1);
prochaineVgp.valueAsDate = nextYear;

// Update prochaine VGP when equipment type or inspection date changes
typeEquipementSelect.addEventListener('change', updateProchaineVgp);
dateInspection.addEventListener('change', updateProchaineVgp);

// Inspecteur - Show/Hide "Autre" field
const inspecteurSelect = document.getElementById('inspecteur');
const inspecteurAutreGroup = document.getElementById('inspecteur-autre-group');
const inspecteurAutreInput = document.getElementById('inspecteur-autre');

inspecteurSelect.addEventListener('change', () => {
  if (inspecteurSelect.value === 'autre') {
    inspecteurAutreGroup.style.display = 'block';
    inspecteurAutreInput.focus();
  } else {
    inspecteurAutreGroup.style.display = 'none';
    inspecteurAutreInput.value = '';
  }
});

function getInspecteurValue() {
  return inspecteurSelect.value === 'autre' ? inspecteurAutreInput.value : inspecteurSelect.value;
}

function setInspecteurValue(value) {
  const options = Array.from(inspecteurSelect.options).map(o => o.value);
  if (options.includes(value)) {
    inspecteurSelect.value = value;
    inspecteurAutreGroup.style.display = 'none';
  } else if (value) {
    inspecteurSelect.value = 'autre';
    inspecteurAutreInput.value = value;
    inspecteurAutreGroup.style.display = 'block';
  }
}

// Marque Hayon - Show/Hide "Autre" field
const marqueSelect = document.getElementById('marque-hayon');
const marqueAutreGroup = document.getElementById('marque-autre-group');
const marqueAutreInput = document.getElementById('marque-hayon-autre');

marqueSelect.addEventListener('change', () => {
  if (marqueSelect.value === 'autre') {
    marqueAutreGroup.style.display = 'block';
    marqueAutreInput.focus();
  } else {
    marqueAutreGroup.style.display = 'none';
    marqueAutreInput.value = '';
  }
});

// Helper to get actual marque value
function getMarqueValue() {
  return marqueSelect.value === 'autre' ? marqueAutreInput.value : marqueSelect.value;
}

// Helper to set marque value (for loading)
function setMarqueValue(value) {
  const options = Array.from(marqueSelect.options).map(o => o.value);
  if (options.includes(value)) {
    marqueSelect.value = value;
    marqueAutreGroup.style.display = 'none';
  } else if (value) {
    marqueSelect.value = 'autre';
    marqueAutreInput.value = value;
    marqueAutreGroup.style.display = 'block';
  }
}

// Immatriculation Auto-Format (AB-123-CD)
const immatInput = document.getElementById('immat');
immatInput.addEventListener('input', formatImmat);

function formatImmat(e) {
  let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Format: AA-123-BB
  if (value.length > 2) {
    value = value.slice(0, 2) + '-' + value.slice(2);
  }
  if (value.length > 6) {
    value = value.slice(0, 6) + '-' + value.slice(6);
  }

  // Limit to 9 characters (AA-123-BB)
  value = value.slice(0, 9);

  e.target.value = value;
}

// CMU Calculations
cmuInput.addEventListener('input', updateCharges);

function updateCharges() {
  const cmu = parseFloat(cmuInput.value) || 0;
  const isCe = marquageCeSelect.value === 'ce';

  // CE coefficients: dynamique 1.1, statique 1.25
  const dynChargeCe = Math.round(cmu * 1.1);
  const statChargeCe = Math.round(cmu * 1.25);

  // Non-CE coefficients: dynamique 1.2, statique 1.5
  const dynChargeNc = Math.round(cmu * 1.2);
  const statChargeNc = Math.round(cmu * 1.5);

  // Update CE displays
  chargeDyn.textContent = dynChargeCe || '-';
  chargeStat.textContent = statChargeCe || '-';

  // Update Non-CE displays
  if (chargeDynNc) chargeDynNc.textContent = dynChargeNc || '-';
  if (chargeStatNc) chargeStatNc.textContent = statChargeNc || '-';

  // Update info boxes in essais section with appropriate values
  const dynValue = isCe ? dynChargeCe : dynChargeNc;
  const statValue = isCe ? statChargeCe : statChargeNc;
  const dynCoef = isCe ? '1.1' : '1.2';
  const statCoef = isCe ? '1.25' : '1.5';

  document.querySelectorAll('.charge-dyn-val').forEach(el => el.textContent = dynValue || '-');
  document.querySelectorAll('.charge-stat-val').forEach(el => el.textContent = statValue || '-');
}

// Section Toggle
document.querySelectorAll('.section-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const sectionId = toggle.dataset.section;
    const content = document.getElementById(sectionId);
    const icon = toggle.querySelector('.toggle-icon');

    content.classList.toggle('collapsed');
    icon.style.transform = content.classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0)';
  });
});

// Status Selector (C/NC/NCA/NA)
document.querySelectorAll('.status-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const item = e.target.closest('.check-item');
    const section = item.dataset.section;
    const status = e.target.dataset.status;
    const noteInput = item.querySelector('.note');

    // Remove active from all buttons in this item
    item.querySelectorAll('.status-btn').forEach(b => {
      b.classList.remove('active-c', 'active-nc', 'active-nca', 'active-na');
    });

    // Remove item status classes
    item.classList.remove('status-c', 'status-nc', 'status-nca', 'status-na');

    // Add active to clicked button
    e.target.classList.add(`active-${status}`);

    // Add status class to item
    item.classList.add(`status-${status}`);

    // Store status in data attribute
    item.dataset.status = status;

    // If NC or NCA, focus on observation field and make it required
    if (status === 'nc' || status === 'nca') {
      noteInput.setAttribute('required', 'true');
      noteInput.placeholder = 'Observation OBLIGATOIRE';
      noteInput.focus();
      item.classList.add('needs-observation');
    } else {
      noteInput.removeAttribute('required');
      noteInput.placeholder = 'Observation';
      item.classList.remove('needs-observation');
    }

    updateSectionStatus(section);
    updateVerdictFromStatus();
  });
});

// Auto-update verdict based on NC/NCA status
function updateVerdictFromStatus() {
  const avisSelect = document.getElementById('avis');
  let hasNCA = false;
  let hasNC = false;

  document.querySelectorAll('.check-item').forEach(item => {
    const status = item.dataset.status;
    if (status === 'nca') hasNCA = true;
    if (status === 'nc') hasNC = true;
  });

  // Auto-set verdict based on findings
  if (hasNCA) {
    avisSelect.value = 'non-conforme';
    showToast('Verdict auto: NON CONFORME (mise à l\'arrêt)');
  } else if (hasNC) {
    avisSelect.value = 'reserve';
    showToast('Verdict auto: Conforme sous réserve');
  }
}

function updateSectionStatus(section) {
  const items = document.querySelectorAll(`.check-item[data-section="${section}"]`);
  let completed = 0;
  let total = items.length;

  items.forEach(item => {
    const status = item.dataset.status;
    if (status === 'c' || status === 'na') {
      completed++;
    }
  });

  const statusEl = document.getElementById(`${section}-status`);
  if (statusEl) {
    statusEl.textContent = `${completed}/${total}`;
    statusEl.classList.toggle('complete', completed === total);
  }

  // Also update tab badges
  updateTabStatuses();
}

// Initialize status counts
['docs', 'visuel', 'securite', 'essais'].forEach(updateSectionStatus);
updateTabStatuses(); // Initial tab status update

// Note input for issues
document.querySelectorAll('.check-item .note').forEach(note => {
  note.addEventListener('input', (e) => {
    const item = e.target.closest('.check-item');
    const status = item.dataset.status;

    // Show issue highlight if note exists and status is NC or not set
    if (e.target.value && (status === 'nc' || !status)) {
      item.classList.add('has-note');
    } else {
      item.classList.remove('has-note');
    }
  });
});

// Save Inspection
document.getElementById('btn-save').addEventListener('click', saveInspection);

function saveInspection(skipValidation = false) {
  // Validate required questions (unless skipping for draft save)
  if (!skipValidation) {
    const validation = validateRequiredQuestions();
    if (!validation.valid) {
      // Ask if user wants to save as draft anyway
      const saveDraft = confirm(
        `${validation.message}\n\nVoulez-vous quand même sauvegarder comme brouillon ?`
      );
      if (!saveDraft) {
        showValidationErrors(validation);
        return;
      }
    }
  }

  const inspection = collectFormData();

  // Get existing inspections
  const inspections = JSON.parse(localStorage.getItem('vgp-inspections') || '[]');

  // Add or update
  const existingIndex = inspections.findIndex(i => i.id === inspection.id);
  if (existingIndex >= 0) {
    inspections[existingIndex] = inspection;
  } else {
    inspection.id = Date.now().toString();
    inspections.unshift(inspection);
  }

  localStorage.setItem('vgp-inspections', JSON.stringify(inspections));
  localStorage.setItem('vgp-current', inspection.id);

  showToast('Inspection sauvegardée');
  loadInspectionsList();
}

function collectFormData() {
  const data = {
    id: localStorage.getItem('vgp-current') || Date.now().toString(),
    dateInspection: document.getElementById('date-inspection').value,
    inspecteur: getInspecteurValue(),
    typeEquipement: document.getElementById('type-equipement').value,
    marquageCe: document.getElementById('marquage-ce').value,
    client: document.getElementById('client').value,
    immat: document.getElementById('immat').value,
    marqueHayon: getMarqueValue(),
    numSerie: document.getElementById('num-serie').value,
    cmu: document.getElementById('cmu').value,
    hauteurLevage: document.getElementById('hauteur-levage').value,
    chargeEssai: document.getElementById('charge-essai').value,
    avis: document.getElementById('avis').value,
    observations: document.getElementById('observations').value,
    prochaineVgp: document.getElementById('prochaine-vgp').value,
    sections: {}
  };

  // Collect status and notes
  document.querySelectorAll('.check-item').forEach((item) => {
    const note = item.querySelector('.note');
    const section = item.dataset.section;
    const status = item.dataset.status || '';

    if (section) {
      if (!data.sections[section]) data.sections[section] = [];
      data.sections[section].push({
        status: status,
        note: note?.value || ''
      });
    }
  });

  return data;
}

// Load Inspection
function loadInspection(id) {
  const inspections = JSON.parse(localStorage.getItem('vgp-inspections') || '[]');
  const inspection = inspections.find(i => i.id === id);

  if (!inspection) return;

  localStorage.setItem('vgp-current', id);

  // Fill form fields
  document.getElementById('date-inspection').value = inspection.dateInspection || '';
  setInspecteurValue(inspection.inspecteur || '');
  document.getElementById('client').value = inspection.client || '';
  document.getElementById('immat').value = inspection.immat || '';
  setMarqueValue(inspection.marqueHayon || '');
  document.getElementById('num-serie').value = inspection.numSerie || '';
  document.getElementById('cmu').value = inspection.cmu || '';
  document.getElementById('charge-essai').value = inspection.chargeEssai || '';
  document.getElementById('avis').value = inspection.avis || '';
  document.getElementById('observations').value = inspection.observations || '';
  document.getElementById('prochaine-vgp').value = inspection.prochaineVgp || '';

  // Restore dynamic section fields
  document.getElementById('type-equipement').value = inspection.typeEquipement || '';
  document.getElementById('marquage-ce').value = inspection.marquageCe || 'ce';
  document.getElementById('hauteur-levage').value = inspection.hauteurLevage || '';

  // Update CE/Non-CE display boxes
  const isCe = (inspection.marquageCe || 'ce') === 'ce';
  calcBoxCe.style.display = isCe ? 'block' : 'none';
  calcBoxNonCe.style.display = isCe ? 'none' : 'block';

  updateCharges();

  // Update visible sections based on equipment type
  updateVisibleSections();

  // Fill status and notes
  Object.keys(inspection.sections || {}).forEach(section => {
    const items = document.querySelectorAll(`.check-item[data-section="${section}"]`);
    inspection.sections[section].forEach((data, index) => {
      if (items[index]) {
        const item = items[index];
        const noteInput = item.querySelector('.note');
        if (noteInput) noteInput.value = data.note || '';

        // Handle both old (checked) and new (status) format
        let status = data.status;
        if (!status && data.checked !== undefined) {
          // Convert old format
          status = data.checked ? 'c' : '';
        }

        // Update visual state
        item.classList.remove('status-c', 'status-nc', 'status-nca', 'status-na');
        item.querySelectorAll('.status-btn').forEach(btn => {
          btn.classList.remove('active-c', 'active-nc', 'active-nca', 'active-na');
        });

        if (status) {
          item.dataset.status = status;
          item.classList.add(`status-${status}`);
          const activeBtn = item.querySelector(`.status-btn[data-status="${status}"]`);
          if (activeBtn) activeBtn.classList.add(`active-${status}`);
        }

        // Show note indicator for NC/NCA
        if (data.note && (status === 'nc' || status === 'nca' || !status)) {
          item.classList.add('has-note');
        }

        // Mark needs-observation for NC/NCA
        if (status === 'nc' || status === 'nca') {
          item.classList.add('needs-observation');
          const noteInput = item.querySelector('.note');
          if (noteInput) {
            noteInput.setAttribute('required', 'true');
            noteInput.placeholder = 'Observation OBLIGATOIRE';
          }
        }
      }
    });
    updateSectionStatus(section);
  });

  showToast('Inspection chargée');
}

// New Inspection
document.getElementById('btn-new').addEventListener('click', () => {
  if (confirm('Créer une nouvelle inspection ? Les données non sauvegardées seront perdues.')) {
    localStorage.removeItem('vgp-current');
    location.reload();
  }
});

// Generate PDF
document.getElementById('btn-pdf').addEventListener('click', generatePDF);

function generatePDF() {
  // Validate required questions - mandatory for PDF
  const validation = validateRequiredQuestions();
  if (!validation.valid) {
    showValidationErrors(validation);
    alert('Impossible de générer le PDF : toutes les questions obligatoires doivent être renseignées.');
    return;
  }

  // Also check if conclusion is set
  const avis = document.getElementById('avis').value;
  if (!avis) {
    alert('Veuillez renseigner l\'avis de l\'inspecteur avant de générer le PDF.');
    switchTab('conclusion');
    return;
  }

  const data = collectFormData();
  const isCe = data.marquageCe === 'ce';
  const dynCoef = isCe ? 1.1 : 1.2;
  const statCoef = isCe ? 1.25 : 1.5;

  // Generate standardized report number: VGP-YYYY-NNNN (year + sequential)
  const year = new Date(data.dateInspection).getFullYear();
  const reportNum = `VGP-${year}-${data.id.slice(-4).padStart(4, '0')}`;

  // Timestamp for traceability
  const generatedAt = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Count NC items for summary
  const ncCount = countNonConformities(data.sections);

  // Collect photos for PDF
  const photoHTML = generatePhotosHTML(data.photos);

  // Create printable content - Standard VGP format per arrêté du 1er mars 2004
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Rapport VGP ${reportNum} - ${data.client}</title>
      <style>
        /* ========== RESET & BASE ========== */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ========== PAGE SETUP (A4) ========== */
        @page {
          size: A4 portrait;
          margin: 12mm 10mm 15mm 10mm;
        }
        @page :first { margin-top: 10mm; }

        html { font-size: 10px; }
        body {
          font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          font-size: 9px;
          line-height: 1.35;
          color: #1a1a1a;
          background: white;
        }

        /* ========== HEADER - ORGANISME DE CONTRÔLE ========== */
        .report-header {
          border: 2px solid #1e3a5f;
          margin-bottom: 10px;
          page-break-inside: avoid;
        }
        .header-row {
          display: flex;
          border-bottom: 1px solid #e2e8f0;
        }
        .header-row:last-child { border-bottom: none; }

        .org-info {
          flex: 1;
          padding: 8px 10px;
          border-right: 1px solid #e2e8f0;
        }
        .org-name {
          font-size: 13px;
          font-weight: 700;
          color: #1e3a5f;
          letter-spacing: 0.5px;
        }
        .org-details {
          font-size: 8px;
          color: #4a5568;
          margin-top: 3px;
          line-height: 1.4;
        }

        .report-info {
          width: 140px;
          padding: 8px 10px;
          background: #f8fafc;
        }
        .report-num {
          font-size: 11px;
          font-weight: 700;
          color: #1e3a5f;
        }
        .report-meta {
          font-size: 7px;
          color: #718096;
          margin-top: 2px;
        }

        .header-title {
          text-align: center;
          padding: 10px;
          background: #1e3a5f;
          color: white;
        }
        .header-title h1 {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1px;
          margin-bottom: 2px;
        }
        .header-title .subtitle {
          font-size: 9px;
          opacity: 0.9;
        }

        .header-legal {
          padding: 6px 10px;
          background: #f1f5f9;
          font-size: 7px;
          color: #64748b;
          text-align: center;
          line-height: 1.4;
        }

        /* ========== INFO SECTIONS ========== */
        .info-grid {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }
        .info-grid > div { flex: 1; }

        .info-section { margin-bottom: 8px; }
        .info-section-title {
          font-size: 9px;
          font-weight: 700;
          color: white;
          background: #1e3a5f;
          padding: 4px 8px;
          margin-bottom: 0;
        }

        .info-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8px;
        }
        .info-table td {
          padding: 3px 6px;
          border: 1px solid #d1d5db;
          vertical-align: middle;
        }
        .info-table .label {
          background: #f3f4f6;
          color: #374151;
          font-weight: 600;
          width: 35%;
        }
        .info-table .value {
          background: white;
        }
        .info-table .value strong {
          color: #1e3a5f;
        }

        /* ========== CHARGES BOX ========== */
        .charges-box {
          background: #eff6ff;
          border: 1px solid #93c5fd;
          padding: 8px;
          margin-bottom: 8px;
          page-break-inside: avoid;
        }
        .charges-title {
          font-size: 9px;
          font-weight: 700;
          color: #1e40af;
          margin-bottom: 5px;
          text-align: center;
        }
        .charges-grid {
          display: flex;
          gap: 8px;
        }
        .charge-item {
          flex: 1;
          background: white;
          border: 1px solid #bfdbfe;
          padding: 6px;
          text-align: center;
        }
        .charge-item .label {
          font-size: 7px;
          color: #64748b;
          margin-bottom: 2px;
        }
        .charge-item .value {
          font-size: 11px;
          font-weight: 700;
          color: #1e40af;
        }
        .charge-item .coef {
          font-size: 7px;
          color: #94a3b8;
        }

        /* ========== LEGEND ========== */
        .legend {
          display: flex;
          gap: 12px;
          font-size: 7px;
          color: #374151;
          margin: 6px 0;
          padding: 4px 8px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          justify-content: center;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .legend-badge {
          display: inline-block;
          padding: 1px 5px;
          font-weight: 700;
          font-size: 12px;
        }
        .legend-badge.c { color: #1a5c38; }
        .legend-badge.nc { color: #d97706; }
        .legend-badge.nca { color: #8b1a1a; }
        .legend-badge.na { color: #000; }

        /* ========== CHECK SECTIONS ========== */
        .check-section {
          margin-bottom: 6px;
          page-break-inside: avoid;
        }
        .check-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #1e3a5f;
          color: white;
          padding: 4px 8px;
          font-size: 9px;
          font-weight: 600;
        }
        .check-section-header .article {
          font-size: 7px;
          font-weight: 400;
          opacity: 0.8;
        }

        .check-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8px;
        }
        .check-table th {
          background: #e5e7eb;
          padding: 3px 5px;
          text-align: left;
          font-weight: 600;
          border: 1px solid #d1d5db;
          font-size: 7px;
        }
        .check-table th.status-col { width: 40px; text-align: center; }
        .check-table th.obs-col { width: 25%; }

        .check-table td {
          padding: 3px 5px;
          border: 1px solid #d1d5db;
          vertical-align: middle;
        }
        .check-table tr:nth-child(even) td { background: #fafafa; }

        .status-cell { text-align: center; font-weight: 700; font-size: 14px; }
        .status-c { color: #1a5c38; }
        .status-nc { color: #d97706; }
        .status-nca { color: #8b1a1a; }
        .status-na { color: #000; }

        .obs-cell { font-style: italic; color: #6b7280; font-size: 7px; }
        .required-mark { color: #dc2626; }

        /* ========== CONCLUSION ========== */
        .conclusion-section {
          border: 2px solid #1e3a5f;
          margin-top: 10px;
          page-break-inside: avoid;
        }
        .conclusion-header {
          background: #1e3a5f;
          color: white;
          padding: 6px 10px;
          font-size: 10px;
          font-weight: 700;
        }
        .conclusion-body { padding: 10px; }

        .verdict {
          text-align: center;
          padding: 10px;
          margin-bottom: 10px;
          font-size: 12px;
          font-weight: 700;
          border-radius: 4px;
          border-width: 2px;
          border-style: solid;
        }
        .verdict.conforme {
          color: #1a5c38;
          border-color: #1a5c38;
        }
        .verdict.reserve {
          color: #8b6914;
          border-color: #8b6914;
        }
        .verdict.non-conforme {
          color: #8b1a1a;
          border-color: #8b1a1a;
        }

        .conclusion-grid {
          display: flex;
          gap: 10px;
          font-size: 8px;
        }
        .conclusion-grid > div { flex: 1; }
        .conclusion-label {
          font-weight: 700;
          color: #374151;
          margin-bottom: 3px;
        }
        .conclusion-value {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          padding: 6px;
          min-height: 35px;
        }

        .nc-summary {
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 6px;
          margin-top: 8px;
          font-size: 8px;
        }
        .nc-summary-title {
          font-weight: 700;
          color: #991b1b;
          margin-bottom: 3px;
        }

        /* ========== SIGNATURES ========== */
        .signatures {
          display: flex;
          gap: 15px;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid #d1d5db;
        }
        .signature-box { flex: 1; }
        .signature-label {
          font-size: 8px;
          font-weight: 700;
          color: #374151;
          margin-bottom: 3px;
        }
        .signature-info {
          font-size: 7px;
          color: #6b7280;
          margin-bottom: 5px;
        }
        .signature-line {
          border-bottom: 1px solid #1a1a1a;
          height: 35px;
          margin-top: 5px;
        }
        .signature-img {
          max-width: 100%;
          max-height: 45px;
          margin-top: 5px;
          object-fit: contain;
        }

        /* Stamp placeholder */
        .stamp-box {
          width: 60px;
          height: 60px;
          border: 1px dashed #9ca3af;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 6px;
          color: #9ca3af;
          text-align: center;
        }

        /* ========== FOOTER ========== */
        .report-footer {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 2px solid #1e3a5f;
          font-size: 7px;
          color: #6b7280;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .footer-legal {
          line-height: 1.4;
        }
        .footer-ref {
          text-align: right;
        }

        /* ========== PHOTOS SECTION ========== */
        .photos-section {
          page-break-before: always;
          margin-top: 15px;
        }
        .photos-section-title {
          font-size: 10px;
          font-weight: 700;
          color: white;
          background: #1e3a5f;
          padding: 6px 10px;
          margin-bottom: 8px;
        }
        .photos-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .photo-item {
          width: calc(33.33% - 6px);
          border: 1px solid #d1d5db;
        }
        .photo-item img {
          width: 100%;
          height: auto;
          display: block;
        }
        .photo-caption {
          font-size: 7px;
          color: #6b7280;
          padding: 3px 5px;
          background: #f9fafb;
          text-align: center;
        }

        /* ========== PRINT STYLES ========== */
        @media print {
          html, body {
            width: 210mm;
            background: white;
          }
          .check-section { page-break-inside: avoid; }
          .conclusion-section { page-break-inside: avoid; }
          .signatures { page-break-inside: avoid; }
          .photos-section { page-break-before: always; }
        }
      </style>
    </head>
    <body>
      <!-- ========== REPORT HEADER ========== -->
      <header class="report-header">
        <div class="header-row">
          <div class="org-info">
            <div class="org-name">FLEETZEN</div>
            <div class="org-details">
              Organisme de contrôle technique<br>
              Vérifications réglementaires des équipements de travail
            </div>
          </div>
          <div class="report-info">
            <div class="report-num">N° ${reportNum}</div>
            <div class="report-meta">
              Généré le ${generatedAt}<br>
              Page 1/1
            </div>
          </div>
        </div>
        <div class="header-title">
          <h1>RAPPORT DE VÉRIFICATION GÉNÉRALE PÉRIODIQUE</h1>
          <div class="subtitle">Appareil de levage − ${getEquipmentTypeLabel(data.typeEquipement)}</div>
        </div>
        <div class="header-legal">
          Conformément à l'Arrêté du 1er mars 2004 relatif aux vérifications des appareils et accessoires de levage
          − Articles R.4323-23 à R.4323-27 du Code du Travail
        </div>
      </header>

      <!-- ========== IDENTIFICATION ========== -->
      <div class="info-grid">
        <div class="info-section">
          <div class="info-section-title">IDENTIFICATION DE L'APPAREIL</div>
          <table class="info-table">
            <tr><td class="label">Type d'équipement</td><td class="value">${getEquipmentTypeLabel(data.typeEquipement)}</td></tr>
            <tr><td class="label">Marque / Modèle</td><td class="value">${(data.marqueHayon || '−').toUpperCase()}</td></tr>
            <tr><td class="label">N° de série</td><td class="value"><strong>${data.numSerie || '−'}</strong></td></tr>
            <tr><td class="label">Immatriculation</td><td class="value">${data.immat || 'N/A'}</td></tr>
            <tr><td class="label">Marquage CE</td><td class="value">${isCe ? 'OUI' : 'NON'}</td></tr>
            <tr><td class="label">CMU</td><td class="value"><strong>${data.cmu || '−'} kg</strong></td></tr>
            <tr><td class="label">Hauteur levage</td><td class="value">${data.hauteurLevage || '−'} m</td></tr>
          </table>
        </div>
        <div class="info-section">
          <div class="info-section-title">INTERVENTION</div>
          <table class="info-table">
            <tr><td class="label">Client / Propriétaire</td><td class="value"><strong>${data.client || '−'}</strong></td></tr>
            <tr><td class="label">Date d'inspection</td><td class="value"><strong>${formatDateFR(data.dateInspection)}</strong></td></tr>
            <tr><td class="label">Inspecteur</td><td class="value">${data.inspecteur || '−'}</td></tr>
            <tr><td class="label">Charge d'essai</td><td class="value">${data.chargeEssai || '−'} kg</td></tr>
            <tr><td class="label">Prochaine VGP</td><td class="value"><strong>${formatDateFR(data.prochaineVgp)}</strong></td></tr>
          </table>
        </div>
      </div>

      <!-- ========== CHARGES D'ÉPREUVE ========== -->
      <div class="charges-box">
        <div class="charges-title">CHARGES D'ÉPREUVE RÉGLEMENTAIRES (${isCe ? 'Appareil CE' : 'Appareil non CE'})</div>
        <div class="charges-grid">
          <div class="charge-item">
            <div class="label">CMU Nominale</div>
            <div class="value">${data.cmu || '−'} kg</div>
          </div>
          <div class="charge-item">
            <div class="label">Épreuve Dynamique</div>
            <div class="value">${Math.round((data.cmu || 0) * dynCoef)} kg</div>
            <div class="coef">CMU × ${dynCoef}</div>
          </div>
          <div class="charge-item">
            <div class="label">Épreuve Statique</div>
            <div class="value">${Math.round((data.cmu || 0) * statCoef)} kg</div>
            <div class="coef">CMU × ${statCoef}</div>
          </div>
        </div>
      </div>

      <!-- ========== LÉGENDE ========== -->
      <div class="legend">
        <div class="legend-item"><span class="legend-badge c">✔</span> Conforme</div>
        <div class="legend-item"><span class="legend-badge nc">⚠</span> NC (réserve)</div>
        <div class="legend-item"><span class="legend-badge nca">✘</span> NC (arrêt)</div>
        <div class="legend-item"><span class="legend-badge na">—</span> N/A</div>
        <div class="legend-item"><span class="required-mark">*</span> Point obligatoire</div>
      </div>

      <!-- ========== CONTRÔLES ========== -->
      ${generateStandardSectionHTML("1. EXAMEN D'ADEQUATION ET DOCUMENTAIRE", "Art. 5 - Arrete 01/03/2004", data.sections.docs, [
        { label: 'Plaque signalétique lisible et complète', required: true },
        { label: 'CMU / Abaque de charges présent et lisible', required: true },
        { label: 'Consignes de sécurité affichées', required: false },
        { label: 'Certificat de conformité CE disponible', required: true },
        { label: 'Notice d\'utilisation présente', required: false },
        { label: 'Carnet de maintenance à jour', required: false }
      ])}

      ${generateStandardSectionHTML("2. EXAMEN DE L'ETAT DE CONSERVATION", "Art. 9 - Arrete 01/03/2004", data.sections.visuel, [
        { label: 'Fixation châssis − serrage et état des boulons', required: true },
        { label: 'Revêtement sol antidérapant', required: false },
        { label: 'État général structure (déformation, corrosion, fissures)', required: true },
        { label: 'Axes et arrêts d\'axes', required: false },
        { label: 'Traverse et articulations', required: false },
        { label: 'Flexibles hydrauliques (fuite, usure)', required: true },
        { label: 'Vérins hydrauliques (fuite, état)', required: true },
        { label: 'Verrouillage position route', required: true },
        { label: 'Verrouillage boîtier poste bas', required: false },
        { label: 'Commande bi-manuelle conforme', required: false },
        { label: 'Identification des commandes', required: false },
        { label: 'Sélecteur de commande', required: false },
        { label: 'Arrêt d\'urgence', required: false },
        { label: 'Retour au neutre automatique', required: false }
      ])}

      ${generateStandardSectionHTML("3. DISPOSITIFS DE SECURITE", "Art. 9 - Arrete 01/03/2004", data.sections.securite, [
        { label: 'Limiteur de charge (déclenchement ≤ 110% CMU)', required: true },
        { label: 'Limiteur de débit (vitesse descente ≤ 0,15 m/s)', required: true },
        { label: 'Freinage vertical (descente ≤ 10 cm)', required: true },
        { label: 'Stop palette / butée de charge', required: true },
        { label: 'Drapeaux de signalisation', required: false },
        { label: 'Bandes réfléchissantes', required: false },
        { label: 'Feux à éclats / gyrophare', required: false }
      ])}

      ${generateStandardSectionHTML("4. ESSAIS DE FONCTIONNEMENT ET EPREUVES", "Art. 10-11 - Arrete 01/03/2004", data.sections.essais, [
        { label: 'Essai des mouvements (montée, descente, inclinaison)', required: true },
        { label: 'Épreuve dynamique − charge ' + Math.round((data.cmu || 0) * dynCoef) + ' kg', required: true },
        { label: 'Épreuve statique 1h − charge ' + Math.round((data.cmu || 0) * statCoef) + ' kg', required: true },
        { label: 'Maintien de charge 10 min (descente ≤ 10 cm)', required: true }
      ])}

      <!-- ========== CONCLUSION ========== -->
      <section class="conclusion-section">
        <div class="conclusion-header">CONCLUSION DE LA VÉRIFICATION</div>
        <div class="conclusion-body">
          <div class="verdict ${data.avis}">${getAvisTextFormal(data.avis)}</div>

          ${ncCount > 0 ? `
          <div class="nc-summary">
            <div class="nc-summary-title">Non-conformités relevées : ${ncCount}</div>
            ${generateNCList(data.sections)}
          </div>
          ` : ''}

          <div class="conclusion-grid">
            <div>
              <div class="conclusion-label">Observations / Réserves :</div>
              <div class="conclusion-value">${data.observations || 'Néant'}</div>
            </div>
            <div>
              <div class="conclusion-label">Actions correctives :</div>
              <div class="conclusion-value">${getActionsCorrectivesText(data.avis)}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- ========== SIGNATURES ========== -->
      <div class="signatures">
        <div class="signature-box">
          <div class="signature-label">Inspecteur</div>
          <div class="signature-info">
            ${data.inspecteur || '−'}<br>
            Le ${formatDateFR(data.dateInspection)}
          </div>
          ${data.signature ? `<img class="signature-img" src="${data.signature}" alt="Signature">` : '<div class="signature-line"></div>'}
        </div>
        <div class="signature-box">
          <div class="signature-label">Client / Représentant</div>
          <div class="signature-info">
            ${data.client || '−'}<br>
            Lu et approuvé, le
          </div>
          <div class="signature-line"></div>
        </div>
        <div class="signature-box" style="flex: 0 0 auto;">
          <div class="signature-label">Cachet</div>
          <div class="stamp-box">Cachet<br>organisme</div>
        </div>
      </div>

      <!-- ========== FOOTER ========== -->
      <footer class="report-footer">
        <div class="footer-legal">
          Ce rapport est établi conformément à l'arrêté du 1er mars 2004.<br>
          Document à conserver pendant 5 ans minimum (Art. R.4323-25 du Code du Travail).<br>
          L'original doit être tenu à disposition de l'inspection du travail.
        </div>
        <div class="footer-ref">
          <strong>Réf: ${reportNum}</strong><br>
          ${generatedAt}
        </div>
      </footer>

      ${photoHTML}
    </body>
    </html>
  `);
  printWindow.document.close();

  // Slight delay to ensure styles are loaded before print dialog
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

// Helper: Format date in French format
function formatDateFR(dateStr) {
  if (!dateStr) return '−';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Helper: Count non-conformities
function countNonConformities(sections) {
  let count = 0;
  Object.values(sections || {}).forEach(items => {
    items.forEach(item => {
      if (item.status === 'nc') count++;
    });
  });
  return count;
}

// Helper: Generate NC list for summary
function generateNCList(sections) {
  const ncItems = [];
  const sectionLabels = {
    docs: 'Documentation',
    visuel: 'État de conservation',
    securite: 'Sécurité',
    essais: 'Essais'
  };

  Object.entries(sections || {}).forEach(([section, items]) => {
    items.forEach((item, index) => {
      if (item.status === 'nc' && item.note) {
        ncItems.push(`• ${sectionLabels[section] || section} : ${item.note}`);
      }
    });
  });

  return ncItems.length > 0
    ? `<div style="font-size: 7px; margin-top: 3px;">${ncItems.join('<br>')}</div>`
    : '';
}

// Helper: Get actions correctives text
function getActionsCorrectivesText(avis) {
  switch (avis) {
    case 'non-conforme':
      return 'MISE HORS SERVICE IMMÉDIATE obligatoire. Réparation requise avant toute remise en service. Nouvelle VGP à effectuer après travaux.';
    case 'reserve':
      return 'Levée des réserves obligatoire dans un délai raisonnable. Tenir le registre de sécurité à jour.';
    case 'conforme':
      return 'Aucune action corrective requise. Maintien en service autorisé.';
    default:
      return '−';
  }
}

// Helper: Generate photos HTML for PDF
function generatePhotosHTML(photosData) {
  if (!photosData) return '';

  const allPhotos = [];

  // General photos
  if (photosData.general && photosData.general.length > 0) {
    photosData.general.forEach((photo, i) => {
      allPhotos.push({
        data: photo.data,
        caption: `Vue générale ${i + 1}`
      });
    });
  }

  // Item photos
  Object.entries(photosData.items || {}).forEach(([itemId, photos]) => {
    photos.forEach((photo, i) => {
      allPhotos.push({
        data: photo.data,
        caption: `${itemId} - Photo ${i + 1}`
      });
    });
  });

  if (allPhotos.length === 0) return '';

  return `
    <section class="photos-section">
      <div class="photos-section-title">ANNEXE PHOTOGRAPHIQUE (${allPhotos.length} photo${allPhotos.length > 1 ? 's' : ''})</div>
      <div class="photos-grid">
        ${allPhotos.map(photo => `
          <div class="photo-item">
            <img src="${photo.data}" alt="${photo.caption}">
            <div class="photo-caption">${photo.caption}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

// Get equipment type label
function getEquipmentTypeLabel(type) {
  const labels = {
    'hayon-rabattable': 'Hayon Rabattable',
    'hayon-repliable': 'Hayon Repliable',
    'hayon-gerbeur': 'Hayon Gerbeur',
    'hayon-potence': 'Hayon Potence',
    'hayon-lateral': 'Hayon Latéral',
    'table-fixe': 'Table Élévatrice Fixe',
    'table-mobile': 'Table Élévatrice Mobile'
  };
  return labels[type] || type || '-';
}

// Generate standard section HTML for PDF
function generateStandardSectionHTML(title, article, items, labels) {
  if (!items) return '';

  let html = `
    <div class="check-section">
      <div class="check-section-header">
        <span>${title}</span>
        <span class="article">${article}</span>
      </div>
      <table class="check-table">
        <thead>
          <tr>
            <th>Point de contrôle</th>
            <th class="status-col">Résultat</th>
            <th>Observations</th>
          </tr>
        </thead>
        <tbody>`;

  items.forEach((item, i) => {
    let status = item.status;
    if (!status && item.checked !== undefined) {
      status = item.checked ? 'c' : '';
    }

    let statusText, statusClass;
    switch (status) {
      case 'c': statusText = '✔'; statusClass = 'status-c'; break;
      case 'nc': statusText = '⚠'; statusClass = 'status-nc'; break;
      case 'nca': statusText = '✘'; statusClass = 'status-nca'; break;
      case 'na': statusText = '—'; statusClass = 'status-na'; break;
      default: statusText = '—'; statusClass = '';
    }

    const labelObj = labels[i] || { label: 'Point ' + (i + 1), required: false };
    const labelText = labelObj.label + (labelObj.required ? ' *' : '');

    html += `
      <tr>
        <td>${labelText}</td>
        <td class="status-cell ${statusClass}">${statusText}</td>
        <td class="obs-cell">${item.note || ''}</td>
      </tr>`;
  });

  html += `
        </tbody>
      </table>
    </div>`;

  return html;
}

// Get formal verdict text
function getAvisTextFormal(avis) {
  const texts = {
    'conforme': 'APPAREIL CONFORME - Maintien en service autorisé',
    'reserve': 'CONFORME SOUS RÉSERVES - Levée des réserves obligatoire',
    'non-conforme': 'APPAREIL NON CONFORME - Mise hors service immédiate'
  };
  return texts[avis] || 'RÉSULTAT NON DÉFINI';
}

function generateSectionHTML(title, items, labels) {
  if (!items) return '';

  let html = `<h2>${title}</h2><div class="check-list">`;
  items.forEach((item, i) => {
    // Handle both old (checked) and new (status) format
    let status = item.status;
    if (!status && item.checked !== undefined) {
      status = item.checked ? 'c' : '';
    }

    let icon, iconClass;
    switch (status) {
      case 'c':
        icon = 'C';
        iconClass = 'check';
        break;
      case 'nc':
        icon = 'NC';
        iconClass = 'cross';
        break;
      case 'na':
        icon = 'N/A';
        iconClass = 'na';
        break;
      default:
        icon = '-';
        iconClass = '';
    }

    const note = item.note ? `<span class="note"> - ${item.note}</span>` : '';
    html += `<div class="check-item"><span class="${iconClass}">${icon}</span> ${labels[i] || 'Item ' + (i+1)}${note}</div>`;
  });
  html += '</div>';
  return html;
}

function getAvisText(avis) {
  const texts = {
    'conforme': 'CONFORME - Utilisation autorisée',
    'reserve': 'CONFORME AVEC RÉSERVES',
    'non-conforme': 'NON CONFORME - Mise hors service'
  };
  return texts[avis] || 'Non défini';
}

// Inspections List
function loadInspectionsList() {
  const inspections = JSON.parse(localStorage.getItem('vgp-inspections') || '[]');
  const container = document.getElementById('liste-inspections');

  if (inspections.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Aucune inspection sauvegardée</p>';
    return;
  }

  container.innerHTML = inspections.map(insp => `
    <div class="inspection-item" onclick="loadInspection('${insp.id}')">
      <div class="info">
        <div class="date">${insp.dateInspection || 'Sans date'}</div>
        <div class="client">${insp.client || 'Sans client'} - ${insp.immat || ''}</div>
      </div>
      <span class="status ${insp.avis}">${getAvisShort(insp.avis)}</span>
    </div>
  `).join('');
}

function getAvisShort(avis) {
  const texts = { 'conforme': 'OK', 'reserve': 'Réserve', 'non-conforme': 'NC' };
  return texts[avis] || '-';
}

// Toast Notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// ========== PHOTO MANAGEMENT ==========

// Store photos in memory (will be saved with inspection)
let photos = {
  general: [],
  items: {} // { 'docs-0': [photo1, photo2], ... }
};

let currentPhotoTarget = null;
let currentLightboxPhoto = null;

const photoInputCamera = document.getElementById('photo-input-camera');
const photoInputGallery = document.getElementById('photo-input-gallery');
const photoInputGeneral = document.getElementById('photo-input-general');
const photoActionSheet = document.getElementById('photo-action-sheet');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

// Show photo action sheet
function capturePhoto(itemId) {
  currentPhotoTarget = itemId;
  photoActionSheet.classList.add('active');
}

// Capture general photo
function captureGeneralPhoto() {
  currentPhotoTarget = 'general';
  photoActionSheet.classList.add('active');
}

// Close photo action sheet
function closePhotoSheet() {
  photoActionSheet.classList.remove('active');
}

// Select photo source (camera or gallery)
function selectPhotoSource(source) {
  closePhotoSheet();
  if (source === 'camera') {
    photoInputCamera.click();
  } else {
    photoInputGallery.click();
  }
}

// Handle photo input change
photoInputCamera.addEventListener('change', handlePhotoCapture);
photoInputGallery.addEventListener('change', handlePhotoCapture);
if (photoInputGeneral) photoInputGeneral.addEventListener('change', handlePhotoCapture);

function handlePhotoCapture(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Compress and convert to base64
  compressImage(file, (base64) => {
    const photoData = {
      id: Date.now().toString(),
      data: base64,
      timestamp: new Date().toISOString()
    };

    if (currentPhotoTarget === 'general') {
      photos.general.push(photoData);
      renderGeneralPhotos();
    } else {
      if (!photos.items[currentPhotoTarget]) {
        photos.items[currentPhotoTarget] = [];
      }
      photos.items[currentPhotoTarget].push(photoData);
      renderItemPhotos(currentPhotoTarget);
    }

    updatePhotoCount();
    showToast('Photo ajoutée');
  });

  // Reset input
  e.target.value = '';
}

// Compress image before storing
function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxSize = 1200; // Max dimension
      let width = img.width;
      let height = img.height;

      if (width > height && width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Render general photos
function renderGeneralPhotos() {
  const container = document.getElementById('photos-generales');
  container.innerHTML = photos.general.map(photo => `
    <div class="photo-thumb" onclick="openLightbox('${photo.id}', 'general')">
      <img src="${photo.data}" alt="Photo">
      <button class="photo-delete" onclick="deletePhoto(event, '${photo.id}', 'general')">✕</button>
    </div>
  `).join('');
}

// Render item photos
function renderItemPhotos(itemId) {
  const item = document.querySelector(`.check-item[data-id="${itemId}"]`);
  if (!item) return;

  const container = item.querySelector('.photo-thumbs');
  const btn = item.querySelector('.btn-cam');
  const itemPhotos = photos.items[itemId] || [];

  container.innerHTML = itemPhotos.map(photo => `
    <div class="photo-thumb" onclick="openLightbox('${photo.id}', '${itemId}')">
      <img src="${photo.data}" alt="Photo">
    </div>
  `).join('');

  // Update button state
  if (itemPhotos.length > 0) {
    btn.classList.add('has-photos');
    btn.setAttribute('data-count', itemPhotos.length);
  } else {
    btn.classList.remove('has-photos');
    btn.removeAttribute('data-count');
  }
}

// Update photo count
function updatePhotoCount() {
  const totalGeneral = photos.general.length;
  const totalItems = Object.values(photos.items).reduce((sum, arr) => sum + arr.length, 0);
  const total = totalGeneral + totalItems;

  document.getElementById('photos-count').textContent = total;
}

// Open lightbox
function openLightbox(photoId, source) {
  let photo;
  if (source === 'general') {
    photo = photos.general.find(p => p.id === photoId);
  } else {
    photo = (photos.items[source] || []).find(p => p.id === photoId);
  }

  if (photo) {
    currentLightboxPhoto = { id: photoId, source };
    lightboxImg.src = photo.data;
    lightbox.classList.add('active');
  }
}

// Close lightbox
function closeLightbox() {
  lightbox.classList.remove('active');
  currentLightboxPhoto = null;
}

// Delete photo from lightbox
function deleteLightboxPhoto(e) {
  e.stopPropagation();
  if (!currentLightboxPhoto) return;

  if (confirm('Supprimer cette photo ?')) {
    deletePhotoById(currentLightboxPhoto.id, currentLightboxPhoto.source);
    closeLightbox();
  }
}

// Delete photo
function deletePhoto(e, photoId, source) {
  e.stopPropagation();
  if (confirm('Supprimer cette photo ?')) {
    deletePhotoById(photoId, source);
  }
}

function deletePhotoById(photoId, source) {
  if (source === 'general') {
    photos.general = photos.general.filter(p => p.id !== photoId);
    renderGeneralPhotos();
  } else {
    photos.items[source] = (photos.items[source] || []).filter(p => p.id !== photoId);
    renderItemPhotos(source);
  }
  updatePhotoCount();
  showToast('Photo supprimée');
}

// Close lightbox on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

// ========== UPDATE SAVE/LOAD FOR PHOTOS ==========

// Override collectFormData to include photos
const originalCollectFormData = collectFormData;
collectFormData = function() {
  const data = originalCollectFormData();
  data.photos = photos;
  data.signature = getSignatureData();
  return data;
};

// Override loadInspection to load photos
const originalLoadInspection = loadInspection;
loadInspection = function(id) {
  const inspections = JSON.parse(localStorage.getItem('vgp-inspections') || '[]');
  const inspection = inspections.find(i => i.id === id);

  if (inspection && inspection.photos) {
    photos = inspection.photos;
    renderGeneralPhotos();
    Object.keys(photos.items).forEach(renderItemPhotos);
    updatePhotoCount();
  } else {
    photos = { general: [], items: {} };
    renderGeneralPhotos();
    updatePhotoCount();
  }

  // Load signature
  if (inspection && inspection.signature) {
    loadSignatureData(inspection.signature);
  } else {
    clearSignature();
  }

  originalLoadInspection(id);
};

// ========== SIGNATURE ==========

const signatureCanvas = document.getElementById('signature-canvas');
const signatureContainer = signatureCanvas.parentElement;
const signaturePlaceholder = document.getElementById('signature-placeholder');
const signatureCtx = signatureCanvas.getContext('2d');

let isDrawing = false;
let hasSignature = false;

// Set canvas size
function resizeSignatureCanvas() {
  const rect = signatureContainer.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  signatureCanvas.width = rect.width * dpr;
  signatureCanvas.height = rect.height * dpr;
  signatureCtx.scale(dpr, dpr);
  signatureCtx.lineCap = 'round';
  signatureCtx.lineJoin = 'round';
  signatureCtx.lineWidth = 2.5;
  signatureCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() || '#000';
}

// Initialize
resizeSignatureCanvas();
window.addEventListener('resize', resizeSignatureCanvas);

// Get position from event
function getSignaturePos(e) {
  const rect = signatureCanvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

// Drawing handlers
function startDrawing(e) {
  e.preventDefault();
  isDrawing = true;
  signatureContainer.classList.add('active');
  const pos = getSignaturePos(e);
  signatureCtx.beginPath();
  signatureCtx.moveTo(pos.x, pos.y);
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const pos = getSignaturePos(e);
  signatureCtx.lineTo(pos.x, pos.y);
  signatureCtx.stroke();
  if (!hasSignature) {
    hasSignature = true;
    signatureContainer.classList.add('has-signature');
  }
}

function stopDrawing() {
  if (isDrawing) {
    isDrawing = false;
    signatureContainer.classList.remove('active');
    signatureCtx.closePath();
  }
}

// Event listeners
signatureCanvas.addEventListener('mousedown', startDrawing);
signatureCanvas.addEventListener('mousemove', draw);
signatureCanvas.addEventListener('mouseup', stopDrawing);
signatureCanvas.addEventListener('mouseleave', stopDrawing);

signatureCanvas.addEventListener('touchstart', startDrawing, { passive: false });
signatureCanvas.addEventListener('touchmove', draw, { passive: false });
signatureCanvas.addEventListener('touchend', stopDrawing);

// Clear signature
function clearSignature() {
  const rect = signatureContainer.getBoundingClientRect();
  signatureCtx.clearRect(0, 0, rect.width, rect.height);
  hasSignature = false;
  signatureContainer.classList.remove('has-signature');
}

// Get signature as base64
function getSignatureData() {
  if (!hasSignature) return null;
  return signatureCanvas.toDataURL('image/png');
}

// Load signature from base64
function loadSignatureData(dataUrl) {
  if (!dataUrl) return;
  const img = new Image();
  img.onload = () => {
    resizeSignatureCanvas();
    const rect = signatureContainer.getBoundingClientRect();
    signatureCtx.drawImage(img, 0, 0, rect.width, rect.height);
    hasSignature = true;
    signatureContainer.classList.add('has-signature');
  };
  img.src = dataUrl;
}

// ========== INITIALIZE ==========

loadInspectionsList();

// Load current inspection if exists
const currentId = localStorage.getItem('vgp-current');
if (currentId) {
  loadInspection(currentId);
}
