(function app() {
  const MEMBERS = ["Pastor Aluísio", "Rafaela", "Lucas", "Gustavo", "Luísa", "Dayane"];
  const CHUNK_SIZE = 50;

  const state = {
    songs: [],
    filteredSongs: [],
    selectedSong: null,
    selectedKeys: [],
    lastFocusEl: null
  };

  const el = {
    searchInput: document.getElementById("searchInput"),
    songsList: document.getElementById("songsList"),
    songCount: document.getElementById("songCount"),
    emptyState: document.getElementById("emptyState"),
    toast: document.getElementById("toast"),
    addSongBtn: document.getElementById("addSongBtn"),
    bulkImportBtn: document.getElementById("bulkImportBtn"),
    songModal: document.getElementById("songModal"),
    importModal: document.getElementById("importModal"),
    detailModal: document.getElementById("detailModal"),
    newSongTitle: document.getElementById("newSongTitle"),
    confirmAddSong: document.getElementById("confirmAddSong"),
    bulkText: document.getElementById("bulkText"),
    stripNumbers: document.getElementById("stripNumbers"),
    confirmImport: document.getElementById("confirmImport"),
    importSummary: document.getElementById("importSummary"),
    detailTitle: document.getElementById("detailTitle"),
    keyFields: document.getElementById("keyFields"),
    saveAllKeys: document.getElementById("saveAllKeys"),
    deleteSongBtn: document.getElementById("deleteSongBtn"),
    brandLogo: document.getElementById("brandLogo"),
    brandFallback: document.getElementById("brandFallback")
  };

  function normalizeTitle(title, stripNumberPrefix = false) {
    let value = (title || "").trim();
    if (stripNumberPrefix) {
      value = value.replace(/^\s*\d+[\.\-\)]\s*/, "");
    }
    value = value.replace(/\s+/g, " ").trim();
    const norm = value.toLocaleLowerCase("pt-BR");
    return { title: value, norm };
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => el.toast.classList.remove("show"), 1800);
  }

  function debounce(fn, delay = 300) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  function getFocusable(modal) {
    return modal.querySelector("input, textarea, button, [tabindex]:not([tabindex='-1'])");
  }

  function openModal(modal, focusTarget = null) {
    state.lastFocusEl = document.activeElement;
    modal.classList.remove("hidden");

    // pequeno delay para garantir render/layout antes do foco
    window.setTimeout(() => {
      const target = focusTarget || getFocusable(modal);
      if (target) target.focus();
    }, 0);
  }

  function closeModal(modal) {
    modal.classList.add("hidden");
    if (state.lastFocusEl && typeof state.lastFocusEl.focus === "function") {
      state.lastFocusEl.focus();
    }
  }

  function renderSongs() {
    el.songsList.innerHTML = "";
    el.songCount.textContent = String(state.filteredSongs.length);

    const hasSongs = state.filteredSongs.length > 0;
    el.emptyState.style.display = hasSongs ? "none" : "block";

    state.filteredSongs.forEach((song) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = song.title;
      btn.addEventListener("click", () => openDetail(song.id));
      li.appendChild(btn);
      el.songsList.appendChild(li);
    });
  }

  function applyFilter(query = "") {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    state.filteredSongs = state.songs.filter((song) => song.title_norm.includes(q));
    renderSongs();
  }

  async function loadSongs() {
    if (!window.supabaseClient) {
      showToast("Configure o Supabase para carregar dados.");
      return;
    }

    const { data, error } = await window.supabaseClient
      .from("songs")
      .select("id, title, title_norm")
      .order("title", { ascending: true });

    if (error) {
      console.error(error);
      showToast("Erro ao carregar músicas.");
      return;
    }

    state.songs = data || [];
    applyFilter(el.searchInput.value);
  }

  async function addSong(title) {
    const parsed = normalizeTitle(title);
    if (!parsed.title) {
      showToast("Informe um título válido.");
      return;
    }

    const { error } = await window.supabaseClient
      .from("songs")
      .insert({ title: parsed.title, title_norm: parsed.norm });

    if (error) {
      if (error.code === "23505") {
        showToast("Essa música já existe.");
      } else {
        console.error(error);
        showToast("Erro ao salvar música.");
      }
      return;
    }

    closeModal(el.songModal);
    el.newSongTitle.value = "";
    await loadSongs();
    showToast("Música adicionada.");
  }

  async function openDetail(songId) {
    state.selectedSong = state.songs.find((item) => item.id === songId);
    if (!state.selectedSong) return;

    const { data, error } = await window.supabaseClient
      .from("song_keys")
      .select("id, member_name, key")
      .eq("song_id", songId)
      .order("member_name", { ascending: true });

    if (error) {
      console.error(error);
      showToast("Erro ao carregar tons.");
      return;
    }

    const mapByMember = new Map((data || []).map((k) => [k.member_name, k]));
    state.selectedKeys = MEMBERS.map((name) => {
      const existing = mapByMember.get(name);
      return { id: existing?.id || null, member_name: name, key: existing?.key || "" };
    });

    renderDetail();
    openModal(el.detailModal, el.detailModal.querySelector("input"));
  }

  function renderDetail() {
    el.detailTitle.textContent = state.selectedSong?.title || "Detalhes";
    el.keyFields.innerHTML = "";

    state.selectedKeys.forEach((item, index) => {
      const wrap = document.createElement("div");
      wrap.className = "key-field";

      const label = document.createElement("label");
      label.textContent = item.member_name;

      const input = document.createElement("input");
      input.className = "input-text";
      input.value = item.key;
      input.placeholder = "Ex: G, A, Bb";
      input.dataset.index = String(index);

      input.addEventListener("input", (event) => {
        const i = Number(event.target.dataset.index);
        state.selectedKeys[i].key = event.target.value.trim();
      });

      input.addEventListener("blur", saveAllKeys);

      wrap.append(label, input);
      el.keyFields.appendChild(wrap);
    });
  }

  async function saveAllKeys() {
    if (!state.selectedSong) return;

    const payload = state.selectedKeys.map((item) => ({
      song_id: state.selectedSong.id,
      member_name: item.member_name,
      key: item.key || null
    }));

    const { error } = await window.supabaseClient
      .from("song_keys")
      .upsert(payload, { onConflict: "song_id,member_name" });

    if (error) {
      console.error(error);
      showToast("Erro ao salvar tons.");
      return;
    }

    showToast("Salvo");
  }

  async function deleteSong() {
    if (!state.selectedSong) return;
    const ok = window.confirm(`Deseja excluir "${state.selectedSong.title}"?`);
    if (!ok) return;

    const { error } = await window.supabaseClient.from("songs").delete().eq("id", state.selectedSong.id);

    if (error) {
      console.error(error);
      showToast("Erro ao excluir música.");
      return;
    }

    closeModal(el.detailModal);
    await loadSongs();
    showToast("Música excluída.");
  }

  async function bulkImport() {
    const raw = el.bulkText.value || "";
    const strip = el.stripNumbers.checked;
    const rows = raw.split(/\r?\n/);

    const processed = [];
    const seenPaste = new Set();

    for (const row of rows) {
      const normalized = normalizeTitle(row, strip);
      if (!normalized.title) continue;
      if (seenPaste.has(normalized.norm)) continue;
      seenPaste.add(normalized.norm);
      processed.push(normalized);
    }

    if (!processed.length) {
      el.importSummary.textContent = "Nenhum título válido encontrado no texto colado.";
      return;
    }

    const norms = processed.map((item) => item.norm);
    const { data: existing, error: checkError } = await window.supabaseClient
      .from("songs")
      .select("title_norm")
      .in("title_norm", norms);

    if (checkError) {
      console.error(checkError);
      showToast("Erro ao validar músicas existentes.");
      return;
    }

    const existingSet = new Set((existing || []).map((i) => i.title_norm));
    const toInsert = processed.filter((item) => !existingSet.has(item.norm));

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE).map((item) => ({
        title: item.title,
        title_norm: item.norm
      }));

      const { error } = await window.supabaseClient.from("songs").insert(chunk);
      if (error) {
        console.error(error);
        showToast("Erro durante importação.");
        return;
      }
      inserted += chunk.length;
    }

    const ignored = rows.length - inserted;
    el.importSummary.textContent = [
      `Total colado: ${rows.length}`,
      `Novas inseridas: ${inserted}`,
      `Ignoradas (duplicadas/inválidas): ${ignored}`
    ].join("\n");

    await loadSongs();
    showToast("Importação concluída.");
  }

  function setupLogoFallback() {
    el.brandLogo.addEventListener("error", () => {
      el.brandLogo.style.display = "none";
      el.brandFallback.style.display = "grid";
    });
  }

  function bindEvents() {
    el.searchInput.addEventListener(
      "input",
      debounce((event) => {
        applyFilter(event.target.value);
      }, 300)
    );

    el.addSongBtn.addEventListener("click", () => openModal(el.songModal, el.newSongTitle));
    el.bulkImportBtn.addEventListener("click", () => openModal(el.importModal, el.bulkText));

    el.confirmAddSong.addEventListener("click", () => addSong(el.newSongTitle.value));
    el.newSongTitle.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addSong(el.newSongTitle.value);
    });

    el.confirmImport.addEventListener("click", bulkImport);
    el.saveAllKeys.addEventListener("click", saveAllKeys);
    el.deleteSongBtn.addEventListener("click", deleteSong);

    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.close;
        closeModal(document.getElementById(targetId));
      });
    });

    [el.songModal, el.importModal, el.detailModal].forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal(modal);
      });
    });

    // ESC fecha o modal ativo
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      [el.songModal, el.importModal, el.detailModal].forEach((modal) => {
        if (!modal.classList.contains("hidden")) closeModal(modal);
      });
    });
  }

  async function init() {
    setupLogoFallback();
    bindEvents();
    await loadSongs();
  }

  init();
})();