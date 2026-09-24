const STORAGE_KEY = 'weekly-budget-data-v2';

let state = {
  weeklyBudget: 0,
  transactions: [], // {id, type, date, category, desc, amount}
  currentWeekStart: startOfWeek(new Date())
};

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun, 1=Mon, ... 5=Fri

  // Friday = start of week (day 5)
  let diff = 5 - day;
  if (diff > 0) diff -= 7; // move backward to last Friday

  date.setDate(date.getDate() + diff);
  date.setHours(0,0,0,0);
  return date;
}


function addDays(d, days) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

function formatDate(d) {
  return d.toISOString().slice(0,10);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    state.weeklyBudget = data.weeklyBudget || 0;
    state.transactions = data.transactions || [];
  } catch (e) {
    console.error('Failed to parse storage', e);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    weeklyBudget: state.weeklyBudget,
    transactions: state.transactions
  }));
}

function getWeekRange(start) {
  const end = addDays(start, 6);
  return {
    startLabel: formatDate(start),
    endLabel: formatDate(end)
  };
}

function isInWeek(dateStr, weekStart) {
  const d = new Date(dateStr);
  const s = new Date(weekStart);
  const e = addDays(s, 6);
  return d >= s && d <= e;
}

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

  const range = getWeekRange(state.currentWeekStart);
  weekLabelEl.textContent = 'Week of';
  weekRangeEl.textContent = `${range.startLabel} – ${range.endLabel}`;

  budgetAmountEl.textContent = state.weeklyBudget.toFixed(2);
  budgetInputEl.value = state.weeklyBudget ? state.weeklyBudget : '';

  const weekTx = state.transactions.filter(tx =>
    isInWeek(tx.date, state.currentWeekStart)
  );

  let income = 0;
  let spent = 0;
  let cashIncome = 0;
  let cashSpent = 0;


  const categories = new Set(['all']);

  tbody.innerHTML = '';

 weekTx.forEach(tx => {
  categories.add(tx.category);

  if (tx.type === 'income') {
    income += tx.amount;
  } else if (tx.type === 'cash-income') {
    cashIncome += tx.amount;
  } else if (tx.type === 'cash-expense') {
    cashSpent += tx.amount;
  } else {
    spent += tx.amount;
  }
});


  categoryFilterEl.innerHTML = '';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    categoryFilterEl.appendChild(opt);
  });

  const selectedCat = categoryFilterEl.value;

  weekTx
    .filter(tx => selectedCat === 'all' || tx.category === selectedCat)
    .forEach(tx => {
      const tr = document.createElement('tr');

      const tdType = document.createElement('td');
      tdType.textContent = tx.type === 'income' ? 'Income' : 'Expense';

      const tdDate = document.createElement('td');
      tdDate.textContent = tx.date;

      const tdCat = document.createElement('td');
      tdCat.textContent = tx.category || '';

      const tdDesc = document.createElement('td');
      tdDesc.textContent = tx.desc || '';

      const tdAmt = document.createElement('td');
      tdAmt.textContent = tx.amount.toFixed(2);
      if (tx.type === 'income' || tx.type === 'cash-income') {
  tdAmt.className = 'income-amount';
}
if (tx.type === 'cash-expense') {
  tdAmt.style.color = '#b00020';
  tdAmt.style.fontWeight = 'bold';
}


      const tdDel = document.createElement('td');
      const btn = document.createElement('button');
      btn.textContent = 'Delete';
      btn.className = 'delete-btn';
      btn.onclick = () => {
        state.transactions = state.transactions.filter(t => t.id !== tx.id);
        saveState();
        render();
      };
      tdDel.appendChild(btn);

      tr.appendChild(tdType);
      tr.appendChild(tdDate);
      tr.appendChild(tdCat);
      tr.appendChild(tdDesc);
      tr.appendChild(tdAmt);
      tr.appendChild(tdDel);

      tbody.appendChild(tr);
    });

  incomeAmountEl.textContent = income.toFixed(2);
  spentAmountEl.textContent = spent.toFixed(2);
  remainingAmountEl.textContent = (state.weeklyBudget - spent).toFixed(2);
  const cashOnHand = cashIncome - cashSpent;
  document.getElementById('cash-on-hand').textContent = cashOnHand.toFixed(2);


  const ahead = income - spent - state.weeklyBudget;
  aheadBehindEl.textContent = ahead.toFixed(2);
  aheadBehindEl.style.color = ahead >= 0 ? '#0a7d00' : '#b00020';

  renderMonthly();
  renderYearly();
}

