/* Bank Management System - Frontend-only */

const state = {
  accounts: [],
  txns: [],
  reduceMotion: false,
};

const els = {
  toasts: document.getElementById('toasts'),
  activityList: document.getElementById('activityList'),

  statTotalBalance: document.getElementById('statTotalBalance'),
  statAccounts: document.getElementById('statAccounts'),
  statTxToday: document.getElementById('statTxToday'),

  accountsGrid: document.getElementById('accountsGrid'),
  txTbody: document.getElementById('txTbody'),

  txSearch: document.getElementById('txSearch'),
  txType: document.getElementById('txType'),
  txSort: document.getElementById('txSort'),

  fromAccount: document.getElementById('fromAccount'),
  toAccount: document.getElementById('toAccount'),
  transferAmount: document.getElementById('transferAmount'),
  transferNote: document.getElementById('transferNote'),
  transferError: document.getElementById('transferError'),

  previewFrom: document.getElementById('previewFrom'),
  previewTo: document.getElementById('previewTo'),
  previewAmount: document.getElementById('previewAmount'),

  modalOverlay: document.getElementById('modalOverlay'),
  modalTitle: document.getElementById('modalTitle'),
  modalSubtitle: document.getElementById('modalSubtitle'),
  modalBody: document.getElementById('modalBody'),
  modalFooter: document.getElementById('modalFooter'),
};

function uid(prefix='TX'){
  return `${prefix}-${Math.random().toString(16).slice(2,6).toUpperCase()}${Math.random().toString(16).slice(2,6).toUpperCase()}`;
}

function now(){ return new Date(); }
function iso(d){ return d.toISOString(); }
function fmtMoney(n){
  const v = Number(n);
  return v.toLocaleString(undefined, { style:'currency', currency:'USD', maximumFractionDigits:0 });
}
function fmtWhen(isoStr){
  const d = new Date(isoStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff/60000);
  if(mins < 1) return 'just now';
  if(mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins/60);
  if(hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs/24);
  return `${days}d ago`;
}

function seedData(){
  state.accounts = [
    { id:'AC-1001', holder:'Ava Johnson', type:'Checking', balance: 1250, createdAt: iso(new Date(Date.now()-86400000*12)) },
    { id:'AC-1002', holder:'Noah Williams', type:'Savings', balance: 8420, createdAt: iso(new Date(Date.now()-86400000*40)) },
    { id:'AC-1003', holder:'Mia Brown', type:'Checking', balance: 3100, createdAt: iso(new Date(Date.now()-86400000*6)) },
  ];

  const t = (minsAgo) => iso(new Date(Date.now() - minsAgo*60000));

  state.txns = [
    { id: uid('TX'), type:'deposit', amount: 800, fromAccountId: null, toAccountId:'AC-1002', note:'Salary top-up', createdAt: t(1600) },
    { id: uid('TX'), type:'withdrawal', amount: 120, fromAccountId:'AC-1001', toAccountId:null, note:'ATM withdrawal', createdAt: t(980) },
    { id: uid('TX'), type:'transfer', amount: 250, fromAccountId:'AC-1002', toAccountId:'AC-1003', note:'Dinner split', createdAt: t(650) },
    { id: uid('TX'), type:'deposit', amount: 150, fromAccountId:null, toAccountId:'AC-1001', note:'Cash deposit', createdAt: t(380) },
    { id: uid('TX'), type:'withdrawal', amount: 60, fromAccountId:'AC-1003', toAccountId:null, note:'Groceries', createdAt: t(220) },
  ];

  // Apply balances from txns is already reflected in seeded balances; keep consistent by deriving from txns would be heavier.
  // We'll keep these as canonical and balances are initialized to match them approximately.
}

