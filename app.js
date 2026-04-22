const STATE = {
  topics: [],
  filteredTopics: [],
  currentTopicId: null,
  lang: localStorage.getItem('tmn_lang') || 'ja',
  bookmarksOnly: localStorage.getItem('tmn_bookmarks_only') === '1',
  bookmarks: new Set(JSON.parse(localStorage.getItem('tmn_bookmarks') || '[]')),
  query: '',
  notesTab: 'law'
};

const el = {
  languageSelect: document.getElementById('languageSelect'),
  searchInput: document.getElementById('searchInput'),
  topicList: document.getElementById('topicList'),
  detailCard: document.getElementById('detailCard'),
  topicItemTemplate: document.getElementById('topicItemTemplate'),
  bookmarkFilterBtn: document.getElementById('bookmarkFilterBtn'),
  menuBtn: document.getElementById('menuBtn'),
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  sidebarCloseBtn: document.getElementById('sidebarCloseBtn')
};

const UI_TEXT = {
  ja: {
    noTopics: '該当するトピックがありません。',
    selectTopic: 'トピックを選択してください。',
    failedLoad: 'topics.json の読み込みに失敗しました。',
    legalNote: '法的説明',
    practiceNote: '実務・商談メモ',
    keyTerms: '関連用語',
    relevantArticles: '関連条文',
    tags: 'タグ',
    none: 'なし',
    notListed: '記載なし',
    addBookmark: 'ブックマークに追加',
    removeBookmark: 'ブックマーク解除',
    bookmarkOnly: 'ブックマークのみ',
    showingBookmarks: 'ブックマーク表示中',
    footer: 'このアプリは商談・実務のための参考用ツールであり、法的助言を提供するものではありません。'
  },
  en: {
    noTopics: 'No topics found.',
    selectTopic: 'Select a topic.',
    failedLoad: 'Failed to load topics.json.',
    legalNote: 'Legal note',
    practiceNote: 'Practice note',
    keyTerms: 'Key terms',
    relevantArticles: 'Relevant articles',
    tags: 'Tags',
    none: 'None',
    notListed: 'Not listed',
    addBookmark: 'Add bookmark',
    removeBookmark: 'Remove bookmark',
    bookmarkOnly: 'Bookmarks only',
    showingBookmarks: 'Showing bookmarks',
    footer: 'This app is a practical reference tool for business discussions and does not constitute legal advice.'
  },
  de: {
    noTopics: 'Keine Themen gefunden.',
    selectTopic: 'Wählen Sie ein Thema aus.',
    failedLoad: 'topics.json konnte nicht geladen werden.',
    legalNote: 'Rechtlicher Hinweis',
    practiceNote: 'Praxishinweis',
    keyTerms: 'Schlüsselbegriffe',
    relevantArticles: 'Relevante Artikel',
    tags: 'Tags',
    none: 'Keine',
    notListed: 'Nicht aufgeführt',
    addBookmark: 'Lesezeichen hinzufügen',
    removeBookmark: 'Lesezeichen entfernen',
    bookmarkOnly: 'Nur Lesezeichen',
    showingBookmarks: 'Lesezeichen werden angezeigt',
    footer: 'Diese App ist ein praktisches Nachschlagewerk für Geschäftsgespräche und stellt keine Rechtsberatung dar.'
  },
  it: {
    noTopics: 'Nessun argomento trovato.',
    selectTopic: 'Seleziona un argomento.',
    failedLoad: 'Impossibile caricare topics.json.',
    legalNote: 'Nota legale',
    practiceNote: 'Nota pratica',
    keyTerms: 'Termini chiave',
    relevantArticles: 'Articoli rilevanti',
    tags: 'Tag',
    none: 'Nessuno',
    notListed: 'Non indicati',
    addBookmark: 'Aggiungi ai preferiti',
    removeBookmark: 'Rimuovi dai preferiti',
    bookmarkOnly: 'Solo preferiti',
    showingBookmarks: 'Visualizzazione preferiti',
    footer: 'Questa app è uno strumento pratico di riferimento per discussioni commerciali e non costituisce consulenza legale.'
  }
};

