const sb = supabase.createClient(
  "https://dxkszikemntfusfyrzos.supabase.co",
  "sb_publishable_NNFvdfSXgOdGGVcSbphbjQ_brC3_9ed"
);

async function carregar() {

  const filmes = await sb.from("vw_filmes_mais_assistidos").select("*");
  document.getElementById("filmes").innerHTML =
    filmes.data.map(f => `
      <div class="card">
        <img src="${f.capa_url}">
        <div class="info">
          <strong>${f.titulo}</strong><br>
          <span class="small">${f.total_views} views</span><br>
          <span class="small">${f.horas_assistidas.toFixed(1)}h assistidas</span>
        </div>
      </div>
    `).join("");

  const series = await sb.from("vw_series_mais_assistidas").select("*");
  document.getElementById("series").innerHTML =
    series.data.map(s => `
      <div class="card">
        <img src="${s.capa_url}">
        <div class="info">
          <strong>${s.serie_nome}</strong><br>
          <span class="small">${s.total_views} views</span><br>
          <span class="small">${s.horas_assistidas.toFixed(1)}h assistidas</span>
        </div>
      </div>
    `).join("");

  const agora = await sb.from("vw_assistindo_agora").select("*");
  document.getElementById("agora").innerHTML =
    agora.data.map(a => `
      <div class="card">
        <img src="${a.capa_url}">
        <div class="info">
          <strong>${a.serie_nome || 'Filme'}</strong><br>
          <span class="small">Ep ${a.episodio || '-'}</span>
          <div class="progress">
            <span style="width:${a.progress_percent}%"></span>
          </div>
        </div>
      </div>
    `).join("");
}

carregar();
setInterval(carregar, 15000); // 🔄 tempo real
