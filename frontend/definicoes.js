// Blue Garden — página de definições (usa o código partilhado de comum.js)

const LADO_FOTO = 256; // a foto é guardada como um quadrado de 256x256 px

function atualizarControlos() {
  $("remover-foto").hidden = !perfil.fotoUrl;
  $("modo-escuro").checked = document.documentElement.dataset.tema === "escuro";
}

// Recorta o centro da imagem num quadrado e reduz para 256x256 antes do envio
async function prepararFoto(ficheiro) {
  const imagem = await createImageBitmap(ficheiro);
  const lado = Math.min(imagem.width, imagem.height);
  const canvas = Object.assign(document.createElement("canvas"), { width: LADO_FOTO, height: LADO_FOTO });
  canvas.getContext("2d").drawImage(
    imagem,
    (imagem.width - lado) / 2, (imagem.height - lado) / 2, lado, lado,
    0, 0, LADO_FOTO, LADO_FOTO,
  );
  imagem.close();
  // WebP quando o browser suporta; caso contrário o canvas devolve PNG
  return new Promise((ok) => canvas.toBlob(ok, "image/webp", 0.9));
}

$("escolher-foto").addEventListener("click", () => $("input-foto").click());

$("input-foto").addEventListener("change", async (e) => {
  const ficheiro = e.target.files[0];
  e.target.value = "";
  if (!ficheiro) return;
  const botao = $("escolher-foto");
  botao.disabled = true;
  try {
    let blob;
    try {
      blob = await prepararFoto(ficheiro);
    } catch {
      throw new Error("Não foi possível ler esta imagem");
    }
    const fd = new FormData();
    fd.append("foto", blob, "foto");
    await api("/perfil/foto", { method: "PUT", body: fd });
    await carregarFoto(true);
    toast("Foto de perfil atualizada");
  } catch (err) {
    toast(err.message);
  } finally {
    botao.disabled = false;
    atualizarControlos();
  }
});

$("remover-foto").addEventListener("click", async () => {
  try {
    await api("/perfil/foto", { method: "DELETE" });
    await carregarFoto(false);
    toast("Foto de perfil removida");
  } catch (err) { toast(err.message); }
  atualizarControlos();
});

$("modo-escuro").addEventListener("change", async (e) => {
  const tema = e.target.checked ? "escuro" : "claro";
  aplicarTema(tema); // muda logo, sem esperar pelo servidor
  try {
    await json("/perfil/preferencias", "PUT", { tema });
  } catch (err) {
    toast(`Não foi possível guardar: ${err.message}`);
  }
});

atualizarControlos();
perfilPronto.then(atualizarControlos);
