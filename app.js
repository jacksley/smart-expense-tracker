/* =====================================================
   SMART EXPENSE TRACKER — app.js
   Features: CRUD, Local Storage, Chart.js, Budgets,
             Dark/Light theme, PDF export, Insights
   ===================================================== */

'use strict';

/* ── Category emoji map ── */
const CAT_EMOJI = {
  Food: '🍜', Transport: '🚌', Shopping: '🛍', Bills: '🏠',
  Health: '💊', Entertainment: '🎬', Education: '📚',
  Salary: '💼', Freelance: '💻', Investment: '📈', Other: '📦'
};

/* ── State ── */
let transactions = [];  // { id, type, description, amount, category, date, note }
let budgets      = {};  // { category: amount }
let currentType  = 'expense';
let expenseChart = null;

/* ── DOM References ── */
const $ = id => document.getElementById(id);

/* =====================================================
   LOCAL STORAGE
   ===================================================== */
function loadFromStorage() {
  try {
    transactions = JSON.parse(localStorage.getItem('expensa_txs'))     || [];
    budgets      = JSON.parse(localStorage.getItem('expensa_budgets')) || {};
    const theme  = localStorage.getItem('expensa_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
  } catch(e) {
    transactions = [];
    budgets = {};
  }
}

function saveTransactions() {
  localStorage.setItem('expensa_txs', JSON.stringify(transactions));
}

function saveBudgets() {
  localStorage.setItem('expensa_budgets', JSON.stringify(budgets));
}

/* =====================================================
   THEME
   ===================================================== */
function toggleTheme() {
  const html  = document.documentElement;
  const theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', theme);
  localStorage.setItem('expensa_theme', theme);
  updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
  const icon = theme === 'dark' ? '☀' : '☾';
  $('themeToggle').querySelector('.theme-icon').textContent = icon;
  $('themeToggleMobile').textContent = icon;
}

/* =====================================================
   NAVIGATION
   ===================================================== */
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const targetView = $('view-' + viewId);
  if (targetView) targetView.classList.add('active');

  const targetBtn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
  if (targetBtn) targetBtn.classList.add('active');

  // Refresh relevant view
  if (viewId === 'dashboard')    renderDashboard();
  if (viewId === 'transactions') renderFullList();
  if (viewId === 'budget')       renderBudgets();
  if (viewId === 'insights')     renderInsights();
}

/* =====================================================
   MODAL
   ===================================================== */
function openModal() {
  $('modalOverlay').classList.add('open');
  $('txDate').valueAsDate = new Date();
  $('txDescription').focus();
}
function closeModal() {
  $('modalOverlay').classList.remove('open');
  resetForm();
}

function resetForm() {
  $('txDescription').value = '';
  $('txAmount').value      = '';
  $('txCategory').value    = '';
  $('txNote').value        = '';
  $('formError').textContent = '';
}

