// analytics/collector.js
(() => {
  const SUPABASE_URL = "https://dxkszikemntfusfyrzos.supabase.co";
  const SUPABASE_KEY = "sb_publishable_NNFvdfSXgOdGGVcSbphbjQ_brC3_9ed";

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const email = localStorage.getItem("usuario_email");
  if (!email) return;

  const page = location.pathname;

  // 🔴 PRESENÇA (heartbeat a cada 15s)
  async function heartbeat() {
    await sb.from("user_presence").upsert({
      email,
      page,
      last_seen: new Date().toISOString()
    });
  }

  heartbeat();
  setInterval(heartbeat, 15000);

  // 📊 EVENTO GENÉRICO
  window.trackEvent = async (payload) => {
    await sb.from("watch_events_raw").insert({
      email,
      ...payload,
      created_at: new Date().toISOString()
    });
  };

})();
