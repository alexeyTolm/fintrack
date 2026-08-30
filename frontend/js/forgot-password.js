const forgotForm = document.getElementById("forgotForm");
const resetForm = document.getElementById("resetForm");
const sendCodeBtn = document.getElementById("sendCodeBtn");
const resetBtn = document.getElementById("resetBtn");
const alertBox = document.getElementById("alertBox");
const successBox = document.getElementById("successBox");
let resetEmail = "";

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

// ===== ШАГ 1: ОТПРАВКА КОДА =====
forgotForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlerts();

  const email = document.getElementById("forgotEmail").value.trim();
  if (!email) {
    showAlert("Введите email");
    return;
  }

  sendCodeBtn.disabled = true;
  sendCodeBtn.textContent = "Отправка...";

  try {
    await Api.forgotPassword({ email });
    resetEmail = email;
    showSuccess("✅ Код отправлен на почту!");

    // Показываем форму сброса
    forgotForm.classList.add("d-none");
    resetForm.classList.remove("d-none");
    document.querySelector(".auth-card h1").textContent =
      "Введите код и новый пароль";
    document.querySelector(".auth-card .text-muted").textContent =
      `Код отправлен на ${email}`;
  } catch (err) {
    showAlert(err.message);
  } finally {
    sendCodeBtn.disabled = false;
    sendCodeBtn.textContent = "Отправить код";
  }
});

// ===== ШАГ 2: СБРОС ПАРОЛЯ =====
resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlerts();

  const code = document.getElementById("resetCode").value.trim();
  const newPassword = document.getElementById("resetPassword").value;
  const newPasswordConfirm = document.getElementById(
    "resetPasswordConfirm",
  ).value;

  if (code.length !== 6) {
    showAlert("Введите 6-значный код");
    return;
  }

  if (newPassword !== newPasswordConfirm) {
    showAlert("Пароли не совпадают");
    return;
  }

  if (newPassword.length < 6) {
    showAlert("Пароль должен быть минимум 6 символов");
    return;
  }

  resetBtn.disabled = true;
  resetBtn.textContent = "Сброс...";

  try {
    await Api.resetPassword({
      email: resetEmail,
      code: code,
      new_password: newPassword,
      new_password_confirm: newPasswordConfirm,
    });

    showSuccess("✅ Пароль успешно изменён!");

    // Переход на страницу входа через 2 секунды
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
  } catch (err) {
    showAlert(err.message);
    resetBtn.disabled = false;
    resetBtn.textContent = "Сбросить пароль";
  }
});
