(() => {
  const storageKey = 'poker_session_v1';

  /** @typedef {{ id: string, name: string, buyIns: number[], cashOut: number|null, createdAt: number }} Player */
  /** @typedef {{ players: Player[], createdAt: number, updatedAt: number }} Session */

  /** @type {Session} */
  let session = loadSession();

  const els = {
    addPlayerForm: document.getElementById('addPlayerForm'),
    playerName: document.getElementById('playerName'),
    buyInAmount: document.getElementById('buyInAmount'),
    playersTbody: document.getElementById('playersTbody'),
    totalIn: document.getElementById('totalIn'),
    totalOut: document.getElementById('totalOut'),
    discrepancy: document.getElementById('discrepancy'),
    resetBtn: document.getElementById('resetBtn'),
    rebuyDialog: document.getElementById('rebuyDialog'),
    rebuyForm: document.getElementById('rebuyForm'),
    rebuyAmount: document.getElementById('rebuyAmount'),
    cashoutDialog: document.getElementById('cashoutDialog'),
    cashoutForm: document.getElementById('cashoutForm'),
    cashoutAmount: document.getElementById('cashoutAmount'),
  };

  // Utils
  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  function fmt(n) {
    return `$${Number(n || 0).toFixed(2)}`;
  }
  function sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { players: [], createdAt: Date.now(), updatedAt: Date.now() };
      const parsed = JSON.parse(raw);
      if (!parsed.players) throw new Error('Invalid');
      return parsed;
    } catch {
      return { players: [], createdAt: Date.now(), updatedAt: Date.now() };
    }
  }

  function saveSession() {
    session.updatedAt = Date.now();
    localStorage.setItem(storageKey, JSON.stringify(session));
  }

  function addPlayer(name, buyIn) {
    const player = { id: uid(), name: name.trim(), buyIns: [buyIn], cashOut: null, createdAt: Date.now() };
    session.players.push(player);
    saveSession();
    render();
  }

  function addRebuy(playerId, amount) {
    const p = session.players.find(p => p.id === playerId);
    if (!p) return;
    p.buyIns.push(amount);
    saveSession();
    render();
  }

  function setCashOut(playerId, amount) {
    const p = session.players.find(p => p.id === playerId);
    if (!p) return;
    if (amount === null) {
      p.cashOut = null;
    } else if (isFinite(amount)) {
      p.cashOut = amount;
    }
    saveSession();
    updateSummary();
  }

  function removePlayer(playerId) {
    session.players = session.players.filter(p => p.id !== playerId);
    saveSession();
    render();
  }

  function resetSession() {
    if (!confirm('Reset current session? This cannot be undone.')) return;
    session = { players: [], createdAt: Date.now(), updatedAt: Date.now() };
    saveSession();
    render();
  }

  

  function render() {
    const tbody = els.playersTbody;
    tbody.innerHTML = '';
    session.players.forEach((p, idx) => {
      const tr = document.createElement('tr');

      const totalIn = sum(p.buyIns);
      const net = (p.cashOut ?? 0) - totalIn;

      tr.innerHTML = `
        <td>${idx+1}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>
          <span class="chip">${p.buyIns.map(b => fmt(b)).join(' + ')}</span>
        </td>
        <td>
          <div class="actions">
            <button class="btn btn-primary" data-action="rebuy" data-id="${p.id}">+ Rebuy</button>
          </div>
        </td>
        <td class="num">${fmt(totalIn)}</td>
        <td>
          <input class="cashout-input" data-id="${p.id}" type="number" min="0" step="0.01" value="${p.cashOut ?? ''}" placeholder="0.00">
        </td>
        <td class="num" data-net="${net}">${fmt(net)}</td>
        <td>
          <div class="actions">
            <button class="btn" data-action="cashout" data-id="${p.id}">Cash Out</button>
            <button class="btn" data-action="remove" data-id="${p.id}">Remove</button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Wire row actions
    tbody.querySelectorAll('button[data-action="rebuy"]').forEach(btn => {
      btn.addEventListener('click', () => openRebuyDialog(btn.getAttribute('data-id')));
    });
    tbody.querySelectorAll('button[data-action="cashout"]').forEach(btn => {
      btn.addEventListener('click', () => openCashoutDialog(btn.getAttribute('data-id')));
    });
    tbody.querySelectorAll('button[data-action="remove"]').forEach(btn => {
      btn.addEventListener('click', () => removePlayer(btn.getAttribute('data-id')));
    });
    tbody.querySelectorAll('input.cashout-input').forEach(input => {
      input.addEventListener('input', () => {
        const id = input.getAttribute('data-id');
        const val = input.value === '' ? null : Number(input.value);
        if (val === null || isFinite(val)) {
          setCashOut(id, val);
          const row = input.closest('tr');
          const p = session.players.find(p => p.id === id);
          const totalIn = p ? sum(p.buyIns) : 0;
          const net = (val ?? 0) - totalIn;
          const netCell = row.querySelector('[data-net]');
          netCell.textContent = fmt(net);
        }
      });
    });

    updateSummary();
  }

  function updateSummary() {
    const totalInSum = session.players.reduce((acc, p) => acc + sum(p.buyIns), 0);
    const totalOutSum = session.players.reduce((acc, p) => acc + (p.cashOut ?? 0), 0);
    const netInPlay = totalInSum - totalOutSum;
    els.totalIn.textContent = fmt(netInPlay);
    els.totalOut.textContent = fmt(totalOutSum);
    const diff = totalOutSum - totalInSum;
    els.discrepancy.textContent = fmt(diff);
    els.discrepancy.style.color = Math.abs(diff) < 0.005 ? '#22c55e' : (diff > 0 ? '#f59e0b' : '#ef4444');
  }

  function openRebuyDialog(playerId) {
    els.rebuyForm.setAttribute('data-id', playerId);
    els.rebuyAmount.value = '';
    els.rebuyDialog.showModal();
    setTimeout(() => els.rebuyAmount.focus(), 50);
  }

  function openCashoutDialog(playerId) {
    els.cashoutForm.setAttribute('data-id', playerId);
    const p = session.players.find(p => p.id === playerId);
    els.cashoutAmount.value = p && p.cashOut != null ? String(p.cashOut) : '';
    els.cashoutDialog.showModal();
    setTimeout(() => els.cashoutAmount.focus(), 50);
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }

  // Events
  els.addPlayerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = els.playerName.value.trim();
    const buyIn = Number(els.buyInAmount.value);
    if (!name) return;
    if (!isFinite(buyIn) || buyIn < 0) return;
    addPlayer(name, buyIn);
    els.playerName.value = '';
    els.buyInAmount.value = '';
    els.playerName.focus();
  });

  els.resetBtn.addEventListener('click', resetSession);

  

  els.rebuyDialog.addEventListener('close', () => {
    if (els.rebuyDialog.returnValue !== 'confirm') return;
    const id = els.rebuyForm.getAttribute('data-id');
    const amt = Number(els.rebuyAmount.value);
    if (isFinite(amt) && amt >= 0) addRebuy(id, amt);
  });

  els.cashoutDialog.addEventListener('close', () => {
    if (els.cashoutDialog.returnValue !== 'confirm') return;
    const id = els.cashoutForm.getAttribute('data-id');
    const amt = Number(els.cashoutAmount.value);
    if (isFinite(amt) && amt >= 0) {
      setCashOut(id, amt);
      render();
    }
  });

  // Initial paint
  render();
})();


