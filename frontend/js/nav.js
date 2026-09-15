document.addEventListener("DOMContentLoaded", () => {
  Auth.requireAuth();
  const user = Auth.getUser();

  // Десктопная версия
  const nameEl = document.getElementById("navUsername");
  if (nameEl && user) nameEl.textContent = user.username;

  // Мобильная версия
  const nameElMobile = document.getElementById("navUsernameMobile");
  if (nameElMobile && user) nameElMobile.textContent = user.username;

  // Десктопная кнопка выхода
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      Auth.logout();
    });
  }

  // Мобильная кнопка выхода
  const logoutBtnMobile = document.getElementById("logoutBtnMobile");
  if (logoutBtnMobile) {
    logoutBtnMobile.addEventListener("click", (e) => {
      e.preventDefault();
      Auth.logout();
    });
  }

  // ===== ВЫБОР ВАЛЮТЫ =====
  const currencySelect = document.getElementById("currencySelect");
  if (currencySelect) {
    if (user && user.currency) currencySelect.value = user.currency;

    currencySelect.addEventListener("change", async () => {
      try {
        const updatedUser = await Api.updateProfile({
          currency: currencySelect.value,
        });
        Auth.setSession(Auth.getToken(), updatedUser);
        // Перезагружаем страницу, чтобы formatMoney применил новую валюту
        location.reload();
      } catch (err) {
        alert("Ошибка сохранения валюты: " + err.message);
      }
    });
  }
});
