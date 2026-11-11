// Blue Garden — páginas de ficheiros (app.html) e reciclagem (reciclagem.html), sem frameworks.
// Usa api(), json(), toast(), esc() e $() definidos em comum.js.
// "Nova pasta" e "Carregar ficheiros" estão no menu do clique direito; "Eliminar pasta" no de cada pasta.
//
// Cada pasta, categoria e pesquisa tem o seu endereço (ex.: app.html?pasta=/Fotos),
// por isso o botão "Voltar" do browser volta à pasta anterior.

const estado = {
  vista: document.body.dataset.pagina || "ficheiros",   // ficheiros | reciclagem (definido no <body>)
  pasta: "/",
  categoria: null,
  pesquisa: "",
  categorias: [],
  itens: new Map(),     // id -> ficheiro (para o menu de contexto)
};

// ---------- endereços (URL) ----------

// Endereço de uma vista da página de ficheiros
function enderecoFicheiros({ pasta = "/", categoria = null, q = "" } = {}) {
  const p = new URLSearchParams();
  if (categoria) p.set("categoria", categoria);
  else if (q) p.set("q", q);
  else if (pasta && pasta !== "/") p.set("pasta", pasta);
  const s = p.toString();
  return s ? `app.html?${s}` : "app.html";
}

// Lê a pasta / categoria / pesquisa do endereço atual
function lerEndereco() {
  if (estado.vista !== "ficheiros") return;
  const p = new URLSearchParams(location.search);
  estado.categoria = p.get("categoria") || null;
  estado.pesquisa = estado.categoria ? "" : (p.get("q") || "").trim();
  estado.pasta = (estado.categoria || estado.pesquisa) ? "/" : (p.get("pasta") || "/");
  $("pesquisa").value = estado.pesquisa;
}

// Muda de vista: na página de ficheiros cria uma entrada no histórico; nas outras páginas abre a de ficheiros
function navegar(destino, { substituir = false } = {}) {
  const url = enderecoFicheiros(destino);
  if (estado.vista !== "ficheiros") { location.href = url; return; }
  if (url === location.pathname.split("/").pop() + location.search) return carregar();
  history[substituir ? "replaceState" : "pushState"](null, "", url);
  lerEndereco();
  carregar();
}

addEventListener("popstate", () => { lerEndereco(); carregar(); });

// ---------- utilitários ----------

function tamanho(b) {
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toLocaleString("pt-PT", { maximumFractionDigits: i ? 1 : 0 })} ${u[i]}`;
}
const juntar = (pasta, nome) => (pasta === "/" ? "" : pasta) + "/" + nome;
const nomePasta = (pasta) => (pasta === "/" ? "Os meus ficheiros" : pasta.split("/").pop());

const relativo = new Intl.RelativeTimeFormat("pt-PT", { numeric: "auto" });
function haQuanto(iso) {
  if (!iso) return "—";
  const seg = (new Date(iso) - Date.now()) / 1000;
  const passos = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.35, "week"], [12, "month"], [Infinity, "year"]];
  let v = seg;
  for (const [n, unidade] of passos) {
    if (Math.abs(v) < n) return relativo.format(Math.round(v), unidade);
    v /= n;
  }
}

// Cor de cada categoria (classes cat-0 … cat-6 em ficheiros.css)
function classeCategoria(c) {
  const i = estado.categorias.indexOf(c);
  return `cat-${i >= 0 && i <= 6 ? i : 6}`;
}

function extensao(nome) {
  const i = nome.lastIndexOf(".");
  return i > 0 ? nome.slice(i + 1).toUpperCase().slice(0, 5) : "";
}

const ICONES = {
  imagem: '<path d="M4 5h16v14H4z"/><circle cx="9" cy="10" r="2"/><path d="m4 17 5-5 4 4 3-3 4 4"/>',
  codigo: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  documento: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  pasta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  abrir: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  descarregar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  carregar: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  novaPasta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9 13h6"/>',
  eliminar: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  restaurar: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5"/>',
  atualizar: '<path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/>',
  localizar: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
};
const svg = (nome) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome]}</svg>`;

function iconeFicheiro(f) {
  const mime = f.tipo_mime || "";
  if (mime.startsWith("image/")) return "imagem";
  if (/\.(py|js|ts|java|c|cpp|h|cs|go|rs|rb|php|html|css|json|sh|sql|kt|swift)$/i.test(f.nome)) return "codigo";
  return "documento";
}

