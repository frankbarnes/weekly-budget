// app.js — full working version with weekly, monthly, yearly, cash, filters, delete, CSV

const STORAGE_KEY = 'weekly-budget-state';

let state = {
  weeklyBudget: 0,
  transactions: []
};

let currentWeek = new Date();

// ---- Persistence ----
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.transactions)) {
        state = parsed;
      }
    }
  } catch (e) {}
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
}

// ---- Week helpers (Friday → Thursday) ----
function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun ... 5=Fri
  let diff = 5 - day;        // target Friday
  if (diff > 0) diff -= 7;   // go back to last Friday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfWeek(weekStart) {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6); // Friday + 6 = Thursday
  end.setHours(23, 59, 59, 999);
  return end;
}

// ---- Rendering ----
function render() {
  const weekLabelEl = document.getElementById('week-label');
  const weekRangeEl = document.getElementById('week-range');
  const budgetAmountEl = document.getElementById('budget-amount');
  const incomeAmountEl = document.getElementById('income-amount');
  const spentAmountEl = document.getElementById('spent-amount');
  const remainingAmountEl = document.getElementById('remaining-amount');
  const aheadBehindEl = document.getElementById('ahead-behind');
  const budgetInputEl = document.getElementById('budget-input');
  const tbody = document.getElementById('tx-table-body');
  const categoryFilterEl = document.getElementById('category-filter');

  const weekStart = startOfWeek(currentWeek);
  const weekEnd = endOfWeek(weekStart);

  weekLabelEl.textContent = `Week of ${weekStart.toLocaleDateString()}`;
  weekRangeEl.textContent =
    `${weekStart.toLocaleDateString()} – ${weekEnd.toLocaleDateString()}`;

  budgetAmountEl.textContent = state.weeklyBudget.toFixed(2);
  budgetInputEl.value = state.weeklyBudget ? state.weeklyBudget : '';

  // Weekly transactions
  const weekTx = state.transactions.filter(tx => {
    const d = new Date(tx.date);
    return d >= weekStart && d <= weekEnd;
  });

  // Build category filter options
  const selectedCategory = categoryFilterEl.value || 'all';
  const categories = Array.from(
    new Set(state.transactions.map(tx => tx.category).filter(Boolean))
  );
  categoryFilterEl.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = 'all';
  allOpt.textContent = 'All';
  categoryFilterEl.appendChild(allOpt);
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === selectedCategory) opt.selected = true;
    categoryFilterEl.appendChild(opt);
  });

  // Totals
  let income = 0;
  let spent = 0;
  let cashIncome = 0;
  let cashSpent = 0;

  weekTx.forEach(tx => {
    const amt = parseFloat(tx.amount);
    if (!isFinite(amt)) return;

    if (tx.type === 'income') income += amt;
    if (tx.type === 'expense') spent += amt;

    if (tx.type === 'cash-income') cashIncome += amt;
    if (tx.type === 'cash-expense') cashSpent += amt;
  });

  const remaining = state.weeklyBudget - spent;
  const cashOnHand = cashIncome - cashSpent;

  incomeAmountEl.textContent = income.toFixed(2);
  spentAmountEl.textContent = spent.toFixed(2);
  remainingAmountEl.textContent = remaining.toFixed(2);
  document.getElementById('cash-on-hand').textContent = cashOnHand.toFixed(2);

  if (remaining >= 0) {
    aheadBehindEl.textContent = `Ahead by $${remaining.toFixed(2)}`;
    aheadBehindEl.style.color = 'green';
  } else {
    aheadBehindEl.textContent = `Behind by $${Math.abs(remaining).toFixed(2)}`;
    aheadBehindEl.style.color = 'red';
  }

  // Table
  tbody.innerHTML = '';
  weekTx
    .filter(tx => selectedCategory === 'all' || tx.category === selectedCategory)
    .forEach(tx => {
      const tr = document.createElement('tr');

      const typeTd = document.createElement('td');
      typeTd.textContent = tx.type;
      tr.appendChild(typeTd);

      const dateTd = document.createElement('td');
      dateTd.textContent = tx.date;
      tr.appendChild(dateTd);

      const catTd = document.createElement('td');
      catTd.textContent = tx.category || '';
      tr.appendChild(catTd);

      const descTd = document.createElement('td');
      descTd.textContent = tx.desc || '';
      tr.appendChild(descTd);

      const amtTd = document.createElement('td');
      amtTd.textContent = parseFloat(tx.amount).toFixed(2);
      if (tx.type === 'expense' || tx.type === 'cash-expense') {
        amtTd.style.color = 'red';
      } else {
        amtTd.style.color = 'green';
      }
      tr.appendChild(amtTd);

      const delTd = document.createElement('td');
      const btn = document.createElement('button');
      btn.textContent = 'Delete';
      btn.addEventListener('click', () => {
        state.transactions = state.transactions.filter(t => t.id !== tx.id);
        saveState();
        render();
      });
      delTd.appendChild(btn);
      tr.appendChild(delTd);

      tbody.appendChild(tr);
    });

  renderMonthlySummary();
  renderYearlySummary();
}

