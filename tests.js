// VGP Inspection - Unit Tests
// Run in browser console or via test runner

(function() {
  'use strict';

  const TEST_RESULTS = [];
  let passCount = 0;
  let failCount = 0;

  // Test utilities
  function assert(condition, message) {
    if (condition) {
      passCount++;
      TEST_RESULTS.push({ status: 'PASS', message });
      console.log(`[PASS] ${message}`);
    } else {
      failCount++;
      TEST_RESULTS.push({ status: 'FAIL', message });
      console.error(`[FAIL] ${message}`);
    }
  }

  function resetForm() {
    // Reset equipment type
    document.getElementById('type-equipement').value = '';
    document.getElementById('marquage-ce').value = 'ce';
    document.getElementById('hauteur-levage').value = '';

    // Reset all check items
    document.querySelectorAll('.check-item').forEach(item => {
      delete item.dataset.status;
      item.className = 'check-item';
      item.querySelectorAll('.status-btn').forEach(btn => btn.classList.remove('active'));
    });

    // Trigger updates
    if (typeof updateVisibleSections === 'function') updateVisibleSections();
    if (typeof updateRequiredQuestions === 'function') updateRequiredQuestions();
  }

  function setEquipmentType(type) {
    const select = document.getElementById('type-equipement');
    select.value = type;
    select.dispatchEvent(new Event('change'));
  }

  function setHeight(height) {
    const input = document.getElementById('hauteur-levage');
    input.value = height;
    input.dispatchEvent(new Event('input'));
  }

  function setCE(isCE) {
    const select = document.getElementById('marquage-ce');
    select.value = isCE ? 'ce' : 'non-ce';
    select.dispatchEvent(new Event('change'));
  }

  function setQuestionStatus(questionId, status) {
    const item = document.querySelector(`.check-item[data-id="${questionId}"]`);
    if (item) {
      item.dataset.status = status;
      item.classList.add(`status-${status}`);
      const btn = item.querySelector(`.status-btn[data-status="${status}"]`);
      if (btn) btn.classList.add('active');
    }
  }

  function countRequiredQuestions() {
    return document.querySelectorAll('.check-item.required').length;
  }

  function countUnansweredRequired() {
    return document.querySelectorAll('.check-item.required:not([data-status])').length;
  }

  function isConditionalSectionVisible(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return false;
    const card = section.closest('.card');
    return card && card.style.display !== 'none';
  }

  // ============================================
  // TEST SUITE
  // ============================================

  console.log('\n[TEST] VGP UNIT TESTS - Starting...\n');
  console.log('=' .repeat(50));

  // ------------------------------------------
  // TEST 1: Hayon Rabattable - Basic Config
  // ------------------------------------------
  console.log('\n[CONFIG] Test 1: Hayon Rabattable - Configuration de base');
  resetForm();
  setEquipmentType('hayon-rabattable');

  assert(
    countRequiredQuestions() > 0,
    'Questions obligatoires détectées pour hayon rabattable'
  );

  assert(
    document.querySelector('.check-item[data-id="visuel-7"].required') !== null,
    'Verrouillage position route est obligatoire pour hayon'
  );

  assert(
    document.querySelector('.check-item[data-id="securite-3"].required') !== null,
    'Stop palette est obligatoire pour hayon'
  );

  assert(
    !isConditionalSectionVisible('section-chassis'),
    'Section Châssis est masquée pour hayon rabattable'
  );

  // ------------------------------------------
  // TEST 2: Table Mobile - Full Config
  // ------------------------------------------
  console.log('\n[CONFIG] Test 2: Table Mobile - Configuration complète');
  resetForm();
  setEquipmentType('table-mobile');

  assert(
    isConditionalSectionVisible('section-chassis'),
    'Section Châssis visible pour table mobile'
  );

  assert(
    isConditionalSectionVisible('section-stabilisateurs'),
    'Section Stabilisateurs visible pour table mobile'
  );

  assert(
    isConditionalSectionVisible('section-energie'),
    'Section Énergie visible pour table mobile'
  );

  assert(
    document.querySelector('.check-item[data-id="securite-3"].required') === null,
    'Stop palette N\'EST PAS obligatoire pour table'
  );

  // ------------------------------------------
  // TEST 3: Table Fixe - Config Minimale
  // ------------------------------------------
  console.log('\n[CONFIG] Test 3: Table Fixe - Configuration minimale');
  resetForm();
  setEquipmentType('table-fixe');

  assert(
    !isConditionalSectionVisible('section-chassis'),
    'Section Châssis masquée pour table fixe'
  );

  assert(
    isConditionalSectionVisible('section-stabilisateurs'),
    'Section Stabilisateurs visible pour table fixe'
  );

  assert(
    document.getElementById('immat-group').style.display === 'none',
    'Champ immatriculation masqué pour table'
  );

  // ------------------------------------------
  // TEST 4: Hayon Gerbeur - Config Spéciale
  // ------------------------------------------
  console.log('\n[CONFIG] Test 4: Hayon Gerbeur - Configuration spéciale');
  resetForm();
  setEquipmentType('hayon-gerbeur');

  assert(
    isConditionalSectionVisible('section-energie'),
    'Section Énergie visible pour gerbeur'
  );

  assert(
    isConditionalSectionVisible('section-poste'),
    'Section Poste de Conduite visible pour gerbeur'
  );

  assert(
    document.querySelector('.check-item[data-id="poste-0"].required') !== null,
    'Protège-tête obligatoire pour gerbeur'
  );

  // ------------------------------------------
  // TEST 5: Garde-corps - Hauteur > 1.6m
  // ------------------------------------------
  console.log('\n[CONFIG] Test 5: Garde-corps avec hauteur > 1.6m');
  resetForm();
  setEquipmentType('hayon-rabattable');
  setHeight(1.8);

  assert(
    isConditionalSectionVisible('section-garde-corps'),
    'Section Garde-corps visible si hauteur > 1.6m'
  );

  assert(
    document.querySelector('.check-item[data-id="gc-0"].required') !== null,
    'Questions garde-corps obligatoires si hauteur > 1.6m'
  );

  // ------------------------------------------
  // TEST 6: Garde-corps - Hauteur <= 1.6m
  // ------------------------------------------
  console.log('\n[CONFIG] Test 6: Garde-corps avec hauteur <= 1.6m');
  resetForm();
  setEquipmentType('hayon-rabattable');
  setHeight(1.5);

  assert(
    !isConditionalSectionVisible('section-garde-corps'),
    'Section Garde-corps masquée si hauteur <= 1.6m'
  );

  // ------------------------------------------
  // TEST 7: Coefficients CE
  // ------------------------------------------
  console.log('\n[CONFIG] Test 7: Coefficients CE');
  resetForm();
  setEquipmentType('hayon-rabattable');
  setCE(true);

  const calcBoxCe = document.getElementById('calc-box-ce');
  const calcBoxNonCe = document.getElementById('calc-box-non-ce');

  assert(
    calcBoxCe && calcBoxCe.style.display !== 'none',
    'Box calcul CE visible quand marquage CE sélectionné'
  );

  assert(
    calcBoxNonCe && calcBoxNonCe.style.display === 'none',
    'Box calcul Non-CE masquée quand marquage CE sélectionné'
  );

  // ------------------------------------------
  // TEST 8: Coefficients Non-CE
  // ------------------------------------------
  console.log('\n[CONFIG] Test 8: Coefficients Non-CE');
  resetForm();
  setEquipmentType('hayon-rabattable');
  setCE(false);

  assert(
    calcBoxNonCe && calcBoxNonCe.style.display !== 'none',
    'Box calcul Non-CE visible quand marquage Non-CE sélectionné'
  );

  assert(
    calcBoxCe && calcBoxCe.style.display === 'none',
    'Box calcul CE masquée quand marquage Non-CE sélectionné'
  );

  // ------------------------------------------
  // TEST 9: Validation - Questions manquantes
  // ------------------------------------------
  console.log('\n[CONFIG] Test 9: Validation - Questions obligatoires manquantes');
  resetForm();
  setEquipmentType('hayon-rabattable');

  const validation1 = validateRequiredQuestions();

  assert(
    !validation1.valid,
    'Validation échoue si questions obligatoires non remplies'
  );

  assert(
    validation1.missing.length > 0,
    `${validation1.missing.length} questions manquantes détectées`
  );

  // ------------------------------------------
  // TEST 10: Validation - Toutes questions remplies
  // ------------------------------------------
  console.log('\n[CONFIG] Test 10: Validation - Toutes questions obligatoires remplies');
  resetForm();
  setEquipmentType('hayon-rabattable');

  // Remplir toutes les questions obligatoires
  document.querySelectorAll('.check-item.required').forEach(item => {
    const section = item.closest('.card');
    if (section && section.style.display !== 'none') {
      item.dataset.status = 'c';
      item.classList.add('status-c');
    }
  });

  const validation2 = validateRequiredQuestions();

  assert(
    validation2.valid,
    'Validation réussit si toutes les questions obligatoires sont remplies'
  );

  assert(
    validation2.missing.length === 0,
    'Aucune question manquante'
  );

  // ============================================
  // RESULTS SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(50));
  console.log('[STATS] RÉSULTATS DES TESTS');
  console.log('='.repeat(50));
  console.log(`[OK] Reussis: ${passCount}`);
  console.log(`[X] Echoues: ${failCount}`);
  console.log(`[TOTAL] Total: ${passCount + failCount}`);
  console.log(`[STATS] Taux de réussite: ${Math.round(passCount / (passCount + failCount) * 100)}%`);
  console.log('='.repeat(50));

  // Reset form after tests
  resetForm();

  // Return results for external use
  return {
    pass: passCount,
    fail: failCount,
    total: passCount + failCount,
    results: TEST_RESULTS,
    success: failCount === 0
  };

})();