function setType(type) {
  currentType = type;
  document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.type-tab[data-type="${type}"]`).classList.add('active');
}

/* =====================================================
   ADD TRANSACTION
   ===================================================== */
function addTransaction() {
  const desc     = $('txDescription').value.trim();
  const amount   = parseFloat($('txAmount').value);
  const category = $('txCategory').value;
  const date     = $('txDate').value;
  const note     = $('txNote').value.trim();

  // Validation
  if (!desc)            return showFormError('Please enter a description.');
  if (!amount || amount <= 0) return showFormError('Please enter a valid amount.');
  if (!category)        return showFormError('Please select a category.');
  if (!date)            return showFormError('Please select a date.');

  const tx = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    type: currentType,
    description: desc,
    amount,
    category,
    date,
    note
  };

  transactions.unshift(tx);
  saveTransactions();
  closeModal();
  refreshAll();
  checkBudgetWarnings();
}

function showFormError(msg) {
  $('formError').textContent = msg;
}

/* =====================================================
   DELETE TRANSACTION
   ===================================================== */
function deleteTransaction(id) {
  transactions = transactions.filter(tx => tx.id !== id);
  saveTransactions();
  refreshAll();
  showToast('Transaction deleted!');
}

/* =====================================================
   CALCULATIONS
   ===================================================== */
function getMonthlyTransactions() {
  const now = new Date();
  const yr  = now.getFullYear();
  const mo  = now.getMonth();
  return transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getFullYear() === yr && d.getMonth() === mo;
  });
}

function calcTotals(txList) {
  let income = 0, expense = 0;
  txList.forEach(tx => {
    if (tx.type === 'income')  income  += tx.amount;
    else                        expense += tx.amount;
  });
  return { income, expense, balance: income - expense };
}

function fmt(amount) {
  return '₹' + Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* =====================================================
   DASHBOARD
   ===================================================== */
function renderDashboard() {
  const monthly = getMonthlyTransactions();
  const { income, expense, balance } = calcTotals(monthly);
  const savings = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;

  // Month label
  const now = new Date();
  $('currentMonthLabel').textContent =
    now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Cards
  const balEl = $('totalBalance');
  balEl.textContent = fmt(balance);
  balEl.style.color = balance >= 0 ? 'var(--blue)' : 'var(--expense)';

  $('totalIncome').textContent   = fmt(income);
  $('totalExpenses').textContent = fmt(expense);
  $('savingsRate').textContent   = savings + '%';

  // Balance trend
  const trendEl = $('balanceTrend');
  trendEl.textContent = balance >= 0 ? '↑ Positive cashflow' : '↓ Negative cashflow';
  trendEl.style.color = balance >= 0 ? 'var(--income)' : 'var(--expense)';

  // Recent (last 5)
  renderTxList($('recentList'), monthly.slice(0, 5), true);

  // Pie chart
  renderChart(monthly.filter(t => t.type === 'expense'));
}

/* =====================================================
   PIE CHART
   ===================================================== */
const CHART_COLORS = [
  '#f5a623','#f05d7a','#3dd68c','#5b8af0',
  '#b07fef','#ff7c5c','#4ecdc4','#ffd166','#06d6a0'
];

function renderChart(expenses) {
  const canvas = $('expenseChart');
  const emptyEl = $('chartEmpty');

  // Group by category
  const groups = {};
  expenses.forEach(tx => {
    groups[tx.category] = (groups[tx.category] || 0) + tx.amount;
  });

  const labels = Object.keys(groups);
  const data   = Object.values(groups);

  if (data.length === 0) {
    canvas.style.opacity = '0';
    emptyEl.classList.add('visible');
  } else {
    canvas.style.opacity = '1';
    emptyEl.classList.remove('visible');
  }

  if (expenseChart) expenseChart.destroy();

  expenseChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS,
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: getComputedStyle(document.documentElement)
                     .getPropertyValue('--text2').trim() || '#8b8fa8',
            font: { family: 'DM Sans', size: 12 },
            boxWidth: 12,
            padding: 14
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ₹${ctx.parsed.toLocaleString('en-IN')}`
          }
        }
      }
    }
  });
}

/* =====================================================
   TRANSACTION ITEM HTML
   ===================================================== */
function createTxItem(tx, isCompact = false) {
  const li = document.createElement('li');
  li.className = 'tx-item';
  li.dataset.id = tx.id;

  const sign  = tx.type === 'income' ? '+' : '-';
  const emoji = CAT_EMOJI[tx.category] || '📦';

  li.innerHTML = `
    <div class="tx-icon ${tx.type}">${emoji}</div>
    <div class="tx-info">
      <div class="tx-desc">${escHtml(tx.description)}</div>
      <div class="tx-meta">${tx.category} · ${fmtDate(tx.date)}${tx.note ? ' · ' + escHtml(tx.note) : ''}</div>
    </div>
    <div class="tx-amount ${tx.type}">${sign}${fmt(tx.amount)}</div>
    <button class="tx-delete" data-id="${tx.id}" title="Delete">✕</button>
  `;

  li.querySelector('.tx-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTransaction(tx.id);
  });

  return li;
}

function renderTxList(container, txList, compact = false) {
  container.innerHTML = '';
  if (!txList.length) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'No transactions found.';
    container.appendChild(li);
    return;
  }
  txList.forEach(tx => container.appendChild(createTxItem(tx, compact)));
}

/* =====================================================
   FULL TRANSACTIONS LIST (with filters)
   ===================================================== */
function renderFullList() {
  const search  = $('searchInput').value.toLowerCase();
  const catF    = $('filterCategory').value;
  const typeF   = $('filterType').value;

  let filtered = transactions.filter(tx => {
    const matchSearch = tx.description.toLowerCase().includes(search) ||
                        tx.category.toLowerCase().includes(search) ||
                        (tx.note || '').toLowerCase().includes(search);
    const matchCat  = catF  === 'all' || tx.category === catF;
    const matchType = typeF === 'all' || tx.type     === typeF;
    return matchSearch && matchCat && matchType;
  });

  renderTxList($('fullList'), filtered);
}

/* =====================================================
   BUDGETS
   ===================================================== */
function setBudget() {
  const cat    = $('budgetCategory').value;
  const amount = parseFloat($('budgetAmount').value);
  if (!cat || !amount || amount <= 0) return;

  budgets[cat] = amount;
  saveBudgets();
  $('budgetAmount').value = '';
  renderBudgets();
}

