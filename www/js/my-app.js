const app = new Framework7({ el: '#app', name: 'Minhas compras', id: 'br.com.compras' });

const STORAGE_KEY = 'compras-lista-v1';
const defaultData = {
  sectors: ['Todos', 'Alimentos', 'Limpeza', 'Banheiro'],
  items: [
    { id: 1, name: 'Arroz', sector: 'Alimentos', qty: 5, price: 2.3 },
    { id: 2, name: 'Feijão Carioca', sector: 'Alimentos', qty: 2, price: 7.49 },
    { id: 3, name: 'Detergente', sector: 'Limpeza', qty: 3, price: 2.5 },
    { id: 4, name: 'Sabonete', sector: 'Banheiro', qty: 4, price: 3.2 },
  ],
};

function capitalizeProductName(text) {
  if (!text) return '';
  return String(text)
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      if (!word) return '';
      if (word.includes('-')) {
        return word.split('-').map((part) => {
          if (!part) return '';
          return part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1).toLocaleLowerCase('pt-BR');
        }).join('-');
      }
      return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1).toLocaleLowerCase('pt-BR');
    })
    .join(' ');
}

function numberValue(value) {
  const normalized = String(value ?? '').trim().replace(/\s/g, '').replace(/\.(?=.*[,])/g, '').replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
function stripEmojis(value) {
  return String(value ?? '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{E0020}-\u{E007F}\u{FE0F}\u{200D}\u{20E3}\u00A9\u00AE\u203C\u2049\u2122\u2139\u3030\u303D\u3297\u3299]/gu, '');
}
function sanitizeTextInput(input) {
  const cursor = input.selectionStart ?? input.value.length;
  const cleanValue = stripEmojis(input.value);
  if (cleanValue !== input.value) {
    input.value = cleanValue;
    input.setSelectionRange(Math.min(cursor, cleanValue.length), Math.min(cursor, cleanValue.length));
  }
  return cleanValue;
}
function sanitizeQuantityInput(input) {
  const cursor = input.selectionStart ?? input.value.length;
  let cleanValue = stripEmojis(input.value).replace(/[^\d.,]/g, '');
  const separator = cleanValue.search(/[.,]/);
  if (separator >= 0) cleanValue = cleanValue.slice(0, separator + 1) + cleanValue.slice(separator + 1).replace(/[.,]/g, '');
  if (cleanValue !== input.value) {
    input.value = cleanValue;
    input.setSelectionRange(Math.min(cursor, cleanValue.length), Math.min(cursor, cleanValue.length));
  }
  return cleanValue;
}
function formatCurrencyInput(input) {
  const digits = stripEmojis(input.value).replace(/\D/g, '');
  const cents = Math.min(Number(digits) || 0, 999999999999);
  input.value = digits ? (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  return cents / 100;
}
function currencyValue(value) {
  const digits = stripEmojis(value).replace(/\D/g, '');
  return digits ? Math.min(Number(digits), 999999999999) / 100 : 0;
}
function isComplete(item) {
  return Boolean(item && String(item.name || '').trim() && String(item.sector || '').trim() && numberValue(item.qty) > 0 && numberValue(item.price) > 0);
}

let data;
try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData; } catch { data = defaultData; }
if (!Array.isArray(data.sectors)) data.sectors = defaultData.sectors;
if (!Array.isArray(data.items)) data.items = [];

// Garantir que os 3 setores principais do usuário ('Alimentos', 'Limpeza', 'Banheiro') estejam na lista
const coreSectors = ['Alimentos', 'Limpeza', 'Banheiro'];
coreSectors.forEach((sec) => {
  if (!data.sectors.some((s) => s.toLocaleLowerCase('pt-BR') === sec.toLocaleLowerCase('pt-BR'))) {
    data.sectors.push(sec);
  }
});

// Migrar setores legados ('Mercearia', 'Hortifruti', 'Açougue', 'Laticínios') para 'Alimentos' caso existam
const legacyToAlimentos = ['mercearia', 'hortifruti', 'açougue', 'acougue', 'laticínios', 'laticinios'];
data.items.forEach((item) => {
  if (item && item.sector && legacyToAlimentos.includes(String(item.sector).toLowerCase())) {
    item.sector = 'Alimentos';
  }
});
// Limpar setores antigos vazios que possam ter sobrado
data.sectors = data.sectors.filter((sector) => {
  if (['Todos', 'Alimentos', 'Limpeza', 'Banheiro'].includes(sector)) return true;
  return data.items.some((item) => item.sector === sector);
});

const dataBeforeCleanup = JSON.stringify({ sectors: data.sectors, items: data.items });
data.sectors = data.sectors.map((sector) => capitalizeProductName(stripEmojis(sector))).filter(Boolean);
data.items = data.items.map((item) => ({
  ...item,
  name: capitalizeProductName(stripEmojis(item.name)),
  inCart: item.inCart === true
})).filter(isComplete);
const needsCleanup = JSON.stringify({ sectors: data.sectors, items: data.items }) !== dataBeforeCleanup;
let activeSector = 'Todos';
let pendingSector = '';
let nextId = Math.max(0, ...data.items.map((item) => Number(item.id) || 0)) + 1;
const money = (value) => (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const save = () => {
  data.items = data.items.filter(isComplete);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};
const totalFor = (item) => (Number(item.qty) || 0) * (Number(item.price) || 0);
const cartHasItems = () => data.items.some((item) => item.inCart);

function render() {
  const tabs = document.querySelector('#sector-tabs');
  tabs.innerHTML = data.sectors.map((sector) => `<button class="sector-tab ${sector === activeSector ? 'active' : ''}" role="tab" aria-selected="${sector === activeSector}" data-sector="${escapeHtml(sector)}">${escapeHtml(sector.toLocaleUpperCase('pt-BR'))}</button>`).join('');

  const filtered = data.items.filter((item) => activeSector === 'Todos' || item.sector === activeSector);
  const grouped = data.sectors.slice(1).filter((sector) => activeSector === 'Todos' || sector === activeSector).map((sector) => ({ sector, items: filtered.filter((item) => item.sector === sector) })).filter((group) => group.items.length);
  document.querySelector('#shopping-list').innerHTML = grouped.map(({ sector, items }) => `
    <article class="sector-block">
      <div class="sector-title-row"><div class="sector-title"><span class="sector-dot"></span>${escapeHtml(sector)}</div><span class="sector-count">${items.length} ${items.length === 1 ? 'ITEM' : 'ITENS'}</span></div>
      ${items.map((item) => `
        <div class="product-row" data-item="${item.id}">
          <div class="product-name-line"><input class="product-name" type="text" autocomplete="off" aria-label="Nome do produto" placeholder="Nome do produto" value="${escapeHtml(item.name)}" data-field="name"><button class="cart-toggle ${item.inCart ? 'in-cart' : ''}" type="button" aria-label="${item.inCart ? 'Retirar' : 'Colocar'} ${escapeHtml(item.name)} ${item.inCart ? 'do' : 'no'} carrinho" title="${item.inCart ? 'Retirar do carrinho' : 'Colocar no carrinho'}" data-cart-toggle="${item.id}"></button><button class="delete-item" type="button" aria-label="Remover ${escapeHtml(item.name)}" title="Remover item" data-delete="${item.id}">×</button></div>
          <div class="field-labels"><span>QUANTIDADE</span><span>VALOR UNITÁRIO</span><span>SUBTOTAL</span></div>
          <div class="product-fields"><input class="qty-input" type="text" inputmode="decimal" aria-label="Quantidade" value="${item.qty}" placeholder="0" data-field="qty"><input type="text" inputmode="decimal" aria-label="Valor unitário em reais" value="${Number(item.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}" data-field="price"><strong class="product-subtotal">${money(totalFor(item))}</strong></div>
        </div>`).join('')}
    </article>`).join('');
  document.querySelector('#empty-state').hidden = grouped.length > 0;
  document.querySelector('#shopping-list').hidden = grouped.length === 0;
  const count = data.items.length;
  document.querySelector('#item-count').textContent = `${count} ${count === 1 ? 'item' : 'itens'}`;
  document.querySelector('#grand-total').textContent = money(data.items.reduce((sum, item) => sum + totalFor(item), 0));
  const clearCart = document.querySelector('#clear-cart');
  clearCart.classList.toggle('has-items', cartHasItems());
  clearCart.setAttribute('aria-label', cartHasItems() ? 'Esvaziar carrinho' : 'Carrinho vazio');
  clearCart.title = cartHasItems() ? 'Esvaziar carrinho' : 'Carrinho vazio';
}

function normalizeName(name) {
  return String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function focusField(field) {
  if (!field) return;
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  field.focus();
  if (field.dataset.field === 'qty') field.select();
}

function openAddItem() {
  pendingSector = activeSector === 'Todos' ? data.sectors[1] : activeSector;
  if (!pendingSector) return app.dialog.alert('Adicione um setor antes de incluir produtos.');
  document.querySelector('#product-form').reset();
  document.querySelector('#modal-sector').textContent = `Setor: ${pendingSector}`;
  document.querySelector('#product-form-error').textContent = '';
  document.querySelector('#product-modal').hidden = false;
  window.setTimeout(() => document.querySelector('#new-product-name').focus(), 80);
}

function closeAddItem() {
  document.querySelector('#product-modal').hidden = true;
}

function renderSectorManager() {
  const sectors = data.sectors.filter((sector) => sector !== 'Todos');
  const list = document.querySelector('#sector-manager-list');
  list.innerHTML = sectors.length ? sectors.map((sector) => {
    const count = data.items.filter((item) => item.sector === sector).length;
    return `<div class="sector-manager-row"><div class="sector-manager-copy"><strong>${escapeHtml(sector)}</strong></div><button class="sector-delete-button" type="button" data-delete-sector="${escapeHtml(sector)}" ${count ? 'disabled title="Este setor tem produtos"' : `aria-label="Excluir setor ${escapeHtml(sector)}"`}>${count ? 'Em uso' : 'Excluir'}</button></div>`;
  }).join('') : '<p class="sector-manager-empty">Nenhum setor para gerenciar.</p>';
}

function openSectorManager() {
  renderSectorManager();
  document.querySelector('#sector-modal').hidden = false;
}

function confirmRemoveSector(sector) {
  if (sector === 'Todos') return;
  const count = data.items.filter((item) => item.sector === sector).length;
  if (count) return app.dialog.alert('Este setor tem produtos e não pode ser excluído.');
  const dialog = app.dialog.create({
    title: 'Excluir setor?',
    text: `Deseja excluir o setor <strong>${escapeHtml(sector)}</strong>?`,
    buttons: [
      { text: 'Cancelar' },
      { text: 'Excluir', color: 'red', bold: true, onClick: () => {
        data.sectors = data.sectors.filter((entry) => entry !== sector);
        if (activeSector === sector) activeSector = 'Todos';
        save(); render(); renderSectorManager();
      } },
    ],
  });
  dialog.open();
}

function confirmRemoveItem(item) {
  const dialog = app.dialog.create({
    title: 'Remover produto?',
    text: `Deseja remover <strong>${escapeHtml(item.name)}</strong> da lista?`,
    buttons: [
      { text: 'Cancelar' },
      { text: 'Remover', color: 'red', bold: true, onClick: () => {
        data.items = data.items.filter((entry) => entry.id !== item.id);
        save(); render();
      } },
    ],
  });
  dialog.open();
}

function focusQuantity(itemId) {
  window.setTimeout(() => focusField(document.querySelector(`[data-item="${itemId}"] [data-field="qty"]`)), 180);
}

function confirmExistingDuplicate(item, existing, input) {
  const previousName = input.dataset.previousName ?? '';
  const cursorPosition = input.selectionStart ?? input.value.length;
  const dialog = app.dialog.create({
    title: 'Produto já está na lista',
    text: `Já existe <strong>${escapeHtml(existing.name)}</strong>. Deseja editar a quantidade desse produto?`,
    buttons: [
      { text: 'Não', onClick: () => {
        item.name = previousName;
        input.value = previousName;
        save();
        window.setTimeout(() => {
          input.focus();
          const position = Math.min(cursorPosition, input.value.length);
          input.setSelectionRange(position, position);
        }, 180);
      } },
      { text: 'Sim, editar quantidade', bold: true, onClick: () => {
        data.items = data.items.filter((entry) => entry.id !== item.id);
        activeSector = existing.sector;
        save(); render(); focusQuantity(existing.id);
      } },
    ],
  });
  dialog.open();
}

function confirmNewDuplicate(existing) {
  const nameInput = document.querySelector('#new-product-name');
  const dialog = app.dialog.create({
    title: 'Produto já está na lista',
    text: `Já existe <strong>${escapeHtml(existing.name)}</strong>. Deseja editar a quantidade desse produto?`,
    buttons: [
      { text: 'Não', onClick: () => window.setTimeout(() => nameInput.focus(), 180) },
      { text: 'Sim, editar quantidade', bold: true, onClick: () => {
        closeAddItem();
        activeSector = existing.sector;
        render(); focusQuantity(existing.id);
      } },
    ],
  });
  dialog.open();
}

function submitNewItem(event) {
  event.preventDefault();
  const nameInput = document.querySelector('#new-product-name');
  const qtyInput = document.querySelector('#new-product-qty');
  const priceInput = document.querySelector('#new-product-price');
  const rawName = nameInput.value.trim();
  const qty = numberValue(qtyInput.value);
  const price = currencyValue(priceInput.value);
  const error = document.querySelector('#product-form-error');
  if (!rawName || !qty || !price) {
    error.textContent = 'Preencha o nome, a quantidade e o valor unitário.';
    if (!rawName) nameInput.focus();
    else if (!qty) qtyInput.focus();
    else priceInput.focus();
    return;
  }
  const formattedName = capitalizeProductName(rawName);
  const duplicate = data.items.find((item) => normalizeName(item.name) === normalizeName(formattedName));
  if (duplicate) return confirmNewDuplicate(duplicate);

  const newItemId = nextId++;
  // Novos itens vão para o início (topo) da lista para fácil acesso ao botão
  data.items.unshift({ id: newItemId, name: formattedName, sector: pendingSector, qty, price, inCart: false });
  activeSector = pendingSector;
  save(); closeAddItem(); render();

  window.setTimeout(() => {
    const el = document.querySelector(`[data-item="${newItemId}"]`);
    if (el) {
      el.classList.add('newly-added');
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      window.setTimeout(() => el.classList.remove('newly-added'), 1400);
    }
  }, 80);
}

document.querySelector('#sector-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-sector]');
  if (!tab) return;
  activeSector = tab.dataset.sector; render();
});

document.querySelector('#add-item').addEventListener('click', openAddItem);
document.querySelector('#manage-sectors').addEventListener('click', openSectorManager);
document.querySelector('#sector-manager-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-sector]');
  if (button && !button.disabled) confirmRemoveSector(button.dataset.deleteSector);
});
document.querySelectorAll('[data-close-sectors]').forEach((button) => button.addEventListener('click', () => {
  document.querySelector('#sector-modal').hidden = true;
}));
document.querySelector('#empty-add-item').addEventListener('click', openAddItem);
document.querySelector('#product-form').addEventListener('submit', submitNewItem);
document.querySelector('#new-product-name').addEventListener('input', (event) => sanitizeTextInput(event.target));
document.querySelector('#new-product-name').addEventListener('blur', (event) => {
  const formatted = capitalizeProductName(event.target.value);
  if (formatted) event.target.value = formatted;
});
document.querySelector('#new-product-qty').addEventListener('input', (event) => sanitizeQuantityInput(event.target));
document.querySelector('#new-product-price').addEventListener('input', (event) => formatCurrencyInput(event.target));
document.querySelectorAll('[data-close-product]').forEach((button) => button.addEventListener('click', closeAddItem));
document.querySelector('#add-sector').addEventListener('click', () => {
  app.dialog.prompt('Qual é o nome do novo setor?', 'Adicionar setor', (name) => {
    const sector = capitalizeProductName(stripEmojis(name));
    if (!sector) return;
    if (data.sectors.some((entry) => entry.toLocaleLowerCase('pt-BR') === sector.toLocaleLowerCase('pt-BR'))) {
      app.dialog.alert('Esse setor já existe.'); return;
    }
    data.sectors.push(sector); activeSector = sector; save(); render();
  });
});

