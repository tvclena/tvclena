(() => {
  const SUPABASE_URL = "https://dxkszikemntfusfyrzos.supabase.co";
  const SUPABASE_KEY = "sb_publishable_NNFvdfSXgOdGGVcSbphbjQ_brC3_9ed";

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const email = localStorage.getItem("usuario_email");
  if (!email) return;

  let sessionStartedAt = null;
  let sentProgress = false;

  function getContext() {
    return window.__CLENA_CONTEXT__ || null;
  }

  function getVideo() {
    return document.querySelector("video");
  }

  function iniciarSessao() {
    if (sessionStartedAt) return;
    sessionStartedAt = Date.now();
    console.log("▶ Sessão iniciada");
  }

  async function enviarProgress(video, item) {
    if (sentProgress) return;

    const elapsed = (Date.now() - sessionStartedAt) / 1000;
    if (elapsed < 10) return; // ⏱ mínimo REAL

    sentProgress = true;

    const percent = Math.floor(
      (video.currentTime / video.duration) * 100
    );

    console.log("📊 Salvando progress", percent);

    await sb.from("watch_progress").upsert({
      email,
      tipo: item.tipo,
      filme_id: item.id || null,
      serie_nome: item.serie_nome || null,
      temporada: item.temporada || null,
      episodio: item.episodio || null,
      progress_percent: percent,
      passed_50: percent >= 50,
      updated_at: new Date().toISOString()
    });
  }

  function bind() {
    const ctx = getContext();
    const video = getVideo();
    if (!ctx || !video) return;

    // 🔥 AUTOPLAY → inicia sozinho
    iniciarSessao();

    video.addEventListener("timeupdate", () => {
      if (!video.duration) return;
      enviarProgress(video, ctx.item);
    });

    video.addEventListener("ended", async () => {
      if (!sessionStartedAt) return;

      const seconds =
        Math.floor((Date.now() - sessionStartedAt) / 1000);

      if (seconds < 10) return;

      await sb.from("watch_sessions").insert({
        email,
        tipo: ctx.item.tipo,
        filme_id: ctx.item.id || null,
        serie_nome: ctx.item.serie_nome || null,
        temporada: ctx.item.temporada || null,
        episodio: ctx.item.episodio || null,
        started_at: new Date(sessionStartedAt).toISOString(),
        ended_at: new Date().toISOString(),
        watched_seconds: seconds
      });

      sessionStartedAt = null;
      sentProgress = false;
    });
  }

  // Observa DOM (player carrega depois)
  const obs = new MutationObserver(bind);
  obs.observe(document.body, { childList: true, subtree: true });
})();
