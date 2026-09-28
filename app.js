(() => {
  'use strict';

  const STORAGE_KEY = 'meu-dinheiro-v1';
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
    'expenseList', 'historyList', 'historyEmpty', 'expenseDialog', 'expenseForm', 'expenseId',
    'expenseAmount', 'expenseName', 'expenseCategory', 'expenseDate', 'expenseDialogTitle',
    'expenseMonthLabel', 'expenseError', 'deleteExpenseButton', 'monthDialog', 'monthForm',
    'monthDate', 'monthIncome', 'monthError', 'incomeDialog', 'incomeForm', 'incomeValue',
    'incomeMonthLabel', 'incomeError', 'themeToggle'
  ].map(id => [id, document.getElementById(id)]));

  let data = loadData();
  let selectedMonth = currentMonthKey();
  let activeView = 'monthView';

  function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function loadData() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"months":{}}');
      if (!parsed || typeof parsed.months !== 'object' || Array.isArray(parsed.months)) return { months: {} };
      for (const [key, month] of Object.entries(parsed.months)) {
        if (!/^\d{4}-\d{2}$/.test(key) || !month || !Number.isFinite(Number(month.income))) {
          delete parsed.months[key];
          continue;
        }
        month.income = Math.max(0, Number(month.income));
        month.expenses = Array.isArray(month.expenses) ? month.expenses.filter(isValidExpense) : [];
      }
      return parsed;
    } catch {
      return { months: {} };
    }
  }

  function isValidExpense(expense) {
    return expense && typeof expense.id === 'string' && typeof expense.name === 'string' &&
      Number.isFinite(Number(expense.amount)) && Number(expense.amount) > 0 &&
      typeof expense.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expense.date);
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

  function monthTotals(month) {
    const spent = month.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    return { spent, balance: Number(month.income) - spent };
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

  function render() {
    renderMonth();
    renderHistory();
    renderMonthPicker();
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
      elements.expenseList.innerHTML = `<div class="empty-state"><span class="empty-icon" aria-hidden="true">€</span><h2>Sem mês registado</h2><p>Cria este mês e define quanto recebeste para começares.</p><button class="text-action" type="button" data-action="create-month">Criar mês</button></div>`;
      return;
    }

    const { spent, balance } = monthTotals(month);
    const percentage = month.income > 0 ? spent / month.income * 100 : (spent > 0 ? 100 : 0);
    const displayPercent = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(percentage);
    elements.balanceAmount.textContent = formatCurrency(balance);
    elements.incomeAmount.textContent = formatCurrency(month.income);
    elements.spentAmount.textContent = formatCurrency(spent);
    elements.spentPercent.textContent = `${displayPercent}%`;
    elements.progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    elements.progressTrack.setAttribute('aria-valuenow', String(Math.min(100, Math.max(0, percentage))));
    elements.negativeNote.hidden = balance >= 0;
    elements.editIncomeButton.hidden = false;

    if (!month.expenses.length) {
      elements.expenseList.innerHTML = '<div class="empty-state"><span class="empty-icon" aria-hidden="true">↘</span><h2>Sem despesas ainda</h2><p>Adiciona a primeira despesa para veres o teu saldo atualizado.</p></div>';
      return;
    }

    const categoryIcons = Object.fromEntries(CATEGORIES);
    const sorted = [...month.expenses].sort((a, b) => b.date.localeCompare(a.date));
    elements.expenseList.innerHTML = sorted.map((expense, index) => {
      const date = new Date(`${expense.date}T12:00:00`);
      return `<button class="expense-row" type="button" data-expense-id="${escapeHTML(expense.id)}" style="animation-delay:${Math.min(index, 7) * 35}ms">
        <span class="category-icon" aria-hidden="true">${categoryIcons[expense.category] || '✳️'}</span>
        <span class="expense-main"><span class="expense-name">${escapeHTML(expense.name)}</span><span class="expense-meta">${escapeHTML(expense.category)} · ${dateFormatter.format(date)}</span></span>
        <span class="expense-value">−${formatCurrency(Number(expense.amount))}</span>
      </button>`;
    }).join('');
  }

  function renderHistory() {
    const keys = Object.keys(data.months).sort((a, b) => b.localeCompare(a));
    elements.historyEmpty.hidden = keys.length > 0;
    elements.historyList.hidden = keys.length === 0;
    elements.historyList.innerHTML = keys.map((key, index) => {
      const month = data.months[key];
      const { spent, balance } = monthTotals(month);
      return `<button class="history-row" type="button" data-month-key="${key}" style="animation-delay:${Math.min(index, 7) * 40}ms">
        <span class="history-month">${escapeHTML(formatMonth(key))}</span>
        <span class="history-balance${balance < 0 ? ' is-negative' : ''}">${formatCurrency(balance)}</span>
        <span class="history-stats"><span>Recebido: <strong>${formatCurrency(month.income)}</strong></span><span>Gasto: <strong>${formatCurrency(spent)}</strong></span><span>Restante: <strong>${formatCurrency(balance)}</strong></span></span>
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
    elements.expenseDialogTitle.textContent = expense ? 'Editar despesa' : 'Nova despesa';
    elements.expenseMonthLabel.textContent = formatMonth(selectedMonth);
    elements.expenseForm.querySelector('.submit-button').textContent = expense ? 'Guardar alterações' : 'Adicionar despesa';
    elements.deleteExpenseButton.hidden = !expense;
    elements.expenseDialog.showModal();
    requestAnimationFrame(() => elements.expenseAmount.focus({ preventScroll: true }));
  }

  function createId() {
    return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  document.querySelectorAll('.view-tab').forEach(tab => tab.addEventListener('click', () => showView(tab.dataset.view)));
  document.getElementById('newMonthButton').addEventListener('click', openMonthDialog);
  document.getElementById('historyNewMonthButton').addEventListener('click', openMonthDialog);
  document.getElementById('firstMonthButton').addEventListener('click', openMonthDialog);
  document.getElementById('addExpenseButton').addEventListener('click', () => openExpenseDialog());
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
    if (!Number.isFinite(amount) || amount <= 0 || !name || !date || date.slice(0, 7) !== selectedMonth) {
      elements.expenseError.textContent = date && date.slice(0, 7) !== selectedMonth ? 'A data da despesa tem de pertencer ao mês selecionado.' : 'Confirma o valor, a descrição e a data.';
      elements.expenseError.hidden = false;
      return;
    }
    const month = getMonth();
    const expense = { id: elements.expenseId.value || createId(), name, amount: Math.round(amount * 100) / 100, category: elements.expenseCategory.value, date };
    const existingIndex = month.expenses.findIndex(item => item.id === expense.id);
    if (existingIndex >= 0) month.expenses[existingIndex] = expense;
    else month.expenses.push(expense);
    saveData();
    elements.expenseDialog.close();
    render();
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
  });

  elements.monthForm.addEventListener('submit', event => {
    event.preventDefault();
    const key = elements.monthDate.value;
    const income = Number(elements.monthIncome.value);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key) || !Number.isFinite(income) || income < 0) {
      elements.monthError.textContent = 'Indica um mês e um rendimento válido.';
      elements.monthError.hidden = false;
      return;
    }
    if (data.months[key]) {
      elements.monthError.textContent = 'Este mês já existe. Seleciona-o para consultar ou alterar o rendimento.';
      elements.monthError.hidden = false;
      return;
    }
    data.months[key] = { income: Math.round(income * 100) / 100, expenses: [] };
    selectedMonth = key;
    saveData();
    elements.monthDialog.close();
    render();
    showView('monthView');
  });

  elements.incomeForm.addEventListener('submit', event => {
    event.preventDefault();
    const income = Number(elements.incomeValue.value);
    if (!Number.isFinite(income) || income < 0) {
      elements.incomeError.textContent = 'Indica um valor igual ou superior a zero.';
      elements.incomeError.hidden = false;
      return;
    }
    getMonth().income = Math.round(income * 100) / 100;
    saveData();
    elements.incomeDialog.close();
    render();
  });

  document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  }));

  elements.themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('meu-dinheiro-theme', isDark ? 'dark' : 'light');
    elements.themeToggle.setAttribute('aria-label', isDark ? 'Ativar modo claro' : 'Ativar modo escuro');
  });

  const savedTheme = localStorage.getItem('meu-dinheiro-theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.dataset.theme = 'dark';
    elements.themeToggle.setAttribute('aria-label', 'Ativar modo claro');
  }
  elements.expenseCategory.innerHTML = CATEGORIES.map(([category, emoji]) => `<option value="${escapeHTML(category)}">${emoji} ${escapeHTML(category)}</option>`).join('');
  render();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));
  }
})();