function toast(kind, title, msg){
  const icon = kind==='success' ? '✅' : kind==='danger' ? '⚠️' : kind==='warning' ? '🧭' : 'ℹ️';
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <div class="toast__icon" aria-hidden="true">${icon}</div>
    <div class="toast__main">
      <div class="toast__title">${escapeHtml(title)}</div>
      <div class="toast__msg">${escapeHtml(msg)}</div>
    </div>
  `;
  els.toasts.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(-6px)'; setTimeout(()=>el.remove(), 180); }, 3200);
}

function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','<')
    .replaceAll('>','>')
    .replaceAll('"','"')
    .replaceAll("'",'&#039;');
}

function applyTxnToBalances(tx){
  // Canonical: state.accounts balances are updated directly here.
  if(tx.type === 'deposit'){
    const to = state.accounts.find(a=>a.id===tx.toAccountId);
    if(!to) throw new Error('Missing destination account');
    to.balance += tx.amount;
  } else if(tx.type === 'withdrawal'){
    const from = state.accounts.find(a=>a.id===tx.fromAccountId);
    if(!from) throw new Error('Missing source account');
    if(from.balance < tx.amount) throw new Error('Insufficient funds');
    from.balance -= tx.amount;
  } else if(tx.type === 'transfer'){
    const from = state.accounts.find(a=>a.id===tx.fromAccountId);
    const to = state.accounts.find(a=>a.id===tx.toAccountId);
    if(!from || !to) throw new Error('Missing accounts');
    if(from.balance < tx.amount) throw new Error('Insufficient funds');
    from.balance -= tx.amount;
    to.balance += tx.amount;
  }
}

function badgeForType(type){
  if(type==='deposit') return { cls:'badge--deposit', label:'Deposit' };
  if(type==='withdrawal') return { cls:'badge--withdrawal', label:'Withdrawal' };
  return { cls:'badge--transfer', label:'Transfer' };
}

function renderNav(){
  const btns = document.querySelectorAll('[data-nav]');
  btns.forEach(b=>{
    b.addEventListener('click', ()=>{
      const target = b.getAttribute('data-nav');
      setScreen(target);
    });
  });
}

function setScreen(name){
  document.querySelectorAll('.screen').forEach(s=> s.classList.add('hidden'));
  const el = document.getElementById(`screen-${name}`);
  if(el) el.classList.remove('hidden');

  document.querySelectorAll('.navbtn').forEach(b=>{
    b.setAttribute('aria-current', b.getAttribute('data-nav')===name ? 'page' : 'false');
  });

  if(name==='transactions') renderTransactions();
  if(name==='transfer') renderTransferForm();
}

function renderStats(){
  const total = state.accounts.reduce((s,a)=>s+a.balance,0);
  els.statTotalBalance.textContent = fmtMoney(total);
  els.statAccounts.textContent = String(state.accounts.length);

  const start = new Date();
  start.setHours(0,0,0,0);
  const today = state.txns.filter(t=> new Date(t.createdAt).getTime() >= start.getTime());
  els.statTxToday.textContent = String(today.length);
}

function renderActivity(){
  const list = state.txns
    .slice()
    .sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt))
    .slice(0,6);

  els.activityList.innerHTML = '';
  for(const tx of list){
    const amountClass = (tx.type==='withdrawal') ? 'amountNeg' : 'amountPos';
    const title = tx.type==='deposit' ? 'Deposit' : tx.type==='withdrawal' ? 'Withdrawal' : 'Transfer';
    const signAmount = tx.type==='withdrawal' ? -tx.amount : tx.amount;

    const from = tx.fromAccountId ? getAccount(tx.fromAccountId)?.holder : '—';
    const to = tx.toAccountId ? getAccount(tx.toAccountId)?.holder : '—';

    const item = document.createElement('div');
    item.className = 'activityItem';
    item.innerHTML = `
      <div class="activityItem__pill" aria-hidden="true">${tx.type==='deposit'?'⬇️': tx.type==='withdrawal'?'⬆️':'🔁'}</div>
      <div class="activityItem__main">
        <div class="activityItem__top">
          <div class="activityItem__title">${escapeHtml(title)}</div>
          <div class="activityItem__when">${escapeHtml(fmtWhen(tx.createdAt))}</div>
        </div>
        <div class="activityItem__meta">
          <span class="amountTag ${amountClass}">${signAmount>=0?'+':''}${escapeHtml(fmtMoney(Math.abs(signAmount)).replace('$',''))}</span>
          <div style="margin-top:4px; color: rgba(234,240,255,.68)">${escapeHtml(from)} → ${escapeHtml(to)}</div>
          ${tx.note ? `<div style="margin-top:4px; color: rgba(234,240,255,.55)">Note: ${escapeHtml(tx.note)}</div>` : ''}
        </div>
      </div>
    `;
    els.activityList.appendChild(item);
  }
}

function getAccount(id){
  return state.accounts.find(a=>a.id===id);
}

function renderAccounts(){
  els.accountsGrid.innerHTML='';
  for(const acc of state.accounts){
    const card = document.createElement('div');
    card.className = 'accCard';
    card.innerHTML = `
      <div class="accTop">
        <div>
          <div class="accName">${escapeHtml(acc.holder)}</div>
          <div class="accType">${escapeHtml(acc.type)} · <span class="mono">${escapeHtml(acc.id)}</span></div>
        </div>
        <div class="badge" style="align-self:flex-start; padding: 8px 10px;">
          <span aria-hidden="true">💠</span>
          <span class="mono">${escapeHtml(acc.id)}</span>
        </div>
      </div>

      <div class="balance">
        <div class="balance__label">Balance</div>
        <div class="balance__value">${escapeHtml(fmtMoney(acc.balance))}</div>
      </div>

      <div class="accActions">
        <button class="smallBtn" data-action="accountDeposit" data-account-id="${escapeHtml(acc.id)}">Deposit</button>
        <button class="smallBtn" data-action="accountWithdraw" data-account-id="${escapeHtml(acc.id)}">Withdraw</button>
      </div>
    `;
    els.accountsGrid.appendChild(card);
  }
}

function renderTransferForm(){
  const options = state.accounts.map(a=>({id:a.id, label:`${a.holder} · ${a.id}`}));

  const fill = (selectEl) => {
    const current = selectEl.value;
    selectEl.innerHTML='';
    for(const o of options){
      const opt = document.createElement('option');
      opt.value=o.id;
      opt.textContent=o.label;
      selectEl.appendChild(opt);
    }
    if(current && options.some(o=>o.id===current)) selectEl.value=current;
  };

  fill(els.fromAccount);
  fill(els.toAccount);

  if(state.accounts.length>=2){
    els.fromAccount.value = state.accounts[0].id;
    els.toAccount.value = state.accounts[1].id;
  }

  updateTransferPreview();
}

function updateTransferPreview(){
  const from = getAccount(els.fromAccount.value);
  const to = getAccount(els.toAccount.value);
  els.previewFrom.textContent = from ? `${from.holder} · ${from.id}` : '—';
  els.previewTo.textContent = to ? `${to.holder} · ${to.id}` : '—';
  const amt = Number(els.transferAmount.value || 0);
  els.previewAmount.textContent = amt>0 ? fmtMoney(amt) : '—';
}

function renderTransactions(){
  const q = (els.txSearch.value || '').trim().toLowerCase();
  const type = els.txType.value;
  const sort = els.txSort.value;

  let rows = state.txns.slice();

  if(type !== 'all') rows = rows.filter(t=>t.type===type);
  if(q){
    rows = rows.filter(t=>{
      const from = t.fromAccountId ? getAccount(t.fromAccountId)?.holder : '';
      const to = t.toAccountId ? getAccount(t.toAccountId)?.holder : '';
      const blob = `${t.id} ${t.type} ${from} ${to} ${t.note||''} ${t.amount}`.toLowerCase();
      return blob.includes(q);
    });
  }

  rows.sort((a,b)=>{
    if(sort==='newest') return new Date(b.createdAt)-new Date(a.createdAt);
    if(sort==='oldest') return new Date(a.createdAt)-new Date(b.createdAt);
    if(sort==='amount_desc') return b.amount-a.amount;
    if(sort==='amount_asc') return a.amount-b.amount;
    return 0;
  });

  els.txTbody.innerHTML='';
  if(rows.length===0){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" style="color: rgba(234,240,255,.65); font-weight:850; padding: 22px 14px">No matching transactions</td>`;
    els.txTbody.appendChild(tr);
    return;
  }

  for(const tx of rows){
    const fromName = tx.fromAccountId ? `${getAccount(tx.fromAccountId)?.holder}` : '—';
    const toName = tx.toAccountId ? `${getAccount(tx.toAccountId)?.holder}` : '—';
    const badge = badgeForType(tx.type);

    const amountSign = tx.type==='withdrawal' ? -tx.amount : tx.type==='transfer' ? tx.amount : tx.amount;
    const amountClass = tx.type==='withdrawal' ? 'amountNeg' : 'amountPos';
    const displayAmount = tx.type==='withdrawal' ? `-${fmtMoney(tx.amount)}` : `+${fmtMoney(tx.amount)}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${escapeHtml(tx.id)}</td>
      <td>
        <span class="badge ${escapeHtml(badge.cls)}">${escapeHtml(badge.label)}</span>
      </td>
      <td>${escapeHtml(fromName)}</td>
      <td>${escapeHtml(toName)}</td>
      <td class="mono"><span class="${escapeHtml(amountClass)}">${escapeHtml(displayAmount)}</span></td>
      <td>${escapeHtml(fmtWhen(tx.createdAt))} <span style="color: rgba(234,240,255,.45); font-weight:700">(${escapeHtml(new Date(tx.createdAt).toLocaleString())})</span></td>
    `;
    els.txTbody.appendChild(tr);
  }
}

