document.addEventListener("DOMContentLoaded", () => {
  // Если уже авторизован — сразу в личный кабинет
  if (Auth.isLoggedIn()) {
    window.location.href = "dashboard.html";
    return;
  }

  const tabs = document.querySelectorAll("#authTabs .nav-link");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const alertBox = document.getElementById("alertBox");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      hideAlert();
      if (tab.dataset.tab === "login") {
        loginForm.classList.remove("d-none");
        registerForm.classList.add("d-none");
      } else {
        registerForm.classList.remove("d-none");
        loginForm.classList.add("d-none");
      }
    });
  });

  function showAlert(message) {
    alertBox.textContent = message;
    alertBox.classList.remove("d-none");
  }
  function hideAlert() {
    alertBox.classList.add("d-none");
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    try {
      const data = await Api.login({ email, password });
      Auth.setSession(data.access_token, data.user);
      window.location.href = "dashboard.html";
    } catch (err) {
      showAlert(err.message);
    }
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert();
    const username = document.getElementById("regUsername").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const password_confirm =
      document.getElementById("regPasswordConfirm").value;

    if (password !== password_confirm) {
      showAlert("Пароли не совпадают");
      return;
    }

    try {
      // Сохраняем данные для страницы верификации
      localStorage.setItem("verify_email", email);
      localStorage.setItem("verify_username", username);
      localStorage.setItem("verify_password", password);

      const data = await Api.register({
        username,
        email,
        password,
        password_confirm,
      });

      // Показываем сообщение об успехе
      showAlert("Код отправлен на почту!");
      document.querySelector(".alert").classList.remove("alert-danger");
      document.querySelector(".alert").classList.add("alert-success");

      // Переход на страницу верификации
      setTimeout(() => {
        window.location.href = "verify.html";
      }, 1000);
    } catch (err) {
      showAlert(err.message);
    }
  });
});