function renderMonthly() {
  const content = document.getElementById('monthly-content');
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const monthTx = state.transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  let income = 0;
  let spent = 0;
  let cashIncome = 0;
  let cashSpent = 0;

  const catTotals = {};

  monthTx.forEach(tx => {
    if (tx.type === 'income') {
      income += tx.amount;
    } else if (tx.type === 'cash-income') {
      cashIncome += tx.amount;
    } else if (tx.type === 'cash-expense') {
      cashSpent += tx.amount;
    } else {
      spent += tx.amount;
    }

    catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
  });

  const ahead = income - spent - (state.weeklyBudget * 4);
  const cashOnHand = cashIncome - cashSpent;

  let html = `
    <div><strong>Income:</strong> $${income.toFixed(2)}</div>
    <div><strong>Spending:</strong> $${spent.toFixed(2)}</div>
    <div><strong>Net:</strong> $${(income - spent).toFixed(2)}</div>
    <div><strong>Ahead/Behind:</strong> $${ahead.toFixed(2)}</div>

    <div><strong>Cash Income:</strong> $${cashIncome.toFixed(2)}</div>
    <div><strong>Cash Spending:</strong> $${cashSpent.toFixed(2)}</div>
    <div><strong>Cash on hand:</strong> $${cashOnHand.toFixed(2)}</div>

    <h3>Category Totals</h3>
  `;

  Object.keys(catTotals).forEach(cat => {
    html += `<div>${cat}: $${catTotals[cat].toFixed(2)}</div>`;
  });

  content.innerHTML = html;
}


function renderYearly() {
  const content = document.getElementById('yearly-content');
  const year = new Date().getFullYear();

  const yearTx = state.transactions.filter(tx => {
    const d = new Date(tx.date);
    return d.getFullYear() === year;
  });

  let income = 0;
  let spent = 0;
  let cashIncome = 0;
  let cashSpent = 0;

  const catTotals = {};

  yearTx.forEach(tx => {
    if (tx.type === 'income') {
      income += tx.amount;
    } else if (tx.type === 'cash-income') {
      cashIncome += tx.amount;
    } else if (tx.type === 'cash-expense') {
      cashSpent += tx.amount;
    } else {
      spent += tx.amount;
    }

    catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
  });

  const ahead = income - spent - (state.weeklyBudget * 52);
  const cashOnHand = cashIncome - cashSpent;

  let html = `
    <div><strong>Income:</strong> $${income.toFixed(2)}</div>
    <div><strong>Spending:</strong> $${spent.toFixed(2)}</div>
    <div><strong>Net:</strong> $${(income - spent).toFixed(2)}</div>
    <div><strong>Ahead/Behind:</strong> $${ahead.toFixed(2)}</div>

    <div><strong>Cash Income:</strong> $${cashIncome.toFixed(2)}</div>
    <div><strong>Cash Spending:</strong> $${cashSpent.toFixed(2)}</div>
    <div><strong>Cash on hand:</strong> $${cashOnHand.toFixed(2)}</div>

    <h3>Category Totals</h3>
  `;

  Object.keys(catTotals).forEach(cat => {
    html += `<div>${cat}: $${catTotals[cat].toFixed(2)}</div>`;
  });

  content.innerHTML = html;
}



function setupEvents() {
  document.getElementById('save-budget-btn').onclick = () => {
    const val = parseFloat(document.getElementById('budget-input').value || '0');
    state.weeklyBudget = isNaN(val) ? 0 : val;
    saveState();
    render();
  };

  document.getElementById('add-tx-btn').onclick = () => {
    const typeEl = document.getElementById('tx-type');
    const dateEl = document.getElementById('tx-date');
    const catEl = document.getElementById('tx-category');
    const descEl = document.getElementById('tx-desc');
    const amtEl = document.getElementById('tx-amount');

    const type = typeEl.value;
    const date = dateEl.value || formatDate(new Date());
    const amount = parseFloat(amtEl.value || '0');
    if (isNaN(amount) || amount === 0) return;

    const tx = {
      id: Date.now() + '-' + Math.random().toString(16).slice(2),
      type,
      date,
      category: catEl.value.trim(),
      desc: descEl.value.trim(),
      amount
    };
if (type === 'cash-income' || type === 'cash-expense') {
  tx.category = 'Cash';
}

    state.transactions.push(tx);
    saveState();

    amtEl.value = '';
    descEl.value = '';
    catEl.value = '';
    dateEl.value = '';

    render();
  };
document.getElementById('category-filter').value = 'all';

  document.getElementById('prev-week-btn').onclick = () => {
    state.currentWeekStart = addDays(state.currentWeekStart, -7);
    render();
  };

  document.getElementById('next-week-btn').onclick = () => {
    state.currentWeekStart = addDays(state.currentWeekStart, 7);
    render();
  };

  document.getElementById('this-week-btn').onclick = () => {
    state.currentWeekStart = startOfWeek(new Date());
    render();
  };

  document.getElementById('export-csv-btn').onclick = () => {
    const range = getWeekRange(state.currentWeekStart);
    const weekTx = state.transactions.filter(tx =>
      isInWeek(tx.date, state.currentWeekStart)
    );
    let csv = 'Type,Date,Category,Description,Amount\n';
    weekTx.forEach(tx => {
      const row = [
        tx.type,
        tx.date,
        `"${(tx.category || '').replace(/"/g, '""')}"`,
        `"${(tx.desc || '').replace(/"/g, '""')}"`,
        tx.amount.toFixed(2)
      ].join(',');
      csv += row + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-budget-${range.startLabel}-to-${range.endLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  document.getElementById('category-filter').onchange = render;

    document.getElementById('monthly-header').onclick = () => {
    const content = document.getElementById('monthly-content');
    content.style.display = content.style.display === 'block' ? 'none' : 'block';
  };

  document.getElementById('yearly-header').onclick = () => {
    const content = document.getElementById('yearly-content');
    content.style.display = content.style.display === 'block' ? 'none' : 'block';
  };
}

loadState();
setupEvents();
render();
