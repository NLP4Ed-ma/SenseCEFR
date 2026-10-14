// sample text demonstrating different senses of party across levels
const SAMPLES = {
  party: `We celebrated at a wonderful birthday party with my best friends.
Both political parties debated the election campaign vigorously.
The binding contract was formally signed by each legal party.`
};

function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class SenseCEFRApp {
  constructor() {
    const NlpClass = typeof NLPEngine !== 'undefined' ? NLPEngine : (typeof window !== 'undefined' ? window.NLPEngine : null);
    const WsdClass = typeof WSDEngine !== 'undefined' ? WSDEngine : (typeof window !== 'undefined' ? window.WSDEngine : null);
    this.nlpEngine = new NlpClass();
    this.wsdEngine = new WsdClass();

    // main dom references
    this.inputText = document.getElementById('inputText');
    this.annotatedViewer = document.getElementById('annotatedViewer');
    this.analyzeBtn = document.getElementById('analyzeBtn');
    this.charCount = document.getElementById('charCount');
    this.exportReportBtn = document.getElementById('exportReportBtn');

    // metrics cards
    this.totalWordsEl = document.getElementById('totalWords');
    this.uniqueTypesEl = document.getElementById('uniqueTypes');
    this.polyCountEl = document.getElementById('polyCount');
    this.distBar = document.getElementById('distBar');

    // word inspector modal elements
    this.inspectModal = document.getElementById('inspectModal');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.modalWord = document.getElementById('modalWord');
    this.modalLemma = document.getElementById('modalLemma');
    this.modalCefrBadge = document.getElementById('modalCefrBadge');
    this.modalConf = document.getElementById('modalConf');
    this.modalSentence = document.getElementById('modalSentence');
    this.modalActiveSense = document.getElementById('modalActiveSense');
    this.modalAltSenses = document.getElementById('modalAltSenses');
    this.modalAltSensesContainer = document.getElementById('modalAltSensesContainer');
    this.modalAiExplanationContainer = document.getElementById('modalAiExplanationContainer');
    this.modalAiExplanation = document.getElementById('modalAiExplanation');

    // settings modal and tab containers
    this.settingsModal = document.getElementById('settingsModal');
    this.openSettingsBtn = document.getElementById('openSettingsBtn');
    this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
    this.tabBtnAi = document.getElementById('tabBtnAi');
    this.tabBtnLexicon = document.getElementById('tabBtnLexicon');
    this.paneAiConfig = document.getElementById('paneAiConfig');
    this.paneCustomLexicon = document.getElementById('paneCustomLexicon');
    this.customLexiconCountBadge = document.getElementById('customLexiconCountBadge');

    // background scroll lock state
    this.savedScrollY = 0;
    this.isScrollLocked = false;

    // gemini api controls
    this.geminiToggle = document.getElementById('geminiToggle');
    this.geminiStatusBadge = document.getElementById('geminiStatusBadge');
    this.geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
    this.toggleKeyVisibilityBtn = document.getElementById('toggleKeyVisibilityBtn');
    this.geminiModelSelect = document.getElementById('geminiModelSelect');
    this.geminiCustomModelContainer = document.getElementById('geminiCustomModelContainer');
    this.geminiCustomModelInput = document.getElementById('geminiCustomModelInput');
    this.geminiConnectionStatus = document.getElementById('geminiConnectionStatus');
    this.testGeminiConnectionBtn = document.getElementById('testGeminiConnectionBtn');
    this.saveGeminiKeyBtn = document.getElementById('saveGeminiKeyBtn');
    this.clearGeminiKeyBtn = document.getElementById('clearGeminiKeyBtn');

    // custom lexicon inputs and table elements
    this.lexiconFileInput = document.getElementById('lexiconFileInput');
    this.backupLexiconBtn = document.getElementById('backupLexiconBtn');
    this.downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    this.resetLexiconBtn = document.getElementById('resetLexiconBtn');
    this.lexiconStatusMsg = document.getElementById('lexiconStatusMsg');
    this.quickAddLexiconForm = document.getElementById('quickAddLexiconForm');
    this.customWordInput = document.getElementById('customWordInput');
    this.customCefrSelect = document.getElementById('customCefrSelect');
    this.customPosSelect = document.getElementById('customPosSelect');
    this.customPosOtherContainer = document.getElementById('customPosOtherContainer');
    this.customPosOtherInput = document.getElementById('customPosOtherInput');
    this.customGuidewordInput = document.getElementById('customGuidewordInput');
    this.customDefInput = document.getElementById('customDefInput');
    this.addLexiconEntryBtn = document.getElementById('addLexiconEntryBtn');
    this.lexiconSearchInput = document.getElementById('lexiconSearchInput');
    this.entriesCountPill = document.getElementById('entriesCountPill');
    this.customEntriesTableWrapper = document.getElementById('customEntriesTableWrapper');

    this.processedTokens = [];

    // load saved lexicon entries and register them with nlp engine
    this.customLexicon = this.loadCustomLexicon();
    this.nlpEngine.setCustomLexicon(this.customLexicon);

    this.initGeminiSettings();
    this.initCustomLexiconUI();
    this.initEventListeners();
  }

  getActiveGeminiModel() {
    if (!this.geminiModelSelect) return 'gemini-flash-lite-latest';
    const val = this.geminiModelSelect.value;
    if (val === 'custom') {
      const customVal = this.geminiCustomModelInput ? this.geminiCustomModelInput.value.trim() : '';
      return customVal || 'gemini-flash-lite-latest';
    }
    return val;
  }

  setGeminiModelUI(modelName) {
    if (!this.geminiModelSelect) return;
    const model = modelName || 'gemini-flash-lite-latest';
    const predefined = Array.from(this.geminiModelSelect.options).map(o => o.value);
    if (predefined.includes(model) && model !== 'custom') {
      this.geminiModelSelect.value = model;
      if (this.geminiCustomModelContainer) this.geminiCustomModelContainer.style.display = 'none';
    } else {
      this.geminiModelSelect.value = 'custom';
      if (this.geminiCustomModelContainer) this.geminiCustomModelContainer.style.display = 'block';
      if (this.geminiCustomModelInput) this.geminiCustomModelInput.value = model;
    }
  }

  initGeminiSettings() {
    // check url query parameters for an api key
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const keyFromUrl = urlParams.get('gemini_key');
      if (keyFromUrl) {
        localStorage.setItem('sensecefr_gemini_key', keyFromUrl);
      }
    } catch (_) {}

    const savedKey = localStorage.getItem('sensecefr_gemini_key') || '';
    const savedModel = localStorage.getItem('sensecefr_gemini_model') || 'gemini-flash-lite-latest';
    const savedEnabled = localStorage.getItem('sensecefr_use_gemini');

    this.wsdEngine.geminiApiKey = savedKey;
    this.wsdEngine.geminiModel = savedModel;
    this.setGeminiModelUI(savedModel);
    if (this.geminiApiKeyInput) this.geminiApiKeyInput.value = savedKey;

    if (savedKey) {
      const isEnabled = (savedEnabled !== 'false');
      this.wsdEngine.useGemini = isEnabled;
      if (this.geminiToggle) this.geminiToggle.checked = isEnabled;
      if (this.geminiStatusBadge) {
        this.geminiStatusBadge.textContent = isEnabled ? 'Active' : 'Configured';
        if (isEnabled) this.geminiStatusBadge.classList.add('active');
        else this.geminiStatusBadge.classList.remove('active');
      }
    } else {
      this.wsdEngine.useGemini = false;
      if (this.geminiToggle) this.geminiToggle.checked = false;
      if (this.geminiStatusBadge) {
        this.geminiStatusBadge.textContent = 'Offline';
        this.geminiStatusBadge.classList.remove('active');
      }
    }
  }

  showGeminiStatus(msg, isSuccess) {
    if (!this.geminiConnectionStatus) return;
    this.geminiConnectionStatus.style.display = 'block';
    this.geminiConnectionStatus.textContent = msg;
    if (isSuccess === true) {
      this.geminiConnectionStatus.style.background = '#dcfce7';
      this.geminiConnectionStatus.style.color = '#15803d';
      this.geminiConnectionStatus.style.border = '1px solid #86efac';
    } else if (isSuccess === false) {
      this.geminiConnectionStatus.style.background = '#ffe4e6';
      this.geminiConnectionStatus.style.color = '#be123c';
      this.geminiConnectionStatus.style.border = '1px solid #fca5a5';
    } else {
      this.geminiConnectionStatus.style.background = '#f1f5f9';
      this.geminiConnectionStatus.style.color = '#475569';
      this.geminiConnectionStatus.style.border = '1px solid #cbd5e1';
    }
  }

  switchSettingsTab(tabName) {
    if (tabName === 'lexicon') {
      if (this.tabBtnAi) this.tabBtnAi.classList.remove('active');
      if (this.paneAiConfig) this.paneAiConfig.classList.remove('active');
      if (this.tabBtnLexicon) this.tabBtnLexicon.classList.add('active');
      if (this.paneCustomLexicon) this.paneCustomLexicon.classList.add('active');
    } else {
      if (this.tabBtnLexicon) this.tabBtnLexicon.classList.remove('active');
      if (this.paneCustomLexicon) this.paneCustomLexicon.classList.remove('active');
      if (this.tabBtnAi) this.tabBtnAi.classList.add('active');
      if (this.paneAiConfig) this.paneAiConfig.classList.add('active');
    }
  }

  lockScroll() {
    if (this.isScrollLocked) return;
    this.savedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;

    // Prevent horizontal layout jump on browsers with non-overlay scrollbars
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.documentElement.classList.add('modal-scroll-locked');
    document.body.classList.add('modal-scroll-locked');
    this.isScrollLocked = true;
  }

  unlockScroll() {
    if (!this.isScrollLocked) return;

    document.documentElement.classList.remove('modal-scroll-locked');
    document.body.classList.remove('modal-scroll-locked');
    document.body.style.paddingRight = '';

    // Restore user to exact scroll position
    window.scrollTo(0, this.savedScrollY);
    this.isScrollLocked = false;
  }

  openSettings(defaultTab = 'ai') {
    if (!this.settingsModal) return;
    this.lockScroll();
    this.switchSettingsTab(defaultTab);
    if (this.geminiApiKeyInput) {
      this.geminiApiKeyInput.value = this.wsdEngine.geminiApiKey || localStorage.getItem('sensecefr_gemini_key') || '';
    }
    const currentModel = this.wsdEngine.geminiModel || localStorage.getItem('sensecefr_gemini_model') || 'gemini-flash-lite-latest';
    this.setGeminiModelUI(currentModel);
    if (this.geminiConnectionStatus) this.geminiConnectionStatus.style.display = 'none';
    this.renderCustomLexiconUI();
    this.settingsModal.style.display = 'flex';
  }

  closeSettings() {
    if (!this.settingsModal) return;
    this.settingsModal.style.display = 'none';
    this.unlockScroll();
  }

  closeInspectModal() {
    if (!this.inspectModal) return;
    this.inspectModal.style.display = 'none';
    this.unlockScroll();
  }

  openGeminiSettings() {
    this.openSettings('ai');
  }

  loadCustomLexicon() {
    try {
      const raw = localStorage.getItem('sensecefr_custom_lexicon');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Failed to parse custom lexicon from localStorage:', err);
      return [];
    }
  }

  saveCustomLexicon() {
    try {
      localStorage.setItem('sensecefr_custom_lexicon', JSON.stringify(this.customLexicon));
    } catch (err) {
      console.warn('Failed to save custom lexicon to localStorage:', err);
    }
    this.nlpEngine.setCustomLexicon(this.customLexicon);
    this.renderCustomLexiconUI(this.lexiconSearchInput ? this.lexiconSearchInput.value : '');
    
    // re-run profiling if the user already has text analyzed
    if (this.inputText && this.inputText.value.trim().length > 0 && this.processedTokens.length > 0) {
      this.analyze();
    }
  }

  showLexiconStatus(msg, isSuccess) {
    if (!this.lexiconStatusMsg) return;
    this.lexiconStatusMsg.textContent = msg;
    this.lexiconStatusMsg.className = `lexicon-status-banner ${isSuccess ? 'success' : 'error'}`;
    this.lexiconStatusMsg.style.display = 'block';
    setTimeout(() => {
      if (this.lexiconStatusMsg) this.lexiconStatusMsg.style.display = 'none';
    }, 4500);
  }

  initCustomLexiconUI() {
    this.renderCustomLexiconUI();
  }

  renderCustomLexiconUI(filterText = '') {
    const list = this.customLexicon || [];
    const count = list.length;
    if (this.customLexiconCountBadge) this.customLexiconCountBadge.textContent = count;
    if (this.entriesCountPill) this.entriesCountPill.textContent = `${count} ${count === 1 ? 'entry' : 'entries'}`;

    if (!this.customEntriesTableWrapper) return;

    if (count === 0) {
      this.customEntriesTableWrapper.innerHTML = `
        <div class="empty-custom-entries">
          No custom entries yet. Use the Quick Add form above or import a CSV file to customize vocabulary levels.
        </div>
      `;
      return;
    }

    const counts = {};
    list.forEach(e => {
      const k = e.word.toLowerCase().trim();
      counts[k] = (counts[k] || 0) + 1;
    });

    const search = (filterText || '').toLowerCase().trim();
    const filtered = search
      ? list.filter(e => e.word.toLowerCase().includes(search) || (e.guideword && e.guideword.toLowerCase().includes(search)) || (e.definition && e.definition.toLowerCase().includes(search)))
      : list;

    if (filtered.length === 0) {
      this.customEntriesTableWrapper.innerHTML = `
        <div class="empty-custom-entries">
          No custom entries match "${escapeHTML(search)}".
        </div>
      `;
      return;
    }

    let rowsHtml = '';
    filtered.forEach(entry => {
      const wordKey = entry.word.toLowerCase().trim();
      const isPoly = (counts[wordKey] || 0) > 1;
      const typeBadge = isPoly
        ? `<span class="entry-type-pill poly">Polysemous (${counts[wordKey]} senses)</span>`
        : `<span class="entry-type-pill">Single Level</span>`;

      const defText = entry.definition ? `<div style="font-size: 0.76rem; color: #64748b; margin-top: 2px;">${escapeHTML(entry.definition)}</div>` : '';
      const guideText = entry.guideword ? `<strong>${escapeHTML(entry.guideword)}</strong>` : '<span style="color: #94a3b8;">-</span>';

      rowsHtml += `
        <tr data-entry-id="${entry.id}">
          <td><strong>${escapeHTML(entry.word)}</strong></td>
          <td><span class="cefr-tag token-${entry.cefr.toLowerCase()}" style="font-size: 0.75rem; padding: 2px 7px;">${escapeHTML(entry.cefr)}</span></td>
          <td><span style="color: #64748b; font-size: 0.78rem;">${escapeHTML(entry.pos || 'all')}</span></td>
          <td>${guideText}${defText}</td>
          <td>${typeBadge}</td>
          <td>
            <button type="button" class="btn-del-entry" title="Delete entry" data-del-id="${entry.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </td>
        </tr>
      `;
    });

    this.customEntriesTableWrapper.innerHTML = `
      <table class="custom-entries-table">
        <thead>
          <tr>
            <th>Word / Phrase</th>
            <th>CEFR</th>
            <th>POS</th>
            <th>Guideword &amp; Sense</th>
            <th>Type</th>
            <th style="width: 36px;"></th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    this.customEntriesTableWrapper.querySelectorAll('.btn-del-entry').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-id');
        this.deleteCustomEntry(id);
      });
    });
  }

  addCustomEntry(word, cefr, pos, guideword, def) {
    const cleanWord = (word || '').trim();
    const cleanCefr = (cefr || '').trim().toUpperCase();
    if (!cleanWord) {
      this.showLexiconStatus('Word or phrase is required.', false);
      return;
    }
    const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'OFF-LIST'];
    if (!validLevels.includes(cleanCefr)) {
      this.showLexiconStatus('Please select a CEFR level (A1 to C2, or Off-list).', false);
      return;
    }

    const newEntry = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      word: cleanWord,
      cefr: cleanCefr === 'OFF-LIST' ? 'Off-list' : cleanCefr,
      pos: (pos || '').trim().toLowerCase(),
      guideword: (guideword || '').trim().toUpperCase(),
      definition: (def || '').trim()
    };

    this.customLexicon.push(newEntry);
    this.saveCustomLexicon();
    this.showLexiconStatus(`Added entry for "${cleanWord}" (${newEntry.cefr}) successfully.`, true);

    if (this.customWordInput) this.customWordInput.value = '';
    if (this.customCefrSelect) this.customCefrSelect.value = '';
    if (this.customPosSelect) this.customPosSelect.value = '';
    if (this.customPosOtherInput) this.customPosOtherInput.value = '';
    if (this.customPosOtherContainer) this.customPosOtherContainer.style.display = 'none';
    if (this.customGuidewordInput) this.customGuidewordInput.value = '';
    if (this.customDefInput) this.customDefInput.value = '';
    if (this.customWordInput) this.customWordInput.focus();
  }

  deleteCustomEntry(id) {
    const idx = this.customLexicon.findIndex(e => e.id === id);
    if (idx >= 0) {
      const removed = this.customLexicon.splice(idx, 1)[0];
      this.saveCustomLexicon();
      this.showLexiconStatus(`Removed "${removed.word}".`, true);
    }
  }

  resetCustomLexicon() {
    if (this.customLexicon.length === 0) {
      this.showLexiconStatus('Custom lexicon is already empty.', false);
      return;
    }
    const confirmed = window.confirm('Are you sure you want to reset and erase all custom lexicon entries? This action cannot be undone.');
    if (confirmed) {
      this.customLexicon = [];
      this.saveCustomLexicon();
      this.showLexiconStatus('Custom lexicon successfully reset to empty default.', true);
    }
  }

  exportLexiconBackup() {
    if (!this.customLexicon || this.customLexicon.length === 0) {
      this.showLexiconStatus('No custom entries to backup. Add entries first.', false);
      return;
    }

    const rows = ['Word,CEFR,POS,Guideword,Definition'];
    this.customLexicon.forEach(e => {
      rows.push([
        escapeCSV(e.word),
        escapeCSV(e.cefr),
        escapeCSV(e.pos || ''),
        escapeCSV(e.guideword || ''),
        escapeCSV(e.definition || '')
      ].join(','));
    });

    const csvContent = rows.join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sensecefr_custom_lexicon_backup_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showLexiconStatus(`Exported backup of ${this.customLexicon.length} entries.`, true);
  }

  downloadLexiconTemplate() {
    const sampleRows = [
      'Word,CEFR,POS,Guideword,Definition',
      'blockchain,C1,noun,DISTRIBUTED LEDGER,A decentralized digital ledger',
      'prompt,B1,adj,QUICK,Done without delay',
      'prompt,B2,noun,AI INPUT,An instruction given to a generative AI model',
      'zoom in,A2,verb,ENLARGE IMAGE,To make a camera view larger'
    ];
    const csvContent = sampleRows.join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sensecefr_lexicon_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showLexiconStatus('Sample CSV template downloaded.', true);
  }

  importLexiconCSV(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) {
          this.showLexiconStatus('CSV file is empty.', false);
          return;
        }

        let headerIdx = -1;
        let colWord = -1, colCefr = -1, colPos = -1, colGuide = -1, colDef = -1;

        const firstLineCols = this.parseCSVLine(lines[0]).map(c => c.toLowerCase().trim());
        const hasHeader = firstLineCols.some(c => ['word', 'cefr', 'pos', 'level', 'guideword', 'definition'].includes(c));

        if (hasHeader) {
          headerIdx = 0;
          firstLineCols.forEach((col, idx) => {
            if (col === 'word' || col === 'lemma' || col === 'term') colWord = idx;
            else if (col === 'cefr' || col === 'level' || col === 'grade') colCefr = idx;
            else if (col === 'pos' || col === 'part of speech') colPos = idx;
            else if (col === 'guideword' || col === 'sense' || col === 'label') colGuide = idx;
            else if (col === 'definition' || col === 'meaning' || col === 'def') colDef = idx;
          });
        } else {
          colWord = 0;
          colCefr = 1;
          colPos = 2;
          colGuide = 3;
          colDef = 4;
        }

        if (colWord === -1) colWord = 0;
        if (colCefr === -1) colCefr = 1;

        const startIdx = hasHeader ? 1 : 0;
        let addedCount = 0;

        for (let i = startIdx; i < lines.length; i++) {
          const parts = this.parseCSVLine(lines[i]);
          if (parts.length === 0) continue;
          const word = (parts[colWord] || '').trim();
          const cefr = (parts[colCefr] || '').trim().toUpperCase();
          if (!word || !['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(cefr)) continue;

          const pos = colPos >= 0 ? (parts[colPos] || '').trim().toLowerCase() : '';
          const guideword = colGuide >= 0 ? (parts[colGuide] || '').trim().toUpperCase() : '';
          const definition = colDef >= 0 ? (parts[colDef] || '').trim() : '';

          this.customLexicon.push({
            id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            word: word,
            cefr: cefr,
            pos: pos,
            guideword: guideword,
            definition: definition
          });
          addedCount++;
        }

        if (addedCount > 0) {
          this.saveCustomLexicon();
          this.showLexiconStatus(`Successfully imported ${addedCount} custom entries from CSV.`, true);
        } else {
          this.showLexiconStatus('No valid entries found in CSV. Expected columns: Word, CEFR (A1..C2), POS, Guideword, Definition.', false);
        }
      } catch (err) {
        this.showLexiconStatus(`Failed to parse CSV: ${err.message}`, false);
      }
    };
    reader.onerror = () => {
      this.showLexiconStatus('Failed to read CSV file.', false);
    };
    reader.readAsText(file);
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && i < line.length - 1 && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    result.push(current.trim());
    return result;
  }

  initEventListeners() {
    this.analyzeBtn.addEventListener('click', () => this.analyze());
    this.exportReportBtn.addEventListener('click', () => this.exportReport());
    
    this.inputText.addEventListener('input', () => {
      this.charCount.textContent = `${this.inputText.value.length} characters`;
    });

    // toggle gemini assistance on or off
    if (this.geminiToggle) {
      this.geminiToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        if (enabled && !this.wsdEngine.geminiApiKey) {
          this.openSettings('ai');
          e.target.checked = false;
          return;
        }
        this.wsdEngine.useGemini = enabled;
        localStorage.setItem('sensecefr_use_gemini', enabled ? 'true' : 'false');
        if (enabled) {
          this.geminiStatusBadge.textContent = 'Active';
          this.geminiStatusBadge.classList.add('active');
        } else {
          this.geminiStatusBadge.textContent = this.wsdEngine.geminiApiKey ? 'Configured' : 'Offline';
          this.geminiStatusBadge.classList.remove('active');
        }
      });
    }

    // open and close settings modal
    if (this.openSettingsBtn) {
      this.openSettingsBtn.addEventListener('click', () => this.openSettings());
    }
    if (this.closeSettingsBtn) {
      this.closeSettingsBtn.addEventListener('click', () => {
        this.closeSettings();
      });
    }
    if (this.settingsModal) {
      this.settingsModal.addEventListener('click', (e) => {
        if (e.target === this.settingsModal) {
          this.closeSettings();
        }
      });
      // Prevent wheel/touch scrolling on the blurred background backdrop itself
      this.settingsModal.addEventListener('wheel', (e) => {
        if (e.target === this.settingsModal) {
          e.preventDefault();
        }
      }, { passive: false });
      this.settingsModal.addEventListener('touchmove', (e) => {
        if (e.target === this.settingsModal) {
          e.preventDefault();
        }
      }, { passive: false });
    }

    // tab switching between ai config and custom lexicon
    if (this.tabBtnAi) {
      this.tabBtnAi.addEventListener('click', () => this.switchSettingsTab('ai'));
    }
    if (this.tabBtnLexicon) {
      this.tabBtnLexicon.addEventListener('click', () => this.switchSettingsTab('lexicon'));
    }

    // api key management and connection testing
    if (this.geminiModelSelect) {
      this.geminiModelSelect.addEventListener('change', () => {
        if (this.geminiModelSelect.value === 'custom') {
          if (this.geminiCustomModelContainer) this.geminiCustomModelContainer.style.display = 'block';
          if (this.geminiCustomModelInput) this.geminiCustomModelInput.focus();
        } else {
          if (this.geminiCustomModelContainer) this.geminiCustomModelContainer.style.display = 'none';
        }
      });
    }

    if (this.toggleKeyVisibilityBtn) {
      this.toggleKeyVisibilityBtn.addEventListener('click', () => {
        if (this.geminiApiKeyInput.type === 'password') {
          this.geminiApiKeyInput.type = 'text';
          this.toggleKeyVisibilityBtn.textContent = 'Hide';
        } else {
          this.geminiApiKeyInput.type = 'password';
          this.toggleKeyVisibilityBtn.textContent = 'Show';
        }
      });
    }

    if (this.testGeminiConnectionBtn) {
      this.testGeminiConnectionBtn.addEventListener('click', async () => {
        const key = this.geminiApiKeyInput.value.trim();
        const model = this.getActiveGeminiModel();
        if (!key) {
          this.showGeminiStatus('Please enter an API key first.', false);
          return;
        }
        this.showGeminiStatus(`Testing connection to Google Gemini API (model: ${model})...`, null);
        try {
          await this.wsdEngine.testGeminiConnection(key, model);
          this.showGeminiStatus(`✓ Connection successful! Model ${model} is ready.`, true);
        } catch (err) {
          this.showGeminiStatus(`✕ Connection failed: ${err.message}`, false);
        }
      });
    }

    if (this.saveGeminiKeyBtn) {
      this.saveGeminiKeyBtn.addEventListener('click', async () => {
        const key = this.geminiApiKeyInput.value.trim();
        const model = this.getActiveGeminiModel();
        if (!key) {
          this.showGeminiStatus('Please enter an API key to save.', false);
          return;
        }
        this.showGeminiStatus(`Validating model ${model} with Gemini API...`, null);
        try {
          await this.wsdEngine.testGeminiConnection(key, model);
          localStorage.setItem('sensecefr_gemini_key', key);
          localStorage.setItem('sensecefr_gemini_model', model);
          localStorage.setItem('sensecefr_use_gemini', 'true');
          this.wsdEngine.geminiApiKey = key;
          this.wsdEngine.geminiModel = model;
          this.wsdEngine.useGemini = true;
          this.geminiToggle.checked = true;
          this.geminiStatusBadge.textContent = 'Active';
          this.geminiStatusBadge.classList.add('active');
          this.showGeminiStatus(`✓ Key saved & connected! Model: ${model}`, true);
          setTimeout(() => {
            this.closeSettings();
          }, 1000);
        } catch (err) {
          this.showGeminiStatus(`✕ Validation failed: ${err.message}`, false);
        }
      });
    }

    if (this.clearGeminiKeyBtn) {
      this.clearGeminiKeyBtn.addEventListener('click', () => {
        localStorage.removeItem('sensecefr_gemini_key');
        localStorage.removeItem('sensecefr_use_gemini');
        this.wsdEngine.geminiApiKey = '';
        this.wsdEngine.useGemini = false;
        this.geminiApiKeyInput.value = '';
        this.geminiToggle.checked = false;
        this.geminiStatusBadge.textContent = 'Offline';
        this.geminiStatusBadge.classList.remove('active');
        this.showGeminiStatus('API key removed from local storage.', false);
      });
    }

    // lexicon toolbar actions like import, backup, template, and reset
    if (this.backupLexiconBtn) {
      this.backupLexiconBtn.addEventListener('click', () => this.exportLexiconBackup());
    }
    if (this.downloadTemplateBtn) {
      this.downloadTemplateBtn.addEventListener('click', () => this.downloadLexiconTemplate());
    }
    if (this.resetLexiconBtn) {
      this.resetLexiconBtn.addEventListener('click', () => this.resetCustomLexicon());
    }
    if (this.lexiconFileInput) {
      this.lexiconFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.importLexiconCSV(e.target.files[0]);
          e.target.value = '';
        }
      });
    }

    // show custom text field when other is selected as part of speech
    if (this.customPosSelect) {
      this.customPosSelect.addEventListener('change', () => {
        if (this.customPosSelect.value === 'other') {
          if (this.customPosOtherContainer) this.customPosOtherContainer.style.display = 'block';
          if (this.customPosOtherInput) this.customPosOtherInput.focus();
        } else {
          if (this.customPosOtherContainer) this.customPosOtherContainer.style.display = 'none';
          if (this.customPosOtherInput) this.customPosOtherInput.value = '';
        }
      });
    }

    const getSelectedPos = () => {
      if (!this.customPosSelect) return '';
      if (this.customPosSelect.value === 'other') {
        const customVal = this.customPosOtherInput ? this.customPosOtherInput.value.trim() : '';
        return customVal || 'other';
      }
      return this.customPosSelect.value;
    };

    // handle adding single words or polysemous senses
    if (this.quickAddLexiconForm) {
      this.quickAddLexiconForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addCustomEntry(
          this.customWordInput.value,
          this.customCefrSelect.value,
          getSelectedPos(),
          this.customGuidewordInput.value,
          this.customDefInput.value
        );
      });
    }
    if (this.addLexiconEntryBtn) {
      this.addLexiconEntryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.addCustomEntry(
          this.customWordInput.value,
          this.customCefrSelect.value,
          getSelectedPos(),
          this.customGuidewordInput.value,
          this.customDefInput.value
        );
      });
    }

    // live search filter across custom dictionary entries
    if (this.lexiconSearchInput) {
      this.lexiconSearchInput.addEventListener('input', () => {
        this.renderCustomLexiconUI(this.lexiconSearchInput.value);
      });
    }

    // load sample text button
    document.querySelectorAll('.sample-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sample;
        this.loadSample(key);
      });
    });

    // close inspector modal
    if (this.closeModalBtn) {
      this.closeModalBtn.addEventListener('click', () => {
        this.closeInspectModal();
      });
    }
    if (this.inspectModal) {
      this.inspectModal.addEventListener('click', (e) => {
        if (e.target === this.inspectModal) {
          this.closeInspectModal();
        }
      });
      // Prevent wheel/touch scrolling on the blurred background backdrop itself
      this.inspectModal.addEventListener('wheel', (e) => {
        if (e.target === this.inspectModal) {
          e.preventDefault();
        }
      }, { passive: false });
      this.inspectModal.addEventListener('touchmove', (e) => {
        if (e.target === this.inspectModal) {
          e.preventDefault();
        }
      }, { passive: false });
    }

    // close any open modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (this.settingsModal && this.settingsModal.style.display === 'flex') {
          this.closeSettings();
        } else if (this.inspectModal && this.inspectModal.style.display === 'flex') {
          this.closeInspectModal();
        }
      }
    });
  }

  loadSample(key) {
    if (SAMPLES[key]) {
      this.inputText.value = SAMPLES[key];
      this.charCount.textContent = `${this.inputText.value.length} characters`;
      this.analyze();
    }
  }

  async analyze() {
    const rawText = this.inputText.value;
    if (!rawText.trim()) {
      this.annotatedViewer.innerHTML = '<span class="viewer-placeholder">Please enter text above to profile...</span>';
      return;
    }

    this.analyzeBtn.disabled = true;
    this.analyzeBtn.innerHTML = '<svg class="icon-white spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Profiling...';

    // tokenize sentences and run morphological lemmatization
    const rawTokens = this.nlpEngine.parseText(rawText);

    // resolve polysemous tokens through the wsd engine
    const polyTokens = rawTokens.filter(t => t.needsWSD);
    const polyCount = polyTokens.length;

    if (this.wsdEngine.useGemini && this.wsdEngine.geminiApiKey && polyTokens.length > 0) {
      await this.wsdEngine.disambiguateBatchGemini(polyTokens);
    } else {
      for (const token of polyTokens) {
        await this.wsdEngine.disambiguateToken(token);
      }
    }

    this.processedTokens = rawTokens;
    this.renderViewer(rawTokens);
    this.updateMetrics(rawTokens, polyCount);

    this.analyzeBtn.disabled = false;
    this.analyzeBtn.innerHTML = '<svg class="icon-white" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>Profile Text';
  }

  renderViewer(tokens) {
    this.annotatedViewer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    tokens.forEach((token, index) => {
      if (!token.isWord) {
        const span = document.createElement('span');
        span.textContent = token.text;
        fragment.appendChild(span);
        return;
      }

      const el = document.createElement('span');
      el.className = 'token';
      el.textContent = token.text;
      el.dataset.tokenId = token.id;

      if (token.isUnresolved) {
        el.classList.add('token-unresolved');
        el.title = `Missing Dictionary Sense: AI flagged that none of the candidate senses fit this sentence context. Click to select manually.`;
      } else {
        const cefrClass = token.cefr ? `token-${token.cefr.toLowerCase()}` : 'token-off';
        el.classList.add(cefrClass);

        if (token.isPhrasal) {
          el.classList.add('token-phrasal');
          el.title = `Phrasal Verb: ${token.phrasalVerb} (${token.cefr}) - ${token.selectedSense ? token.selectedSense.guideword : ''}`;
        } else if (token.isPolysemous) {
          el.classList.add('token-poly');
          el.title = `Sense-Disambiguated: ${token.selectedSense ? token.selectedSense.guideword : ''} (${token.cefr})`;
        } else {
          el.title = `${token.lemma} (${token.cefr})`;
        }

        if (token.isCustom) {
          el.title += ' [Custom Lexicon]';
        }
      }

      el.addEventListener('click', () => this.openInspector(token));
      fragment.appendChild(el);
    });

    this.annotatedViewer.appendChild(fragment);
  }

  updateMetrics(tokens, polyCount) {
    tokens = tokens || this.processedTokens;
    if (!tokens) return;
    const wordTokens = tokens.filter(t => t.isWord);
    const totalWords = wordTokens.length;
    const uniqueTypes = new Set(wordTokens.map(t => t.text.toLowerCase().trim())).size;
    const polyWords = wordTokens.filter(t => t.isPolysemous);
    polyCount = polyCount !== undefined ? polyCount : polyWords.length;

    this.totalWordsEl.textContent = totalWords;
    this.uniqueTypesEl.textContent = uniqueTypes;
    this.polyCountEl.textContent = polyCount;

    // calculate level frequencies
    const counts = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, 'Off-list': 0, 'Unresolved': 0 };
    wordTokens.forEach(t => {
      if (t.isUnresolved) {
        counts['Unresolved']++;
      } else {
        const level = t.cefr || 'Off-list';
        if (counts[level] !== undefined) counts[level]++;
        else counts['Off-list']++;
      }
    });

    // compute percentage share for each level
    const pcts = {};
    for (const [lvl, cnt] of Object.entries(counts)) {
      pcts[lvl] = totalWords > 0 ? ((cnt / totalWords) * 100).toFixed(1) : '0.0';
    }

    document.getElementById('pctA1').textContent = `${pcts.A1}% (${counts.A1})`;
    document.getElementById('pctA2').textContent = `${pcts.A2}% (${counts.A2})`;
    document.getElementById('pctB1').textContent = `${pcts.B1}% (${counts.B1})`;
    document.getElementById('pctB2').textContent = `${pcts.B2}% (${counts.B2})`;
    document.getElementById('pctC1').textContent = `${pcts.C1}% (${counts.C1})`;
    document.getElementById('pctC2').textContent = `${pcts.C2}% (${counts.C2})`;
    document.getElementById('pctOff').textContent = `${pcts['Off-list']}% (${counts['Off-list']})`;

    const legUnresolved = document.getElementById('legendUnresolved');
    if (legUnresolved) {
      if (counts.Unresolved > 0) {
        legUnresolved.style.display = 'inline-flex';
        document.getElementById('pctUnresolved').textContent = `${pcts.Unresolved}% (${counts.Unresolved})`;
      } else {
        legUnresolved.style.display = 'none';
      }
    }

    // update the horizontal distribution bar width and labels
    this.distBar.innerHTML = '';
    const colorMap = {
      A1: 'var(--cefr-a1)',
      A2: 'var(--cefr-a2)',
      B1: 'var(--cefr-b1)',
      B2: 'var(--cefr-b2)',
      C1: 'var(--cefr-c1)',
      C2: 'var(--cefr-c2)',
      'Off-list': 'var(--cefr-off)',
      'Unresolved': 'var(--cefr-unresolved)'
    };

    for (const [lvl, pct] of Object.entries(pcts)) {
      if (parseFloat(pct) > 0) {
        const seg = document.createElement('div');
        seg.className = 'dist-segment';
        seg.style.width = `${pct}%`;
        seg.style.backgroundColor = colorMap[lvl];
        seg.title = `${lvl}: ${pct}%`;
        this.distBar.appendChild(seg);
      }
    }
  }

  overrideSense(token, newSense) {
    token.selectedSense = newSense;
    token.cefr = newSense.cefr;
    token.isUnresolved = false;
    token.confidence = '100% (Manual User Override)';
    token.wsdMethod = 'Manual User Override';

    // update the token element in the text output
    const tokenEl = this.annotatedViewer.querySelector(`[data-token-id="${token.id}"]`);
    if (tokenEl) {
      tokenEl.className = `token token-${newSense.cefr.toLowerCase()}${token.isPhrasal ? ' token-phrasal' : (token.isPolysemous ? ' token-poly' : '')}`;
      tokenEl.title = `Sense-Disambiguated: ${newSense.guideword} (${newSense.cefr}) [User Override]`;
    }

    // recalculate token metrics and level breakdown
    this.updateMetrics();

    // redraw modal to reflect the selected sense
    this.openInspector(token);
  }

  assignManualLevel(token, newLevel) {
    token.cefr = newLevel;
    token.isUnresolved = false;
    token.selectedSense = {
      id: `manual_${token.lemma}_${newLevel.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      guideword: `MANUALLY ASSIGNED (${newLevel})`,
      definition: `User manually assigned CEFR level ${newLevel} to this token.`,
      cefr: newLevel
    };
    token.confidence = '100% (Manual Level Assignment)';
    token.wsdMethod = 'Manual Level Assignment';

    // update the token element in the text output
    const tokenEl = this.annotatedViewer.querySelector(`[data-token-id="${token.id}"]`);
    if (tokenEl) {
      const lvlClass = newLevel === 'Off-list' ? 'off' : newLevel.toLowerCase();
      tokenEl.className = `token token-${lvlClass}${token.isPhrasal ? ' token-phrasal' : (token.isPolysemous ? ' token-poly' : '')}`;
      tokenEl.title = `Manually Assigned: ${newLevel}`;
    }

    // recalculate token metrics and level breakdown
    this.updateMetrics();

    // redraw modal to reflect the selected sense
    this.openInspector(token);
  }

  assignManualSense(token, customSense) {
    const level = customSense.cefr || 'Off-list';
    token.cefr = level;
    token.isUnresolved = false;
    token.selectedSense = {
      id: `manual_sense_${token.lemma}_${Date.now()}`,
      guideword: customSense.guideword || `MANUAL SENSE (${level})`,
      definition: customSense.definition || `User manually assigned sense to this token.`,
      cefr: level
    };
    token.confidence = '100% (Manual Sense Assignment)';
    token.wsdMethod = 'Manual Sense Assignment';

    // update the token element in the text output
    const tokenEl = this.annotatedViewer.querySelector(`[data-token-id="${token.id}"]`);
    if (tokenEl) {
      const lvlClass = level === 'Off-list' ? 'off' : level.toLowerCase();
      tokenEl.className = `token token-${lvlClass}${token.isPhrasal ? ' token-phrasal' : (token.isPolysemous ? ' token-poly' : '')}`;
      tokenEl.title = `${token.selectedSense.guideword} (${level}): ${token.selectedSense.definition}`;
    }

    // recalculate token metrics and level breakdown
    this.updateMetrics();

    // redraw modal to reflect the selected sense
    this.openInspector(token);
  }

  openInspector(token) {
    this.modalWord.textContent = token.isPhrasal ? token.phrasalVerb : token.text;
    if (token.isCustom) {
      this.modalLemma.innerHTML = `${escapeHTML(token.lemma)} <span style="font-size: 0.72rem; color: #0b5035; font-weight: 700; background: #dcfce7; padding: 1px 7px; border-radius: 4px; margin-left: 6px; border: 1px solid #86efac;">Custom Lexicon</span>`;
    } else {
      this.modalLemma.textContent = token.lemma;
    }

    if (token.isUnresolved) {
      this.modalCefrBadge.textContent = 'Manual Pick Needed';
      this.modalCefrBadge.className = 'cefr-tag token-unresolved';
      this.modalConf.textContent = 'Flagged by AI (No Match)';
    } else {
      const lvl = token.cefr || 'Off-list';
      const lvlClass = lvl === 'Off-list' ? 'off' : lvl.toLowerCase();
      this.modalCefrBadge.textContent = lvl;
      this.modalCefrBadge.className = `cefr-tag token-${lvlClass}`;
      this.modalConf.textContent = token.confidence || '100% (Direct Lookup)';
    }

    this.modalSentence.textContent = `"${token.sentenceContext}"`;

    const isOverride = token.wsdMethod === 'Manual User Override' || token.wsdMethod === 'Manual Level Assignment' || token.wsdMethod === 'Manual Sense Assignment';
    const overrideHTML = isOverride ? `<div class="override-badge">✓ Manually Selected by User</div>` : '';

    // render details for the currently assigned sense
    if (token.isUnresolved) {
      this.modalActiveSense.innerHTML = `
        <div class="unresolved-callout" style="background: #fff0f0; border: 1.5px dashed #ff0000; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
          <div style="font-weight: 700; color: #cc0000; font-size: 0.92rem; display: flex; align-items: center; gap: 6px;">
            <span>Missing Dictionary Sense Detected</span>
          </div>
          <div style="font-size: 0.85rem; color: #990000; margin-top: 6px; line-height: 1.45;">
            The AI evaluated the sentence context and determined that <strong>none of the existing candidate senses in the dictionary fit this usage</strong>.
          </div>
        </div>

        <div style="margin-top: 10px;">
          <div style="font-weight: 600; font-size: 0.85rem; color: #334155; margin-bottom: 8px;">
            Manually Define &amp; Assign Sense:
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <div>
              <label style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Guideword / Label</label>
              <input type="text" id="manualSenseGuideword" placeholder="" style="width: 100%; padding: 6px 8px; font-size: 0.82rem; border: 1px solid var(--border-strong); border-radius: 6px; box-sizing: border-box;">
            </div>
            <div>
              <label style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">CEFR Level <span class="required-star">*</span> <span style="color: #dc2626; font-size: 0.7rem; font-weight: 700;">(required)</span></label>
              <select id="manualSenseLevel" style="width: 100%; padding: 6px 8px; font-size: 0.82rem; border: 1px solid var(--border-strong); border-radius: 6px; background: #fff; box-sizing: border-box;" required>
                <option value="" selected disabled></option>
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
                <option value="C2">C2</option>
                <option value="Off-list">Off-list</option>
              </select>
            </div>
          </div>
          <div style="margin-bottom: 8px;">
            <label style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Sense Definition / Meaning</label>
            <input type="text" id="manualSenseDef" placeholder="" style="width: 100%; padding: 6px 8px; font-size: 0.82rem; border: 1px solid var(--border-strong); border-radius: 6px; box-sizing: border-box;">
          </div>
          <div id="manualSenseStatus" style="font-size: 0.8rem; margin-bottom: 8px; display: none;"></div>
          <div style="display: flex; justify-content: flex-end; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary-accent btn-sm" id="btnGenerateSenseAi" title="Deduce and fill sense details automatically using AI">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
              Generate Sense using AI
            </button>
            <button type="button" class="btn btn-primary btn-sm" id="btnAssignCustomSense">
              Assign Sense
            </button>
          </div>
        </div>
      `;

      // handle ai sense generation button click
      const btnGenAi = this.modalActiveSense.querySelector('#btnGenerateSenseAi');
      const statusMsg = this.modalActiveSense.querySelector('#manualSenseStatus');
      if (btnGenAi) {
        btnGenAi.addEventListener('click', async () => {
          if (!this.wsdEngine.geminiApiKey) {
            if (statusMsg) {
              statusMsg.textContent = 'Please configure your API Key in Settings to generate senses with AI.';
              statusMsg.style.color = '#be123c';
              statusMsg.style.display = 'block';
            } else {
              alert('Please configure your API Key in Settings to generate senses with AI.');
            }
            return;
          }

          const originalText = btnGenAi.innerHTML;
          btnGenAi.disabled = true;
          btnGenAi.innerHTML = `
            <svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
            Generating...
          `;
          if (statusMsg) statusMsg.style.display = 'none';

          try {
            const aiSense = await this.wsdEngine.generateSenseAI(token);
            const guidewordInput = this.modalActiveSense.querySelector('#manualSenseGuideword');
            const levelSelect = this.modalActiveSense.querySelector('#manualSenseLevel');
            const defInput = this.modalActiveSense.querySelector('#manualSenseDef');

            if (guidewordInput) guidewordInput.value = aiSense.guideword;
            if (levelSelect) {
              levelSelect.value = aiSense.cefr;
              levelSelect.style.borderColor = 'var(--border-strong)';
            }
            if (defInput) defInput.value = aiSense.definition;

            if (statusMsg) {
              statusMsg.textContent = '✓ Sense details generated by AI! Click "Assign Sense" to apply.';
              statusMsg.style.color = '#15803d';
              statusMsg.style.display = 'block';
            }
          } catch (err) {
            console.error('AI sense generation failed:', err);
            if (statusMsg) {
              statusMsg.textContent = `✕ AI Generation failed: ${err.message}`;
              statusMsg.style.color = '#be123c';
              statusMsg.style.display = 'block';
            }
          } finally {
            btnGenAi.disabled = false;
            btnGenAi.innerHTML = originalText;
          }
        });
      }

      // handle manual level override assignment
      const btnAssignSense = this.modalActiveSense.querySelector('#btnAssignCustomSense');
      if (btnAssignSense) {
        btnAssignSense.addEventListener('click', () => {
          const levelSelect = this.modalActiveSense.querySelector('#manualSenseLevel');
          const level = levelSelect ? levelSelect.value : '';
          if (!level) {
            if (statusMsg) {
              statusMsg.textContent = 'Please select a CEFR level (required).';
              statusMsg.style.color = '#be123c';
              statusMsg.style.display = 'block';
            }
            if (levelSelect) {
              levelSelect.focus();
              levelSelect.style.borderColor = '#dc2626';
            }
            return;
          }

          const guideword = (this.modalActiveSense.querySelector('#manualSenseGuideword')?.value || '').trim();
          const def = (this.modalActiveSense.querySelector('#manualSenseDef')?.value || '').trim();
          this.assignManualSense(token, {
            guideword: guideword.toUpperCase() || `MANUAL SENSE`,
            cefr: level,
            definition: def || `User manually assigned sense to this token.`
          });
        });
      }
    } else if (token.isPolysemous && token.selectedSense) {
      this.modalActiveSense.innerHTML = `
        <div class="sense-card-header">
          <span class="guideword-badge"><span style="color: #c1272d; margin-right: 4px; font-size: 0.82rem; line-height: 1;">✦</span>${token.selectedSense.guideword}</span>
          <span class="cefr-tag token-${token.selectedSense.cefr.toLowerCase()}">${token.selectedSense.cefr}</span>
        </div>
        <div style="font-size: 0.9rem; margin-top: 4px;">${token.selectedSense.definition}</div>
        <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;">Method: ${token.wsdMethod || 'Semantic Matcher'}</div>
        ${overrideHTML}
      `;
    } else {
      this.modalActiveSense.innerHTML = `
        <div style="font-size: 0.9rem;">${token.definition || 'Standard dictionary headword'}</div>
        ${overrideHTML}
      `;
    }

    // show reasoning details if returned by gemini
    if (this.modalAiExplanationContainer && this.modalAiExplanation) {
      if (token.aiExplanation) {
        this.modalAiExplanationContainer.style.display = 'block';
        this.modalAiExplanation.textContent = token.aiExplanation;
      } else {
        this.modalAiExplanationContainer.style.display = 'none';
      }
    }

    // render candidate senses that were ruled out
    if (token.isPolysemous && token.candidateSenses && token.candidateSenses.length > 0) {
      const altCandidates = token.isUnresolved
        ? token.candidateSenses
        : token.candidateSenses.filter(s => token.selectedSense && s.id !== token.selectedSense.id);

      if (altCandidates.length > 0) {
        this.modalAltSensesContainer.style.display = 'block';
        const sectionHeader = this.modalAltSensesContainer.querySelector('.section-label');
        if (sectionHeader) {
          sectionHeader.textContent = token.isUnresolved ? 'Dictionary Candidate Senses (AI Deemed None Fit)' : 'Alternative Candidate Senses';
        }
        this.modalAltSenses.innerHTML = '';
        altCandidates.forEach(s => {
          const card = document.createElement('div');
          card.className = 'sense-card';
          card.innerHTML = `
            <div class="sense-card-header" style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.82rem; color: #1e293b; font-weight: 600;">${s.guideword}</span>
              <span class="cefr-tag token-${s.cefr.toLowerCase()}">${s.cefr}</span>
            </div>
            <div style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">${s.definition}</div>
            <div style="margin-top: 8px; text-align: right;">
              <button class="select-sense-btn">✓ Select this Sense</button>
            </div>
          `;
          const btn = card.querySelector('.select-sense-btn');
          btn.addEventListener('click', () => {
            this.overrideSense(token, s);
          });
          this.modalAltSenses.appendChild(card);
        });
      } else {
        this.modalAltSensesContainer.style.display = 'none';
      }
    } else {
      this.modalAltSensesContainer.style.display = 'none';
    }

    this.lockScroll();
    this.inspectModal.style.display = 'flex';
  }

  exportReport() {
    if (!this.processedTokens || this.processedTokens.length === 0) {
      return;
    }

    const wordTokens = this.processedTokens.filter(t => t.isWord);
    const totalWords = wordTokens.length;
    const uniqueTypes = Array.from(new Set(wordTokens.map(t => t.text.toLowerCase().trim())));
    const polyTokens = wordTokens.filter(t => t.isPolysemous);

    // count occurrences per level for the report
    const distribution = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, 'Off-list': 0, 'Unresolved': 0 };
    wordTokens.forEach(t => {
      if (t.isUnresolved) {
        distribution['Unresolved']++;
      } else {
        const lvl = t.cefr || 'Off-list';
        if (distribution[lvl] !== undefined) distribution[lvl]++;
        else distribution['Off-list']++;
      }
    });

    const csvRows = [];

    // metadata and corpus statistics block
    csvRows.push(['# SenseCEFR Profiler (beta v0.4.1) - Analysis Report']);
    csvRows.push([escapeCSV('Generated At'), escapeCSV(new Date().toISOString())].join(','));
    csvRows.push([escapeCSV('Tokens'), escapeCSV(totalWords)].join(','));
    csvRows.push([escapeCSV('Types'), escapeCSV(uniqueTypes.length)].join(','));
    csvRows.push([escapeCSV('AI Disambiguated Senses'), escapeCSV(polyTokens.length)].join(','));
    csvRows.push([]);

    // level distribution summary table
    csvRows.push([escapeCSV('CEFR Level'), escapeCSV('Count'), escapeCSV('Percentage')].join(','));
    for (const [lvl, count] of Object.entries(distribution)) {
      if (lvl === 'Unresolved' && count === 0) continue;
      const pct = totalWords > 0 ? ((count / totalWords) * 100).toFixed(1) + '%' : '0.0%';
      csvRows.push([escapeCSV(lvl === 'Unresolved' ? 'Needs Manual Pick' : lvl), escapeCSV(count), escapeCSV(pct)].join(','));
    }
    csvRows.push([]);

    // table of polysemous words resolved by context
    csvRows.push([`# AI Disambiguated Polysemous Words (${polyTokens.length} detected)`]);
    csvRows.push([
      escapeCSV('Token'),
      escapeCSV('Lemma'),
      escapeCSV('Assigned CEFR'),
      escapeCSV('Guideword / Sense'),
      escapeCSV('Confidence'),
      escapeCSV('Disambiguation Method'),
      escapeCSV('Sense Definition'),
      escapeCSV('Sentence Context'),
      escapeCSV('AI Reasoning')
    ].join(','));

    polyTokens.forEach(t => {
      const assignedLevel = t.isUnresolved ? 'Unresolved (Manual Pick Needed)' : (t.cefr || 'N/A');
      const guideword = t.isUnresolved ? 'NONE / MISSING IN DICTIONARY' : (t.selectedSense ? t.selectedSense.guideword : 'N/A');
      const definition = t.isUnresolved ? 'AI evaluated context and determined no dictionary sense matches' : (t.selectedSense ? t.selectedSense.definition : 'N/A');
      csvRows.push([
        escapeCSV(t.text),
        escapeCSV(t.lemma),
        escapeCSV(assignedLevel),
        escapeCSV(guideword),
        escapeCSV(t.confidence || 'N/A'),
        escapeCSV(t.wsdMethod || 'Stemmed Semantic Matcher'),
        escapeCSV(definition),
        escapeCSV(t.sentenceContext || ''),
        escapeCSV(t.aiExplanation || '')
      ].join(','));
    });
    csvRows.push([]);

    // complete token list with lemmas and assigned levels
    csvRows.push([`# Full Token Stream (${wordTokens.length} running words)`]);
    csvRows.push([
      escapeCSV('Index'),
      escapeCSV('Token'),
      escapeCSV('Lemma'),
      escapeCSV('CEFR Level'),
      escapeCSV('Polysemous'),
      escapeCSV('Resolved Sense / Note')
    ].join(','));

    wordTokens.forEach((t, idx) => {
      const level = t.isUnresolved ? 'Unresolved' : (t.cefr || 'Off-list');
      const resolved = t.isUnresolved
        ? 'Flagged by AI: No matching sense in dictionary (Manual pick required)'
        : (t.selectedSense ? `${t.selectedSense.guideword} (${t.confidence || ''})` : (t.definition || ''));
      csvRows.push([
        escapeCSV(idx + 1),
        escapeCSV(t.text),
        escapeCSV(t.lemma),
        escapeCSV(level),
        escapeCSV(t.isPolysemous ? 'Yes' : 'No'),
        escapeCSV(resolved)
      ].join(','));
    });

    const csvContent = csvRows.join('\r\n');

    // export report as csv with utf-8 bom for excel compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sensecefr_report_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // brief visual confirmation on the download button
    if (this.exportReportBtn) {
      const origHtml = this.exportReportBtn.innerHTML;
      this.exportReportBtn.innerHTML = '<svg class="icon-red" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>Downloaded!';
      setTimeout(() => {
        this.exportReportBtn.innerHTML = origHtml;
      }, 1500);
    }
  }
}

// bootstrap application after dom is ready
window.addEventListener('DOMContentLoaded', () => {
  window.senseCEFRApp = new SenseCEFRApp();
});