// ---------- barra lateral ----------

async function carregarCategorias() {
  const d = await json("/categorias");
  estado.categorias = d.categorias;
  desenharCategorias({});
}

function desenharCategorias(contagens) {
  $("menu-categorias").innerHTML = estado.categorias.map((c) => `
    <li><a href="${esc(enderecoFicheiros({ categoria: c }))}" data-categoria="${esc(c)}" class="${classeCategoria(c)}${estado.categoria === c ? " ativo" : ""}">
      <span class="bg-ponto" aria-hidden="true"></span><span class="nome">${esc(c)}</span>
      <span class="contagem">${contagens[c] ?? ""}</span>
    </a></li>`).join("");
}

async function carregarResumo() {
  try {
    const r = await json("/resumo");
    desenharCategorias(r.categorias || {});
  } catch { /* sem ligação: as categorias ficam sem contagem */ }
}

function marcarMenu() {
  document.querySelectorAll(".bg-nav a").forEach((a) =>
    a.classList.toggle("ativo", !estado.categoria && !estado.pesquisa && a.dataset.vista === estado.vista));
  document.querySelectorAll("#menu-categorias a").forEach((a) =>
    a.classList.toggle("ativo", a.dataset.categoria === estado.categoria));
}

// ---------- desenho do conteúdo ----------

function desenharCabecalho() {
  const m = $("migalhas"), t = $("titulo"), s = $("subtitulo");
  s.hidden = true;
  $("botao-esvaziar").hidden = estado.vista !== "reciclagem";

  if (estado.vista === "reciclagem") {
    m.innerHTML = ""; t.textContent = "Reciclagem";
    s.textContent = "Os ficheiros apagados ficam aqui e podem ser recuperados até serem eliminados de vez.";
    s.hidden = false;
  } else if (estado.categoria) {
    m.innerHTML = `<span>Categorias (IA)</span>`; t.textContent = estado.categoria;
  } else if (estado.pesquisa) {
    m.innerHTML = `<span>Pesquisa</span>`; t.textContent = `Resultados para “${estado.pesquisa}”`;
  } else {
    const partes = estado.pasta.split("/").filter(Boolean);
    let html = `<a href="app.html" data-pasta="/">Os meus ficheiros</a>`, acc = "";
    for (const p of partes.slice(0, -1)) {
      acc += "/" + p;
      html += `<span aria-hidden="true">/</span><a href="${esc(enderecoFicheiros({ pasta: acc }))}" data-pasta="${esc(acc)}">${esc(p)}</a>`;
    }
    if (partes.length) html += `<span aria-hidden="true">/</span><span>${esc(partes[partes.length - 1])}</span>`;
    m.innerHTML = partes.length ? html : "";
    t.textContent = nomePasta(estado.pasta);
  }
  document.title = `Blue Garden — ${t.textContent}`;
}

function etiquetaCategoria(f) {
  if (f.estado !== "CATEGORIZADO") {
    return `<span class="bg-etiqueta cat-6">${f.estado === "EM_ANALISE" ? "IA a analisar…" : "Na fila da IA"}</span>`;
  }
  const opcoes = estado.categorias
    .map((c) => `<option ${c === f.categoria ? "selected" : ""}>${esc(c)}</option>`).join("");
  const conf = f.corrigido ? "corrigido" : f.confianca != null ? `${Math.round(f.confianca * 100)}%` : "";
  return `<span class="bg-etiqueta ${classeCategoria(f.categoria)}">
            <select data-corrigir="${f.id}" aria-label="Categoria de ${esc(f.nome)} (muda para corrigir a IA)">${opcoes}</select>
          </span>${conf ? `<span class="bg-confianca" title="Confiança da IA">${conf}</span>` : ""}`;
}

function cartaoFicheiro(f, mostrarLocal) {
  const pendente = f.estado !== "CATEGORIZADO";
  const cls = pendente ? "cat-6" : classeCategoria(f.categoria);
  return `<div class="bg-cartao ${cls}${pendente ? " pendente" : ""}" tabindex="0" draggable="true" data-ficheiro="${f.id}"
               title="${esc(f.nome)} · ${tamanho(f.tamanho)}" aria-label="${esc(f.nome)}, ${tamanho(f.tamanho)}">
    <div class="bg-miniatura" aria-hidden="true">${svg(iconeFicheiro(f))}<span class="ext">${esc(extensao(f.nome))}</span></div>
    <div class="nome">${esc(f.nome)}</div>
    ${mostrarLocal ? `<div class="local">${esc(nomePasta(f.pasta))}</div>` : ""}
    <div class="rodape">${etiquetaCategoria(f)}</div>
  </div>`;
}

