(() => {
  'use strict';

  const STORAGE_KEY = 'eco-plus-v1';
  const LEGACY_STORAGE_KEY = 'meu-dinheiro-v1';
  const THEME_KEY = 'eco-plus-theme';
  const APP_VERSION = '1.2.1';
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
    'monthView', 'historyView', 'monthHeading', 'monthPicker', 'balanceAmount', 'negativeNote',
    'spentPercent', 'progressTrack', 'progressFill', 'incomeAmount', 'spentAmount', 'editIncomeButton',
    'awardStrip', 'expenseList', 'historyList', 'historyEmpty', 'expenseDialog', 'expenseForm', 'expenseId',
    'expenseAmount', 'expenseName', 'expenseCategory', 'expenseDate', 'expenseDialogTitle',
    'expenseMonthLabel', 'expenseError', 'deleteExpenseButton', 'monthDialog', 'monthForm',
    'monthDate', 'monthIncome', 'monthError', 'incomeDialog', 'incomeForm', 'incomeValue',
    'incomeMonthLabel', 'incomeError', 'themeToggle', 'userPill', 'userNameLabel', 'profileDialog',
    'profileForm', 'profileName', 'profileError', 'expenseType', 'subscriptionList', 'subscriptionDialog',
    'subscriptionForm', 'subscriptionDialogTitle', 'subscriptionId', 'subscriptionName', 'subscriptionAmount', 'subscriptionStartMonth',
    'subscriptionEndDate', 'subscriptionError', 'deleteSubscriptionButton', 'exportDataButton', 'importDataButton',
    'importDataFile', 'backupError'
  ].map(id => [id, document.getElementById(id)]));

  let data = loadData();
  let selectedMonth = currentMonthKey();
  let activeView = 'monthView';
  let audioContext = null;

  function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
    const entryType = expense.type === 'refund' ? 'refund' : 'expense';
    return { ...expense, type: entryType, amount: Number(expense.amount) };
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
    const spent = month.expenses.reduce((sum, expense) => sum + (expense.type === 'expense' ? Number(expense.amount) : 0), 0);
    const refunds = month.expenses.reduce((sum, expense) => sum + (expense.type === 'refund' ? Number(expense.amount) : 0), 0);
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
    elements.awardStrip.innerHTML = getAwards(month).map(award => `<span class="award-pill award-pill--${balance < 0 ? 'warning' : 'success'}"><span>${award.icon}</span>${award.label}</span>`).join('');
    if (refunds > 0) {
      elements.awardStrip.innerHTML += `<span class="award-pill award-pill--muted"><span>↩️</span>Reembolsos ${formatCurrency(refunds)}</span>`;
    }
    if (subscriptions > 0) {
      elements.awardStrip.innerHTML += `<span class="award-pill award-pill--muted"><span>📱</span>Subscrições ${formatCurrency(subscriptions)}</span>`;
    }
    pulseElement('.balance-amount');
    pulseElement('.summary-item strong');

    if (!month.expenses.length) {
      elements.expenseList.innerHTML = '<div class="empty-state"><span class="empty-icon" aria-hidden="true">↘</span><h2>Sem despesas ainda</h2><p>Adiciona a primeira despesa para veres o teu saldo atualizado.</p></div>';
      return;
    }

    const categoryIcons = Object.fromEntries(CATEGORIES);
    const sorted = [...month.expenses].sort((a, b) => b.date.localeCompare(a.date));
    elements.expenseList.innerHTML = sorted.map((expense, index) => {
      const date = new Date(`${expense.date}T12:00:00`);
      const isRefund = expense.type === 'refund';
      const sign = isRefund ? '+' : '−';
      const valueClass = isRefund ? 'expense-value expense-value--refund' : 'expense-value';
      const metaLabel = isRefund ? 'Reembolso' : expense.category;
      return `<button class="expense-row" type="button" data-expense-id="${escapeHTML(expense.id)}" style="animation-delay:${Math.min(index, 7) * 35}ms">
        <span class="category-icon" aria-hidden="true">${isRefund ? '↩️' : (categoryIcons[expense.category] || '✳️')}</span>
        <span class="expense-main"><span class="expense-name">${escapeHTML(expense.name)}</span><span class="expense-meta">${escapeHTML(metaLabel)} · ${dateFormatter.format(date)}</span></span>
        <span class="${valueClass}">${sign}${formatCurrency(Number(expense.amount))}</span>
      </button>`;
    }).join('');
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
    elements.monthPicker.innerHTML = keys.map(key => {
      const [year, month] = key.split('-').map(Number);
      const label = monthPickerFormatter.format(new Date(year, month - 1, 1));
      return `<option value="${key}"${key === selectedMonth ? ' selected' : ''}>${escapeHTML(label)}</option>`;
    }).join('');
  }

  function showView(viewId) {
    activeView = viewId;
    elements.monthView.hidden = viewId !== 'monthView';
    elements.historyView.hidden = viewId !== 'historyView';
    document.querySelectorAll('.view-tab').forEach(tab => {
      const selected = tab.dataset.view === viewId;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-current', selected ? 'page' : 'false');
    });
    document.getElementById('addExpenseButton').hidden = viewId !== 'monthView';
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
    elements.expenseType.value = expense?.type === 'refund' ? 'refund' : 'expense';
    elements.expenseDialogTitle.textContent = expense ? 'Editar movimento' : 'Novo movimento';
    elements.expenseMonthLabel.textContent = formatMonth(selectedMonth);
    elements.expenseForm.querySelector('.submit-button').textContent = expense ? 'Guardar alterações' : 'Adicionar despesa';
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
    selectedMonth = event.target.value;
    render();
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

  elements.expenseList.addEventListener('click', event => {
    if (event.target.closest('[data-action="create-month"]')) return openMonthDialog();
    const row = event.target.closest('[data-expense-id]');
    if (!row) return;
    const expense = getMonth()?.expenses.find(item => item.id === row.dataset.expenseId);
    if (expense) openExpenseDialog(expense);
  });

  elements.historyList.addEventListener('click', event => {
    const row = event.target.closest('[data-month-key]');
    if (!row) return;
    selectedMonth = row.dataset.monthKey;
    render();
    showView('monthView');
  });

  elements.expenseForm.addEventListener('submit', event => {
    event.preventDefault();
    const amount = Number(elements.expenseAmount.value);
    const name = elements.expenseName.value.trim();
    const date = elements.expenseDate.value;
    const type = elements.expenseType.value === 'refund' ? 'refund' : 'expense';
    if (!Number.isFinite(amount) || amount <= 0 || !name || !date || date.slice(0, 7) !== selectedMonth) {
      elements.expenseError.textContent = date && date.slice(0, 7) !== selectedMonth ? 'A data do movimento tem de pertencer ao mês selecionado.' : 'Confirma o valor, a descrição e a data.';
      elements.expenseError.hidden = false;
      triggerFeedback('warning');
      return;
    }
    const month = getMonth();
    const expense = { id: elements.expenseId.value || createId(), name, amount: Math.round(amount * 100) / 100, category: elements.expenseCategory.value, date, type };
    const existingIndex = month.expenses.findIndex(item => item.id === expense.id);
    if (existingIndex >= 0) month.expenses[existingIndex] = expense;
    else month.expenses.push(expense);
    saveData();
    elements.expenseDialog.close();
    render();
    triggerFeedback('success');
  });

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
    selectedMonth = key;
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

  function makeBackupDocument() {
    return {
      format: 'eco-plus-backup',
      formatVersion: 1,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: { theme: localStorage.getItem(THEME_KEY) || 'system', selectedMonth },
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
      const importedTheme = ['dark', 'light'].includes(backup.settings?.theme) ? backup.settings.theme : 'system';
      if (importedTheme === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, importedTheme);
      const isDark = importedTheme === 'dark' || (importedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
      elements.themeToggle.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
      selectedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(backup.settings?.selectedMonth || '')
        ? backup.settings.selectedMonth
        : currentMonthKey();
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
  elements.importDataButton.addEventListener('click', () => elements.importDataFile.click());
  elements.importDataFile.addEventListener('change', event => importData(event.target.files[0]));

  elements.themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    elements.themeToggle.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
    triggerFeedback('success');
  });

  const savedTheme = localStorage.getItem(THEME_KEY) || localStorage.getItem('meu-dinheiro-theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.dataset.theme = 'dark';
    elements.themeToggle.setAttribute('aria-label', 'Ativar modo claro');
  }
  elements.expenseCategory.innerHTML = CATEGORIES.map(([category, emoji]) => `<option value="${escapeHTML(category)}">${emoji} ${escapeHTML(category)}</option>`).join('');
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