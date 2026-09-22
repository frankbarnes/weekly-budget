const STORAGE_KEY = 'weekly-budget-data-v1';

let state = {
  weeklyBudget: 0,
  transactions: [], // {id, date, category, desc, amount}
  currentWeekStart: startOfWeek(new Date())
};

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start
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
  const spentAmountEl = document.getElementById('spent-amount');
  const remainingAmountEl = document.getElementById('remaining-amount');
  const budgetInputEl = document.getElementById('budget-input');
  const tbody = document.getElementById('tx-table-body');

  const range = getWeekRange(state.currentWeekStart);
  weekLabelEl.textContent = 'Week of';
  weekRangeEl.textContent = `${range.startLabel} – ${range.endLabel}`;

  budgetAmountEl.textContent = state.weeklyBudget.toFixed(2);
  budgetInputEl.value = state.weeklyBudget ? state.weeklyBudget : '';

  const weekTx = state.transactions.filter(tx =>
    isInWeek(tx.date, state.currentWeekStart)
  );

  let spent = 0;
  tbody.innerHTML = '';
  weekTx.forEach(tx => {
    spent += tx.amount;
    const tr = document.createElement('tr');

    const tdDate = document.createElement('td');
    tdDate.textContent = tx.date;

    const tdCat = document.createElement('td');
    tdCat.textContent = tx.category || '';

    const tdDesc = document.createElement('td');
    tdDesc.textContent = tx.desc || '';

    const tdAmt = document.createElement('td');
    tdAmt.textContent = tx.amount.toFixed(2);

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

    tr.appendChild(tdDate);
    tr.appendChild(tdCat);
    tr.appendChild(tdDesc);
    tr.appendChild(tdAmt);
    tr.appendChild(tdDel);

    tbody.appendChild(tr);
  });

  spentAmountEl.textContent = spent.toFixed(2);
  remainingAmountEl.textContent = (state.weeklyBudget - spent).toFixed(2);
}

function setupEvents() {
  document.getElementById('save-budget-btn').onclick = () => {
    const val = parseFloat(document.getElementById('budget-input').value || '0');
    state.weeklyBudget = isNaN(val) ? 0 : val;
    saveState();
    render();
  };

  document.getElementById('add-tx-btn').onclick = () => {
    const dateEl = document.getElementById('tx-date');
    const catEl = document.getElementById('tx-category');
    const descEl = document.getElementById('tx-desc');
    const amtEl = document.getElementById('tx-amount');

    const date = dateEl.value || formatDate(new Date());
    const amount = parseFloat(amtEl.value || '0');
    if (isNaN(amount) || amount === 0) return;

    const tx = {
      id: Date.now() + '-' + Math.random().toString(16).slice(2),
      date,
      category: catEl.value.trim(),
      desc: descEl.value.trim(),
      amount
    };
    state.transactions.push(tx);
    saveState();

    amtEl.value = '';
    descEl.value = '';
    catEl.value = '';
    dateEl.value = '';

    render();
  };

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
    let csv = 'Date,Category,Description,Amount\n';
    weekTx.forEach(tx => {
      const row = [
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
}

window.addEventListener('load', () => {
  loadState();
  state.currentWeekStart = startOfWeek(new Date());
  setupEvents();
  render();
});
