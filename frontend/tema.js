// Aplica o tema guardado antes de a página ser desenhada (evita o "flash" claro).
// Tem de ser carregado no <head>, antes do style.css.
(function () {
  try {
    if (localStorage.getItem("bg_tema") === "escuro") {
      document.documentElement.dataset.tema = "escuro";
    }
  } catch (e) { /* armazenamento indisponível: fica o tema claro */ }
})();