// ---- Monthly & Yearly summaries ----
function groupByMonth() {
  const map = new Map();
  state.transactions.forEach(tx => {
    const d = new Date(tx.date);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) {
      map.set(key, { income: 0, expense: 0, cashIncome: 0, cashExpense: 0 });
    }
    const bucket = map.get(key);
    const amt = parseFloat(tx.amount);
    if (!isFinite(amt)) return;

    if (tx.type === 'income') bucket.income += amt;
    if (tx.type === 'expense') bucket.expense += amt;
    if (tx.type === 'cash-income') bucket.cashIncome += amt;
    if (tx.type === 'cash-expense') bucket.cashExpense += amt;
  });
  return map;
}

function groupByYear() {
  const map = new Map();
  state.transactions.forEach(tx => {
    const d = new Date(tx.date);
    if (isNaN(d)) return;
    const key = d.getFullYear();
    if (!map.has(key)) {
      map.set(key, { income: 0, expense: 0, cashIncome: 0, cashExpense: 0 });
    }
    const bucket = map.get(key);
    const amt = parseFloat(tx.amount);
    if (!isFinite(amt)) return;

    if (tx.type === 'income') bucket.income += amt;
    if (tx.type === 'expense') bucket.expense += amt;
    if (tx.type === 'cash-income') bucket.cashIncome += amt;
    if (tx.type === 'cash-expense') bucket.cashExpense += amt;
  });
  return map;
}

