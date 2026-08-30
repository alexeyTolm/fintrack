// Получаем email из localStorage (сохраняем после регистрации)
const email = localStorage.getItem("verify_email");
const username = localStorage.getItem("verify_username");

if (!email) {
  window.location.href = "index.html";
}

document.getElementById("verifyEmail").textContent = email;

const alertBox = document.getElementById("alertBox");
const successBox = document.getElementById("successBox");
const verifyBtn = document.getElementById("verifyBtn");

function showAlert(message) {
  alertBox.textContent = message;
  alertBox.classList.remove("d-none");
  successBox.classList.add("d-none");
}

function showSuccess(message) {
  successBox.textContent = message;
  successBox.classList.remove("d-none");
  alertBox.classList.add("d-none");
}

function hideAlerts() {
  alertBox.classList.add("d-none");
  successBox.classList.add("d-none");
}

// ===== ОТПРАВКА КОДА =====
document.getElementById("verifyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlerts();

  const code = document.getElementById("verifyCode").value.trim();
  if (code.length !== 6) {
    showAlert("Введите 6-значный код");
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.textContent = "Проверка...";

  try {
    const data = await Api.verifyCode({
      email: email,
      username: username,
      code: code,
    });

    showSuccess("✅ Регистрация завершена!");

    // Сохраняем токен и данные пользователя
    Auth.setSession(data.access_token, data.user);

    // Очищаем временные данные
    localStorage.removeItem("verify_email");
    localStorage.removeItem("verify_username");

    // Переход на дашборд через 1.5 секунды
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1500);
  } catch (err) {
    showAlert(err.message);
    verifyBtn.disabled = false;
    verifyBtn.textContent = "Подтвердить";
  }
});

// ===== ПОВТОРНАЯ ОТПРАВКА КОДА =====
document
  .getElementById("resendCodeBtn")
  .addEventListener("click", async (e) => {
    e.preventDefault();
    hideAlerts();

    try {
      // Повторно отправляем код (используем тот же эндпоинт /register)
      await Api.register({
        email: email,
        username: username,
        password: localStorage.getItem("verify_password"),
        password_confirm: localStorage.getItem("verify_password"),
      });
      showSuccess("✅ Новый код отправлен на почту!");
    } catch (err) {
      showAlert(err.message);
    }
  });