function botaoPasta(nome, caminho) {
  return `<button type="button" class="bg-pasta" data-abrir="${esc(caminho)}">
    <span class="bg-pasta-icone" aria-hidden="true"></span><span>${esc(nome)}</span></button>`;
}

function vazio(titulo, texto) {
  return `<div class="bg-vazio"><strong>${titulo}</strong><span>${texto}</span></div>`;
}

function desenharGrelha(subpastas, ficheiros, mostrarLocal) {
  let html = "";
  if (subpastas.length) {
    html += `<section class="bg-seccao" aria-labelledby="t-pastas"><h2 class="bg-rotulo" id="t-pastas">Pastas</h2>
      <div class="bg-grelha">${subpastas.map((s) => botaoPasta(s, juntar(estado.pasta, s))).join("")}</div></section>`;
  }
  if (ficheiros.length) {
    html += `<section class="bg-seccao" aria-labelledby="t-ficheiros"><h2 class="bg-rotulo" id="t-ficheiros">Ficheiros</h2>
      <div class="bg-grelha">${ficheiros.map((f) => cartaoFicheiro(f, mostrarLocal)).join("")}</div></section>`;
  }
  return html;
}

function desenharReciclagem(ficheiros) {
  if (!ficheiros.length) return vazio("A reciclagem está vazia", "Os ficheiros que eliminares aparecem aqui.");
  const linhas = ficheiros.map((f) => `
    <tr data-reciclado="${f.id}" tabindex="0">
      <td><div class="bg-nome-celula ${f.estado === "CATEGORIZADO" ? classeCategoria(f.categoria) : "cat-6"}">
        <span class="icone" aria-hidden="true"></span><span>${esc(f.nome)}</span></div></td>
      <td class="suave">${esc(f.pasta === "/" ? "Os meus ficheiros" : f.pasta.slice(1).split("/").join(" / "))}</td>
      <td class="suave" title="${esc(new Date(f.apagado_em).toLocaleString("pt-PT"))}">${haQuanto(f.apagado_em)}</td>
      <td class="acoes"><button type="button" class="bg-botao primario pequeno" data-restaurar="${f.id}">Recuperar</button></td>
    </tr>`).join("");
  return `<div class="bg-tabela-caixa"><table class="bg-tabela">
      <thead><tr><th>Nome</th><th>Pasta original</th><th>Apagado</th><th><span class="so-leitores">Ações</span></th></tr></thead>
      <tbody>${linhas}</tbody></table></div>
    <p class="bg-nota">Os ficheiros recuperados voltam à pasta original e mantêm a categoria. Clica com o botão direito numa linha para eliminar de vez.</p>`;
}

let temporizador = null;

async function carregar() {
  fecharMenu();
  desenharCabecalho();
  marcarMenu();
  $("aviso").hidden = true;
  try {
    let html = "", pendentes = false, lista = [];
    if (estado.vista === "reciclagem") {
      const d = await json("/reciclagem");
      lista = d.ficheiros;
      html = desenharReciclagem(lista);
      $("botao-esvaziar").disabled = !lista.length;
    } else {
      const p = new URLSearchParams({ pasta: estado.pasta });
      if (estado.categoria) p.set("categoria", estado.categoria);
      if (estado.pesquisa) p.set("q", estado.pesquisa);
      const d = await json(`/ficheiros?${p}`);
      lista = d.ficheiros;
      const procura = !!(estado.categoria || estado.pesquisa);
      html = desenharGrelha(d.subpastas, lista, procura);
      if (!html) {
        html = procura
          ? vazio("Nenhum ficheiro encontrado", estado.categoria ? "Ainda não há ficheiros nesta categoria." : "Experimenta outro nome.")
          : vazio("Esta pasta está vazia", "Arrasta ficheiros para aqui ou clica com o botão direito para carregar ficheiros ou criar uma pasta.");
      }
    }
    estado.itens = new Map(lista.map((f) => [f.id, f]));
    pendentes = lista.some((f) => f.estado !== "CATEGORIZADO");
    // Não redesenhar enquanto o utilizador está a escolher uma categoria
    if (!document.activeElement?.matches?.("select[data-corrigir]")) $("conteudo").innerHTML = html;
    // Enquanto a IA não acabar, atualizar sozinho a cada 3 s
    clearTimeout(temporizador);
    if (pendentes && estado.vista !== "reciclagem") temporizador = setTimeout(() => { carregar(); carregarResumo(); }, 3000);
  } catch (e) {
    $("aviso").textContent = `${e.message}. A tentar novamente…`;
    $("aviso").hidden = false;
    clearTimeout(temporizador);
    temporizador = setTimeout(carregar, 4000);
  }
}

