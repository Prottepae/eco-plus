(() => {
  'use strict';

  const STORAGE_KEY = 'eco-plus-v1';
  const LEGACY_STORAGE_KEY = 'meu-dinheiro-v1';
  const THEME_KEY = 'eco-plus-theme';
  const PALETTE_KEY = 'eco-plus-palette';
  const COMPACT_MODE_KEY = 'eco-plus-compact-mode';
  const REDUCED_MOTION_KEY = 'eco-plus-reduced-motion';
  const SELECTED_MONTH_KEY = 'eco-plus-selected-month';
  const PALETTES = ['green', 'ocean', 'lavender', 'amber'];
  const APP_VERSION = '1.7.1';
  const CATEGORIES = [
    ['Alimentação', '🍎'], ['Transportes', '🚗'], ['Casa', '🏠'],
    ['Entretenimento', '🎬'], ['Compras', '🛍️'], ['Subscrições', '📱'],
    ['Saúde', '🩺'], ['Outros', '✳️']
  ];
  const monthFormatter = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' });
  const monthPickerFormatter = new Intl.DateTimeFormat('pt-PT', { month: 'short', year: 'numeric' });
  const dateFormatter = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' });
  const currencyFormatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
  const elements = Object.fromEntries([
    'monthView', 'transactionsView', 'historyView', 'monthHeading', 'monthPicker',
    'transactionsHeading', 'transactionsMonthPicker', 'allTransactionsList', 'viewMoreTransactionsButton',
    'backToMonthButton', 'balanceAmount', 'negativeNote',
    'spentPercent', 'progressTrack', 'progressFill', 'incomeAmount', 'spentAmount', 'editIncomeButton',
    'monthComparison', 'comparisonIcon', 'comparisonText', 'exportMonthCsvButton',
    'awardStrip', 'expenseList', 'expenseFilters', 'expenseSearch', 'expenseCategoryFilter', 'expenseTypeFilter',
    'clearExpenseFilters', 'expenseCount', 'categoryBreakdown', 'categoryBreakdownList',
    'historyList', 'historyEmpty', 'expenseDialog', 'expenseForm', 'expenseId',
    'expenseAmount', 'expenseName', 'expenseCategory', 'expenseDate', 'expenseDialogTitle',
    'expenseMonthLabel', 'expenseError', 'deleteExpenseButton', 'monthDialog', 'monthForm',
    'monthDate', 'monthIncome', 'monthError', 'incomeDialog', 'incomeForm', 'incomeValue',
    'incomeMonthLabel', 'incomeError', 'themeToggle', 'userPill', 'userNameLabel', 'profileDialog',
    'profileForm', 'profileName', 'profileError', 'themeModeSelect', 'colorPaletteSelect',
    'compactModeToggle', 'reducedMotionToggle', 'expenseType', 'subscriptionList', 'subscriptionDialog',
    'subscriptionForm', 'subscriptionDialogTitle', 'subscriptionId', 'subscriptionName', 'subscriptionAmount', 'subscriptionStartMonth',
    'subscriptionEndDate', 'subscriptionError', 'deleteSubscriptionButton', 'exportDataButton', 'importDataButton',
    'importDataFile', 'backupError'
  ].map(id => [id, document.getElementById(id)]));

  let data = loadData();
  let selectedMonth = loadSelectedMonth();
  let activeView = 'monthView';
  let audioContext = null;
  let themeMode = loadThemeMode();
  let colorPalette = loadColorPalette();
  let compactMode = localStorage.getItem(COMPACT_MODE_KEY) === 'true';
  let reducedMotion = localStorage.getItem(REDUCED_MOTION_KEY) === 'true';

  function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function loadSelectedMonth() {
    const savedMonth = localStorage.getItem(SELECTED_MONTH_KEY);
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(savedMonth || '') ? savedMonth : currentMonthKey();
  }

  function loadThemeMode() {
    const savedTheme = localStorage.getItem(THEME_KEY) || localStorage.getItem('meu-dinheiro-theme');
    return ['system', 'light', 'dark'].includes(savedTheme) ? savedTheme : 'system';
  }

  function loadColorPalette() {
    const savedPalette = localStorage.getItem(PALETTE_KEY);
    return PALETTES.includes(savedPalette) ? savedPalette : 'green';
  }

  function savePreferences() {
    localStorage.setItem(THEME_KEY, themeMode);
    localStorage.setItem(PALETTE_KEY, colorPalette);
    localStorage.setItem(COMPACT_MODE_KEY, String(compactMode));
    localStorage.setItem(REDUCED_MOTION_KEY, String(reducedMotion));
    localStorage.setItem(SELECTED_MONTH_KEY, selectedMonth);
  }

  function applyPreferences() {
    const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    document.documentElement.dataset.palette = colorPalette;
    document.documentElement.dataset.density = compactMode ? 'compact' : 'comfortable';
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
    elements.themeToggle.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
  }

  function syncPreferenceControls() {
    elements.themeModeSelect.value = themeMode;
    elements.colorPaletteSelect.value = colorPalette;
    elements.compactModeToggle.checked = compactMode;
    elements.reducedMotionToggle.checked = reducedMotion;
  }

  function setSelectedMonth(month) {
    selectedMonth = month;
    localStorage.setItem(SELECTED_MONTH_KEY, selectedMonth);
  }

  function loadData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || '{"months":{},"profile":{"name":""}}';
      const parsed = normalizeAppData(JSON.parse(stored));
      if (localStorage.getItem(STORAGE_KEY) === null && localStorage.getItem(LEGACY_STORAGE_KEY) !== null) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return emptyData();
    }
  }

  function emptyData() {
    return { months: {}, profile: { name: '' }, subscriptions: [] };
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeAppData(value) {
    let parsed = value;
    if (parsed && parsed.data && typeof parsed.data === 'object' && parsed.data.months) parsed = parsed.data;
    if (!parsed || typeof parsed.months !== 'object' || Array.isArray(parsed.months)) return emptyData();
    parsed.profile = parsed.profile && typeof parsed.profile === 'object' ? parsed.profile : { name: '' };
    parsed.profile.name = typeof parsed.profile.name === 'string' ? parsed.profile.name : '';
    parsed.subscriptions = Array.isArray(parsed.subscriptions) ? parsed.subscriptions.map(normalizeSubscription).filter(Boolean) : [];
    for (const [key, month] of Object.entries(parsed.months)) {
      if (!/^\d{4}-\d{2}$/.test(key) || !month || !Number.isFinite(Number(month.income))) {
        delete parsed.months[key];
        continue;
      }
      month.income = Math.max(0, Number(month.income));
      month.expenses = Array.isArray(month.expenses) ? month.expenses.map(normalizeExpense).filter(Boolean) : [];
    }
    return parsed;
  }

  function normalizeExpense(expense) {
    if (!expense || typeof expense !== 'object') return null;
    if (!isValidExpense(expense)) return null;
    const entryType = ['refund', 'received'].includes(expense.type) ? expense.type : 'expense';
    return {
      ...expense,
      type: entryType,
      amount: Number(expense.amount),
      reimbursed: entryType === 'expense' && expense.reimbursed === true
    };
  }

  function isValidExpense(expense) {
    return expense && typeof expense.id === 'string' && typeof expense.name === 'string' &&
      Number.isFinite(Number(expense.amount)) && Number(expense.amount) > 0 &&
      typeof expense.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expense.date);
  }

  function normalizeSubscription(subscription) {
    if (!subscription || typeof subscription !== 'object' || typeof subscription.id !== 'string' ||
      typeof subscription.name !== 'string' || !Number.isFinite(Number(subscription.amount)) ||
      Number(subscription.amount) <= 0 || !/^\d{4}-\d{2}$/.test(subscription.startMonth || '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(subscription.endDate || '')) return null;
    return { ...subscription, amount: Number(subscription.amount) };
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch {
      window.alert('Não foi possível guardar os dados neste dispositivo. Verifica o espaço disponível no navegador.');
      return false;
    }
  }

  function formatMonth(key) {
    const [year, month] = key.split('-').map(Number);
    const label = monthFormatter.format(new Date(year, month - 1, 1));
    return label.charAt(0).toLocaleUpperCase('pt-PT') + label.slice(1);
  }

  function formatCurrency(value) {
    return currencyFormatter.format(Number.isFinite(value) ? value : 0);
  }

  function subscriptionTotal(monthKey) {
    return data.subscriptions.reduce((sum, subscription) => {
      const endMonth = subscription.endDate.slice(0, 7);
      return subscription.startMonth <= monthKey && monthKey <= endMonth ? sum + subscription.amount : sum;
    }, 0);
  }

  function monthTotals(month, monthKey = selectedMonth) {
    const spent = month.expenses.reduce((sum, expense) => sum + (expense.type === 'expense' && !expense.reimbursed ? Number(expense.amount) : 0), 0);
    const refunds = month.expenses.reduce((sum, expense) => sum + (expense.type !== 'expense' ? Number(expense.amount) : 0), 0);
    const subscriptions = subscriptionTotal(monthKey);
    return { spent, refunds, subscriptions, balance: Number(month.income) - spent - subscriptions + refunds };
  }

  function getMonth() {
    return data.months[selectedMonth] || null;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function dateFromKey(key) {
    const [year, month] = key.split('-').map(Number);
    const day = Math.min(new Date().getDate(), new Date(year, month, 0).getDate());
    return `${key}-${String(day).padStart(2, '0')}`;
  }

  function triggerHaptic(pattern) {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }

  function ensureAudioContext() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioContext) audioContext = new AudioCtor();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    return audioContext;
  }

  function playTone(frequency, duration, type, gainValue, delay = 0) {
    const context = ensureAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + delay);
    gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(gainValue, context.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime + delay);
    oscillator.stop(context.currentTime + delay + duration);
  }

  function triggerFeedback(type = 'success') {
    if (type === 'success') {
      triggerHaptic([10]);
      playTone(660, 0.08, 'triangle', 0.06, 0);
      playTone(840, 0.11, 'triangle', 0.04, 0.08);
    } else if (type === 'delete') {
      triggerHaptic([18, 38, 18]);
      playTone(180, 0.14, 'sawtooth', 0.05, 0);
      playTone(120, 0.18, 'square', 0.04, 0.08);
    } else {
      triggerHaptic([30, 20, 30]);
      playTone(340, 0.12, 'square', 0.04, 0);
      playTone(290, 0.2, 'square', 0.03, 0.12);
    }
  }

  function pulseElement(selector) {
    const element = document.querySelector(selector);
    if (!element) return;
    element.classList.remove('is-popping');
    void element.offsetWidth;
    element.classList.add('is-popping');
  }

  function getAwards(month) {
    if (!month) return [{ icon: '🏁', label: 'Começa o mês', detail: 'define a tua renda' }];

    const { spent, balance } = monthTotals(month);
    const percent = month.income > 0 ? spent / month.income * 100 : 0;
    const awards = [];

    if (month.expenses.length === 0) {
      awards.push({ icon: '🌱', label: 'Planeamento', detail: 'sem despesas' });
    }
    if (month.expenses.length >= 3) {
      awards.push({ icon: '✨', label: 'Fluxo em foco', detail: 'vários movimentos' });
    }
    if (month.income > 0 && percent <= 50) {
      awards.push({ icon: '🏆', label: 'Controlo total', detail: 'até metade gasto' });
    }
    if (balance >= month.income * 0.7) {
      awards.push({ icon: '💚', label: 'Mês saudável', detail: 'saldo forte' });
    }
    if (balance < 0) {
      awards.push({ icon: '🔥', label: 'Mês apertado', detail: 'alerta de gasto' });
    }
    if (month.expenses.some(expense => expense.category === 'Subscrições')) {
      awards.push({ icon: '📱', label: 'Assinaturas', detail: 'em ordem' });
    }

    return awards.slice(0, 3);
  }

  function render() {
    renderMonth();
    renderHistory();
    renderMonthPicker();
    renderSubscriptions();
    renderAllTransactions();
  }

  function renderMonth() {
    const month = getMonth();
    elements.monthHeading.textContent = formatMonth(selectedMonth);
    if (!month) {
      elements.balanceAmount.textContent = formatCurrency(0);
      elements.incomeAmount.textContent = formatCurrency(0);
      elements.spentAmount.textContent = formatCurrency(0);
      elements.spentPercent.textContent = '0%';
      elements.progressFill.style.width = '0%';
      elements.progressTrack.setAttribute('aria-valuenow', '0');
      elements.negativeNote.hidden = true;
      elements.editIncomeButton.hidden = true;
      elements.awardStrip.innerHTML = '<span class="award-pill award-pill--muted"><span>🏁</span>Começa o mês</span>';
      elements.monthComparison.hidden = true;
      elements.exportMonthCsvButton.hidden = true;
      elements.categoryBreakdown.hidden = true;
      elements.expenseFilters.hidden = true;
      elements.viewMoreTransactionsButton.hidden = true;
      elements.expenseList.innerHTML = `<div class="empty-state"><span class="empty-icon" aria-hidden="true">€</span><h2>Sem mês registado</h2><p>Cria este mês e define quanto recebeste para começares.</p><button class="text-action" type="button" data-action="create-month">Criar mês</button></div>`;
      return;
    }

    const { spent, refunds, subscriptions, balance } = monthTotals(month);
    const totalSpent = spent + subscriptions;
    const percentage = month.income > 0 ? totalSpent / month.income * 100 : (totalSpent > 0 ? 100 : 0);
    const displayPercent = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(percentage);
    elements.balanceAmount.textContent = formatCurrency(balance);
    elements.incomeAmount.textContent = formatCurrency(month.income);
    elements.spentAmount.textContent = formatCurrency(totalSpent);
    elements.spentPercent.textContent = `${displayPercent}%`;
    elements.progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    elements.progressTrack.setAttribute('aria-valuenow', String(Math.min(100, Math.max(0, percentage))));
    elements.negativeNote.hidden = balance >= 0;
    elements.editIncomeButton.hidden = false;
    elements.exportMonthCsvButton.hidden = false;
    elements.awardStrip.innerHTML = getAwards(month).map(award => `<span class="award-pill award-pill--${balance < 0 ? 'warning' : 'success'}"><span>${award.icon}</span>${award.label}</span>`).join('');
    if (refunds > 0) {
      elements.awardStrip.innerHTML += `<span class="award-pill award-pill--muted"><span>↩️</span>Reembolsos ${formatCurrency(refunds)}</span>`;
    }
    if (subscriptions > 0) {
      elements.awardStrip.innerHTML += `<span class="award-pill award-pill--muted"><span>📱</span>Subscrições ${formatCurrency(subscriptions)}</span>`;
    }
    pulseElement('.balance-amount');
    pulseElement('.summary-item strong');

    renderMonthComparison(totalSpent);
    renderCategoryBreakdown(month);
    renderExpenseList(month);
  }

  function renderMonthComparison(currentSpent) {
    const previousKey = Object.keys(data.months)
      .filter(key => key < selectedMonth)
      .sort((a, b) => b.localeCompare(a))[0];
    elements.monthComparison.hidden = !previousKey;
    if (!previousKey) return;

    const previousMonth = data.months[previousKey];
    const { spent, subscriptions } = monthTotals(previousMonth, previousKey);
    const previousSpent = spent + subscriptions;
    const difference = Math.round((currentSpent - previousSpent) * 100) / 100;
    const previousLabel = formatMonth(previousKey);
    elements.monthComparison.classList.toggle('is-positive', difference < 0);
    elements.monthComparison.classList.toggle('is-negative', difference > 0);

    if (difference === 0) {
      elements.comparisonIcon.textContent = '↔';
      elements.comparisonText.textContent = `Gastaste o mesmo que em ${previousLabel}.`;
    } else if (previousSpent === 0) {
      elements.comparisonIcon.textContent = '↗';
      elements.comparisonText.textContent = `Começaste a registar gastos: ${formatCurrency(currentSpent)}.`;
    } else {
      const changePercent = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 })
        .format(Math.abs(difference / previousSpent * 100));
      const direction = difference < 0 ? 'menos' : 'mais';
      elements.comparisonIcon.textContent = difference < 0 ? '↓' : '↑';
      elements.comparisonText.textContent = `Gastaste ${formatCurrency(Math.abs(difference))} ${direction} (${changePercent}%) do que em ${previousLabel}.`;
    }
  }

  function renderCategoryBreakdown(month) {
    const categoryTotals = new Map();
    month.expenses.filter(expense => expense.type === 'expense' && !expense.reimbursed).forEach(expense => {
      const category = CATEGORIES.some(([name]) => name === expense.category) ? expense.category : 'Outros';
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + Number(expense.amount));
    });
    const total = [...categoryTotals.values()].reduce((sum, amount) => sum + amount, 0);
    elements.categoryBreakdown.hidden = total === 0;
    if (!total) {
      elements.categoryBreakdownList.innerHTML = '';
      return;
    }

    const categoryIcons = Object.fromEntries(CATEGORIES);
    const sorted = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
    elements.categoryBreakdownList.innerHTML = sorted.map(([category, amount]) => {
      const percentage = amount / total * 100;
      const displayPercent = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(percentage);
      return `<div class="category-breakdown-row">
        <div class="category-breakdown-meta"><span class="category-breakdown-name">${categoryIcons[category]} ${escapeHTML(category)}</span><strong>${formatCurrency(amount)}</strong></div>
        <div class="category-bar-track" role="progressbar" aria-label="${escapeHTML(category)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}">
          <span class="category-bar-fill" style="width:${percentage}%"></span>
        </div>
        <span class="category-breakdown-percent">${displayPercent}% dos gastos</span>
      </div>`;
    }).join('');
  }

  function renderExpenseList(month) {
    const sorted = getSortedTransactions(month.expenses);
    const recent = sorted.slice(0, 5);
    elements.viewMoreTransactionsButton.hidden = sorted.length <= recent.length;
    elements.viewMoreTransactionsButton.textContent = 'Ver mais';
    if (!recent.length) {
      elements.expenseList.innerHTML = '<div class="empty-state"><span class="empty-icon" aria-hidden="true">↘</span><h2>Sem despesas ainda</h2><p>Adiciona a primeira despesa para veres o teu saldo atualizado.</p></div>';
      return;
    }

    elements.expenseList.innerHTML = renderTransactionRows(recent);
  }

  function getSortedTransactions(expenses) {
    return [...expenses].reverse();
  }

  function renderTransactionRows(expenses) {
    const categoryIcons = Object.fromEntries(CATEGORIES);
    return expenses.map((expense, index) => {
      const date = new Date(`${expense.date}T12:00:00`);
      const isCredit = expense.type !== 'expense';
      const sign = isCredit ? '+' : '−';
      const valueClass = expense.reimbursed
        ? 'expense-value expense-value--reimbursed'
        : isCredit ? 'expense-value expense-value--refund' : 'expense-value';
      const metaLabel = expense.reimbursed
        ? `Reembolsada · ${expense.category}`
        : expense.type === 'refund' ? 'Reembolso' : expense.type === 'received' ? 'Recebido' : expense.category;
      const icon = expense.reimbursed ? '✓' : isCredit ? '↩️' : (categoryIcons[expense.category] || '✳️');
      const displayedValue = expense.reimbursed ? formatCurrency(Number(expense.amount)) : `${sign}${formatCurrency(Number(expense.amount))}`;
      return `<button class="expense-row" type="button" data-expense-id="${escapeHTML(expense.id)}" style="animation-delay:${Math.min(index, 7) * 35}ms">
        <span class="category-icon${expense.reimbursed ? ' category-icon--reimbursed' : ''}" aria-hidden="true">${icon}</span>
        <span class="expense-main"><span class="expense-name">${escapeHTML(expense.name)}</span><span class="expense-meta">${escapeHTML(metaLabel)} · ${dateFormatter.format(date)}</span></span>
        <span class="${valueClass}">${displayedValue}</span>
      </button>`;
    }).join('');
  }

  function renderAllTransactions() {
    const month = getMonth();
    elements.transactionsHeading.textContent = formatMonth(selectedMonth);
    elements.expenseFilters.hidden = !month?.expenses.length;
    if (!month?.expenses.length) {
      elements.expenseCount.textContent = '0 movimentos';
      elements.allTransactionsList.innerHTML = '<div class="empty-state"><span class="empty-icon" aria-hidden="true">↘</span><h2>Sem movimentos neste mês</h2><p>Volta ao resumo do mês para adicionar despesas, reembolsos ou valores recebidos.</p></div>';
      return;
    }

    const query = elements.expenseSearch.value.trim().toLocaleLowerCase('pt-PT');
    const categoryFilter = elements.expenseCategoryFilter.value;
    const typeFilter = elements.expenseTypeFilter.value;
    const filtered = month.expenses.filter(expense => {
      const matchesQuery = !query || `${expense.name} ${expense.category || ''}`.toLocaleLowerCase('pt-PT').includes(query);
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
      const matchesType = typeFilter === 'all' || expense.type === typeFilter;
      return matchesQuery && matchesCategory && matchesType;
    });
    const sorted = getSortedTransactions(filtered);
    const hasFilters = Boolean(query) || categoryFilter !== 'all' || typeFilter !== 'all';
    elements.clearExpenseFilters.hidden = !hasFilters;
    elements.expenseCount.textContent = `A mostrar ${sorted.length} de ${month.expenses.length} ${month.expenses.length === 1 ? 'movimento' : 'movimentos'}`;
    elements.allTransactionsList.innerHTML = sorted.length
      ? renderTransactionRows(sorted)
      : '<div class="empty-state"><span class="empty-icon" aria-hidden="true">⌕</span><h2>Sem resultados</h2><p>Não encontrámos movimentos com estes filtros. Experimenta alterar a pesquisa ou limpar os filtros.</p></div>';
  }

  function renderHistory() {
    const keys = Object.keys(data.months).sort((a, b) => b.localeCompare(a));
    elements.historyEmpty.hidden = keys.length > 0;
    elements.historyList.hidden = keys.length === 0;
    elements.historyList.innerHTML = keys.map((key, index) => {
      const month = data.months[key];
      const { spent, refunds, subscriptions, balance } = monthTotals(month, key);
      const totalSpent = spent + subscriptions;
      return `<button class="history-row" type="button" data-month-key="${key}" style="animation-delay:${Math.min(index, 7) * 40}ms">
        <span class="history-month">${escapeHTML(formatMonth(key))}</span>
        <span class="history-balance${balance < 0 ? ' is-negative' : ''}">${formatCurrency(balance)}</span>
        <span class="history-stats"><span>Recebido: <strong>${formatCurrency(month.income)}</strong></span><span>Gasto: <strong>${formatCurrency(totalSpent)}</strong></span><span>Subscrições: <strong>${formatCurrency(subscriptions)}</strong></span><span>Reemb.: <strong>${formatCurrency(refunds)}</strong></span><span>Restante: <strong>${formatCurrency(balance)}</strong></span></span>
      </button>`;
    }).join('');
  }

  function renderSubscriptions() {
    const subscriptions = [...data.subscriptions].sort((a, b) => a.name.localeCompare(b.name, 'pt-PT'));
    if (!subscriptions.length) {
      elements.subscriptionList.innerHTML = '<p class="subscription-empty">Ainda não adicionaste subscrições mensais.</p>';
      return;
    }
    elements.subscriptionList.innerHTML = subscriptions.map(subscription => {
      const endDate = new Date(`${subscription.endDate}T12:00:00`);
      const endMonth = subscription.endDate.slice(0, 7);
      const status = selectedMonth < subscription.startMonth ? 'Começa mais tarde' : selectedMonth > endMonth ? 'Terminada' : `Até ${dateFormatter.format(endDate)}`;
      return `<button class="subscription-row" type="button" data-subscription-id="${escapeHTML(subscription.id)}">
        <span class="subscription-icon" aria-hidden="true">↻</span>
        <span class="expense-main"><span class="expense-name">${escapeHTML(subscription.name)}</span><span class="expense-meta">${escapeHTML(status)} · mensal</span></span>
        <span class="subscription-value">${formatCurrency(subscription.amount)}<small>/mês</small></span>
      </button>`;
    }).join('');
  }

  function renderMonthPicker() {
    const keys = [...new Set([selectedMonth, ...Object.keys(data.months)])].sort((a, b) => b.localeCompare(a));
    const options = keys.map(key => {
      const [year, month] = key.split('-').map(Number);
      const label = monthPickerFormatter.format(new Date(year, month - 1, 1));
      return `<option value="${key}"${key === selectedMonth ? ' selected' : ''}>${escapeHTML(label)}</option>`;
    }).join('');
    elements.monthPicker.innerHTML = options;
    elements.transactionsMonthPicker.innerHTML = options;
  }

  function showView(viewId) {
    activeView = viewId;
    elements.monthView.hidden = viewId !== 'monthView';
    elements.transactionsView.hidden = viewId !== 'transactionsView';
    elements.historyView.hidden = viewId !== 'historyView';
    document.querySelectorAll('.view-tab').forEach(tab => {
      const selected = tab.dataset.view === (viewId === 'transactionsView' ? 'monthView' : viewId);
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-current', selected ? 'page' : 'false');
    });
    document.getElementById('addExpenseButton').hidden = !['monthView', 'transactionsView'].includes(viewId);
    if (viewId === 'transactionsView') renderAllTransactions();
  }

  function openMonthDialog() {
    elements.monthDate.value = selectedMonth;
    elements.monthIncome.value = '';
    elements.monthError.hidden = true;
    elements.monthDialog.showModal();
  }

  function openExpenseDialog(expense = null) {
    const month = getMonth();
    if (!month) return openMonthDialog();
    elements.expenseForm.reset();
    elements.expenseError.hidden = true;
    elements.expenseId.value = expense?.id || '';
    elements.expenseAmount.value = expense ? Number(expense.amount).toFixed(2) : '';
    elements.expenseName.value = expense?.name || '';
    elements.expenseCategory.value = expense?.category || CATEGORIES[0][0];
    elements.expenseDate.value = expense?.date || dateFromKey(selectedMonth);
    elements.expenseType.value = ['refund', 'received'].includes(expense?.type) ? expense.type : 'expense';
    elements.expenseDialogTitle.textContent = expense ? 'Editar movimento' : 'Novo movimento';
    elements.expenseMonthLabel.textContent = formatMonth(selectedMonth);
    elements.expenseForm.querySelector('.submit-button').textContent = expense ? 'Guardar alterações' : 'Adicionar movimento';
    elements.deleteExpenseButton.hidden = !expense;
    elements.expenseDialog.showModal();
    requestAnimationFrame(() => elements.expenseAmount.focus({ preventScroll: true }));
  }

  function openSubscriptionDialog(subscription = null) {
    elements.subscriptionForm.reset();
    elements.subscriptionError.hidden = true;
    elements.subscriptionId.value = subscription?.id || '';
    elements.subscriptionName.value = subscription?.name || '';
    elements.subscriptionAmount.value = subscription ? Number(subscription.amount).toFixed(2) : '';
    elements.subscriptionStartMonth.value = subscription?.startMonth || selectedMonth;
    elements.subscriptionEndDate.value = subscription?.endDate || dateFromKey(selectedMonth);
    elements.subscriptionDialogTitle.textContent = subscription ? 'Editar subscrição' : 'Nova subscrição';
    elements.subscriptionForm.querySelector('.submit-button').textContent = subscription ? 'Guardar alterações' : 'Guardar subscrição';
    elements.deleteSubscriptionButton.hidden = !subscription;
    elements.subscriptionDialog.showModal();
  }

  function createId() {
    return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  document.querySelectorAll('.view-tab').forEach(tab => tab.addEventListener('click', () => showView(tab.dataset.view)));
  document.getElementById('newMonthButton').addEventListener('click', openMonthDialog);
  document.getElementById('historyNewMonthButton').addEventListener('click', openMonthDialog);
  document.getElementById('firstMonthButton').addEventListener('click', openMonthDialog);
  document.getElementById('addExpenseButton').addEventListener('click', () => openExpenseDialog());
  elements.viewMoreTransactionsButton.addEventListener('click', () => showView('transactionsView'));
  elements.backToMonthButton.addEventListener('click', () => showView('monthView'));
  document.getElementById('addSubscriptionButton').addEventListener('click', () => openSubscriptionDialog());
  document.getElementById('editIncomeButton').addEventListener('click', () => {
    const month = getMonth();
    if (!month) return;
    elements.incomeValue.value = Number(month.income).toFixed(2);
    elements.incomeMonthLabel.textContent = formatMonth(selectedMonth);
    elements.incomeError.hidden = true;
    elements.incomeDialog.showModal();
  });

  elements.monthPicker.addEventListener('change', event => {
    setSelectedMonth(event.target.value);
    render();
  });
  elements.transactionsMonthPicker.addEventListener('change', event => {
    setSelectedMonth(event.target.value);
    render();
    showView('transactionsView');
  });
  elements.expenseSearch.addEventListener('input', renderAllTransactions);
  elements.expenseCategoryFilter.addEventListener('change', renderAllTransactions);
  elements.expenseTypeFilter.addEventListener('change', renderAllTransactions);
  elements.clearExpenseFilters.addEventListener('click', () => {
    elements.expenseSearch.value = '';
    elements.expenseCategoryFilter.value = 'all';
    elements.expenseTypeFilter.value = 'all';
    renderAllTransactions();
    elements.expenseSearch.focus();
  });

  elements.subscriptionList.addEventListener('click', event => {
    const row = event.target.closest('[data-subscription-id]');
    if (!row) return;
    const subscription = data.subscriptions.find(item => item.id === row.dataset.subscriptionId);
    if (subscription) openSubscriptionDialog(subscription);
  });

  elements.subscriptionForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = elements.subscriptionName.value.trim();
    const amount = Number(elements.subscriptionAmount.value);
    const startMonth = elements.subscriptionStartMonth.value;
    const endDate = elements.subscriptionEndDate.value;
    if (!name || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startMonth > endDate.slice(0, 7)) {
      elements.subscriptionError.textContent = 'Confirma o nome, o valor e um prazo final igual ou posterior ao início.';
      elements.subscriptionError.hidden = false;
      triggerFeedback('warning');
      return;
    }
    const subscription = { id: elements.subscriptionId.value || createId(), name, amount: Math.round(amount * 100) / 100, startMonth, endDate };
    const index = data.subscriptions.findIndex(item => item.id === subscription.id);
    if (index >= 0) data.subscriptions[index] = subscription;
    else data.subscriptions.push(subscription);
    saveData();
    elements.subscriptionDialog.close();
    render();
    triggerFeedback('success');
  });

  elements.deleteSubscriptionButton.addEventListener('click', () => {
    const subscriptionId = elements.subscriptionId.value;
    const subscription = data.subscriptions.find(item => item.id === subscriptionId);
    if (!subscription || !window.confirm(`Eliminar a subscrição "${subscription.name}"? Esta ação não pode ser anulada.`)) return;
    data.subscriptions = data.subscriptions.filter(item => item.id !== subscriptionId);
    saveData();
    elements.subscriptionDialog.close();
    render();
    triggerFeedback('delete');
  });

  function handleExpenseListClick(event) {
    if (event.target.closest('[data-action="create-month"]')) return openMonthDialog();
    const row = event.target.closest('[data-expense-id]');
    if (!row) return;
    const expense = getMonth()?.expenses.find(item => item.id === row.dataset.expenseId);
    if (expense) openExpenseDialog(expense);
  }
  elements.expenseList.addEventListener('click', handleExpenseListClick);
  elements.allTransactionsList.addEventListener('click', handleExpenseListClick);

  elements.historyList.addEventListener('click', event => {
    const row = event.target.closest('[data-month-key]');
    if (!row) return;
    setSelectedMonth(row.dataset.monthKey);
    render();
    showView('monthView');
  });

  elements.expenseForm.addEventListener('submit', event => {
    event.preventDefault();
    const amount = Number(elements.expenseAmount.value);
    const name = elements.expenseName.value.trim();
    const date = elements.expenseDate.value;
    const type = ['refund', 'received'].includes(elements.expenseType.value) ? elements.expenseType.value : 'expense';
    if (!Number.isFinite(amount) || amount <= 0 || !name || !date || date.slice(0, 7) !== selectedMonth) {
      elements.expenseError.textContent = date && date.slice(0, 7) !== selectedMonth ? 'A data do movimento tem de pertencer ao mês selecionado.' : 'Confirma o valor, a descrição e a data.';
      elements.expenseError.hidden = false;
      triggerFeedback('warning');
      return;
    }
    const month = getMonth();
    const roundedAmount = Math.round(amount * 100) / 100;
    const expenseId = elements.expenseId.value;
    const linkedPayment = type !== 'expense'
      ? findPaymentForCredit(month, roundedAmount, expenseId)
      : null;
    let associatedPayment = null;
    if (linkedPayment) {
      associatedPayment = confirmCreditAssociation(linkedPayment, roundedAmount, type);
    }

    if (associatedPayment) {
      associatedPayment.reimbursed = true;
      const existingCreditIndex = month.expenses.findIndex(item => item.id === expenseId);
      if (existingCreditIndex >= 0) month.expenses.splice(existingCreditIndex, 1);
    } else {
      const existingExpense = month.expenses.find(item => item.id === expenseId);
      const expense = {
        id: expenseId || createId(),
        name,
        amount: roundedAmount,
        category: elements.expenseCategory.value,
        date,
        type,
        reimbursed: type === 'expense' && existingExpense?.reimbursed === true
      };
      const existingIndex = month.expenses.findIndex(item => item.id === expense.id);
      if (existingIndex >= 0) month.expenses[existingIndex] = expense;
      else month.expenses.push(expense);
    }
    saveData();
    elements.expenseDialog.close();
    render();
    triggerFeedback('success');
  });

  function findPaymentForCredit(month, amount, excludeId) {
    const amountInCents = Math.round(amount * 100);
    return month.expenses.filter(expense =>
      expense.id !== excludeId &&
      expense.type === 'expense' &&
      !expense.reimbursed &&
      Math.round(Number(expense.amount) * 100) === amountInCents
    );
  }

  function confirmCreditAssociation(payments, amount, type) {
    const creditLabel = type === 'received' ? 'este valor recebido' : 'este reembolso';
    for (const payment of payments) {
      const multipleMatches = payments.length > 1;
      const prompt = multipleMatches
        ? `Encontrámos vários pagamentos deste valor. Pretendes associar ${creditLabel} a "${payment.name}" (${formatCurrency(amount)})? Se escolheres Não, verificamos o seguinte.`
        : `Pretendes associar ${creditLabel} ao pagamento "${payment.name}" de ${formatCurrency(amount)}?`;
      if (window.confirm(`${prompt} O pagamento ficará marcado como reembolsado e não será criado um movimento separado.`)) {
        return payment;
      }
      if (!multipleMatches) return null;
    }
    return null;
  }

  elements.deleteExpenseButton.addEventListener('click', () => {
    const month = getMonth();
    const expenseId = elements.expenseId.value;
    const expense = month?.expenses.find(item => item.id === expenseId);
    if (!expense || !window.confirm(`Eliminar a despesa "${expense.name}"? Esta ação não pode ser anulada.`)) return;
    month.expenses = month.expenses.filter(item => item.id !== expenseId);
    saveData();
    elements.expenseDialog.close();
    render();
    triggerFeedback('delete');
  });

  elements.monthForm.addEventListener('submit', event => {
    event.preventDefault();
    const key = elements.monthDate.value;
    const income = Number(elements.monthIncome.value);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key) || !Number.isFinite(income) || income < 0) {
      elements.monthError.textContent = 'Indica um mês e um rendimento válido.';
      elements.monthError.hidden = false;
      triggerFeedback('warning');
      return;
    }
    if (data.months[key]) {
      elements.monthError.textContent = 'Este mês já existe. Seleciona-o para consultar ou alterar o rendimento.';
      elements.monthError.hidden = false;
      triggerFeedback('warning');
      return;
    }
    data.months[key] = { income: Math.round(income * 100) / 100, expenses: [] };
    setSelectedMonth(key);
    saveData();
    elements.monthDialog.close();
    render();
    showView('monthView');
    triggerFeedback('success');
  });

  elements.incomeForm.addEventListener('submit', event => {
    event.preventDefault();
    const income = Number(elements.incomeValue.value);
    if (!Number.isFinite(income) || income < 0) {
      elements.incomeError.textContent = 'Indica um valor igual ou superior a zero.';
      elements.incomeError.hidden = false;
      triggerFeedback('warning');
      return;
    }
    getMonth().income = Math.round(income * 100) / 100;
    saveData();
    elements.incomeDialog.close();
    render();
    triggerFeedback('success');
  });

  document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  }));
  elements.userPill.addEventListener('click', () => {
    elements.profileName.value = data.profile.name || '';
    elements.profileError.hidden = true;
    syncPreferenceControls();
    elements.profileDialog.showModal();
  });

  elements.profileForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = elements.profileName.value.trim();
    if (!name) {
      elements.profileError.textContent = 'Escreve um nome válido.';
      elements.profileError.hidden = false;
      return;
    }
    data.profile.name = name;
    saveData();
    elements.profileDialog.close();
    renderUserName();
    triggerFeedback('success');
  });

  function renderUserName() {
    const name = (data.profile && data.profile.name ? data.profile.name : 'Tu').trim();
    elements.userNameLabel.textContent = name;
    elements.userPill.setAttribute('aria-label', `Editar nome: ${name}`);
  }

  function csvCell(value, protectFormula = false) {
    let text = String(value ?? '');
    if (protectFormula && /^\s*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportSelectedMonthCsv() {
    const month = getMonth();
    if (!month) return;
    const formatCsvAmount = amount => Number(amount).toFixed(2).replace('.', ',');

    const rows = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor (EUR)']];
    if (month.income > 0) rows.push(['', 'Rendimento', 'Rendimento mensal', 'Rendimento', formatCsvAmount(month.income)]);
    data.subscriptions
      .filter(subscription => subscription.startMonth <= selectedMonth && selectedMonth <= subscription.endDate.slice(0, 7))
      .forEach(subscription => rows.push([
        '', 'Subscrição', `Subscrição: ${subscription.name}`, 'Subscrições', formatCsvAmount(-Number(subscription.amount))
      ]));
    month.expenses.forEach(expense => rows.push([
      expense.date,
      expense.reimbursed ? 'Despesa reembolsada' : expense.type === 'refund' ? 'Reembolso' : expense.type === 'received' ? 'Recebido' : 'Despesa',
      expense.reimbursed ? `${expense.name} (reembolsada)` : expense.name,
      expense.category || 'Outros',
      formatCsvAmount(expense.reimbursed ? 0 : expense.type !== 'expense' ? Number(expense.amount) : -Number(expense.amount))
    ]));

    const csv = `\uFEFF${rows.map((row, rowIndex) => row.map((value, columnIndex) =>
      csvCell(value, rowIndex > 0 && columnIndex >= 1 && columnIndex <= 3)
    ).join(';')).join('\r\n')}`;
    const file = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `eco-plus-${selectedMonth}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function makeBackupDocument() {
    return {
      format: 'eco-plus-backup',
      formatVersion: 1,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: { theme: themeMode, themeMode, palette: colorPalette, compactMode, reducedMotion, selectedMonth },
      data: cloneData(data)
    };
  }

  function exportData() {
    const documentData = makeBackupDocument();
    const file = new Blob([JSON.stringify(documentData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `eco-plus-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importData(file) {
    elements.backupError.hidden = true;
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup?.format !== 'eco-plus-backup' || backup.formatVersion !== 1 || !backup.data) {
        throw new Error('Este ficheiro não parece ser uma cópia de segurança Eco+.');
      }
      if (!backup.data.months || typeof backup.data.months !== 'object' || Array.isArray(backup.data.months)) {
        throw new Error('A cópia não contém os meses e dados financeiros esperados.');
      }
      const importedData = normalizeAppData(backup.data);
      if (!window.confirm('Importar esta cópia vai substituir o nome, tema, meses, despesas e subscrições guardados neste dispositivo. Esta ação não pode ser anulada. Continuar?')) return;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(importedData));
      const importedTheme = backup.settings?.themeMode || backup.settings?.theme;
      themeMode = ['system', 'light', 'dark'].includes(importedTheme) ? importedTheme : 'system';
      colorPalette = PALETTES.includes(backup.settings?.palette) ? backup.settings.palette : 'green';
      compactMode = backup.settings?.compactMode === true;
      reducedMotion = backup.settings?.reducedMotion === true;
      setSelectedMonth(/^\d{4}-(0[1-9]|1[0-2])$/.test(backup.settings?.selectedMonth || '')
        ? backup.settings.selectedMonth
        : currentMonthKey());
      savePreferences();
      applyPreferences();
      syncPreferenceControls();
      data = importedData;
      elements.profileDialog.close();
      renderUserName();
      render();
      showView('monthView');
      triggerFeedback('success');
    } catch (error) {
      elements.backupError.textContent = error instanceof SyntaxError
        ? 'O ficheiro não contém JSON válido.'
        : error.message || 'Não foi possível importar este ficheiro.';
      elements.backupError.hidden = false;
      triggerFeedback('warning');
    } finally {
      elements.importDataFile.value = '';
    }
  }

  elements.exportDataButton.addEventListener('click', exportData);
  elements.exportMonthCsvButton.addEventListener('click', exportSelectedMonthCsv);
  elements.importDataButton.addEventListener('click', () => elements.importDataFile.click());
  elements.importDataFile.addEventListener('change', event => importData(event.target.files[0]));

  elements.themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme !== 'dark';
    themeMode = isDark ? 'dark' : 'light';
    savePreferences();
    applyPreferences();
    triggerFeedback('success');
  });

  elements.themeModeSelect.addEventListener('change', () => {
    themeMode = elements.themeModeSelect.value;
    savePreferences();
    applyPreferences();
  });
  elements.colorPaletteSelect.addEventListener('change', () => {
    colorPalette = elements.colorPaletteSelect.value;
    savePreferences();
    applyPreferences();
  });
  elements.compactModeToggle.addEventListener('change', () => {
    compactMode = elements.compactModeToggle.checked;
    savePreferences();
    applyPreferences();
  });
  elements.reducedMotionToggle.addEventListener('change', () => {
    reducedMotion = elements.reducedMotionToggle.checked;
    savePreferences();
    applyPreferences();
  });
  const colorSchemePreference = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = () => {
    if (themeMode === 'system') applyPreferences();
  };
  if (colorSchemePreference.addEventListener) colorSchemePreference.addEventListener('change', handleSystemThemeChange);
  else colorSchemePreference.addListener(handleSystemThemeChange);

  applyPreferences();
  elements.expenseCategory.innerHTML = CATEGORIES.map(([category, emoji]) => `<option value="${escapeHTML(category)}">${emoji} ${escapeHTML(category)}</option>`).join('');
  elements.expenseCategoryFilter.innerHTML += CATEGORIES.map(([category, emoji]) => `<option value="${escapeHTML(category)}">${emoji} ${escapeHTML(category)}</option>`).join('');
  document.getElementById('appVersion').textContent = `Eco+ v${APP_VERSION}`;
  renderUserName();
  render();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    const updateReloadKey = 'eco-plus-sw-update-reload';
    try { sessionStorage.removeItem(updateReloadKey); } catch {}
    const hadController = Boolean(navigator.serviceWorker.controller);
    let updateReloadScheduled = false;
    if (hadController) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (updateReloadScheduled) return;
        updateReloadScheduled = true;
        try {
          if (sessionStorage.getItem(updateReloadKey)) return;
          sessionStorage.setItem(updateReloadKey, '1');
        } catch {}
        window.location.reload();
      });
    }
    window.addEventListener('load', () => {
      const appBase = new URL('./', window.location.href);
      navigator.serviceWorker.register(new URL('service-worker.js', appBase), {
        scope: appBase.pathname,
        updateViaCache: 'none'
      }).then(registration => registration.update()).catch(() => {});
    });
  }
})();