const STATE = {
  topics: [],
  filteredTopics: [],
  currentTopicId: null,
  lang: localStorage.getItem('tmn_lang') || 'en',
  bookmarksOnly: localStorage.getItem('tmn_bookmarks_only') === '1',
  bookmarks: new Set(JSON.parse(localStorage.getItem('tmn_bookmarks') || '[]')),
  query: ''
};

const el = {
  languageSelect: document.getElementById('languageSelect'),
  searchInput: document.getElementById('searchInput'),
  topicList: document.getElementById('topicList'),
  detailCard: document.getElementById('detailCard'),
  topicItemTemplate: document.getElementById('topicItemTemplate'),
  bookmarkFilterBtn: document.getElementById('bookmarkFilterBtn')
};

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function highlight(text = '', query = '') {
  const safe = escapeHtml(text);
  if (!query.trim()) return safe;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${escaped})`, 'ig'), '<mark>$1</mark>');
}

function savePrefs() {
  localStorage.setItem('tmn_lang', STATE.lang);
  localStorage.setItem('tmn_bookmarks_only', STATE.bookmarksOnly ? '1' : '0');
  localStorage.setItem('tmn_bookmarks', JSON.stringify([...STATE.bookmarks]));
}

function matchesTopic(topic, q) {
  if (!q) return true;
  const bag = [
    topic.topic?.en, topic.topic?.de, topic.topic?.it,
    topic.summary?.en, topic.summary?.de, topic.summary?.it,
    ...(topic.tags || []),
    ...(topic.related_terms || [])
  ].join(' ').toLowerCase();
  return bag.includes(q.toLowerCase());
}

function applyFilters() {
  STATE.filteredTopics = STATE.topics.filter(topic => {
    const bookmarkOk = !STATE.bookmarksOnly || STATE.bookmarks.has(topic.id);
    return bookmarkOk && matchesTopic(topic, STATE.query);
  });

  if (!STATE.filteredTopics.some(t => t.id === STATE.currentTopicId)) {
    STATE.currentTopicId = STATE.filteredTopics[0]?.id || null;
  }
}

function renderTopicList() {
  el.topicList.innerHTML = '';
  if (!STATE.filteredTopics.length) {
    el.topicList.innerHTML = '<p class="empty">No topics found.</p>';
    return;
  }

  for (const topic of STATE.filteredTopics) {
    const node = el.topicItemTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = topic.id;
    if (topic.id === STATE.currentTopicId) node.classList.add('active');

    const title = topic.topic?.[STATE.lang] || topic.topic?.en || topic.id;
    node.querySelector('.topic-item-title').innerHTML = highlight(title, STATE.query);
    const meta = `${topic.tags?.slice(0, 3).join(' Â· ') || ''}`;
    node.querySelector('.topic-item-meta').innerHTML = highlight(meta, STATE.query);

    node.addEventListener('click', () => {
      openTopic(topic.id);
    });

    el.topicList.appendChild(node);
  }
}

function openTopic(id) {
  STATE.currentTopicId = id;
  location.hash = `#/topic/${encodeURIComponent(id)}`;
  render();
}

function toggleBookmark(id) {
  if (STATE.bookmarks.has(id)) STATE.bookmarks.delete(id);
  else STATE.bookmarks.add(id);
  savePrefs();
  applyFilters();
  render();
}

function renderDetail() {
  const topic = STATE.topics.find(t => t.id === STATE.currentTopicId);
  if (!topic) {
    el.detailCard.innerHTML = '<p class="empty">Select a topic.</p>';
    return;
  }

  const title = topic.topic?.[STATE.lang] || topic.topic?.en || topic.id;
  const summary = topic.summary?.[STATE.lang] || topic.summary?.en || '';
  const notes = topic.notes?.[STATE.lang] || topic.notes?.en || '';
  const isBookmarked = STATE.bookmarks.has(topic.id);

  el.detailCard.innerHTML = `
    <div class="badges">
      <span class="badge">${escapeHtml(STATE.lang.toUpperCase())}</span>
      <span class="badge">${escapeHtml(topic.id)}</span>
      ${topic.level ? `<span class="badge">${escapeHtml(topic.level)}</span>` : ''}
    </div>
    <h2>${escapeHtml(title)}</h2>
    <p class="summary">${highlight(summary, STATE.query)}</p>

    <h3 class="section-title">Core explanation</h3>
    <p>${highlight(notes, STATE.query)}</p>

    <h3 class="section-title">Related terms</h3>
    <div class="related-list">
      ${(topic.related_terms || []).map(x => `<span class="link-chip">${highlight(x, STATE.query)}</span>`).join('') || '<span class="muted">None</span>'}
    </div>

    <h3 class="section-title">Articles</h3>
    <div class="article-list">
      ${(topic.articles || []).map(x => `<span class="article-chip">Art. ${escapeHtml(x)}</span>`).join('') || '<span class="muted">Not listed</span>'}
    </div>

    <h3 class="section-title">Tags</h3>
    <div class="tag-list">
      ${(topic.tags || []).map(x => `<span class="tag">${highlight(x, STATE.query)}</span>`).join('') || '<span class="muted">None</span>'}
    </div>

    <div class="actions">
      <button id="bookmarkBtn" class="primary-btn" type="button">${isBookmarked ? 'Remove bookmark' : 'Add bookmark'}</button>
    </div>

    <p class="footer-note">This app is a compact study aid and not legal advice. Adjust the wording as you refine each topic.</p>
  `;

  document.getElementById('bookmarkBtn').addEventListener('click', () => toggleBookmark(topic.id));
}

function syncControls() {
  el.languageSelect.value = STATE.lang;
  el.searchInput.value = STATE.query;
  el.bookmarkFilterBtn.setAttribute('aria-pressed', String(STATE.bookmarksOnly));
  el.bookmarkFilterBtn.textContent = STATE.bookmarksOnly ? 'Showing bookmarks' : 'Bookmarks only';
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
    if (STATE.topics.some(t => t.id === id)) {
      STATE.currentTopicId = id;
      return;
    }
  }
  STATE.currentTopicId = STATE.filteredTopics[0]?.id || STATE.topics[0]?.id || null;
}

async function init() {
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

  window.addEventListener('hashchange', () => {
    syncFromHash();
    render();
  });

  const res = await fetch('./topics.json?v=2026-04-21', { cache: 'no-store' });
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
  el.detailCard.innerHTML = '<p class="empty">Failed to load topics.json.</p>';
});
