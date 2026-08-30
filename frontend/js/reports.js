document.addEventListener("DOMContentLoaded", async () => {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  document.getElementById("exportStart").value = iso(monthStart);
  document.getElementById("exportEnd").value = iso(today);

  try {
    const [monthTx, trendTx] = await Promise.all([
      Api.listTransactions({
        start_date: iso(monthStart),
        end_date: iso(today),
        type: "expense",
      }),
      Api.listTransactions({
        start_date: iso(thirtyDaysAgo),
        end_date: iso(today),
      }),
    ]);
    renderPie(monthTx);
    renderTrend(trendTx, thirtyDaysAgo, today);
  } catch (err) {
    console.error(err);
  }

  document.getElementById("doExportBtn").addEventListener("click", async () => {
    const start = document.getElementById("exportStart").value || undefined;
    const end = document.getElementById("exportEnd").value || undefined;
    const expensesOnly = document.getElementById("exportExpensesOnly").checked;
    try {
      await Api.exportReport({ start, end, expensesOnly });
      bootstrap.Modal.getInstance(
        document.getElementById("exportModal"),
      ).hide();
    } catch (err) {
      alert(err.message);
    }
  });
});

function iso(d) {
  return d.toISOString().slice(0, 10);
}

function renderPie(monthTx) {
  const totals = {};
  monthTx.forEach((tx) => {
    totals[tx.category] = (totals[tx.category] || 0) + Number(tx.amount);
  });
  const labels = Object.keys(totals);
  const values = Object.values(totals);
  const totalSum = values.reduce((a, b) => a + b, 0);

  if (!labels.length) {
    document.getElementById("pieEmpty").classList.remove("d-none");
    if (window.pieChartInstance) {
      window.pieChartInstance.destroy();
    }
    return;
  }
  document.getElementById("pieEmpty").classList.add("d-none");

  const isMobile = window.innerWidth < 768;

  const palette = [
    "#2563eb",
    "#16a34a",
    "#f59e0b",
    "#dc2626",
    "#7c3aed",
    "#0891b2",
    "#db2777",
    "#65a30d",
    "#ea580c",
    "#4f46e5",
  ];

  if (window.pieChartInstance) {
    window.pieChartInstance.destroy();
  }

  const ctx = document.getElementById("categoryPie");

  window.pieChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, i) => palette[i % palette.length]),
          borderColor: "#ffffff",
          borderWidth: isMobile ? 2 : 3,
          hoverOffset: isMobile ? 8 : 12,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: isMobile ? "65%" : "55%",
      plugins: {
        legend: {
          position: isMobile ? "bottom" : "right",
          labels: {
            font: {
              size: isMobile ? 10 : 13,
              weight: isMobile ? "400" : "500",
            },
            padding: isMobile ? 6 : 14,
            usePointStyle: true,
            pointStyle: "circle",
            pointRadius: isMobile ? 4 : 6,
            generateLabels: function (chart) {
              const data = chart.data;
              const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
              return data.labels.map((label, i) => ({
                text: isMobile
                  ? `${label} (${((data.datasets[0].data[i] / total) * 100).toFixed(0)}%)`
                  : `${label} (${((data.datasets[0].data[i] / total) * 100).toFixed(1)}%)`,
                fillStyle: data.datasets[0].backgroundColor[i],
                strokeStyle: data.datasets[0].backgroundColor[i],
                pointStyle: "circle",
                index: i,
              }));
            },
          },
        },
        tooltip: {
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          titleColor: "#1f2937",
          bodyColor: "#1f2937",
          borderColor: "#e5e7eb",
          borderWidth: 1,
          cornerRadius: 10,
          padding: isMobile ? 10 : 14,
          callbacks: {
            label: function (context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage =
                total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
              return ` ${formatMoney(context.parsed)} (${percentage}%)`;
            },
            title: function (tooltipItems) {
              return tooltipItems[0].label;
            },
          },
        },
      },
      animation: {
        animateRotate: true,
        duration: 800,
      },
    },
    plugins: [
      {
        id: "centerText",
        beforeDraw: function (chart) {
          const { width, height, ctx } = chart;
          ctx.save();

          const centerX = width / 2 - (isMobile ? 0 : 78);
          const centerY = height / 2 + (isMobile ? 0 : 20);

          const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);

          // Фон
          ctx.beginPath();
          ctx.arc(centerX, centerY, isMobile ? 38 : 45, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
          ctx.fill();
          ctx.shadowColor = "rgba(0, 0, 0, 0.06)";
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;

          // Сумма
          ctx.shadowColor = "transparent";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = isMobile
            ? "bold 18px -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
            : "bold 20px -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
          ctx.fillStyle = "#1f2937";
          ctx.fillText(
            formatMoney(total),
            centerX,
            centerY - (isMobile ? 18 : 20),
          );

          // Подпись
          ctx.font = isMobile
            ? "10px -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
            : "11px -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
          ctx.fillStyle = "#6b7280";
          ctx.fillText(
            "Всего расходов",
            centerX,
            centerY + (isMobile ? -3 : -4),
          );

          ctx.restore();
        },
      },
    ],
  });
}

