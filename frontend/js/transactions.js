let CATEGORIES = { income: [], expense: [] };
let deleteTargetId = null;
const txModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById("txModal"));
const deleteModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById("deleteModal"));

document.addEventListener("DOMContentLoaded", async () => {
  await loadCategories();
  bindFilterEvents();
  bindFormEvents();
  await loadTransactions();
});

async function loadCategories() {
  try {
    CATEGORIES = await Api.getCategories();
    const filterCat = document.getElementById("filterCategory");
    [...CATEGORIES.income, ...CATEGORIES.expense].forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      filterCat.appendChild(opt);
    });
    populateCategorySelect(document.getElementById("txType").value);
  } catch (err) {
    showAlert(err.message);
  }
}

function populateCategorySelect(type) {
  const select = document.getElementById("txCategory");
  select.innerHTML = "";
  CATEGORIES[type].forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });

  // ===== ПОКАЗЫВАЕМ/СКРЫВАЕМ ЧЕКБОКС =====
  const wrapper = document.getElementById("excludeCheckboxWrapper");
  const checkbox = document.getElementById("txExcludeFromIncome");
  if (type === "income") {
    wrapper.style.display = "block";
    checkbox.checked = false;
  } else {
    wrapper.style.display = "none";
    checkbox.checked = false;
  }
}

function bindFilterEvents() {
  document.getElementById("txType").addEventListener("change", (e) => {
    populateCategorySelect(e.target.value);
  });

  const periodSelect = document.getElementById("filterPeriod");
  const customRangeEls = document.querySelectorAll(".custom-range");
  periodSelect.addEventListener("change", () => {
    const isCustom = periodSelect.value === "custom";
    customRangeEls.forEach((el) => el.classList.toggle("d-none", !isCustom));
  });

  document.getElementById("btnFilter").addEventListener("click", loadTransactions);

  document.getElementById("btnAddTx").addEventListener("click", () => {
    document.getElementById("txModalTitle").textContent = "Новая операция";
    document.getElementById("txForm").reset();
    document.getElementById("txId").value = "";
    document.getElementById("txDate").value = todayISO();
    populateCategorySelect(document.getElementById("txType").value);
  });
}

function computePeriodRange() {
  const period = document.getElementById("filterPeriod").value;
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);

  if (period === "today") {
    return { start_date: iso(today), end_date: iso(today) };
  }
  if (period === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { start_date: iso(start), end_date: iso(today) };
  }
  if (period === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start_date: iso(start), end_date: iso(today) };
  }
  if (period === "custom") {
    return {
      start_date: document.getElementById("filterStart").value || undefined,
      end_date: document.getElementById("filterEnd").value || undefined,
    };
  }
  return {};
}

async function loadTransactions() {
  hideAlert();
  const params = {
    type: document.getElementById("filterType").value || undefined,
    category: document.getElementById("filterCategory").value || undefined,
    ...computePeriodRange(),
  };
  try {
    const items = await Api.listTransactions(params);
    renderTable(items);
  } catch (err) {
    showAlert(err.message);
  }
}

function renderTable(items) {
  const body = document.getElementById("txBody");
  const empty = document.getElementById("txEmpty");
  body.innerHTML = "";

  if (!items.length) {
    empty.classList.remove("d-none");
    return;
  }
  empty.classList.add("d-none");

  items.forEach((tx) => {
    const tr = document.createElement("tr");
    const badgeClass = tx.type === "income" ? "badge-income" : "badge-expense";
    const label = tx.type === "income" ? "Доход" : "Расход";
    const sign = tx.type === "income" ? "+" : "−";
    const dateFormatted = formatDate(tx.date);
    const amountClass = tx.type === "income" ? "text-success" : "text-danger";
    const hasComment = tx.comment && tx.comment.trim() !== "";

    tr.innerHTML = `
      <!-- ДЕСКТОПНАЯ ВЕРСИЯ -->
      <td class="desktop-only">${dateFormatted}</td>
      <td class="desktop-only"><span class="badge ${badgeClass}">${label}</span></td>
      <td class="desktop-only">${tx.category}</td>
      <td class="desktop-only text-end ${amountClass}">${sign} ${formatMoney(tx.amount)}</td>
      <td class="desktop-only text-muted">${tx.comment || "—"}</td>
      <td class="desktop-only text-end">
        <button class="btn btn-sm btn-outline-secondary me-1 edit-btn" data-id="${tx.id}">✏️</button>
        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${tx.id}">🗑️</button>
      </td>

      <!-- МОБИЛЬНАЯ ВЕРСИЯ (без лишней карточки) -->
      <td class="mobile-only" colspan="6">
        <div class="mobile-row mobile-row-header">
          <span class="mobile-date">${dateFormatted}</span>
          <span class="badge ${badgeClass}">${label}</span>
        </div>
        <div class="mobile-row mobile-row-main">
          <span class="mobile-category">${tx.category}</span>
          <span class="mobile-amount ${amountClass}">${sign} ${formatMoney(tx.amount)}</span>
        </div>
        ${hasComment ? `<div class="mobile-row mobile-row-comment">${tx.comment}</div>` : ""}
        <div class="mobile-row mobile-row-actions">
          <button class="btn btn-sm btn-outline-secondary edit-btn" data-id="${tx.id}">✏️ Редактировать</button>
          <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${tx.id}">🗑️ Удалить</button>
        </div>
      </td>
    `;

    body.appendChild(tr);
  });

  body.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      openEditModal(items.find((t) => t.id === Number(btn.dataset.id))),
    );
  });

  body.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      deleteTargetId = Number(btn.dataset.id);
      deleteModal().show();
    });
  });
}

function openEditModal(tx) {
  document.getElementById("txModalTitle").textContent = "Редактировать операцию";
  document.getElementById("txId").value = tx.id;
  document.getElementById("txType").value = tx.type;
  populateCategorySelect(tx.type);
  document.getElementById("txCategory").value = tx.category;
  document.getElementById("txAmount").value = tx.amount;
  document.getElementById("txDate").value = tx.date;
  document.getElementById("txComment").value = tx.comment || "";
  document.getElementById("txExcludeFromIncome").checked = tx.exclude_from_income || false;
  txModal().show();
}

function bindFormEvents() {
  document.getElementById("txForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();
    const id = document.getElementById("txId").value;
    const payload = {
      type: document.getElementById("txType").value,
      category: document.getElementById("txCategory").value,
      amount: parseFloat(document.getElementById("txAmount").value),
      date: document.getElementById("txDate").value,
      comment: document.getElementById("txComment").value || null,
      exclude_from_income: document.getElementById("txExcludeFromIncome").checked
    };
    try {
      if (id) {
        await Api.updateTransaction(id, payload);
      } else {
        await Api.createTransaction(payload);
      }
      txModal().hide();
      await loadTransactions();
    } catch (err) {
      showAlert(err.message);
    }
  });

  document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
    try {
      await Api.deleteTransaction(deleteTargetId);
      deleteModal().hide();
      await loadTransactions();
    } catch (err) {
      showAlert(err.message);
    }
  });
}

function showAlert(message) {
  const box = document.getElementById("alertBox");
  box.textContent = message;
  box.classList.remove("d-none");
}
function hideAlert() {
  document.getElementById("alertBox").classList.add("d-none");
}