function renderBudgets() {
  const container = $('budgetProgressList');
  const monthly   = getMonthlyTransactions().filter(t => t.type === 'expense');

  if (!Object.keys(budgets).length) {
    container.innerHTML = '<p class="empty-state">No budgets set yet.</p>';
    return;
  }

  container.innerHTML = '';

  Object.entries(budgets).forEach(([cat, limit]) => {
    const spent = monthly
      .filter(tx => tx.category === cat)
      .reduce((s, tx) => s + tx.amount, 0);

    const pct     = Math.min((spent / limit) * 100, 100).toFixed(1);
    const isWarn  = spent / limit >= 0.75 && spent / limit < 1;
    const isDanger = spent >= limit;
    const fillClass = isDanger ? 'danger' : isWarn ? 'warn' : '';

    const div = document.createElement('div');
    div.className = 'budget-item';
    div.innerHTML = `
      <div class="budget-item-header">
        <span class="budget-cat-name">${CAT_EMOJI[cat] || ''} ${cat}</span>
        <span class="budget-amounts">${fmt(spent)} / ${fmt(limit)}</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill ${fillClass}" style="width: ${pct}%"></div>
      </div>
      <div class="budget-warning ${isDanger ? 'visible' : ''}">
        ⚠ Budget exceeded by ${fmt(spent - limit)}!
      </div>
    `;
    container.appendChild(div);
  });
}

function checkBudgetWarnings() {
  const monthly = getMonthlyTransactions().filter(t => t.type === 'expense');

  Object.entries(budgets).forEach(([cat, limit]) => {
    const spent = monthly
      .filter(tx => tx.category === cat)
      .reduce((s, tx) => s + tx.amount, 0);

    if (spent >= limit) {
      showToast(`⚠ ${cat} budget exceeded!`);
    } else if (spent / limit >= 0.9) {
      showToast(`⚠ ${cat} at 90% of budget`);
    }
  });
}

/* =====================================================
   INSIGHTS
   ===================================================== */
function renderInsights() {
  const monthly   = getMonthlyTransactions();
  const expenses  = monthly.filter(t => t.type === 'expense');
  const { income, expense } = calcTotals(monthly);

  // Top category
  const groups = {};
  expenses.forEach(tx => { groups[tx.category] = (groups[tx.category] || 0) + tx.amount; });
  const topCat = Object.entries(groups).sort((a,b) => b[1]-a[1])[0];
  $('topCategoryVal').textContent = topCat
    ? `${CAT_EMOJI[topCat[0]] || ''} ${topCat[0]}`
    : '—';

  // Avg daily spend (days elapsed in month)
  const today    = new Date();
  const daysGone = today.getDate();
  $('avgDailyVal').textContent = daysGone ? fmt(expense / daysGone) : '₹0';

  // Largest single transaction
  const largest = expenses.reduce((max, tx) => tx.amount > max ? tx.amount : max, 0);
  $('largestVal').textContent = fmt(largest);

  // Count
  $('txCountVal').textContent = transactions.length;

  // Smart tips
  generateTips(income, expense, groups, topCat);
}

function generateTips(income, expense, groups, topCat) {
  const tips = [];
  const ratio = income > 0 ? expense / income : 0;

  if (ratio > 0.9)    tips.push('Your expenses are nearly equal to income. Try cutting non-essential spending by 10% this week.');
  if (ratio > 0.5)    tips.push(`You've spent ${(ratio*100).toFixed(0)}% of your income. Aim to keep expenses below 50% for healthy savings.`);
  if (ratio < 0.3)    tips.push('Great job! You\'re spending well under your income. Consider investing the surplus.');

  if (topCat && topCat[1] > income * 0.3) {
    tips.push(`${topCat[0]} is your biggest expense at ${fmt(topCat[1])}. Look for ways to reduce this category.`);
  }
  if (groups['Entertainment'] && groups['Entertainment'] > income * 0.1) {
    tips.push('Entertainment costs are above 10% of income. Set a monthly cap to stay on track.');
  }
  if (!income) {
    tips.push('Add an income transaction to unlock personalised savings insights.');
  }
  if (expense === 0) {
    tips.push('No expenses recorded this month — start tracking to see insights!');
  }
  if (Object.keys(budgets).length === 0) {
    tips.push('Set category budgets in the Budget tab to get spending warnings.');
  }

  const container = $('smartTips');
  container.innerHTML = '';
  (tips.length ? tips : ['Keep tracking your transactions for personalised insights.']).forEach(tip => {
    const p = document.createElement('p');
    p.className = 'tip-item';
    p.textContent = tip;
    container.appendChild(p);
  });
}

/* =====================================================
   PDF EXPORT
   ===================================================== */