function atualizarTudo() { carregar(); carregarResumo(); }

// ---------- ações ----------

async function enviar(ficheiros, pastaDestino) {
  if (!ficheiros.length) return;
  const destino = pastaDestino ?? (estado.vista === "ficheiros" && !estado.categoria && !estado.pesquisa ? estado.pasta : "/");
  for (const f of ficheiros) {
    const fd = new FormData();
    fd.append("ficheiro", f);
    fd.append("pasta", destino);
    try {
      await api("/ficheiros", { method: "POST", body: fd });
      toast(`“${f.name}” carregado`);
    } catch (e) {
      toast(`Falhou “${f.name}”: ${e.message}`);
    }
  }
  atualizarTudo();
}

async function descarregar(id) {
  const f = estado.itens.get(id);
  try {
    const r = await api(`/ficheiros/${id}/download`);
    const url = URL.createObjectURL(await r.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: f ? f.nome : "" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { toast(e.message); }
}

async function mover(id, destino) {
  const f = estado.itens.get(id);
  if (!f || f.pasta === destino) return;
  // As pastas existem enquanto têm ficheiros: registar a pasta de origem para não desaparecer se ficar vazia
  if (f.pasta !== "/") await json("/pastas", "POST", { caminho: f.pasta }).catch(() => {});
  await json(`/ficheiros/${id}`, "PATCH", { pasta: destino });
  toast(`“${f.nome}” movido para ${destino === "/" ? "Os meus ficheiros" : nomePasta(destino)}`);
  atualizarTudo();
}

async function eliminar(id) {
  await api(`/ficheiros/${id}`, { method: "DELETE" });
  toast("Movido para a reciclagem");
  atualizarTudo();
}

async function eliminarPasta(caminho) {
  const ok = await confirmar("Eliminar a pasta?", `A pasta “${nomePasta(caminho)}” desaparece e os ficheiros que tem vão para a reciclagem, de onde podem ser recuperados.`, "Eliminar pasta");
  if (!ok) return;
  await api(`/pastas?caminho=${encodeURIComponent(caminho)}`, { method: "DELETE" });
  toast(`Pasta “${nomePasta(caminho)}” eliminada`);
  atualizarTudo();
}

async function restaurar(id) {
  await api(`/ficheiros/${id}/restaurar`, { method: "POST" });
  toast("Ficheiro recuperado");
  atualizarTudo();
}

async function eliminarDeVez(id) {
  const f = estado.itens.get(id);
  const ok = await confirmar("Eliminar de vez?", `“${f ? f.nome : "Este ficheiro"}” vai ser apagado definitivamente e não dá para recuperar.`, "Eliminar de vez");
  if (!ok) return;
  await api(`/ficheiros/${id}/definitivo`, { method: "DELETE" });
  toast("Eliminado definitivamente");
  atualizarTudo();
}

async function esvaziarReciclagem() {
  const ids = [...estado.itens.keys()];
  if (!ids.length) return;
  const ok = await confirmar("Esvaziar a reciclagem?", `${ids.length === 1 ? "O ficheiro" : `Os ${ids.length} ficheiros`} da reciclagem vão ser apagados definitivamente. Não dá para recuperar.`, "Esvaziar");
  if (!ok) return;
  let falhas = 0;
  for (const id of ids) {
    try { await api(`/ficheiros/${id}/definitivo`, { method: "DELETE" }); } catch { falhas++; }
  }
  toast(falhas ? `${falhas} ficheiro(s) não foram apagados` : "Reciclagem esvaziada");
  atualizarTudo();
}

function abrirPasta(caminho) {
  navegar({ pasta: caminho });
}

function irParaPastaDe(id) {
  const f = estado.itens.get(id);
  if (f) abrirPasta(f.pasta);
}

// ---------- diálogos ----------

function novaPasta() {
  const d = $("dialogo-pasta");
  $("dialogo-pasta-local").textContent = `Dentro de: ${estado.pasta === "/" ? "Os meus ficheiros" : estado.pasta.slice(1).split("/").join(" / ")}`;
  $("nome-pasta").value = "";
  d.showModal();
  $("nome-pasta").focus();
}

$("cancelar-pasta").onclick = () => $("dialogo-pasta").close();
$("form-pasta").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = $("nome-pasta").value.trim();
  if (!nome) return;
  if (nome.includes("/")) { toast("O nome não pode ter “/”"); return; }
  try {
    await json("/pastas", "POST", { caminho: juntar(estado.pasta, nome) });
    $("dialogo-pasta").close();
    toast(`Pasta “${nome}” criada`);
    carregar();
  } catch (err) { toast(err.message); }
});