document.querySelector('#shopping-list').addEventListener('input', (event) => {
  const field = event.target.dataset.field;
  if (!field) return;
  const row = event.target.closest('[data-item]');
  const item = data.items.find((entry) => entry.id === Number(row.dataset.item));
  if (!item) return;
  if (field === 'name') {
    item.name = sanitizeTextInput(event.target).trim();
    row.querySelector('.delete-item').setAttribute('aria-label', `Remover ${item.name || 'produto'}`);
    row.querySelector('.cart-toggle').setAttribute('aria-label', `${item.inCart ? 'Retirar' : 'Colocar'} ${item.name || 'produto'} ${item.inCart ? 'do' : 'no'} carrinho`);
  }
  if (field === 'qty') item.qty = numberValue(sanitizeQuantityInput(event.target));
  if (field === 'price') item.price = formatCurrencyInput(event.target);
  row.querySelector('.product-subtotal').textContent = money(totalFor(item));
  document.querySelector('#grand-total').textContent = money(data.items.reduce((sum, entry) => sum + totalFor(entry), 0));
});

document.querySelector('#shopping-list').addEventListener('focusin', (event) => {
  const field = event.target.dataset.field;
  if (!field) return;
  const row = event.target.closest('[data-item]');
  const item = data.items.find((entry) => entry.id === Number(row.dataset.item));
  if (!item) return;
  if (field === 'name') event.target.dataset.previousName = item.name || '';
  else {
    if (field === 'price') event.target.select();
    event.target.dataset.previousValue = event.target.value;
  }
});