function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const { income, expense, balance } = calcTotals(transactions);
  const now = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' });

  // Header
  doc.setFillColor(245, 166, 35);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(14, 15, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Expensa — Transaction Report', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 80);
  doc.text(`Generated: ${now}`, 14, 35);

  // Summary
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 50);
  doc.text('Summary', 14, 46);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Total Income:   ${fmt(income)}`,  14, 54);
  doc.text(`Total Expenses: ${fmt(expense)}`, 14, 61);
  doc.text(`Net Balance:    ${fmt(balance)}`, 14, 68);

  // Transactions table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('All Transactions', 14, 80);

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 100);
  const headers = ['Date', 'Description', 'Category', 'Type', 'Amount'];
  const colX    = [14, 40, 100, 135, 165];
  headers.forEach((h, i) => doc.text(h, colX[i], 88));

  // Line under header
  doc.setDrawColor(200, 200, 220);
  doc.line(14, 90, 196, 90);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 50);

  let y = 96;
  transactions.forEach((tx, idx) => {
    if (y > 270) { doc.addPage(); y = 20; }
    if (idx % 2 === 0) {
      doc.setFillColor(245, 246, 252);
      doc.rect(13, y - 4, 183, 7, 'F');
    }
    doc.setTextColor(tx.type === 'income' ? 30 : 200, tx.type === 'income' ? 150 : 40, 80);
    doc.text(fmtDate(tx.date),                       colX[0], y, { maxWidth: 24 });
    doc.setTextColor(30, 30, 50);
    doc.text(tx.description,                          colX[1], y, { maxWidth: 58 });
    doc.text(tx.category,                             colX[2], y, { maxWidth: 33 });
    doc.text(tx.type.charAt(0).toUpperCase() + tx.type.slice(1), colX[3], y, { maxWidth: 28 });
    doc.setTextColor(tx.type === 'income' ? 30 : 200, tx.type === 'income' ? 150 : 40, 80);
    doc.text(fmt(tx.amount),                          colX[4], y, { maxWidth: 28 });
    y += 8;
  });

  doc.save('Expensa_Report.pdf');
  showToast('PDF exported successfully!');
}

/* =====================================================
   TOAST
   ===================================================== */
function showToast(msg, duration = 2800) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

/* =====================================================
   HELPERS
   ===================================================== */
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function refreshAll() {
  const activeView = document.querySelector('.view.active');
  if (!activeView) return;
  const viewId = activeView.id.replace('view-', '');
  switchView(viewId);
}

/* =====================================================
   EVENT LISTENERS
   ===================================================== */
function initEvents() {
  /* Sidebar navigation */
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
      closeMobileSidebar();
    });
  });

  /* "See all" link on dashboard */
  document.querySelectorAll('.see-all-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  /* Theme toggles */
  $('themeToggle').addEventListener('click', toggleTheme);
  $('themeToggleMobile').addEventListener('click', toggleTheme);

  /* Modal open */
  $('openModal').addEventListener('click', openModal);
  $('openModal2').addEventListener('click', openModal);

  /* Modal close */
  $('closeModal').addEventListener('click', closeModal);
  $('modalOverlay').addEventListener('click', e => { if (e.target === $('modalOverlay')) closeModal(); });

  /* Type tabs */
  document.querySelectorAll('.type-tab').forEach(tab => {
    tab.addEventListener('click', () => setType(tab.dataset.type));
  });

  /* Add transaction */
  $('submitTx').addEventListener('click', addTransaction);

  /* Enter key in modal */
  $('modal').addEventListener('keydown', e => { if (e.key === 'Enter') addTransaction(); });

  /* Filters */
  $('searchInput').addEventListener('input', renderFullList);
  $('filterCategory').addEventListener('change', renderFullList);
  $('filterType').addEventListener('change', renderFullList);

  /* Budget */
  $('setBudgetBtn').addEventListener('click', setBudget);

  /* Export PDF */
  $('exportPDF').addEventListener('click', exportPDF);

  /* Mobile hamburger */
  $('hamburger').addEventListener('click', openMobileSidebar);

  /* Sidebar backdrop click */
  document.querySelector('.sidebar-backdrop') &&
    document.querySelector('.sidebar-backdrop').addEventListener('click', closeMobileSidebar);
}

/* Mobile sidebar */
function openMobileSidebar() {
  $('sidebar').classList.add('open');
  let backdrop = document.querySelector('.sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop visible';
    backdrop.addEventListener('click', closeMobileSidebar);
    document.body.appendChild(backdrop);
  } else {
    backdrop.classList.add('visible');
  }
}

function closeMobileSidebar() {
  $('sidebar').classList.remove('open');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (backdrop) backdrop.classList.remove('visible');
}

/* =====================================================
   INIT
   ===================================================== */
function init() {
  loadFromStorage();
  initEvents();
  switchView('dashboard');
}

document.addEventListener('DOMContentLoaded', init);