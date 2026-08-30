document.addEventListener("DOMContentLoaded", () => {
  const monthInput = document.getElementById("planMonth");
  const now = new Date();
  monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  monthInput.addEventListener("change", loadPlans);
  loadPlans();
});

async function loadPlans() {
  hideAlert();
  const monthValue = document.getElementById("planMonth").value; // "YYYY-MM"
  const monthDate = `${monthValue}-01`;
  try {
    const plans = await Api.listPlans(monthDate);
    renderPlans(plans, monthDate);
  } catch (err) {
    showAlert(err.message);
  }
}

function renderPlans(plans, monthDate) {
  const container = document.getElementById("plansContainer");
  container.innerHTML = "";

  plans.forEach((plan) => {
    const spent = Number(plan.spent);
    const limit = Number(plan.limit_amount);
    const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
    let barClass = "bg-success";
    if (limit > 0) {
      if (spent / limit > 1) barClass = "bg-danger";
      else if (spent / limit >= 0.8) barClass = "bg-warning";
    }

    const col = document.createElement("div");
    col.className = "col-md-6 col-lg-4";
    col.innerHTML = `
      <div class="card p-3 h-100">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h2 class="h6 mb-0">${plan.category}</h2>
          <span class="text-muted small">${limit > 0 ? formatMoney(spent) + " / " + formatMoney(limit) : formatMoney(spent) + " потрачено"}</span>
        </div>
        <div class="progress mb-3">
          <div class="progress-bar ${barClass}" style="width: ${pct}%"></div>
        </div>
        <div class="input-group input-group-sm mt-auto">
          <input type="number" min="0" step="0.01" class="form-control plan-limit-input" placeholder="Лимит на месяц" value="${limit > 0 ? limit : ""}">
          <button class="btn btn-brand save-plan-btn">Сохранить</button>
        </div>
      </div>
    `;
    const saveBtn = col.querySelector(".save-plan-btn");
    const input = col.querySelector(".plan-limit-input");
    saveBtn.addEventListener("click", () => savePlan(plan.category, monthDate, input.value));
    container.appendChild(col);
  });
}

async function savePlan(category, monthDate, limitValue) {
  hideAlert();
  const limit_amount = parseFloat(limitValue);
  if (!limit_amount || limit_amount <= 0) {
    showAlert("Укажите положительное число для лимита");
    return;
  }
  try {
    await Api.savePlan({ category, month: monthDate, limit_amount });
    await loadPlans();
  } catch (err) {
    showAlert(err.message);
  }
}

function showAlert(message) {
  const box = document.getElementById("alertBox");
  box.textContent = message;
  box.classList.remove("d-none");
}
function hideAlert() {
  document.getElementById("alertBox").classList.add("d-none");
}
