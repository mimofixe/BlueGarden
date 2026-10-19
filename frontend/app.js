// Blue Garden — lógica do frontend (sem frameworks)

const token = localStorage.getItem("bg_token");
if (!token) location.href = "index.html";

const estado = {
  vista: "ficheiros",   // ficheiros | reciclagem
  pasta: "/",
  categoria: null,
  pesquisa: "",
  categorias: [],
};

const $ = (id) => document.getElementById(id);
document.getElementById("nome-utilizador").textContent = localStorage.getItem("bg_nome") || "";

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
  location.href = "index.html";
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 3000);
}

// ---------- utilitários ----------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function tamanho(b) {
  const u = ["B", "KB", "MB", "GB"]; let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(i ? 1 : 0)} ${u[i]}`;
}
const data = (iso) => new Date(iso).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
const juntar = (pasta, nome) => (pasta === "/" ? "" : pasta) + "/" + nome;

// ---------- desenho ----------

function desenharMigalhas() {
  const m = $("migalhas");
  if (estado.vista === "reciclagem") { m.innerHTML = "Reciclagem"; return; }
  if (estado.categoria) { m.innerHTML = `Categoria: <strong>${esc(estado.categoria)}</strong>`; return; }
  if (estado.pesquisa) { m.innerHTML = `Resultados para “${esc(estado.pesquisa)}”`; return; }
  const partes = estado.pasta.split("/").filter(Boolean);
  let html = `<a href="#" data-pasta="/">Os meus ficheiros</a>`;
  let acc = "";
  for (const p of partes) {
    acc += "/" + p;
    html += `<span>›</span><a href="#" data-pasta="${esc(acc)}">${esc(p)}</a>`;
  }
  m.innerHTML = html;
}

function celulaCategoria(f) {
  if (f.estado !== "CATEGORIZADO") {
    return `<span class="etiqueta pendente">${f.estado === "EM_ANALISE" ? "A analisar…" : "Na fila da IA"}</span>`;
  }
  const classe = f.categoria === "Por rever" ? "etiqueta rever" : "etiqueta";
  const opcoes = estado.categorias
    .map((c) => `<option ${c === f.categoria ? "selected" : ""}>${esc(c)}</option>`).join("");
  const conf = f.corrigido ? "corrigido" : f.confianca != null ? `${Math.round(f.confianca * 100)}%` : "";
  return `<span class="${classe}" title="Escolhe outra categoria para corrigir a IA">
            <select data-corrigir="${f.id}">${opcoes}</select></span>
          <span class="confianca">${conf}</span>`;
}

function linhaFicheiro(f, reciclagem) {
  const acoes = reciclagem
    ? `<button class="botao pequeno" data-restaurar="${f.id}">Restaurar</button>
       <button class="botao pequeno" data-definitivo="${f.id}">Eliminar de vez</button>`
    : `<button class="botao pequeno" data-descarregar="${f.id}" data-nome="${esc(f.nome)}">Descarregar</button>
       <button class="botao pequeno" data-eliminar="${f.id}">Eliminar</button>`;
  return `<tr>
    <td>📄 ${esc(f.nome)}${estado.pesquisa || estado.categoria ? `<div class="confianca">${esc(f.pasta)}</div>` : ""}</td>
    <td>${reciclagem ? esc(f.categoria || "—") : celulaCategoria(f)}</td>
    <td>${tamanho(f.tamanho)}</td>
    <td>${data(reciclagem ? f.apagado_em : f.criado_em)}</td>
    <td class="acoes">${acoes}</td>
  </tr>`;
}

let temporizador = null;

async function carregar() {
  desenharMigalhas();
  $("botao-pasta").hidden = estado.vista !== "ficheiros" || !!estado.categoria || !!estado.pesquisa;
  $("aviso").hidden = true;
  try {
    let linhas = "", total = 0, pendentes = false;
    if (estado.vista === "reciclagem") {
      const d = await json("/reciclagem");
      linhas = d.ficheiros.map((f) => linhaFicheiro(f, true)).join("");
      total = d.ficheiros.length;
    } else {
      const p = new URLSearchParams({ pasta: estado.pasta });
      if (estado.categoria) p.set("categoria", estado.categoria);
      if (estado.pesquisa) p.set("q", estado.pesquisa);
      const d = await json(`/ficheiros?${p}`);
      linhas = d.subpastas.map((s) =>
        `<tr class="pasta" data-abrir="${esc(juntar(estado.pasta, s))}"><td>📁 ${esc(s)}</td><td></td><td></td><td></td><td></td></tr>`
      ).join("") + d.ficheiros.map((f) => linhaFicheiro(f, false)).join("");
      total = d.subpastas.length + d.ficheiros.length;
      pendentes = d.ficheiros.some((f) => f.estado !== "CATEGORIZADO");
    }
    $("lista").innerHTML = linhas;
    $("vazio").hidden = total > 0;
    // Enquanto a IA não acabar, atualizar sozinho a cada 3 s
    clearTimeout(temporizador);
    if (pendentes) temporizador = setTimeout(carregar, 3000);
  } catch (e) {
    $("aviso").textContent = `${e.message}. A tentar novamente…`;
    $("aviso").hidden = false;
    clearTimeout(temporizador);
    temporizador = setTimeout(carregar, 4000);
  }
}

async function carregarCategorias() {
  const d = await json("/categorias");
  estado.categorias = d.categorias;
  $("menu-categorias").innerHTML = d.categorias
    .map((c) => `<li><a href="#" data-categoria="${esc(c)}">${esc(c)}</a></li>`).join("");
}

function marcarMenu(el) {
  document.querySelectorAll(".lateral .menu a").forEach((a) => a.classList.toggle("ativo", a === el));
}

// ---------- ações ----------

async function enviar(ficheiros) {
  for (const f of ficheiros) {
    const fd = new FormData();
    fd.append("ficheiro", f);
    fd.append("pasta", estado.pasta);
    try {
      await api("/ficheiros", { method: "POST", body: fd });
      toast(`“${f.name}” carregado`);
    } catch (e) {
      toast(`Falhou “${f.name}”: ${e.message}`);
    }
  }
  carregar();
}

async function descarregar(id, nome) {
  const r = await api(`/ficheiros/${id}/download`);
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- eventos ----------

$("sair").onclick = sair;
$("botao-carregar").onclick = () => $("input-ficheiro").click();
$("input-ficheiro").onchange = (e) => { enviar([...e.target.files]); e.target.value = ""; };

$("botao-pasta").onclick = async () => {
  const nome = prompt("Nome da nova pasta:");
  if (!nome || !nome.trim()) return;
  try {
    await json("/pastas", "POST", { caminho: juntar(estado.pasta, nome.trim()) });
    carregar();
  } catch (e) { toast(e.message); }
};

let atrasoPesquisa;
$("pesquisa").oninput = (e) => {
  clearTimeout(atrasoPesquisa);
  atrasoPesquisa = setTimeout(() => {
    estado.pesquisa = e.target.value.trim();
    estado.vista = "ficheiros";
    estado.categoria = null;
    carregar();
  }, 300);
};

document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-vista],[data-categoria],[data-pasta],[data-abrir],[data-descarregar],[data-eliminar],[data-restaurar],[data-definitivo]");
  if (!t) return;
  e.preventDefault();
  const d = t.dataset;
  try {
    if (d.vista) {
      estado.vista = d.vista; estado.categoria = null; estado.pasta = "/"; estado.pesquisa = ""; $("pesquisa").value = "";
      marcarMenu(t);
    } else if (d.categoria) {
      estado.vista = "ficheiros"; estado.categoria = d.categoria; estado.pesquisa = ""; $("pesquisa").value = "";
      marcarMenu(t);
    } else if (d.pasta || d.abrir) {
      estado.pasta = d.pasta || d.abrir;
    } else if (d.descarregar) {
      return descarregar(d.descarregar, d.nome);
    } else if (d.eliminar) {
      await api(`/ficheiros/${d.eliminar}`, { method: "DELETE" });
      toast("Movido para a reciclagem");
    } else if (d.restaurar) {
      await api(`/ficheiros/${d.restaurar}/restaurar`, { method: "POST" });
      toast("Ficheiro restaurado");
    } else if (d.definitivo) {
      if (!confirm("Eliminar definitivamente? Não dá para recuperar.")) return;
      await api(`/ficheiros/${d.definitivo}/definitivo`, { method: "DELETE" });
      toast("Eliminado definitivamente");
    }
    carregar();
  } catch (err) { toast(err.message); }
});

document.addEventListener("change", async (e) => {
  const id = e.target.dataset.corrigir;
  if (!id) return;
  try {
    await json(`/ficheiros/${id}/categoria`, "PUT", { categoria: e.target.value });
    toast("Obrigado! A correção vai ajudar a treinar a IA.");
    carregar();
  } catch (err) { toast(err.message); }
});

// Arrastar e largar
const zona = $("zona-drop");
zona.addEventListener("dragover", (e) => { e.preventDefault(); zona.classList.add("arrastar"); });
zona.addEventListener("dragleave", () => zona.classList.remove("arrastar"));
zona.addEventListener("drop", (e) => {
  e.preventDefault();
  zona.classList.remove("arrastar");
  if (estado.vista === "ficheiros" && e.dataTransfer.files.length) enviar([...e.dataTransfer.files]);
});

carregarCategorias().then(carregar).catch(() => carregar());