function confirmar(titulo, texto, acao) {
  const d = $("dialogo-confirmar");
  $("confirmar-titulo").textContent = titulo;
  $("confirmar-texto").textContent = texto;
  const sim = $("confirmar-sim");
  sim.textContent = acao;
  sim.className = "bg-botao primario";
  sim.style.background = "var(--perigo)"; sim.style.borderColor = "var(--perigo)";
  d.returnValue = "";
  d.showModal();
  return new Promise((ok) => d.addEventListener("close", () => ok(d.returnValue === "sim"), { once: true }));
}

// ---------- menu do clique direito ----------

const menu = $("menu-contexto");
let focoAntesDoMenu = null;

function abrirMenu(x, y, itens, titulo) {
  focoAntesDoMenu = document.activeElement;
  let html = titulo ? `<li class="titulo" role="presentation">${esc(titulo)}</li>` : "";
  itens.forEach((it, i) => {
    html += it === "-"
      ? `<li role="separator"></li>`
      : `<li role="none"><button type="button" role="menuitem" data-item="${i}" class="${it.perigo ? "perigo" : ""}">${svg(it.icone)}${esc(it.rotulo)}</button></li>`;
  });
  menu.innerHTML = html;
  menu.hidden = false;
  menu._itens = itens;
  // Manter o menu dentro do ecrã
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
  menu.querySelector("button")?.focus();
}

function fecharMenu(devolverFoco) {
  if (menu.hidden) return;
  menu.hidden = true;
  document.querySelectorAll(".bg-cartao.selecionado").forEach((c) => c.classList.remove("selecionado"));
  if (devolverFoco && focoAntesDoMenu?.focus) focoAntesDoMenu.focus();
}

menu.addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-item]");
  if (!b) return;
  const item = menu._itens[+b.dataset.item];
  fecharMenu(false);
  try { await item.acao(); } catch (err) { toast(err.message); }
});

menu.addEventListener("keydown", (e) => {
  const botoes = [...menu.querySelectorAll("button")];
  const i = botoes.indexOf(document.activeElement);
  if (e.key === "ArrowDown") { e.preventDefault(); botoes[(i + 1) % botoes.length].focus(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); botoes[(i - 1 + botoes.length) % botoes.length].focus(); }
  else if (e.key === "Home") { e.preventDefault(); botoes[0].focus(); }
  else if (e.key === "End") { e.preventDefault(); botoes[botoes.length - 1].focus(); }
  else if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); fecharMenu(true); }
});

document.addEventListener("mousedown", (e) => { if (!menu.hidden && !menu.contains(e.target)) fecharMenu(false); });
addEventListener("resize", () => fecharMenu(false));
addEventListener("scroll", () => fecharMenu(false), true);

const podeCriar = () => estado.vista === "ficheiros" && !estado.categoria && !estado.pesquisa;

function itensDaArea() {
  const itens = [];
  if (podeCriar()) {
    itens.push(
      { rotulo: "Nova pasta", icone: "novaPasta", acao: novaPasta },
      { rotulo: "Carregar ficheiros", icone: "carregar", acao: () => $("input-ficheiro").click() },
      "-",
    );
  }
  if (estado.vista === "reciclagem" && estado.itens.size) {
    itens.push({ rotulo: "Esvaziar reciclagem", icone: "eliminar", perigo: true, acao: esvaziarReciclagem }, "-");
  }
  itens.push({ rotulo: "Atualizar", icone: "atualizar", acao: atualizarTudo });
  return itens;
}