function renderTrend(transactions, start, end) {
  const ctx = document.getElementById("trendChart");

  if (!transactions || transactions.length === 0) {
    ctx.parentElement.innerHTML = `
      <div class="empty-state py-4">
        <p class="mb-0">📊 Нет данных за последние 30 дней.</p>
        <small class="text-muted">Добавьте операции на странице «Операции».</small>
      </div>
    `;
    return;
  }

  const isMobile = window.innerWidth < 768;

  const days = [];
  const incomeByDay = {};
  const expenseByDay = {};

  const cursor = new Date(start);
  while (cursor <= end) {
    const key = iso(cursor);
    days.push(key);
    incomeByDay[key] = 0;
    expenseByDay[key] = 0;
    cursor.setDate(cursor.getDate() + 1);
  }

  transactions.forEach((tx) => {
    if (tx.type === "income" && tx.exclude_from_income === true) {
      return;
    }
    const bucket = tx.type === "income" ? incomeByDay : expenseByDay;
    if (bucket[tx.date] !== undefined) {
      bucket[tx.date] += Number(tx.amount);
    }
  });

  const labels = days.map((d) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  });

  const incomeValues = days.map((d) => incomeByDay[d] || 0);
  const expenseValues = days.map((d) => expenseByDay[d] || 0);

  if (window.trendChartInstance) {
    window.trendChartInstance.destroy();
  }

  window.trendChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Доходы",
          data: incomeValues,
          borderColor: "#16a34a",
          backgroundColor: "rgba(22, 163, 74, 0.15)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#16a34a",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointRadius: isMobile ? 3 : 4,
          pointHoverRadius: isMobile ? 6 : 7,
          borderWidth: isMobile ? 2 : 2.5,
        },
        {
          label: "Расходы",
          data: expenseValues,
          borderColor: "#dc2626",
          backgroundColor: "rgba(220, 38, 38, 0.15)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#dc2626",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointRadius: isMobile ? 3 : 4,
          pointHoverRadius: isMobile ? 6 : 7,
          borderWidth: isMobile ? 2 : 2.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: isMobile ? "bottom" : "top",
          labels: {
            font: {
              size: isMobile ? 10 : 12,
              weight: "600",
            },
            padding: isMobile ? 8 : 16,
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: isMobile ? 10 : 14,
          },
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
              return `${context.dataset.label}: ${formatMoney(context.parsed.y)}`;
            },
            title: function (tooltipItems) {
              const idx = tooltipItems[0].dataIndex;
              const date = days[idx];
              return new Date(date + "T00:00:00").toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: isMobile ? 60 : 40,
            minRotation: 0,
            autoSkip: isMobile ? true : false,
            maxTicksLimit: isMobile ? 10 : 15,
            font: {
              size: isMobile ? 9 : 11,
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
  });
}