function t(key) {
  return UI_TEXT[STATE.lang]?.[key] || UI_TEXT.ja[key] || UI_TEXT.en[key] || key;
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

function highlight(text = '', query = '') {
  const safe = escapeHtml(String(text));
  if (!query.trim()) return safe;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${escaped})`, 'ig'), '<mark>$1</mark>');
}

function resolve(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return obj[STATE.lang] || obj.ja || obj.en || Object.values(obj).find(Boolean) || '';
}

function savePrefs() {
  localStorage.setItem('tmn_lang', STATE.lang);
  localStorage.setItem('tmn_bookmarks_only', STATE.bookmarksOnly ? '1' : '0');
  localStorage.setItem('tmn_bookmarks', JSON.stringify([...STATE.bookmarks]));
}

function matchesTopic(topic, q) {
  if (!q) return true;

  const notesBag = [
    resolve(topic.notes?.law),
    resolve(topic.notes?.practice)
  ];

  const bag = [
    resolve(topic.topic),
    resolve(topic.summary),
    ...notesBag,
    ...(topic.tags || []),
    ...(topic.related_terms || [])
  ].filter(Boolean).join(' ').toLowerCase();

  return bag.includes(q.toLowerCase());
}

function applyFilters() {
  STATE.filteredTopics = STATE.topics.filter((topic) => {
    const bookmarkOk = !STATE.bookmarksOnly || STATE.bookmarks.has(topic.id);
    return bookmarkOk && matchesTopic(topic, STATE.query);
  });

  if (!STATE.filteredTopics.some((tp) => tp.id === STATE.currentTopicId)) {
    STATE.currentTopicId = STATE.filteredTopics[0]?.id || null;
  }
}

function renderTopicList() {
  el.topicList.innerHTML = '';

  if (!STATE.filteredTopics.length) {
    el.topicList.innerHTML = `<p class="empty">${escapeHtml(t('noTopics'))}</p>`;
    return;
  }

  for (const topic of STATE.filteredTopics) {
    const node = el.topicItemTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = topic.id;

    if (topic.id === STATE.currentTopicId) {
      node.classList.add('active');
    }

    const title = resolve(topic.topic) || topic.id;
    node.querySelector('.topic-item-title').innerHTML = highlight(title, STATE.query);

    const meta = (topic.tags || []).slice(0, 3).join(' · ');
    node.querySelector('.topic-item-meta').innerHTML = highlight(meta, STATE.query);

    node.addEventListener('click', () => {
      openTopic(topic.id);
      closeSidebar();
    });

    el.topicList.appendChild(node);
  }
}

function openTopic(id) {
  STATE.currentTopicId = id;
  STATE.notesTab = 'law';
  location.hash = `#/topic/${encodeURIComponent(id)}`;
  render();
}

function toggleBookmark(id) {
  if (STATE.bookmarks.has(id)) {
    STATE.bookmarks.delete(id);
  } else {
    STATE.bookmarks.add(id);
  }
  savePrefs();
  applyFilters();
  render();
}

function renderDetail() {
  const topic = STATE.topics.find((tp) => tp.id === STATE.currentTopicId);

  if (!topic) {
    el.detailCard.innerHTML = `<p class="empty">${escapeHtml(t('selectTopic'))}</p>`;
    return;
  }

  const title = resolve(topic.topic) || topic.id;
  const summary = resolve(topic.summary);
  const lawNote = resolve(topic.notes?.law);
  const practiceNote = resolve(topic.notes?.practice);
  const isBookmarked = STATE.bookmarks.has(topic.id);
  const activeTab = STATE.notesTab;

  el.detailCard.innerHTML = `
    <div class="badges">
      <span class="badge">${escapeHtml(STATE.lang.toUpperCase())}</span>
      <span class="badge">${escapeHtml(topic.id)}</span>
      ${topic.level ? `<span class="badge">${escapeHtml(topic.level)}</span>` : ''}
    </div>

    <h2>${escapeHtml(title)}</h2>
    <p class="summary">${highlight(summary, STATE.query)}</p>

    <div class="notes-tabs">
      <button class="notes-tab ${activeTab === 'law' ? 'active' : ''}" data-tab="law" type="button">
        ${escapeHtml(t('legalNote'))}
      </button>
      <button class="notes-tab ${activeTab === 'practice' ? 'active' : ''}" data-tab="practice" type="button">
        ${escapeHtml(t('practiceNote'))}
      </button>
    </div>

    <div class="notes-panel">
      ${activeTab === 'law'
        ? (highlight(lawNote, STATE.query) || `<span class="muted">${escapeHtml(t('notListed'))}</span>`)
        : (highlight(practiceNote, STATE.query) || `<span class="muted">${escapeHtml(t('notListed'))}</span>`)
      }
    </div>

    <h3 class="section-title">${escapeHtml(t('keyTerms'))}</h3>
    <div class="related-list">
      ${(topic.related_terms || []).map((x) => `<span class="link-chip">${highlight(x, STATE.query)}</span>`).join('') || `<span class="muted">${escapeHtml(t('none'))}</span>`}
    </div>

    <h3 class="section-title">${escapeHtml(t('relevantArticles'))}</h3>
    <div class="article-list">
      ${(topic.articles || []).map((x) => `<span class="article-chip">Art. ${escapeHtml(x)}</span>`).join('') || `<span class="muted">${escapeHtml(t('notListed'))}</span>`}
    </div>

    <h3 class="section-title">${escapeHtml(t('tags'))}</h3>
    <div class="tag-list">
      ${(topic.tags || []).map((x) => `<span class="tag">${highlight(x, STATE.query)}</span>`).join('') || `<span class="muted">${escapeHtml(t('none'))}</span>`}
    </div>

    <div class="actions">
      <button id="bookmarkBtn" class="primary-btn${isBookmarked ? ' bookmarked' : ''}" type="button">
        ${isBookmarked ? escapeHtml(t('removeBookmark')) : escapeHtml(t('addBookmark'))}
      </button>
    </div>

    <p class="footer-note">${escapeHtml(t('footer'))}</p>
  `;

  document.getElementById('bookmarkBtn').addEventListener('click', () => toggleBookmark(topic.id));

  el.detailCard.querySelectorAll('.notes-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      STATE.notesTab = btn.dataset.tab;
      renderDetail();
    });
  });
}