function closeModal(){
  els.modalOverlay.classList.add('hidden');
  els.modalOverlay.setAttribute('aria-hidden','true');
  els.modalBody.innerHTML='';
  els.modalFooter.innerHTML='';
}

function openModal({title, subtitle, bodyEl, footerEl}){
  els.modalTitle.textContent = title;
  els.modalSubtitle.textContent = subtitle || '';
  els.modalBody.innerHTML='';
  els.modalFooter.innerHTML='';
  if(typeof bodyEl === 'string') els.modalBody.innerHTML = bodyEl;
  else if(bodyEl) els.modalBody.appendChild(bodyEl);
  if(footerEl) els.modalFooter.appendChild(footerEl);

  els.modalOverlay.classList.remove('hidden');
  els.modalOverlay.setAttribute('aria-hidden','false');
}

function makeField({label, inputId, inputType='text', placeholder=''}){
  const wrap = document.createElement('label');
  wrap.className = 'field';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  input.id = inputId;
  input.type = inputType;
  input.placeholder = placeholder;
  wrap.appendChild(span);
  wrap.appendChild(input);
  return wrap;
}

function openCreateAccount(){
  const holder = makeField({label:'Account holder', inputId:'newHolder', placeholder:'e.g. Oliver Tate'});
  const type = document.createElement('label');
  type.className='field';
  const tSpan = document.createElement('span');
  tSpan.textContent='Account type';
  const select = document.createElement('select');
  select.id='newType';
  select.innerHTML = `
    <option value="Checking">Checking</option>
    <option value="Savings">Savings</option>
    <option value="Business">Business</option>
  `;
  type.appendChild(tSpan); type.appendChild(select);

  const startBal = makeField({label:'Starting balance', inputId:'newBalance', inputType:'number', placeholder:'e.g. 500'});

  const container = document.createElement('div');
  container.className='twoCols';
  // Layout: holder + type then balance full width
  const leftCol = document.createElement('div');
  leftCol.appendChild(holder);
  const rightCol = document.createElement('div');
  rightCol.appendChild(type);
  const balWrap = document.createElement('div');
  balWrap.style.gridColumn='1 / -1';
  balWrap.appendChild(startBal);

  container.appendChild(leftCol);
  container.appendChild(rightCol);
  container.appendChild(balWrap);

  const footer = document.createElement('div');
  footer.innerHTML = `<button class="secondary" data-modal-cancel>Cancel</button><button class="primary" data-modal-submit>Create</button>`;

  footer.querySelector('[data-modal-cancel]').addEventListener('click', closeModal);
  footer.querySelector('[data-modal-submit]').addEventListener('click', ()=>{
    const h = document.getElementById('newHolder').value.trim();
    const tp = document.getElementById('newType').value;
    const b = Number(document.getElementById('newBalance').value || 0);
    if(!h){ toast('danger','Missing name','Enter account holder name.'); return; }
    if(!Number.isFinite(b) || b<0){ toast('danger','Invalid balance','Starting balance must be >= 0.'); return; }

    const next = 1000 + state.accounts.length + 1;
    const acc = { id: `AC-${next}`, holder: h, type: tp, balance: b, createdAt: iso(now()) };
    state.accounts.unshift(acc);

    // Add a deposit txn if starting balance > 0
    if(b>0){
      const tx = { id: uid('TX'), type:'deposit', amount:b, fromAccountId:null, toAccountId:acc.id, note:'Opening balance', createdAt: iso(now()) };
      state.txns.unshift(tx);
    }

    closeModal();
    toast('success','Account created',`${acc.holder} · ${acc.id}`);
    refreshAll();
  });

  openModal({
    title: 'Create account',
    subtitle: 'Creates a new mock account with optional opening balance.',
    bodyEl: container,
    footerEl: footer
  });
}