function itensDoFicheiro(id) {
  const procura = estado.categoria || estado.pesquisa;
  const itens = [
    { rotulo: "Descarregar", icone: "descarregar", acao: () => descarregar(id) },
  ];
  if (procura) itens.push({ rotulo: "Mostrar na pasta", icone: "localizar", acao: () => irParaPastaDe(id) });
  itens.push("-", { rotulo: "Mover para a reciclagem", icone: "eliminar", perigo: true, acao: () => eliminar(id) });
  return itens;
}

function itensDaPasta(caminho) {
  const itens = [
    { rotulo: "Abrir", icone: "abrir", acao: () => abrirPasta(caminho) },
    "-",
    { rotulo: "Eliminar pasta", icone: "eliminar", perigo: true, acao: () => eliminarPasta(caminho) },
  ];
  return itens.concat("-", itensDaArea());
}

function itensDoReciclado(id) {
  return [
    { rotulo: "Recuperar", icone: "restaurar", acao: () => restaurar(id) },
    "-",
    { rotulo: "Eliminar de vez", icone: "eliminar", perigo: true, acao: () => eliminarDeVez(id) },
  ];
}

$("zona-drop").addEventListener("contextmenu", (e) => {
  // Deixar o menu normal do browser nos campos de texto e nas listas de categoria
  if (e.target.closest("select, input, textarea")) return;
  e.preventDefault();
  // Pelo teclado (tecla Menu / Shift+F10) o evento vem sem coordenadas: usar o elemento
  let x = e.clientX, y = e.clientY;
  const alvo = e.target.closest("[data-ficheiro],[data-abrir],[data-reciclado]");
  if (!x && !y) {
    const r = (alvo || e.target).getBoundingClientRect();
    x = r.left + 12; y = r.top + Math.min(r.height, 40);
  }
  if (alvo?.dataset.ficheiro) {
    const f = estado.itens.get(alvo.dataset.ficheiro);
    alvo.classList.add("selecionado");
    abrirMenu(x, y, itensDoFicheiro(alvo.dataset.ficheiro), f?.nome);
  } else if (alvo?.dataset.abrir) {
    abrirMenu(x, y, itensDaPasta(alvo.dataset.abrir), nomePasta(alvo.dataset.abrir));
  } else if (alvo?.dataset.reciclado) {
    const f = estado.itens.get(alvo.dataset.reciclado);
    abrirMenu(x, y, itensDoReciclado(alvo.dataset.reciclado), f?.nome);
  } else {
    abrirMenu(x, y, itensDaArea());
  }
});

// ---------- outros eventos ----------

$("input-ficheiro").onchange = (e) => { enviar([...e.target.files]); e.target.value = ""; };
$("botao-esvaziar").onclick = esvaziarReciclagem;

// Pesquisa: a primeira letra cria uma entrada no histórico, as seguintes só a atualizam
let atrasoPesquisa;
$("pesquisa").oninput = (e) => {
  clearTimeout(atrasoPesquisa);
  atrasoPesquisa = setTimeout(() => {
    const q = e.target.value.trim();
    if (estado.vista !== "ficheiros") { if (q) navegar({ q }); return; }
    if (q) navegar({ q }, { substituir: !!estado.pesquisa });
    else if (estado.pesquisa) history.back();   // apagou a pesquisa: voltar ao que estava antes
  }, estado.vista === "ficheiros" ? 300 : 600);
};

document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-categoria],[data-pasta],[data-abrir],[data-restaurar]");
  if (!t) return;
  // Ctrl/Cmd/Shift/clique do meio: deixar o browser abrir o link num separador novo
  if (t.tagName === "A" && (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0)) return;
  // Noutras páginas (ex.: reciclagem) os links abrem a página de ficheiros normalmente
  if (t.tagName === "A" && estado.vista !== "ficheiros") return;
  e.preventDefault();
  const d = t.dataset;
  try {
    if (d.categoria) navegar({ categoria: d.categoria });
    else if (d.pasta || d.abrir) navegar({ pasta: d.pasta || d.abrir });
    else if (d.restaurar) await restaurar(d.restaurar);
  } catch (err) { toast(err.message); }
});