document.querySelector('#shopping-list').addEventListener('change', (event) => {
  const field = event.target.dataset.field;
  if (!field) return;
  const input = event.target;
  const row = input.closest('[data-item]');
  const item = data.items.find((entry) => entry.id === Number(row.dataset.item));
  if (!item) return;
  if (field === 'name') {
    const formatted = capitalizeProductName(item.name);
    item.name = formatted;
    input.value = formatted;
    const name = normalizeName(item.name);
    if (!name) {
      item.name = input.dataset.previousName || '';
      input.value = item.name;
      save();
      return;
    }
    const existing = data.items.find((entry) => entry.id !== item.id && normalizeName(entry.name) === name);
    if (existing) return confirmExistingDuplicate(item, existing, input);
  } else {
    const value = field === 'price' ? currencyValue(input.value) : numberValue(input.value);
    if (!value) {
      input.value = input.dataset.previousValue || '';
      if (field === 'qty') item.qty = numberValue(input.value);
      if (field === 'price') item.price = currencyValue(input.value);
      row.querySelector('.product-subtotal').textContent = money(totalFor(item));
      document.querySelector('#grand-total').textContent = money(data.items.reduce((sum, entry) => sum + totalFor(entry), 0));
      return;
    }
    if (field === 'qty') item.qty = value;
    if (field === 'price') item.price = value;
    input.dataset.previousValue = input.value;
  }
  save();
});

document.querySelector('#shopping-list').addEventListener('click', (event) => {
  const cartButton = event.target.closest('[data-cart-toggle]');
  if (cartButton) {
    const item = data.items.find((entry) => entry.id === Number(cartButton.dataset.cartToggle));
    if (!item) return;
    item.inCart = !item.inCart;
    save();
    render();
    return;
  }
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  const item = data.items.find((entry) => entry.id === Number(button.dataset.delete));
  if (item) confirmRemoveItem(item);
});

document.querySelector('#clear-cart').addEventListener('click', () => {
  if (!cartHasItems()) return;
  data.items.forEach((item) => { item.inCart = false; });
  save();
  render();
});

if (needsCleanup) save();
render();