function openQuickDeposit(){
  // Reuse modal for depositing into first account
  const defaultAcc = state.accounts[0];
  if(!defaultAcc){ toast('warning','No accounts','Create an account first.'); return; }
  openDepositWithdraw({mode:'deposit', defaultAccountId: defaultAcc.id});
}

function openDepositWithdraw({mode=null, defaultAccountId=null}={}){
  const wrapper = document.createElement('div');
  wrapper.className='twoCols';

  const accSelectWrap = document.createElement('label');
  accSelectWrap.className='field';
  const aSpan = document.createElement('span');
  aSpan.textContent='Account';
  const select = document.createElement('select');
  select.id='dwAccount';
  select.innerHTML = state.accounts.map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(a.holder)} · ${escapeHtml(a.id)}</option>`).join('');
  accSelectWrap.appendChild(aSpan);
  accSelectWrap.appendChild(select);

  const typeWrap = document.createElement('label');
  typeWrap.className='field';
  const tSpan = document.createElement('span');
  tSpan.textContent='Operation';
  const opSel = document.createElement('select');
  opSel.id='dwType';
  opSel.innerHTML = `
    <option value="deposit">Deposit</option>
    <option value="withdrawal">Withdrawal</option>
  `;
  typeWrap.appendChild(tSpan);
  typeWrap.appendChild(opSel);

  const amountWrap = document.createElement('label');
  amountWrap.className='field';
  const amSpan = document.createElement('span');
  amSpan.textContent='Amount';
  const amt = document.createElement('input');
  amt.id='dwAmount';
  amt.type='number';
  amt.min='1';
  amt.step='1';
  amt.placeholder='e.g. 250';
  amountWrap.appendChild(amSpan);
  amountWrap.appendChild(amt);

  const noteWrap = document.createElement('label');
  noteWrap.className='field';
  const nSpan = document.createElement('span');
  nSpan.textContent='Note';
  const note = document.createElement('input');
  note.id='dwNote';
  note.type='text';
  note.placeholder='optional';
  noteWrap.appendChild(nSpan);
  noteWrap.appendChild(note);

  // Arrange
  wrapper.appendChild(accSelectWrap);
  wrapper.appendChild(typeWrap);
  const full1 = document.createElement('div'); full1.style.gridColumn='1 / -1'; full1.appendChild(amountWrap);
  const full2 = document.createElement('div'); full2.style.gridColumn='1 / -1'; full2.appendChild(noteWrap);
  wrapper.appendChild(full1);
  wrapper.appendChild(full2);

  if(defaultAccountId) select.value = defaultAccountId;
  if(mode) opSel.value = mode;

  const footer = document.createElement('div');
  footer.innerHTML = `<button class="secondary" data-modal-cancel>Cancel</button><button class="primary" data-modal-submit>Apply</button>`;
  footer.querySelector('[data-modal-cancel]').addEventListener('click', closeModal);
  footer.querySelector('[data-modal-submit]').addEventListener('click', ()=>{
    const accountId = select.value;
    const op = opSel.value;
    const amount = Number(amt.value || 0);
    const noteText = note.value.trim();

    if(amount <= 0 || !Number.isFinite(amount)){
      toast('danger','Invalid amount','Enter a valid amount >= 1.');
      return;
    }

    const tx = {
      id: uid('TX'),
      type: op,
      amount,
      fromAccountId: op==='withdrawal' ? accountId : null,
      toAccountId: op==='deposit' ? accountId : null,
      note: noteText || undefined,
      createdAt: iso(now())
    };

    try{
      applyTxnToBalances(tx);
      state.txns.unshift(tx);
      closeModal();
      toast('success','Operation applied',`${op==='deposit'?'Deposited':'Withdrew'} ${fmtMoney(amount)}.`);
      refreshAll();
    } catch(e){
      toast('danger','Operation failed',String(e.message||e));
    }
  });

  openModal({
    title: mode ? (mode==='deposit'?'Deposit':'Withdrawal') : 'Deposit / Withdrawal',
    subtitle: 'Updates balances and adds a transaction to history.',
    bodyEl: wrapper,
    footerEl: footer
  });
}

function openTransfer(){
  setScreen('transfer');
  // Ensure preview and selects
  renderTransferForm();
}

function submitTransfer(){
  els.transferError.hidden = true;
  const fromId = els.fromAccount.value;
  const toId = els.toAccount.value;
  const amount = Number(els.transferAmount.value || 0);
  const note = els.transferNote.value.trim();

  if(fromId === toId){
    els.transferError.hidden=false;
    els.transferError.textContent = 'From and To accounts must be different.';
    return;
  }
  if(amount <= 0 || !Number.isFinite(amount)){
    els.transferError.hidden=false;
    els.transferError.textContent = 'Enter a valid transfer amount (>= 1).';
    return;
  }

  const tx = {
    id: uid('TX'),
    type:'transfer',
    amount,
    fromAccountId: fromId,
    toAccountId: toId,
    note: note || undefined,
    createdAt: iso(now())
  };

  try{
    applyTxnToBalances(tx);
    state.txns.unshift(tx);
    toast('success','Transfer completed',`Transferred ${fmtMoney(amount)}.`);

    // Clear inputs lightly
    els.transferAmount.value='';
    els.transferNote.value='';
    updateTransferPreview();
    refreshAll();
    renderTransactions();
  } catch(e){
    els.transferError.hidden=false;
    els.transferError.textContent = String(e.message||e);
  }
}

function resetData(){
  seedData();
  toast('warning','Data reset','Mock accounts and transactions have been restored to defaults.');
  refreshAll();
}

function toggleReduceMotion(){
  state.reduceMotion = !state.reduceMotion;
  document.body.classList.toggle('reduce-motion', state.reduceMotion);
  toast('info','Motion mode', state.reduceMotion ? 'Reduced motion enabled.' : 'Animations restored.');
}

function refreshAll(){
  renderStats();
  renderActivity();
  renderAccounts();
  renderTransactions();
  renderTransferForm();
}

function wireEvents(){
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-action]');
    if(!btn) return;

    const action = btn.getAttribute('data-action');
    const accountId = btn.getAttribute('data-account-id');

    if(action==='openCreateAccount') return openCreateAccount();
    if(action==='openQuickDeposit') return openQuickDeposit();
    if(action==='jumpTransactions') return setScreen('transactions');
    if(action==='openDepositWithdraw') return openDepositWithdraw();
    if(action==='openTransfer') return openTransfer();
    if(action==='resetData') return resetData();
    if(action==='toggleReduceMotion') return toggleReduceMotion();
    if(action==='closeModal') return closeModal();

    if(action==='accountDeposit') return openDepositWithdraw({mode:'deposit', defaultAccountId: accountId});
    if(action==='accountWithdraw') return openDepositWithdraw({mode:'withdrawal', defaultAccountId: accountId});
    if(action==='submitTransfer') return submitTransfer();
  });

  els.modalOverlay.addEventListener('click', (e)=>{
    if(e.target === els.modalOverlay) closeModal();
  });

  els.txSearch.addEventListener('input', ()=>{ if(!document.getElementById('screen-transactions').classList.contains('hidden')) renderTransactions(); });
  els.txType.addEventListener('change', ()=>{ if(!document.getElementById('screen-transactions').classList.contains('hidden')) renderTransactions(); });
  els.txSort.addEventListener('change', ()=>{ if(!document.getElementById('screen-transactions').classList.contains('hidden')) renderTransactions(); });

  ['fromAccount','toAccount','transferAmount','transferNote'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', ()=>{
      if(id==='transferAmount' || id==='fromAccount' || id==='toAccount') updateTransferPreview();
    });
    el.addEventListener('change', ()=>{
      if(id==='transferAmount' || id==='fromAccount' || id==='toAccount') updateTransferPreview();
    });
  });
}

function init(){
  seedData();
  renderNav();
  wireEvents();

  // default motion
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    state.reduceMotion = true;
    document.body.classList.add('reduce-motion');
  }

  // initial screen
  setScreen('dashboard');
  refreshAll();

  updateTransferPreview();
}

init();