// Duplo clique / Enter num ficheiro: descarregar
document.addEventListener("dblclick", (e) => {
  const c = e.target.closest("[data-ficheiro]");
  if (c && !e.target.closest("select")) descarregar(c.dataset.ficheiro);
});
document.addEventListener("keydown", (e) => {
  const c = e.target.closest?.("[data-ficheiro]");
  if (c && e.key === "Enter" && e.target === c) descarregar(c.dataset.ficheiro);
  if (c && e.key === "Delete" && e.target === c) eliminar(c.dataset.ficheiro).catch((err) => toast(err.message));
});

document.addEventListener("change", async (e) => {
  const id = e.target.dataset.corrigir;
  if (!id) return;
  try {
    await json(`/ficheiros/${id}/categoria`, "PUT", { categoria: e.target.value });
    toast("Obrigado! A correção vai ajudar a treinar a IA.");
    e.target.blur();
    atualizarTudo();
  } catch (err) { toast(err.message); }
});

// Arrastar e largar
const zona = $("zona-drop");
let contadorArrasto = 0;
const temFicheiros = (e) => [...(e.dataTransfer?.types || [])].includes("Files");
zona.addEventListener("dragenter", (e) => { if (temFicheiros(e)) { contadorArrasto++; zona.classList.add("arrastar"); } });
zona.addEventListener("dragover", (e) => { if (temFicheiros(e)) e.preventDefault(); });
zona.addEventListener("dragleave", () => { if (--contadorArrasto <= 0) { contadorArrasto = 0; zona.classList.remove("arrastar"); } });
zona.addEventListener("drop", (e) => {
  e.preventDefault();
  contadorArrasto = 0;
  zona.classList.remove("arrastar");
  if (alvoPasta(e.target) !== null) return;   // largado numa pasta: tratado abaixo
  if (estado.vista !== "reciclagem" && e.dataTransfer.files.length) enviar([...e.dataTransfer.files]);
});

// ---------- arrastar ficheiros para pastas ----------
// Arrastar um cartão para uma pasta (ou para uma migalha / "Os meus ficheiros") move o ficheiro.
// Arrastar ficheiros do computador para uma pasta carrega-os diretamente nessa pasta.

let arrasto = null;   // { id, pasta } do cartão que está a ser arrastado

function alvoPasta(el) {
  const a = el?.closest?.("[data-abrir],[data-pasta]");
  return a ? (a.dataset.abrir || a.dataset.pasta) : null;
}
const limparAlvos = () => document.querySelectorAll(".alvo-largar").forEach((x) => x.classList.remove("alvo-largar"));

document.addEventListener("dragstart", (e) => {
  const c = e.target.closest?.("[data-ficheiro]");
  if (!c) return;
  const f = estado.itens.get(c.dataset.ficheiro);
  arrasto = { id: c.dataset.ficheiro, pasta: f ? f.pasta : null };
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", f ? f.nome : "");
  fecharMenu(false);
  requestAnimationFrame(() => c.classList.add("a-arrastar"));
});

document.addEventListener("dragend", () => {
  arrasto = null;
  limparAlvos();
  document.querySelectorAll(".a-arrastar").forEach((x) => x.classList.remove("a-arrastar"));
});

document.addEventListener("dragover", (e) => {
  if (estado.vista === "reciclagem") return;
  const destino = alvoPasta(e.target);
  const valido = destino !== null && (arrasto ? destino !== arrasto.pasta : temFicheiros(e));
  const el = valido ? e.target.closest("[data-abrir],[data-pasta]") : null;
  document.querySelectorAll(".alvo-largar").forEach((x) => { if (x !== el) x.classList.remove("alvo-largar"); });
  if (!el) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = arrasto ? "move" : "copy";
  el.classList.add("alvo-largar");
});

document.addEventListener("drop", (e) => {
  const destino = alvoPasta(e.target);
  limparAlvos();
  if (destino === null || estado.vista === "reciclagem") return;
  e.preventDefault();
  if (arrasto) mover(arrasto.id, destino).catch((err) => toast(err.message));
  else if (e.dataTransfer.files.length) enviar([...e.dataTransfer.files], destino);
});

lerEndereco();
carregarCategorias().catch(() => {}).finally(() => { carregar(); carregarResumo(); });
