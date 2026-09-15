document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await Api.getDashboard();

    document.getElementById("statBalance").textContent = formatMoney(
      data.balance,
    );
    document
      .getElementById("statBalance")
      .classList.add(data.balance >= 0 ? "positive" : "negative");
    document.getElementById("statIncome").textContent = formatMoney(
      data.month_income,
    );
    document.getElementById("statExpense").textContent = formatMoney(
      data.month_expense,
    );

    renderChart(data.daily_expenses);
    renderRecent(data.recent_transactions);
  } catch (err) {
    console.error(err);
  }
});

function renderChart(points) {
  const ctx = document.getElementById("dailyChart");

  if (!points || points.length === 0) {
    ctx.parentElement.innerHTML = `
      <div class="empty-state py-4">
        <p class="mb-0">📊 Нет данных о расходах за последние 10 дней.</p>
        <small class="text-muted">Добавьте расходы на странице «Операции».</small>
      </div>
    `;
    return;
  }

  const isMobile = window.innerWidth < 768;

  const labels = points.map((p) => {
    const d = new Date(p.date + "T00:00:00");
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  });
  const values = points.map((p) => Number(p.amount));

  if (window.dailyChartInstance) {
    window.dailyChartInstance.destroy();
  }

  window.dailyChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Расходы, ₽",
          data: values,
          borderColor: "#2563eb",
          backgroundColor: function (context) {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return "rgba(37, 99, 235, 0.2)";
            const gradient = ctx.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom,
            );
            gradient.addColorStop(0, "rgba(37, 99, 235, 0.35)");
            gradient.addColorStop(0.5, "rgba(37, 99, 235, 0.15)");
            gradient.addColorStop(1, "rgba(37, 99, 235, 0.02)");
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointBackgroundColor: values.map((v) => {
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            return v > avg * 1.5 ? "#dc2626" : "#2563eb";
          }),
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointRadius: isMobile ? 5 : 6,
          pointHoverRadius: isMobile ? 8 : 9,
          borderWidth: isMobile ? 2.5 : 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          titleColor: "#1f2937",
          bodyColor: "#1f2937",
          borderColor: "#e5e7eb",
          borderWidth: 1,
          cornerRadius: 8,
          padding: isMobile ? 10 : 12,
          callbacks: {
            label: function (context) {
              return `💰 ${formatMoney(context.parsed.y)}`;
            },
            title: function (tooltipItems) {
              const idx = tooltipItems[0].dataIndex;
              const date = points[idx].date;
              return new Date(date + "T00:00:00").toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
            },
          },
        },
        datalabels: {
          display: !isMobile, // на мобильных убираем подписи, чтобы не налезали
          color: "#4b5563",
          font: {
            size: isMobile ? 9 : 11,
            weight: "600",
          },
          anchor: "end",
          align: "top",
          offset: 2,
          formatter: function (value) {
            return Math.round(value) + " ₽";
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            maxRotation: isMobile ? 45 : 0,
            autoSkip: isMobile ? true : false,
            font: {
              size: isMobile ? 10 : 12,
              weight: isMobile ? "400" : "500",
            },
            color: "#6b7280",
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
            drawBorder: false,
          },
          ticks: {
            font: {
              size: isMobile ? 9 : 11,
            },
            color: "#6b7280",
            callback: function (value) {
              if (value >= 1000) return (value / 1000).toFixed(0) + "k";
              return value;
            },
          },
        },
      },
      interaction: {
        intersect: false,
        mode: "index",
      },
    },
    plugins: isMobile ? [] : [ChartDataLabels], // на мобильных отключаем плагин подписей
  });
}

function renderRecent(transactions) {
  const body = document.getElementById("recentBody");
  const empty = document.getElementById("recentEmpty");
  body.innerHTML = "";

  if (!transactions.length) {
    empty.classList.remove("d-none");
    return;
  }
  empty.classList.add("d-none");

  transactions.forEach((tx) => {
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
      <td class="desktop-only text-muted">${tx.comment || ""}</td>

      <!-- МОБИЛЬНАЯ ВЕРСИЯ -->
      <td class="mobile-only" colspan="5">
        <div class="mobile-card">
          <div class="mobile-row mobile-row-header">
            <span class="mobile-date">${dateFormatted}</span>
            <span class="badge ${badgeClass}">${label}</span>
          </div>
          <div class="mobile-row mobile-row-main">
            <span class="mobile-category">${tx.category}</span>
            <span class="mobile-amount ${amountClass}">${sign} ${formatMoney(tx.amount)}</span>
          </div>
          ${hasComment ? `<div class="mobile-row mobile-row-comment">${tx.comment}</div>` : ""}
        </div>
      </td>
    `;

    body.appendChild(tr);
  });
}

document.getElementById("statInvestment").textContent = formatMoney(
  data.month_investment,
);