function syncControls() {
  el.languageSelect.value = STATE.lang;
  el.searchInput.value = STATE.query;
  el.bookmarkFilterBtn.setAttribute('aria-pressed', String(STATE.bookmarksOnly));
  el.bookmarkFilterBtn.textContent = STATE.bookmarksOnly ? t('showingBookmarks') : t('bookmarkOnly');
}

function render() {
  syncControls();
  renderTopicList();
  renderDetail();
}

function syncFromHash() {
  const match = location.hash.match(/^#\/topic\/(.+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    if (STATE.topics.some((tp) => tp.id === id)) {
      STATE.currentTopicId = id;
      return;
    }
  }
  STATE.currentTopicId = STATE.filteredTopics[0]?.id || STATE.topics[0]?.id || null;
}

function isMobileLayout() {
  return window.matchMedia('(max-width: 860px)').matches;
}

function openSidebar() {
  if (!isMobileLayout()) return;
  el.sidebar.classList.add('open');
  el.sidebarOverlay.classList.add('active');
  el.sidebarOverlay.setAttribute('aria-hidden', 'false');
  el.menuBtn.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  el.sidebar.classList.remove('open');
  el.sidebarOverlay.classList.remove('active');
  el.sidebarOverlay.setAttribute('aria-hidden', 'true');
  el.menuBtn.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

async function init() {
  el.languageSelect.value = STATE.lang;

  el.languageSelect.addEventListener('change', (e) => {
    STATE.lang = e.target.value;
    savePrefs();
    render();
  });

  el.searchInput.addEventListener('input', (e) => {
    STATE.query = e.target.value.trim();
    applyFilters();
    syncFromHash();
    render();
  });

  el.bookmarkFilterBtn.addEventListener('click', () => {
    STATE.bookmarksOnly = !STATE.bookmarksOnly;
    savePrefs();
    applyFilters();
    syncFromHash();
    render();
  });

  el.menuBtn.addEventListener('click', () => {
    if (!isMobileLayout()) return;
    const isOpen = el.sidebar.classList.contains('open');
    isOpen ? closeSidebar() : openSidebar();
  });

  el.sidebarCloseBtn.addEventListener('click', closeSidebar);
  el.sidebarOverlay.addEventListener('click', closeSidebar);

  window.addEventListener('resize', () => {
    if (!isMobileLayout()) {
      closeSidebar();
    }
  });

  window.addEventListener('hashchange', () => {
    syncFromHash();
    render();
  });

  const cacheBust = `v=${new Date().toISOString().slice(0, 10)}`;
  const res = await fetch(`./topics.json?${cacheBust}`, { cache: 'no-store' });
  const data = await res.json();

  STATE.topics = data;
  applyFilters();
  syncFromHash();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

init().catch((err) => {
  console.error(err);
  el.detailCard.innerHTML = `<p class="empty">${escapeHtml(t('failedLoad'))}</p>`;
});