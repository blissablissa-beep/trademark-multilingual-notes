const CACHE_NAME = ‘tmn-cache-v2’;

const ASSETS = [
‘./’,
‘./index.html’,
‘./styles.css’,
‘./app.js’,
‘./topics.json’,
‘./manifest.webmanifest’
];

// インストール時にキャッシュ
self.addEventListener(‘install’, (event) => {
event.waitUntil(
caches.open(CACHE_NAME).then((cache) => {
return cache.addAll(ASSETS);
})
);
self.skipWaiting();
});

// 有効化時に古いキャッシュ削除
self.addEventListener(‘activate’, (event) => {
event.waitUntil(
caches.keys().then((keys) =>
Promise.all(
keys.map((key) => {
if (key !== CACHE_NAME) {
return caches.delete(key);
}
})
)
)
);
self.clients.claim();
});

// リクエスト処理
// topics.json はネットワーク優先（更新が即反映されるように）
// その他のアセットはキャッシュ優先
self.addEventListener(‘fetch’, (event) => {
if (event.request.method !== ‘GET’) return;

const url = new URL(event.request.url);
const isTopicsJson = url.pathname.endsWith(‘topics.json’);

if (isTopicsJson) {
// ネットワーク優先：取得できたらキャッシュ更新、失敗時はキャッシュにフォールバック
event.respondWith(
fetch(event.request)
.then((response) => {
return caches.open(CACHE_NAME).then((cache) => {
cache.put(event.request, response.clone());
return response;
});
})
.catch(() => caches.match(event.request))
);
} else {
// キャッシュ優先：キャッシュになければネットワーク取得してキャッシュ保存
event.respondWith(
caches.match(event.request).then((cached) => {
return (
cached ||
fetch(event.request).then((response) => {
return caches.open(CACHE_NAME).then((cache) => {
cache.put(event.request, response.clone());
return response;
});
}).catch(() => cached)
);
})
);
}
});