function renderMonthlySummary() {
  const container = document.getElementById('monthly-content');
  container.innerHTML = '';

  const data = Array.from(groupByMonth().entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  if (!data.length) {
    container.textContent = 'No data yet.';
    return;
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Month', 'Income', 'Expense', 'Net', 'Cash In', 'Cash Out', 'Cash Net'].forEach(
    h => {
      const th = document.createElement('th');
      th.textContent = h;
      headRow.appendChild(th);
    }
  );
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  data.forEach(([key, bucket]) => {
    const [year, month] = key.split('-');
    const label = `${month}/${year}`;
    const tr = document.createElement('tr');

    const net = bucket.income - bucket.expense;
    const cashNet = bucket.cashIncome - bucket.cashExpense;

    [label,
     bucket.income.toFixed(2),
     bucket.expense.toFixed(2),
     net.toFixed(2),
     bucket.cashIncome.toFixed(2),
     bucket.cashExpense.toFixed(2),
     cashNet.toFixed(2)
    ].forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

function renderYearlySummary() {
  const container = document.getElementById('yearly-content');
  container.innerHTML = '';

  const data = Array.from(groupByYear().entries()).sort((a, b) => a[0] - b[0]);

  if (!data.length) {
    container.textContent = 'No data yet.';
    return;
  }

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Year', 'Income', 'Expense', 'Net', 'Cash In', 'Cash Out', 'Cash Net'].forEach(
    h => {
      const th = document.createElement('th');
      th.textContent = h;
      headRow.appendChild(th);
    }
  );
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  data.forEach(([year, bucket]) => {
    const tr = document.createElement('tr');
    const net = bucket.income - bucket.expense;
    const cashNet = bucket.cashIncome - bucket.cashExpense;

    [String(year),
     bucket.income.toFixed(2),
     bucket.expense.toFixed(2),
     net.toFixed(2),
     bucket.cashIncome.toFixed(2),
     bucket.cashExpense.toFixed(2),
     cashNet.toFixed(2)
    ].forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

// ---- Add transaction ----
function setupAddTransaction() {
  const typeEl = document.getElementById('tx-type');
  const dateEl = document.getElementById('tx-date');
  const catEl = document.getElementById('tx-category');
  const descEl = document.getElementById('tx-desc');
  const amtEl = document.getElementById('tx-amount');
  const btn = document.getElementById('add-tx-btn');

  btn.addEventListener('click', () => {
    const type = typeEl.value;
    const date = dateEl.value;
    const category = catEl.value.trim();
    const desc = descEl.value.trim();
    const amount = parseFloat(amtEl.value);

    if (!date || !isFinite(amount)) {
      alert('Please enter a valid date and amount.');
      return;
    }

    const tx = {
      id: Date.now() + Math.random().toString(16).slice(2),
      type,
      date,
      category,
      desc,
      amount
    };

    state.transactions.push(tx);
    saveState();

    // clear form
    descEl.value = '';
    amtEl.value = '';
    // keep type/date/category as-is for speed

    render();
  });
}

// ---- Budget save ----
function setupBudget() {
  const input = document.getElementById('budget-input');
  const btn = document.getElementById('save-budget-btn');

  btn.addEventListener('click', () => {
    const val = parseFloat(input.value);
    if (!isFinite(val) || val < 0) {
      alert('Enter a valid weekly budget.');
      return;
    }
    state.weeklyBudget = val;
    saveState();
    render();
  });
}

// ---- Week navigation ----
function setupWeekNav() {
  const prevBtn = document.getElementById('prev-week-btn');
  const nextBtn = document.getElementById('next-week-btn');
  const thisBtn = document.getElementById('this-week-btn');

  prevBtn.addEventListener('click', () => {
    currentWeek.setDate(currentWeek.getDate() - 7);
    render();
  });

  nextBtn.addEventListener('click', () => {
    currentWeek.setDate(currentWeek.getDate() + 7);
    render();
  });

  thisBtn.addEventListener('click', () => {
    currentWeek = new Date();
    render();
  });
}

// ---- Category filter ----
function setupCategoryFilter() {
  const categoryFilterEl = document.getElementById('category-filter');
  categoryFilterEl.addEventListener('change', () => {
    render();
  });
}

// ---- CSV export ----
function setupExportCSV() {
  const btn = document.getElementById('export-csv-btn');
  btn.addEventListener('click', () => {
    const weekStart = startOfWeek(currentWeek);
    const weekEnd = endOfWeek(weekStart);

    const weekTx = state.transactions.filter(tx => {
      const d = new Date(tx.date);
      return d >= weekStart && d <= weekEnd;
    });

    if (!weekTx.length) {
      alert('No transactions for this week.');
      return;
    }

    const rows = [
      ['Type', 'Date', 'Category', 'Description', 'Amount']
    ];

    weekTx.forEach(tx => {
      rows.push([
        tx.type,
        tx.date,
        tx.category || '',
        tx.desc || '',
        parseFloat(tx.amount).toFixed(2)
      ]);
    });

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'weekly-budget.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

// ---- Collapse headers ----
function setupCollapses() {
  const monthlyHeader = document.getElementById('monthly-header');
  const monthlyContent = document.getElementById('monthly-content');
  const yearlyHeader = document.getElementById('yearly-header');
  const yearlyContent = document.getElementById('yearly-content');

  monthlyHeader.addEventListener('click', () => {
    const visible = monthlyContent.style.display !== 'none';
    monthlyContent.style.display = visible ? 'none' : 'block';
    monthlyHeader.textContent = visible ? 'Monthly Summary ▶' : 'Monthly Summary ▼';
  });

  yearlyHeader.addEventListener('click', () => {
    const visible = yearlyContent.style.display !== 'none';
    yearlyContent.style.display = visible ? 'none' : 'block';
    yearlyHeader.textContent = visible ? 'Yearly Summary ▶' : 'Yearly Summary ▼';
  });

  // default: show both
  monthlyContent.style.display = 'block';
  yearlyContent.style.display = 'block';
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  setupAddTransaction();
  setupBudget();
  setupWeekNav();
  setupCategoryFilter();
  setupExportCSV();
  setupCollapses();
  render();
});
