(async function () {
  // Step A — Load data.json
  const dataUrl = chrome.runtime.getURL('data.json');
  let data = {};
  try {
    const response = await fetch(dataUrl);
    data = await response.json();
  } catch (e) {
    console.error("[Workday Autofill] Error loading data.json", e);
    return;
  }

  function setInputValue(input, value) {
    if (!input || value === null || value === undefined) return;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setTextareaValue(textarea, value) {
    if (!textarea || !value) return;
    const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeTextareaValueSetter.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function pressEnter(el) {
    if (!el) return;
    el.dispatchEvent(new KeyboardEvent('keydown',  { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup',    { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  }

  async function pressEnterTwice(el) {
    if (!el) return;
    for (let i = 0; i < 2; i++) {
      el.dispatchEvent(new KeyboardEvent('keydown',  { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup',    { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      await wait(150);
    }
  }

  const MONTH_MAP = {
    'january':'01','february':'02','march':'03','april':'04',
    'may':'05','june':'06','july':'07','august':'08',
    'september':'09','october':'10','november':'11','december':'12'
  };
  function toMonthNum(m) {
    if (!m) return '';
    return MONTH_MAP[m.toLowerCase().trim()] || m;
  }

  async function fillDropdown(automationId, targetText, context = document) {
    if (!targetText) return;
    const container = context.querySelector(`[data-automation-id="${automationId}"]`);
    if (!container) return;
    const button = container.querySelector('button[aria-haspopup="listbox"]');
    if (!button) return;
    button.click();
    await wait(500);
    let options = document.querySelectorAll('[role="option"]');
    for (const opt of options) {
      if (opt.textContent.trim().toLowerCase() === targetText.trim().toLowerCase()) { opt.click(); await wait(200); return; }
    }
    options = document.querySelectorAll('[role="option"]');
    for (const opt of options) {
      if (opt.textContent.trim().toLowerCase().includes(targetText.trim().toLowerCase())) { opt.click(); await wait(200); return; }
    }
  }

  // fillTypeahead: selects result AND presses Enter twice to confirm
  async function fillTypeahead(automationId, searchText, context = document) {
    if (!searchText) return;
    const container = context.querySelector(`[data-automation-id="${automationId}"]`);
    if (!container) return;

    let input = container.querySelector('[data-automation-id="searchBox"]')
            || container.querySelector('[data-automation-id="multiselectInputContainer"] input')
            || container.querySelector('input[type="text"]');
    if (!input) return;

    input.focus();
    input.click();
    setInputValue(input, searchText);
    await wait(700);

    const results = document.querySelectorAll('[role="listbox"] [role="option"], [data-automation-id="promptOption"]');
    for (const result of results) {
      if (result.textContent.toLowerCase().includes(searchText.toLowerCase())) {
        result.click();
        await wait(500);
        pressEnter(input);
        await wait(450);
        pressEnter(input);
        await wait(500);
        return;
      }
    }

  // No result found — press Enter twice anyway
  pressEnter(input);
  await wait(450);
  pressEnter(input);
  await wait(500);
}

  async function addSkill(skillName) {
    const container = document.querySelector('[data-automation-id="formField-skills"]');
    if (!container) return;
    let input = container.querySelector('[data-automation-id="multiselectInputContainer"] input') || container.querySelector('input[type="text"]');
    if (!input) return;
    input.focus(); input.click();
    setInputValue(input, skillName);
    await wait(1000);
    pressEnter(input);
    await wait(800);
    pressEnter(input);
    await wait(800);
  }

  function getAddButtonForSection(sectionName) {
    const target = sectionName.trim().toLowerCase();

    // Strategy 1: locate any heading containing the section name, then find the nearest Add button.
    const headings = document.querySelectorAll('h2, h3, h4, h5, [role="heading"]');
    for (const h of headings) {
      if (!h.textContent.trim().toLowerCase().includes(target)) continue;
      const section = h.closest('[role="group"], [role="region"], fieldset, section, div[data-automation-id]') || h.parentElement;
      if (!section) continue;
      const btn = findAddButton(section);
      if (btn) return btn;
    }

    // Strategy 2: global search for any button whose label/text starts with "Add <sectionName>".
    const allButtons = document.querySelectorAll('button');
    for (const b of allButtons) {
      const label = ((b.getAttribute('aria-label') || '') + ' ' + (b.textContent || '')).trim().toLowerCase();
      if (label.startsWith('add ' + target) || label === 'add ' + target) return b;
      if (label.includes('add another') && b.closest('[data-automation-id]')) {
        const container = b.closest('[data-automation-id]');
        const heading = container.querySelector('h2, h3, h4, h5, [role="heading"]');
        if (heading && heading.textContent.trim().toLowerCase().includes(target)) return b;
      }
    }

    return null;
  }

  function findAddButton(scope) {
    const candidates = scope.querySelectorAll('button, [role="button"]');
    for (const b of candidates) {
      const aid = (b.getAttribute('data-automation-id') || '').toLowerCase();
      if (aid === 'add-button' || aid === 'add' || aid === 'addbutton' || aid.startsWith('add')) return b;
    }
    for (const b of candidates) {
      const label = ((b.getAttribute('aria-label') || '') + ' ' + (b.textContent || '')).trim().toLowerCase();
      if (label === 'add' || label.startsWith('add ') || label.includes('add another')) return b;
    }
    return null;
  }

  function getLastField(id) {
    const all = document.querySelectorAll(`[data-automation-id="${id}"]`);
    return all[all.length - 1] || null;
  }

  // Try a list of automation-ids and return the last element from the first one that matches.
  function getLastFieldAny(ids) {
    for (const id of ids) {
      const el = getLastField(id);
      if (el) return el;
    }
    return null;
  }

  async function fillPage1(data) {
    console.log("[Workday Autofill] Filling Page 1");
    setInputValue(document.querySelector('input[name="legalName--firstName"]'), data.firstName);
    setInputValue(document.querySelector('input[name="legalName--lastName"]'), data.lastName);
    setInputValue(document.querySelector('input[name="addressLine1"]'), data.address);
    setInputValue(document.querySelector('input[name="city"]'), data.city);
    setInputValue(document.querySelector('input[name="postalCode"]'), data.postalCode);
    setInputValue(document.querySelector('input[name="phoneNumber"]'), data.phone);
    await fillDropdown('formField-countryRegion', data.province);
    await fillDropdown('formField-phoneType', 'Mobile');
    if (data.previousWorker !== undefined) {
      const val = data.previousWorker === true ? "true" : "false";
      const radio = document.querySelector(`input[type="radio"][name="candidateIsPreviousWorker"][value="${val}"]`);
      if (radio) radio.click();
    }
    if (data.hearAboutUs) {
      const sourceContainer = document.querySelector('[data-automation-id="formField-source"]');
      if (sourceContainer) {
        const input = sourceContainer.querySelector('input') || sourceContainer.querySelector('[data-automation-id="searchBox"]');
        if (input) {
          input.focus();
          input.click();
          setInputValue(input, data.hearAboutUs);
          await wait(1000);
          pressEnter(input);
          await wait(500);
          //pressEnter(input);
          //await wait(500);
        }
      }
    }

  }

  async function fillPage2(data) {
    console.log("[Workday Autofill] Filling Page 2");

    // Work History — click Add for EVERY entry (section starts empty)
    for (let i = 0; i < (data.workHistory || []).length; i++) {
      const entry = data.workHistory[i];
      const addBtn = getAddButtonForSection('Work Experience');
      if (!addBtn) { console.warn(`[Workday Autofill] No Work Experience Add button for entry ${i}`); continue; }
      addBtn.click(); await wait(800);

      const jt = getLastField('formField-jobTitle');   if (jt) setInputValue(jt.querySelector('input'), entry.jobTitle);
      const co = getLastField('formField-companyName'); if (co) setInputValue(co.querySelector('input'), entry.company);
      const lo = getLastField('formField-location');    if (lo) setInputValue(lo.querySelector('input'), entry.location);

      const cur = getLastField('formField-currentlyWorkHere');
      if (cur && entry.currentlyWorkHere) { const cb = cur.querySelector('input[type="checkbox"]'); if (cb && !cb.checked) { cb.click(); await wait(200); } }

      const sd = getLastField('formField-startDate');
      if (sd) {
        setInputValue(sd.querySelector('[data-automation-id="dateSectionMonth-input"]'), toMonthNum(entry.startMonth));
        await wait(100);
        setInputValue(sd.querySelector('[data-automation-id="dateSectionYear-input"]'), entry.startYear);
      }
      if (!entry.currentlyWorkHere && entry.endMonth) {
        const ed = getLastField('formField-endDate');
        if (ed) {
          setInputValue(ed.querySelector('[data-automation-id="dateSectionMonth-input"]'), toMonthNum(entry.endMonth));
          await wait(100);
          setInputValue(ed.querySelector('[data-automation-id="dateSectionYear-input"]'), entry.endYear);
        }
      }
      const desc = getLastField('formField-roleDescription'); if (desc) setTextareaValue(desc.querySelector('textarea'), entry.description);
      await wait(400);
    }

    // Education — pause 2s, then for each entry: school → degree → field of study → gpa → years
    await wait(2000);
    for (let i = 0; i < (data.education || []).length; i++) {
      const entry = data.education[i];
      const addBtn = getAddButtonForSection('Education');
      if (!addBtn) { console.warn(`[Workday Autofill] No Education Add button for entry ${i}`); continue; }
      addBtn.click(); await wait(900);

      // 1. School / University — plain text input on this tenant; set value directly.
      if (entry.school) {
        const schoolEl = getLastFieldAny(['formField-schoolName', 'formField-school', 'formField-university', 'formField-institution']);
        if (schoolEl) {
          // Pick the visible named input, not any decorative sibling.
          const input = schoolEl.querySelector('input[name="schoolName"]')
                     || schoolEl.querySelector('input[type="text"]:not(.css-77hcv)')
                     || schoolEl.querySelector('[data-automation-id="searchBox"]')
                     || schoolEl.querySelector('input');
          if (input) {
            input.focus(); input.click();
            setInputValue(input, entry.school);
            await wait(500);
            // If a typeahead listbox happened to open, accept the first match; otherwise just blur.
            const results = document.querySelectorAll('[role="listbox"] [role="option"], [data-automation-id="promptOption"]');
            for (const r of results) {
              if (r.closest('[data-automation-id="selectedItemList"]')) continue;
              if (r.textContent.toLowerCase().includes(entry.school.toLowerCase())) { r.click(); await wait(300); break; }
            }
            input.blur();
            await wait(300);
          }
        }
      }

      // 2. Degree — button-dropdown (aria-haspopup="listbox"). Click button, then pick option.
      if (entry.degree) {
        const degreeEl = getLastFieldAny(['formField-degree', 'formField-degreeLevel', 'formField-degreeName']);
        if (degreeEl) {
          const degBtn = degreeEl.querySelector('button[aria-haspopup="listbox"]');
          if (degBtn) {
            degBtn.click();
            await wait(700);
            const opts = document.querySelectorAll('[role="option"], [role="listbox"] li');
            const target = entry.degree.trim().toLowerCase();
            let picked = false;
            for (const o of opts) {
              if (o.textContent.trim().toLowerCase() === target) { o.click(); picked = true; await wait(400); break; }
            }
            if (!picked) {
              for (const o of opts) {
                if (o.textContent.trim().toLowerCase().includes(target)) { o.click(); picked = true; await wait(400); break; }
              }
            }
            if (!picked) {
              // Close the popup so subsequent fields are reachable.
              document.body.click();
              await wait(200);
              console.warn('[Workday Autofill] Degree option not found:', entry.degree);
            }
          } else {
            // Fallback: typeahead-style input if the tenant ever uses one.
            const degInput = degreeEl.querySelector('[data-automation-id="searchBox"]') || degreeEl.querySelector('input:not(.css-77hcv)');
            if (degInput) {
              degInput.focus(); degInput.click(); setInputValue(degInput, entry.degree); await wait(800);
              await pressEnterTwice(degInput); await wait(400);
            }
          }
        }
      }

      // 3. Field of Study — multi-select with placeholder="Search". Type, then click matching option.
      if (entry.fieldOfStudy) {
        const fosEl = getLastFieldAny(['formField-fieldOfStudy', 'formField-major', 'formField-fieldofstudy']);
        if (fosEl) {
          const input = fosEl.querySelector('[data-automation-id="multiselectInputContainer"] input')
                     || fosEl.querySelector('input[placeholder="Search"]')
                     || fosEl.querySelector('[data-automation-id="searchBox"]')
                     || fosEl.querySelector('input');
          if (input) {
            input.focus(); input.click();
            setInputValue(input, entry.fieldOfStudy);
            await wait(900);
            const target = entry.fieldOfStudy.trim().toLowerCase();
            // Exclude already-selected pills (which also use [data-automation-id="promptOption"]).
            const results = [...document.querySelectorAll('[role="option"], [data-automation-id="promptOption"]')]
              .filter(r => !r.closest('[data-automation-id="selectedItemList"]')
                        && !r.closest('[data-automation-id="selectedItem"]'));
            let picked = false;
            for (const r of results) {
              if (r.textContent.trim().toLowerCase() === target) { r.click(); picked = true; await wait(400); break; }
            }
            if (!picked) {
              for (const r of results) {
                if (r.textContent.toLowerCase().includes(target)) { r.click(); picked = true; await wait(400); break; }
              }
            }
            if (!picked) { pressEnter(input); await wait(300); }
            input.blur();
            await wait(300);
          }
        }
      }

      // 4. GPA / Overall Result — plain text input
      if (entry.gpa) {
        const gpaEl = getLastField('formField-gradeAverage') || getLastField('formField-overallResult') || getLastField('formField-gpa');
        if (gpaEl) {
          const input = gpaEl.querySelector('input');
          if (input) { setInputValue(input, entry.gpa); await wait(200); }
        }
      }

      // 5. Years — start (firstYearAttended) and end (lastYearAttended)
      if (entry.startYear) {
        const fyEl = getLastField('formField-firstYearAttended') || getLastField('formField-startYear');
        if (fyEl) {
          const input = fyEl.querySelector('input');
          if (input) { setInputValue(input, entry.startYear); await wait(200); }
        }
      }
      if (entry.endYear) {
        const lyEl = getLastField('formField-lastYearAttended') || getLastField('formField-endYear');
        if (lyEl) {
          const input = lyEl.querySelector('input');
          if (input) { setInputValue(input, entry.endYear); await wait(200); }
        }
      }

      await wait(500);
    }

    // Certifications
    for (let i = 0; i < (data.certifications || []).length; i++) {
      const entry = data.certifications[i];
      if (!entry.name) continue;
      if (i > 0) { const addBtn = getAddButtonForSection('Certifications'); if (addBtn) { addBtn.click(); await wait(700); } }
      const certEl = getLastField('formField-certification');
      if (certEl) {
        const input = certEl.querySelector('[data-automation-id="searchBox"]') || certEl.querySelector('input');
        if (input) {
          input.focus(); input.click(); setInputValue(input, entry.name); await wait(700);
          const results = document.querySelectorAll('[role="listbox"] [role="option"]');
          for (const r of results) { if (r.textContent.toLowerCase().includes(entry.name.toLowerCase())) { r.click(); await wait(300); break; } }
          await pressEnterTwice(input); await wait(200);
        }
      }
      if (entry.number) { const n = getLastField('formField-certificationNumber'); if (n) setInputValue(n.querySelector('input'), entry.number); }
      if (entry.expiryMonth) {
        const exp = getLastField('formField-expirationDate');
        if (exp) {
          setInputValue(exp.querySelector('[data-automation-id="dateSectionMonth-input"]'), toMonthNum(entry.expiryMonth)); await wait(100);
          if (entry.expiryDay)  setInputValue(exp.querySelector('[data-automation-id="dateSectionDay-input"]'),  entry.expiryDay);
          if (entry.expiryYear) setInputValue(exp.querySelector('[data-automation-id="dateSectionYear-input"]'), entry.expiryYear);
        }
      }
      await wait(300);
    }

    // Skills
    for (const skill of (data.skills || [])) { await addSkill(skill); await wait(200); }

    // LinkedIn
    const li = document.querySelector('input[name="linkedInAccount"]');
    if (li) setInputValue(li, data.linkedin);
  }

  async function fillPage3(data) {
    console.log("[Workday Autofill] Filling Page 3");
    const q = data.applicationQuestions || {};

    for (const fieldset of document.querySelectorAll('fieldset')) {
      const legendEl = fieldset.querySelector('legend')
                    || fieldset.querySelector('[data-automation-id="richText"]')
                    || fieldset.querySelector('[data-automation-id="questionTitle"]');
      if (!legendEl) continue;
      const text = (legendEl.innerText || legendEl.textContent || "").toLowerCase();

      const answerDropdown = async (val) => {
        if (!val) return;
        const btn = fieldset.querySelector('button[aria-haspopup="listbox"]');
        if (!btn) return;
        btn.click(); await wait(400);
        let opts = document.querySelectorAll('[role="option"]');
        for (const o of opts) { if (o.textContent.trim().toLowerCase() === val.toLowerCase()) { o.click(); await wait(200); return; } }
        opts = document.querySelectorAll('[role="option"]');
        for (const o of opts) { if (o.textContent.trim().toLowerCase().includes(val.toLowerCase())) { o.click(); await wait(200); return; } }
      };

      if      (text.includes("age of majority") || text.includes("18 years old") || text.includes("18 years of age"))
        await answerDropdown(q.ageRequirement);
      else if (text.includes("high school") || text.includes("secondary school"))
        await answerDropdown(q.hasHighSchoolDiploma);
      else if (text.includes("legally entitled to work") || text.includes("authorized to work") || text.includes("eligible to work"))
        await answerDropdown(q.workAuthorization);
      else if (text.includes("reside in canada") || text.includes("live in canada") || text.includes("located in canada"))
        await answerDropdown(q.resideInCanada);
      else if (text.includes("insurance license") || text.includes("llqp") || text.includes("life licence"))
        await answerDropdown(q.hasInsuranceLicense);
      else if ((text.includes("relative") || text.includes("family member")) && (text.includes("td") || text.includes("bank")))
        await answerDropdown(q.relativesAtTD);
      else if (text.includes("ernst & young") || text.includes("ernst and young") || (text.includes("ey") && (text.includes("employed") || text.includes("worked"))))
        await answerDropdown(q.workedAtEY);
      else if (text.includes("politically exposed") || text.includes("pep"))
        await answerDropdown(q.politicallyExposed);
      else if (text.includes("weekly hours") || text.includes("hours per week")) {
        const input = fieldset.querySelector('input[type="text"], input[type="number"]');
        if (input) setInputValue(input, q.weeklyHours);
      }
      else if (text.includes("type of employment") || text.includes("employment you are seeking")) {
        const targetTypes = q.employmentTypes || [];
        fieldset.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          const label = document.querySelector(`label[for="${cb.id}"]`) || cb.closest('label');
          if (label && targetTypes.some(t => (label.innerText || label.textContent || "").includes(t))) {
            if (!cb.checked) cb.click();
          }
        });
      }
      else if (text.includes("work shifts") || text.includes("flexible hours") || text.includes("shift work"))
        await answerDropdown(q.flexibleHours || "Yes");
      else if (text.includes("background check") || text.includes("credit check") || text.includes("consent to a"))
        await answerDropdown(q.backgroundCheck || "Yes");
      else if (text.includes("conflict of interest") || text.includes("outside business") || text.includes("other employment"))
        await answerDropdown(q.conflictOfInterest || "No");
      else if (text.includes("accommodation") && text.includes("disability"))
        await answerDropdown(q.requiresAccommodation || "No");
      // gender / race / ethnicity / veteran → skip, leave for user
    }
  }

  const filled = { page1: false, page2: false, page3: false };
  async function checkAndFill() {
    if (!filled.page1 && document.querySelector('[data-automation-id="applyFlowMyInfoPage"]'))   { filled.page1 = true; await wait(600); await fillPage1(data); }
    if (!filled.page2 && document.querySelector('[data-automation-id="applyFlowMyExpPage"]'))    { filled.page2 = true; await wait(600); await fillPage2(data); }
    if (!filled.page3 && document.querySelector('[data-automation-id="applyFlowPrimaryQuestionsPage"]')) { filled.page3 = true; await wait(600); await fillPage3(data); }
  }

  const observer = new MutationObserver(() => checkAndFill());
  observer.observe(document.body, { childList: true, subtree: true });
  checkAndFill();

})();
