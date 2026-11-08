// Blue Garden — código partilhado pelas páginas autenticadas (ficheiros e definições):
// sessão, pedidos à API, notificações, tema e menu da conta.

const token = localStorage.getItem("bg_token");
if (!token) location.replace("index.html");

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- API ----------

async function api(caminho, opcoes = {}) {
  const r = await fetch(`/api${caminho}`, {
    ...opcoes,
    headers: { Authorization: `Bearer ${token}`, ...(opcoes.headers || {}) },
  });
  if (r.status === 401) { sair(); throw new Error("Sessão expirada"); }
  if (!r.ok) {
    let msg = `Erro ${r.status}`;
    try { const d = await r.json(); if (typeof d.detail === "string") msg = d.detail; } catch {}
    throw new Error(msg);
  }
  return r;
}
const json = (caminho, metodo = "GET", corpo) =>
  api(caminho, {
    method: metodo,
    headers: corpo ? { "Content-Type": "application/json" } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
  }).then((r) => r.json());

function sair() {
  localStorage.removeItem("bg_token");
  localStorage.removeItem("bg_nome");
  location.replace("index.html");
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 3000);
}

// ---------- tema ----------

function aplicarTema(tema) {
  if (tema === "escuro") document.documentElement.dataset.tema = "escuro";
  else delete document.documentElement.dataset.tema;
  try { localStorage.setItem("bg_tema", tema); } catch {}
}

// ---------- perfil e avatar ----------

const perfil = { nome: localStorage.getItem("bg_nome") || "", email: "", tema: "claro", fotoUrl: null };

function inicial(nome) {
  const letra = (nome || "").trim().charAt(0);
  return letra ? letra.toLocaleUpperCase("pt-PT") : "?";
}

// Desenha todos os avatares da página (elementos com o atributo data-avatar)
function desenharAvatares() {
  document.querySelectorAll("[data-avatar]").forEach((el) => {
    el.innerHTML = perfil.fotoUrl
      ? `<img src="${perfil.fotoUrl}" alt="">`
      : `<span>${esc(inicial(perfil.nome))}</span>`;
  });
  const nome = $("painel-nome"), email = $("painel-email");
  if (nome) nome.textContent = perfil.nome;
  if (email) email.textContent = perfil.email;
}

async function carregarFoto(temFoto) {
  if (perfil.fotoUrl) URL.revokeObjectURL(perfil.fotoUrl);
  perfil.fotoUrl = null;
  if (temFoto) {
    // A foto precisa do token, por isso é pedida com fetch e mostrada como blob
    const r = await api("/perfil/foto");
    perfil.fotoUrl = URL.createObjectURL(await r.blob());
  }
  desenharAvatares();
}

async function carregarPerfil() {
  desenharAvatares(); // mostra logo a inicial guardada, antes da resposta do servidor
  try {
    const p = await json("/perfil");
    Object.assign(perfil, { nome: p.nome, email: p.email, tema: p.tema });
    localStorage.setItem("bg_nome", p.nome);
    aplicarTema(p.tema);
    await carregarFoto(p.tem_foto);
  } catch { /* sem ligação: fica a inicial guardada */ }
  return perfil;
}

// ---------- menu da conta ----------

function iniciarMenuConta() {
  const botao = $("avatar-botao"), painel = $("painel-conta");
  const abrir = (sim) => { painel.hidden = !sim; botao.setAttribute("aria-expanded", String(sim)); };

  botao.addEventListener("click", (e) => { e.stopPropagation(); abrir(painel.hidden); });
  document.addEventListener("click", (e) => { if (!painel.hidden && !painel.contains(e.target)) abrir(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !painel.hidden) { abrir(false); botao.focus(); } });
  $("sair").addEventListener("click", sair);
}

iniciarMenuConta();
// As páginas podem esperar por isto com perfilPronto.then(...)
const perfilPronto = carregarPerfil();
