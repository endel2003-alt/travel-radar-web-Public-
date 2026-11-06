// Travel Radar 웹앱 — 데이터는 data/*.json (수집기 내보내기에서 빌드). 라우팅은 해시(#radar, #hotel/accor|1555, #hotels, #guide/accor, #promos).
(() => {
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hImg = (h) => h.img || h.image || '';
// 사진 오류: 보관본이 깨지면 원본 주소로 한 번 더, 그것도 안 되면 자리를 비운다
window.trImgErr = function (el, orig, onFail) { if (orig && el.src !== orig && !el.dataset.retried) { el.dataset.retried = '1'; el.src = orig; return; } if (onFail === 'parent') { el.parentElement?.classList.add('noimg'); } el.remove(); };
const won = (n) => n == null ? '–' : '₩' + Math.round(n).toLocaleString('ko-KR');
// 최근 7일 변동 화살표 (수집기가 ca=바뀐 시각, pc=이전 비용, pp=이전 포인트를 준다). 내리면 초록 ▼, 오르면 빨강 ▲
const chg = (r) => {
  if (!r || !r.ca || Date.now() - r.ca > 7 * 86400e3) return '';
  if (r.pt && r.pp && r.pp !== r.pt) { const d = r.pt - r.pp; return `<span class="chg ${d < 0 ? 'dn' : 'up'}" title="최근 7일 변동 · 이전 ${r.pp.toLocaleString()}pt">${d < 0 ? '▼' : '▲'}${Math.abs(d) >= 10000 ? (Math.abs(d) / 10000).toFixed(1).replace(/\.0$/, '') + '만' : Math.abs(d).toLocaleString()}pt</span>`; }
  if (!r.pt && r.pc != null && r.my != null && r.pc !== r.my) { const d = r.my - r.pc; return `<span class="chg ${d < 0 ? 'dn' : 'up'}" title="최근 7일 변동 · 이전 ${won(r.pc)}">${d < 0 ? '▼' : '▲'}${wonShort(Math.abs(d)).replace('₩', '₩')}</span>`; }
  return '';
};
const wonShort = (n) => n == null ? '–' : n >= 1e8 ? `₩${(n / 1e8).toFixed(1)}억` : n >= 1e4 ? `₩${Math.round(n / 1e4)}만` : won(n);   // 좁은 칸용: ₩48만
const ptShort = (n) => n >= 1e4 ? `${+(n / 1e4).toFixed(1)}만pt` : `${n.toLocaleString()}pt`;   // 9.3만pt
const NARROW = () => window.matchMedia('(max-width: 860px)').matches;
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const BEN = { SUITE: { label: '스위트', icon: '' }, FREE_NIGHT: { label: '무료박', icon: '' }, POINTS: { label: '포인트', icon: '' }, SALE: { label: '세일', icon: '' } };
const CHAIN = { accor: 'Accor', ihg: 'IHG', marriott: 'Marriott', hilton: 'Hilton' };
// 식스센스 예약 페이지 경로(sixsenses.com/en/hotels-resorts/asia-the-pacific/{나라}/{여기}/accommodation/). 이름으로 만든 슬러그가 안 맞는 곳만 적는다
const SIXS_PATH = { CXRNV: 'ninh-van-bay' };
const RAW = { SNU: 'Suite Night Upgrade', STAY_PLUS: 'Stay Plus', RED_HOT: 'Red Hot Room', POINTS: 'Reward Night', POINTS_SUITE: '스위트 포인트 룸', AMB: 'Ambassador 무료 주말', FIVE4: '5박 중 1박 무료 (Stay for 5 Pay for 4)', SALE: '회원 특가', 'marriott:POINTS': '포인트 숙박 (Standard Room)' };
const FREE_SHORT = { STAY_PLUS: '2박 중 1박 무료', AMB: '주말 2박 중 1박 무료', FIVE4: '5박 중 1박 무료' };
const badgeLabel = (r) => r.b === 'FREE_NIGHT' ? (FREE_SHORT[r.br] || BEN.FREE_NIGHT.label) : BEN[r.b].label;
const rawLabel = (r) => RAW[`${r.chain}:${r.br}`] || RAW[r.br] || r.bl || '';
const NOTE = { SNU: 'SNU 1장 사용 · 스위트 확정', STAY_PLUS: '2박 중 1박 무료 (Stay Plus 1장)', RED_HOT: 'Explorer 전용 · 환불 불가', AMB: '2박 중 둘째 밤 무료 (Ambassador 주말 숙박권)', POINTS_SUITE: '스위트 객실 포인트 재고 있음', POINTS: '현금가 대비', FIVE4: '5박 포인트 예약 시 가장 싼 1박 무료', SALE: '회원 전용 요금' };
const ELIG = { SNU: 'ALL Platinum+ · SNU 보유', STAY_PLUS: 'Accor+ Explorer · Stay Plus 보유', RED_HOT: 'Accor+ Explorer', AMB: 'IHG Ambassador', POINTS: 'IHG 회원 · 포인트', POINTS_SUITE: 'IHG 회원 · 포인트', FIVE4: 'Bonvoy 회원 · 포인트', SALE: 'Bonvoy 회원', 'marriott:POINTS': 'Bonvoy 회원 · 포인트' };
const eligLabel = (r) => ELIG[`${r.chain}:${r.br}`] || ELIG[r.br] || '';

const D = { rows: [], hotels: new Map(), promos: [], guides: {}, meta: {} };
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
const fmtD = (s) => `${s.slice(5, 7)}.${s.slice(8, 10)} (${DOW[dow(s)]})`;
// ---------- 한국 공휴일 (2026~2027, 관공서 공휴일 + 근로자의 날·선거일) — 기능 플래그 FEAT.holiday ----------
const FEAT = { holiday: true, flex: true, share: true };   // 기능 켜고 끄기 (별로면 false)
const HOLI_KR = { '2026-01-01': '신정', '2026-02-16': '설 연휴', '2026-02-17': '설날', '2026-02-18': '설 연휴', '2026-03-01': '삼일절', '2026-03-02': '대체휴일', '2026-05-01': '근로자의 날', '2026-05-05': '어린이날', '2026-05-24': '부처님오신날', '2026-05-25': '대체휴일', '2026-06-03': '지방선거', '2026-06-06': '현충일', '2026-08-15': '광복절', '2026-08-17': '대체휴일', '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴', '2026-10-03': '개천절', '2026-10-05': '대체휴일', '2026-10-09': '한글날', '2026-12-25': '성탄절',
  '2027-01-01': '신정', '2027-02-06': '설 연휴', '2027-02-07': '설날', '2027-02-08': '설 연휴', '2027-02-09': '대체휴일', '2027-03-01': '삼일절', '2027-05-01': '근로자의 날', '2027-05-05': '어린이날', '2027-05-13': '부처님오신날', '2027-06-06': '현충일', '2027-08-15': '광복절', '2027-08-16': '대체휴일', '2027-09-14': '추석 연휴', '2027-09-15': '추석', '2027-09-16': '추석 연휴', '2027-10-03': '개천절', '2027-10-04': '대체휴일', '2027-10-09': '한글날', '2027-10-11': '대체휴일', '2027-12-25': '성탄절', '2027-12-27': '대체휴일' };
const holiName = (d) => FEAT.holiday ? (HOLI_KR[d] || '') : '';
const isOff = (d) => !!HOLI_KR[d] || [0, 6].includes(dow(d));
// 연휴 = 주말 포함 3일 이상 연속 쉬는 날. 체크인이 연휴 전날 저녁~연휴 안이고 체크아웃이 연휴 끝 다음날 안이면 "연휴 숙박"
let _lw = null;
function longWeekends() {
  if (_lw) return _lw; _lw = []; const y0 = +todayStr().slice(0, 4); let d = `${y0}-01-01`, end = `${y0 + 1}-12-31`, cur = null;
  for (; d <= end; d = addDays(d, 1)) { if (isOff(d)) { if (!cur) cur = { start: d, end: d }; else cur.end = d; } else if (cur) { if (daysBetween(cur.start, cur.end) >= 2) _lw.push(cur); cur = null; } }
  for (const r of _lw) r.name = Object.keys(HOLI_KR).filter(k => k >= r.start && k <= r.end).map(k => HOLI_KR[k]).find(n => !/연휴|대체/.test(n)) || Object.keys(HOLI_KR).filter(k => k >= r.start && k <= r.end).map(k => HOLI_KR[k])[0] || '주말';
  return _lw;
}
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400e3);
const inLongWeekend = (d, n) => longWeekends().some(r => d >= addDays(r.start, -1) && addDays(d, n || 1) <= addDays(r.end, 1));
const holiTag = (d, cls) => { const n = holiName(d); const lw = FEAT.holiday && !n && longWeekends().find(r => d >= addDays(r.start, -1) && d <= r.end && daysBetween(r.start, r.end) >= 2 && Object.keys(HOLI_KR).some(k => k >= r.start && k <= r.end)); return n ? `<i class="hol ${cls || ''}" title="공휴일">${esc(n)}</i>` : lw ? `<i class="hol lw ${cls || ''}" title="연휴">${esc(lw.name)} 연휴</i>` : ''; };

// ---------- 프로필 (브라우저에만 저장) ----------
const PROFILE_DEFAULT = { accorTier: '', explorer: false, snu: 0, stayPlus: 0, accorPts: 0, accorNights: 0, snuExp: '', stayPlusExp: '', ihgTier: '', ambassador: false, ihgPts: 0, ihgNights: 0, ambExp: '', marriottTier: '', marriottPts: 0, marriottNights: 0, hiltonTier: '', hiltonPts: 0, hiltonNights: 0 };
let profile = Object.assign({}, PROFILE_DEFAULT);
try { profile = Object.assign({}, PROFILE_DEFAULT, JSON.parse(localStorage.getItem('tr_profile') || '{}')); } catch (e) {}
const hasProfile = () => !!(profile.accorTier || profile.ihgTier || profile.marriottTier || profile.hiltonTier);
function eligible(r) {
  // 내 프로필로 쓸 수 있는 혜택인지. 프로필이 없으면 항상 true.
  if (!hasProfile()) return true;
  const chain = r.h.split('|')[0];
  if (chain === 'accor') {
    const tierOk = ['Platinum', 'Diamond', 'Limitless'].includes(profile.accorTier);
    if (r.br === 'SNU') return tierOk && profile.snu > 0;
    if (r.br === 'STAY_PLUS') return profile.explorer && profile.stayPlus > 0;
    if (r.br === 'RED_HOT') return profile.explorer;
    return !!profile.accorTier;
  }
  if (chain === 'hilton') { if (!profile.hiltonTier) return false; if (r.br === 'FIVE4') return ['Silver', 'Gold', 'Diamond'].includes(profile.hiltonTier) && (r.pt || 0) <= (profile.hiltonPts || 0); if (r.b === 'POINTS') return (r.pt || 0) <= (profile.hiltonPts || 0); return true; }
  if (chain === 'marriott') { if (!profile.marriottTier) return false; if (r.b === 'POINTS' || r.br === 'FIVE4') return (r.pt || 0) <= (profile.marriottPts || 0); return true; }
  if (r.br === 'AMB') return profile.ambassador;
  if (r.b === 'POINTS' || r.br === 'POINTS_SUITE') return !!profile.ihgTier && (r.pt || 0) <= (profile.ihgPts || 0);
  return !!profile.ihgTier;
}

// ---------- 딥링크 (행에는 저장하지 않고 재구성) ----------
function link(r) {
  const h = D.hotels.get(r.h); const out = addDays(r.d, r.n || 1);
  if (!h) return '#';
  if (h.chain === 'accor') {
    const q = new URLSearchParams({ destination: h.slug || '', compositions: '2', dateIn: r.d, dateOut: out, nights: String(r.n || 1) });
    if (r.br === 'SNU') { q.set('snu', 'true'); q.set('snuselected', '1'); }
    return `https://all.accor.com/booking/ko/accor/hotel/${h.id}?${q}`;
  }
  if (h.chain === 'marriott') {
    const us = (d) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;
    const q = new URLSearchParams({ propertyCode: h.id, fromDate: us(r.d), toDate: us(out), numberOfRooms: '1', numberOfAdults: '2', isSearch: 'true' }); if (r.b === 'POINTS' || r.br === 'FIVE4') q.set('useRewardsPoints', 'true');
    return `https://www.marriott.com/reservation/availabilitySearch.mi?${q}`;
  }
  if (h.chain === 'hilton') {
    // 힐튼 객실 선택 페이지 (수집기 deeplink와 같은 형식). 포인트·5박 무료는 포인트 요금으로 연다
    const q = new URLSearchParams({ ctyhocn: h.id, arrivalDate: r.d, departureDate: out, numRooms: '1', numAdults: '2', redeemPts: r.b === 'POINTS' || r.br === 'FIVE4' || r.pt ? 'true' : 'false' });
    return `https://www.hilton.com/ko/book/reservation/rooms/?${q}`;
  }
  if (h.chain !== 'ihg') return '#';
  if (/six senses|식스 ?센스/i.test(`${h.brand || ''} ${h.name || ''}`)) {
    // 식스센스는 ihg.com 에 호텔 페이지가 없어 redirect 가 /explore 로 떨어진다 → sixsenses.com 예약 페이지로 직접 (호텔 코드 + 날짜)
    const us = (d) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;
    const CTRY = { VN: 'vietnam', TH: 'thailand', JP: 'japan', SG: 'singapore', KR: 'south-korea', HK: 'hong-kong' };
    const prop = SIXS_PATH[h.id] || `${h.name || ''}`.replace(/six senses|식스 ?센스/i, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const q = new URLSearchParams({ Hotel: h.id, Arrive: us(r.d), Depart: us(out), Rooms: '1', Adult: '2', Child: '0' });
    return `https://www.sixsenses.com/en/hotels-resorts/asia-the-pacific/${CTRY[h.cc] || 'vietnam'}/${prop}/accommodation/?${q}`;
  }
  const di = new Date(r.d + 'T00:00:00Z'), doo = new Date(out + 'T00:00:00Z');
  const my = (d) => String(d.getUTCMonth()).padStart(2, '0') + d.getUTCFullYear();
  const q = new URLSearchParams({ path: 'hd', brandCode: h.bc || '6C', localeCode: 'ko', regionCode: 'kr', hotelCode: h.id, checkInDate: String(di.getUTCDate()), checkInMonthYear: my(di), checkOutDate: String(doo.getUTCDate()), checkOutMonthYear: my(doo), rateCode: r.br === 'AMB' ? 'IBAMB' : 'IVANI', adultCount: '2', childCount: '0', roomCount: '1' });
  return `https://www.ihg.com/redirect?${q}`;
}

// ---------- 서버(Supabase)에서 읽기 ----------
// tr_data() 하나로 rows/hotels/promos/meta를 받는다. 무료는 오늘+7일, Pro·운영자는 전부 (서버가 자른다).
async function loadFromServer() {
  const S = window.TR_SERVER; const headers = { apikey: S.anon, Authorization: `Bearer ${S.anon}`, 'Content-Type': 'application/json' };
  try { const tok = localStorage.getItem('tr_token'); if (tok) headers.Authorization = `Bearer ${tok}`; } catch (e) {}
  let res = await fetch(`${S.url.replace(/\/$/, '')}/rest/v1/rpc/tr_data`, { method: 'POST', headers, body: '{}' });
  if ((res.status === 401 || res.status === 403) && headers.Authorization !== `Bearer ${S.anon}`) {
    // 내 토큰이 만료·무효 → 로그아웃 처리하고 손님으로 다시 (옛 data/ 폴더로 조용히 넘어가지 않게)
    authSave(null); headers.Authorization = `Bearer ${S.anon}`;
    res = await fetch(`${S.url.replace(/\/$/, '')}/rest/v1/rpc/tr_data`, { method: 'POST', headers, body: '{}' });
  }
  if (!res.ok) throw new Error('server ' + res.status);
  const d = await res.json(); if (!d || !Array.isArray(d.rows)) return null;
  d.meta = d.meta || {}; d.meta.source = 'server'; return d;
}
// ---------- 데이터 로드 ----------
// 서버 데이터 캐시: 마지막으로 받은 tr_data를 브라우저(Cache API)에 보관 → 다음 방문 땐 즉시 그리고, 뒤에서 새 데이터를 받아 바뀌었으면 조용히 다시 그림
const DCACHE = 'tr-data-cache';
const dataKey = () => '/__trdata/' + (AUTH.s?.user_id || 'guest');
async function dataCacheGet() { try { const c = await caches.open(DCACHE); const r = await c.match(dataKey()); return r ? await r.json() : null; } catch (e) { return null; } }
async function dataCachePut(d) { try { const c = await caches.open(DCACHE); await c.put(dataKey(), new Response(JSON.stringify(d), { headers: { 'content-type': 'application/json' } })); } catch (e) {} }
const loadGuides = () => fetch('guides.json').then(r => r.ok ? r.json() : Promise.reject()).catch(() => fetch('data/guides.json').then(r => r.json())).catch(() => ({}));
let QUIET = false;   // true면 다시 그릴 때 맨 위로 스크롤하지 않음
async function load() {
  if (window.TR_SERVER?.url && !window.TR_PROVIDER) {
    authFromHash(); await authEnsure();
    const guidesP = loadGuides(); const cached = await dataCacheGet(); const prof0 = JSON.stringify(profile);
    const fresh = Promise.all([profilePull(), loadFromServer()]).then(([, d]) => d); loadWatches();
    if (cached?.rows) {
      applyData(Object.assign({}, cached, { guides: await guidesP }));
      fresh.then(async (d) => {
        if (!d) return; dataCachePut(d);
        const changed = JSON.stringify([d.meta?.uploadedAt, d.meta?.pro, d.meta?.horizon, d.rows.length]) !== JSON.stringify([cached.meta?.uploadedAt, cached.meta?.pro, cached.meta?.horizon, cached.rows.length]) || JSON.stringify(profile) !== prof0;
        if (changed) { QUIET = true; applyData(Object.assign({}, d, { guides: await guidesP })); QUIET = false; }
      }).catch(() => {});
      return;
    }
    const d = await fresh.catch(() => null);
    if (d) { dataCachePut(d); return applyData(Object.assign({}, d, { guides: await guidesP })); }
  }
  return loadLegacy();
}
async function loadLegacy() {
  // 데이터 출처: 확장 프로그램 안에서는 window.TR_PROVIDER(수집 DB 직접), 사이트에서는 data/*.json
  let rows, hotels, promos, guides, meta;
  if (window.TR_PROVIDER) { ({ rows, hotels, promos, guides, meta } = await window.TR_PROVIDER()); }
  else if (window.TR_SERVER?.url && await loadFromServer().then(d => { if (!d) return false; ({ rows, hotels, promos, meta } = d); return true; }).catch(() => false)) {
    guides = await fetch('guides.json').then(r => r.ok ? r.json() : Promise.reject()).catch(() => fetch('data/guides.json').then(r => r.json())).catch(() => ({}));
  }
  else { [rows, hotels, promos, guides, meta] = await Promise.all(['radar', 'hotels', 'promos', 'guides', 'meta'].map(n => fetch(`data/${n}.json`).then(r => r.json()))); try { meta.areaGeo = meta.areaGeo || await fetch('data/areas.json').then(r => r.json()); } catch (e) {} }
  return applyData({ rows, hotels, promos, guides, meta });
}
// 정가 이상치 보정: 일반실이 매진된 날엔 남은 가장 싼 현금 요금이 클럽·스위트라 '정가'가 평소의 몇 배로 잡힌다
// → 포인트·특가 절약액이 부풀어 티어 가치 1위로 올라온다. 호텔별 평소 1박 정가(중앙값)의 2배를 넘으면 평소 값으로 보정.
// 스위트 업그레이드(SUITE)는 원래 객실 차액이 정가라 제외. 기준: 평소 1박 정가(중앙값)의 2배 초과.
function fixOddRefs(rows) {
  // 기준 = 같은 호텔·같은 혜택 종류에서 같은 요일의 앞뒤 주 중앙값(없으면 앞뒤 4일). 성수기 계단식 인상·주말 요금은 안 걸리고,
  // 일반실 매진으로 하루만 튀는 값만 보정한다.
  const groups = new Map();
  for (const r of rows) { if (r.b === 'SUITE' || !r.ref) continue; const k = `${r.h}|${r.br || r.b}`; (groups.get(k) || groups.set(k, []).get(k)).push(r); }
  const day = (d) => Math.round(Date.parse(d + 'T00:00:00Z') / 86400e3);
  for (const list of groups.values()) {
    if (list.length < 4) continue; list.sort((x, y) => x.d.localeCompare(y.d));
    const per = list.map(r => ({ r, t: day(r.d), v: r.ref / (r.n || 1) }));
    for (let i = 0; i < per.length; i++) {
      const me = per[i];
      // 두 기준을 모두 넘어야 이상치: ① 같은 요일의 앞뒤 주(±7·14·21일) 중앙값의 2배 — 주말 요금이 평일의 2~3배인 리조트 보호
      //                               ② 앞뒤 3일 중앙값의 2배 — 성수기 계단식 인상(이웃 날짜도 같이 높음) 보호
      const medOf = (a) => { a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
      const wk = per.filter((o, j) => j !== i && [7, 14, 21].includes(Math.abs(o.t - me.t))).map(o => o.v);
      const near = per.filter((o, j) => j !== i && Math.abs(o.t - me.t) <= 3).map(o => o.v);
      if (wk.length < 2 || near.length < 2) continue;
      const m = Math.max(medOf(wk), medOf(near)); const r = me.r; const n = r.n || 1;
      if (me.v > m * 2.0) {
        const k = (m * n) / r.ref; r.ref0 = r.ref; r.ref = Math.round(m * n); r.ap = 1; r.odd = 1;
        if (r.b === 'FREE_NIGHT' && !r.pt) { if (r.my != null) r.my = Math.round(r.my * k); if (r.sv != null) r.sv = Math.round(r.sv * k); }
        else if (r.my != null) r.sv = r.ref - r.my;
      }
    }
  }
}
function applyData({ rows, hotels, promos, guides, meta }) {
  $('#loadingNote')?.remove();
  rows = rows.map(r => Object.assign({}, r)); hotels = hotels.map(h => Object.assign({}, h));
  for (const h of hotels) if (h.image && !/^https?:/i.test(h.image)) h.image = (h.chain === 'hilton' ? 'https://www.hilton.com' : h.chain === 'ihg' ? 'https://digital.ihg.com' : h.chain === 'marriott' ? 'https://cache.marriott.com' : 'https://www.ahstatic.com') + (h.image.startsWith('/') ? '' : '/') + h.image;   // 상대 경로 사진 → 절대 주소
  // IHG는 호텔 이름이 브랜드 없이 오는 경우가 많다("Kobe", "Grand Stanford Hong Kong") → 이름에 브랜드가 없으면 앞에 붙인다. 운영자가 이름을 직접 고친 호텔은 그대로
  const BRAND_RE = [[/intercontinental|인터[콘컨]티넨탈|\bIC\b/i], [/holiday inn|홀리데이 ?인/i], [/crowne plaza|크라운 ?플라자/i], [/\bvoco\b|보코/i], [/indigo|인디고/i], [/kimpton|킴튼/i], [/six senses|식스 ?센스/i], [/regent|리젠트/i], [/staybridge|스테이브리지/i], [/garner|가너/i], [/candlewood|캔들우드/i], [/\bavid\b|에이비드/i], [/\beven\b/i]];
  for (const h of hotels) {
    if (h.chain !== 'ihg' || !h.brand || !h.name || h._edited?.name) continue;
    const b = h.brand.replace(/\s*hotels?( & resorts)?$/i, '').trim(); if (!b) continue;
    if (/vignette/i.test(b)) { if (!/vignette|비녜트/i.test(h.name)) h.name = `${h.name}, Vignette Collection`; continue; }
    const re = BRAND_RE.find(([r]) => r.test(b))?.[0];
    const has = re ? re.test(h.name) : h.name.toLowerCase().includes(b.toLowerCase());
    if (!has) h.name = `${b} ${h.name}`;
  }
  // 보관본(img)이 있으면 그걸 먼저, 못 읽으면 호텔 서버 주소(image)로. 사이트는 data/ 옆의 img/ 폴더, 확장은 DB의 blob URL.
  D.rows = rows; D.hotels = new Map(hotels.map(h => [h.key, h])); D.promos = promos; D.guides = guides; D.meta = meta;
  // 확장 안에서 계정 정보가 있고 프로필을 아직 안 적었으면 계정 값으로 채워 준다
  const acc = meta.accounts; if (acc && !hasProfile() && (acc.accor || acc.ihg || acc.marriott || acc.hilton)) {
    const a = acc.accor, i = acc.ihg; const item = (x, n) => (x?.items || []).find(t => t.name === n)?.count || 0; const exp = (x, n) => (x?.items || []).find(t => t.name === n)?.expires || '';
    profile = Object.assign({}, PROFILE_DEFAULT, { accorTier: a ? (String(a.tier || '').replace(/^ALL\s*/i, '') || 'Classic') : '', explorer: !!(a?.subscriptions || []).some(s => /Explorer|Accor\+|Plus/i.test(s.label || '')), snu: item(a, 'SNU'), stayPlus: item(a, 'Stay Plus'), accorPts: a?.points || 0, accorNights: a?.nights || 0, snuExp: exp(a, 'SNU'), stayPlusExp: exp(a, 'Stay Plus'),
      ihgTier: i ? (/다이아|Diamond/i.test(i.tier) ? 'Diamond' : /플래티|Platinum/i.test(i.tier) ? 'Platinum' : /골드|Gold/i.test(i.tier) ? 'Gold' : /실버|Silver/i.test(i.tier) ? 'Silver' : 'Club') : '', ambassador: item(i, 'Ambassador') > 0, ihgPts: i?.points || 0, ihgNights: i?.nights || 0, ambExp: exp(i, 'Ambassador'), marriottTier: acc.marriott ? (String(acc.marriott.tier || 'Member')) : '', marriottPts: acc.marriott?.points || 0, marriottNights: acc.marriott?.nights || 0, hiltonTier: acc.hilton ? (/Diamond|Gold|Silver/.exec(acc.hilton.tier || '')?.[0] || 'Member') : '', hiltonPts: acc.hilton?.points || 0, hiltonNights: acc.hilton?.nights || 0 });
    try { localStorage.setItem('tr_profile', JSON.stringify(profile)); } catch (e) {}
  }
  for (const r of rows) { const h = D.hotels.get(r.h); r.hn = h ? h.name : r.h; r.cc = h?.cc; r.city = h?.city; r.chain = r.h.split('|')[0]; }
  fixOddRefs(rows);
  if (window.TR_PROVIDER) { const b = $('#collectorBtn'); if (b) { b.hidden = false; b.href = '../app.html'; } }
  $('#meta').textContent = meta.collectedAt ? `마지막 수집 ${new Date(meta.collectedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '';
  fillWhere(); $('#filtersBox').open = false; renderAuth(); route();
}


// ---------- 로그인 (Supabase Auth · 이메일 링크) ----------
// 비밀번호 없음: 이메일로 받은 링크를 누르면 로그인. 세션(토큰)은 이 브라우저에 저장, 프로필은 서버(tr_profiles)에 저장돼 어디서 열어도 같다.
const AUTH = { s: null };
const authBase = () => (window.TR_SERVER?.url || '').replace(/\/$/, '') + '/auth/v1';
const SITE_URL = () => location.origin + location.pathname;
function authSave(sess) { AUTH.s = sess; try { if (sess) { localStorage.setItem('tr_auth', JSON.stringify(sess)); localStorage.setItem('tr_token', sess.access_token); } else { localStorage.removeItem('tr_auth'); localStorage.removeItem('tr_token'); } } catch (e) {} }
const jwtPayload = (t) => { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return {}; } };
const authUser = () => AUTH.s ? { email: AUTH.s.email, id: AUTH.s.user_id } : null;
// 1) 주소창 해시에 로그인 결과(#access_token=…)가 실려 오면 세션으로 바꾸고 해시를 지운다
function authFromHash() {
  const h = location.hash.slice(1); if (!/(^|&)access_token=/.test(h) && !/(^|&)error=/.test(h)) return;
  const q = new URLSearchParams(h);
  if (q.get('error')) { alert('로그인 실패: ' + (q.get('error_description') || q.get('error')).replace(/\+/g, ' ')); }
  else { const at = q.get('access_token'); const pl = jwtPayload(at); authSave({ access_token: at, refresh_token: q.get('refresh_token'), expires_at: Date.now() + (+q.get('expires_in') || 3600) * 1000, email: pl.email || '', user_id: pl.sub || '' }); }
  history.replaceState(null, '', location.pathname + location.search + '#radar');
}
// 2) 토큰이 만료 직전이면 갱신
async function authEnsure() {
  try { AUTH.s = JSON.parse(localStorage.getItem('tr_auth') || 'null'); } catch (e) {}
  if (!AUTH.s) return;
  if ((AUTH.s.expires_at || 0) - Date.now() > 5 * 60 * 1000) return;
  try {
    const r = await fetch(`${authBase()}/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: window.TR_SERVER.anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: AUTH.s.refresh_token }) });
    if (!r.ok) throw new Error('refresh ' + r.status);
    const j = await r.json(); authSave({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, email: j.user?.email || AUTH.s.email, user_id: j.user?.id || AUTH.s.user_id });
  } catch (e) { authSave(null); }
}
async function authSendLink(email) {
  const r = await fetch(`${authBase()}/otp?redirect_to=${encodeURIComponent(SITE_URL())}`, { method: 'POST', headers: { apikey: window.TR_SERVER.anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, create_user: true }) });
  if (!r.ok) { const t = await r.json().catch(() => ({})); throw new Error(t.msg || t.error_description || t.error || ('HTTP ' + r.status)); }
}
async function authLogout() {
  try { if (AUTH.s) await fetch(`${authBase()}/logout`, { method: 'POST', headers: { apikey: window.TR_SERVER.anon, Authorization: `Bearer ${AUTH.s.access_token}` } }); } catch (e) {}
  authSave(null); location.reload();
}
// 3) 프로필 서버 동기화: 로그인돼 있으면 서버 것을 쓰고, 서버에 없고 이 기기에 있으면 올린다
const restHeaders = () => ({ apikey: window.TR_SERVER.anon, Authorization: `Bearer ${AUTH.s.access_token}`, 'Content-Type': 'application/json' });
async function profilePull() {
  if (!AUTH.s) return;
  try {
    const r = await fetch(`${window.TR_SERVER.url.replace(/\/$/, '')}/rest/v1/tr_profiles?select=data&user_id=eq.${AUTH.s.user_id}`, { headers: restHeaders() });
    if (!r.ok) return; const rows = await r.json();
    if (rows[0]?.data && Object.keys(rows[0].data).length) { profile = Object.assign({}, PROFILE_DEFAULT, rows[0].data); try { localStorage.setItem('tr_profile', JSON.stringify(profile)); } catch (e) {} }
    else if (hasProfile()) await profilePush();
  } catch (e) {}
}
async function profilePush() {
  if (!AUTH.s) return;
  try { await fetch(`${window.TR_SERVER.url.replace(/\/$/, '')}/rest/v1/rpc/tr_save_profile`, { method: 'POST', headers: restHeaders(), body: JSON.stringify({ p: profile }) }); } catch (e) {}
}
// 4) 화면: 상단 버튼 · More 시트 · 로그인 창
function renderAuth() {
  const u = authUser(); const pro = !!D.meta?.pro;
  for (const el of document.querySelectorAll('.authBtn')) { el.hidden = !window.TR_SERVER?.url; el.innerHTML = u ? `<span class="who">${esc(u.email.split('@')[0])}</span>${pro ? '<b class="pro">PRO</b>' : ''}` : '로그인'; el.title = u ? u.email : ''; }
  const ck = $('#checkLink'); if (ck) ck.hidden = !D.meta?.owner; const mck = $('#moreCheck'); if (mck) mck.hidden = !D.meta?.owner;
  const m = $('#moreAuth'); if (m) m.textContent = u ? `Account — ${u.email}${pro ? ' · PRO' : ''} · 로그아웃` : 'Login — 이메일로 로그인';
  for (const lim of document.querySelectorAll('.limitNote')) { const t = limitText(); lim.hidden = !t; lim.innerHTML = t; }
}
// 무료 범위(오늘+7일) 안내문 — 서버 데이터이고 pro가 아닐 때만
function limitText() {
  const m = D.meta || {}; const u = authUser();
  if (m.source !== 'server' || m.pro || !m.horizon || !m.fullDateTo || m.horizon >= m.fullDateTo) return '';
  return u ? `무료 회원은 <b>오늘부터 7일</b>까지만 보여요. 전체(${m.fullDateTo.slice(5).replace('-', '.')}까지)는 멤버십에서 열립니다.` : `지금은 <b>오늘부터 7일</b>까지만 보여요. <a href="#" data-login>로그인</a>하면 더 긴 기간을 볼 수 있어요.`;
}
function openLogin() {
  const u = authUser(); const d = $('#dlgLogin'); if (!d) return;
  $('#loginIn').hidden = !!u; $('#loginOut').hidden = !u; $('#loginMsg').textContent = '';
  if (u) $('#loginWho').textContent = `${u.email}${D.meta?.pro ? ' · PRO' : ' · 무료'}`;
  d.showModal(); if (!u) setTimeout(() => $('#loginEmail').focus(), 50);
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('.authBtn, [data-login], #moreAuth'); if (!a) return; e.preventDefault(); $('#dlgMore')?.open && $('#dlgMore').close(); openLogin();
});
$('#loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault(); const email = $('#loginEmail').value.trim(); const msg = $('#loginMsg'); if (!email) return;
  const b = $('#loginSend'); b.disabled = true; msg.textContent = '보내는 중…';
  try { await authSendLink(email); msg.innerHTML = `<b>${esc(email)}</b> 로 로그인 링크를 보냈어요. 메일의 링크를 <b>이 기기에서</b> 누르면 로그인됩니다. (안 오면 스팸함 확인 · 1시간에 몇 통까지만 보낼 수 있어요)`; }
  catch (err) { msg.textContent = '보내지 못했어요: ' + err.message; }
  b.disabled = false;
});
$('#loginLogout')?.addEventListener('click', (e) => { e.preventDefault(); authLogout(); });
// 구글 로그인: Supabase가 구글로 보냈다가 사이트로 돌려보내며 #access_token 을 붙여준다 (이메일 링크와 같은 처리)
$('#loginGoogle')?.addEventListener('click', () => { location.href = `${authBase()}/authorize?provider=google&redirect_to=${encodeURIComponent(SITE_URL())}`; });


// ---------- 운영자 편집 모드 ----------
// 운영자(tr_is_owner)에게만 호텔 화면에 '호텔 정보 수정' 버튼. 저장은 서버 tr_overrides 에 → 매일 수집이 덮어쓰지 않는다.
const EDIT_LABEL = { name: '이름', brand: '브랜드', stars: '성급', lounge: '라운지', city: '지역', img: '사진', note: '메모' };
let editKey = null; let editFile = null;
// 사진 파일 → 브라우저에서 1280px WebP로 줄여 서버 사진 저장소 img/manual/ 에 올린다 (운영자만 허용, SQL 03)
async function shrinkImage(file, max = 1280) {
  const bmp = await createImageBitmap(file); const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('변환 실패')), 'image/webp', 0.85));
}
async function uploadHotelPhoto(key, file) {
  if (!AUTH.s) throw new Error('로그인이 필요해요'); await authEnsure();
  const blob = await shrinkImage(file); const name = `manual/${key.replace(/[^A-Za-z0-9]+/g, '-')}-${Date.now()}.webp`; const base = window.TR_SERVER.url.replace(/\/$/, '');
  const r = await fetch(`${base}/storage/v1/object/img/${name}`, { method: 'POST', headers: { apikey: window.TR_SERVER.anon, Authorization: `Bearer ${AUTH.s.access_token}`, 'Content-Type': 'image/webp', 'x-upsert': 'true', 'Cache-Control': 'public, max-age=604800' }, body: blob });
  if (!r.ok) { const t = await r.json().catch(() => ({})); throw new Error((t.message || t.error || 'HTTP ' + r.status) + (r.status === 403 || r.status === 400 ? ' (SQL 03을 실행했는지 확인)' : '')); }
  return `${base}/storage/v1/object/public/img/${name}`;
}
$('#editFile')?.addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; editFile = f; $('#editFileName').textContent = `${f.name} · 저장할 때 올라가요`; const pv = $('#editPreview'); pv.src = URL.createObjectURL(f); pv.hidden = false; $('#editForm').img.value = ''; });
function openHotelEditor(key) {
  const h = D.hotels.get(key); const d = $('#dlgEdit'); if (!h || !d) return; editKey = key; const f = $('#editForm');
  $('#editTitle').textContent = h.name; $('#editMsg').textContent = '';
  f.name.value = h.name || ''; f.brand.value = h.brand || ''; f.city.value = h.city || ''; f.img.value = (h._edited?.img) || ''; f.note.value = h.note || '';
  f.stars.value = h._edited?.stars != null ? String(h._edited.stars) : ''; f.lounge.value = h._edited?.lounge === true ? 'yes' : h._edited?.lounge === false ? 'no' : '';
  $('#editAuto').textContent = `수집 값 · 성급 ${starsOf(Object.assign({}, h, { stars: h._edited?.stars != null ? null : h.stars }))?.n || '?'}성 · 라운지 ${hasLounge(Object.assign({}, h, { lounge: h._edited?.lounge != null ? undefined : h.lounge })) === true ? '있음' : hasLounge(h) === false ? '없음' : '브랜드 추정'}`;
  editFile = null; $('#editFile').value = ''; $('#editFileName').textContent = ''; const pv = $('#editPreview'); if (hImg(h)) { pv.src = hImg(h); pv.hidden = false; } else pv.hidden = true;
  $('#editReset').hidden = !h._edited; d.showModal();
}
async function saveOverride(key, p) {
  if (!AUTH.s) throw new Error('로그인이 필요해요');
  await authEnsure();
  const r = await fetch(`${window.TR_SERVER.url.replace(/\/$/, '')}/rest/v1/rpc/tr_save_override`, { method: 'POST', headers: restHeaders(), body: JSON.stringify({ k: key, p }) });
  if (!r.ok) { const t = await r.json().catch(() => ({})); throw new Error(t.message || ('HTTP ' + r.status)); }
  // 새 데이터로 다시 그리기 (수정이 반영된 호텔 목록)
  const d = await loadFromServer(); if (d) { dataCachePut(d); QUIET = true; applyData(Object.assign({}, d, { guides: D.guides })); QUIET = false; }
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-edit-hotel]'); if (b) { e.preventDefault(); openHotelEditor(b.dataset.editHotel); } });
$('#editForm')?.addEventListener('submit', async (e) => {
  e.preventDefault(); const h = D.hotels.get(editKey); if (!h) return; const f = $('#editForm'); const msg = $('#editMsg');
  const p = Object.assign({}, h._edited || {});
  const txt = (k, v) => { v = v.trim(); if (!v) delete p[k]; else if (v !== (h._edited?.[k] ?? h[k] ?? '')) p[k] = v; else if (h._edited?.[k] == null) delete p[k]; };
  txt('name', f.name.value); txt('brand', f.brand.value); txt('city', f.city.value); txt('note', f.note.value);
  let img = f.img.value.trim();
  if (editFile) { try { msg.textContent = '사진 올리는 중…'; img = await uploadHotelPhoto(editKey, editFile); } catch (err) { msg.textContent = '사진 업로드 실패: ' + err.message; return; } }
  if (img) { if (!/^https:\/\//.test(img)) { msg.textContent = '사진 주소는 https:// 로 시작해야 해요'; return; } p.img = img; } else delete p.img;
  if (f.stars.value) p.stars = +f.stars.value; else delete p.stars;
  if (f.lounge.value === 'yes') p.lounge = true; else if (f.lounge.value === 'no') p.lounge = false; else delete p.lounge;
  msg.textContent = '저장 중…'; $('#editSave').disabled = true;
  try { await saveOverride(editKey, p); $('#dlgEdit').close(); } catch (err) { msg.textContent = '저장 실패: ' + err.message; }
  $('#editSave').disabled = false;
});
$('#editReset')?.addEventListener('click', async () => {
  if (!confirm('이 호텔의 수정 내용을 지우고 수집된 값으로 되돌릴까요?')) return;
  const msg = $('#editMsg'); msg.textContent = '되돌리는 중…';
  try { await saveOverride(editKey, {}); $('#dlgEdit').close(); } catch (err) { msg.textContent = '실패: ' + err.message; }
});


// ---------- 여행 플래너 ----------
// 기간+지역 → 날짜마다 내가 쓸 수 있는 혜택을 깔고, 이어지는 밤을 조합해 3안을 만든다.
// 값 = 절약액(sv) + 티어 혜택 가치(bv × 박수). 바우처(SNU·Stay Plus) 개수와 체인별 포인트 잔액 안에서만. 호텔을 옮기면 감점.
const PLAN = { last: null };
const MOVE_PENALTY = 60000;
function planOptions(from, nights, where, opt) {
  const dates = Array.from({ length: nights }, (_, i) => addDays(from, i)); const idx = Object.fromEntries(dates.map((d, i) => [d, i]));
  const okHotel = (h) => {
    if (!h) return false;
    if (where) { const [k, cc, city] = where.split(':'); if (k === 'c' && h.cc !== cc) return false; if (k === 't' && (h.cc !== cc || h.city !== city)) return false; }
    if (opt.lounge && hasLounge(h) === false) return false;
    if (opt.stars && (starsOf(h)?.n || 0) < opt.stars) return false;
    return true;
  };
  const bvCache = new Map(); const bv = (h) => { if (!bvCache.has(h.key)) bvCache.set(h.key, benefitValue(tierBenefits(h))); return bvCache.get(h.key); };
  const out = [];
  for (const r of D.rows) {
    if (!(r.d in idx)) continue; const n = r.n || 1; if (idx[r.d] + n > nights) continue;
    if (hasProfile() && !eligible(r)) continue;
    const h = D.hotels.get(r.h); if (!okHotel(h)) continue;
    const isPt = !!r.pt && (r.b === 'POINTS' || r.br === 'FIVE4' || r.br === 'POINTS_SUITE');
    out.push({ r, h, s: idx[r.d], n, value: (r.sv || 0) + bv(h) * n, cash: isPt ? 0 : (r.my ?? 0), pts: isPt ? r.pt : 0, chain: h.chain, snu: r.br === 'SNU' ? 1 : 0, sp: r.br === 'STAY_PLUS' ? 1 : 0 });
  }
  return { dates, opts: out };
}
// DP: 밤 i, 마지막 호텔, 이동 횟수, 쓴 SNU, 쓴 Stay Plus → 최고 점수
function planDP(nights, opts, score, { maxMoves = 1, snu = 9, sp = 9, onlyHotel = null } = {}) {
  const byStart = Array.from({ length: nights }, () => []); for (const o of opts) if (!onlyHotel || o.h.key === onlyHotel) byStart[o.s].push(o);
  let layer = new Map([['|0|0|0', { sc: 0, path: [], last: '', mv: 0, su: 0, pu: 0 }]]); const layers = [layer];
  const best = Array.from({ length: nights + 1 }, () => new Map()); best[0] = layer;
  for (let i = 0; i < nights; i++) {
    for (const st of best[i].values()) {
      const push = (j, ns) => { const k = `${ns.last}|${ns.city || ''}|${ns.mv}|${ns.su}|${ns.pu}`; const cur = best[j].get(k); if (!cur || ns.sc > cur.sc) best[j].set(k, ns); };
      push(i + 1, Object.assign({}, st, { path: st.path.concat([{ gap: true, s: i }]) }));   // 혜택 없는 밤
      for (const o of byStart[i]) {
        const move = st.last && st.last !== o.h.key ? 1 : 0; if (st.mv + move > maxMoves) continue;
        if (st.city && st.city !== (o.h.city || '')) continue;   // 호텔 이동은 같은 도시 안에서만 (창원→서울 같은 일정 방지)
        if (st.su + o.snu > snu || st.pu + o.sp > sp) continue;
        push(i + o.n, { sc: st.sc + score(o) - move * MOVE_PENALTY, path: st.path.concat([o]), last: o.h.key, city: o.h.city || '', mv: st.mv + move, su: st.su + o.snu, pu: st.pu + o.sp });
      }
    }
  }
  let top = null; for (const st of best[nights].values()) if (!top || st.sc > top.sc) top = st; return top;
}
function planFix(nights, opts, score, lim) {
  // 체인별 포인트 잔액 초과 시: 가장 비효율적인 포인트 옵션을 빼고 다시 (최대 12번)
  const bal = { accor: profile.accorPts || 0, ihg: profile.ihgPts || 0, marriott: profile.marriottPts || 0, hilton: profile.hiltonPts || 0 };
  let pool = opts.slice();
  for (let t = 0; t < 12; t++) {
    const st = planDP(nights, pool, score, lim); if (!st) return null;
    const used = {}; for (const o of st.path) if (!o.gap && o.pts) used[o.chain] = (used[o.chain] || 0) + o.pts;
    const over = hasProfile() ? Object.keys(used).find(c => used[c] > bal[c]) : null; if (!over) return st;
    const worst = st.path.filter(o => !o.gap && o.pts && o.chain === over).sort((a, b) => a.value / a.pts - b.value / b.pts)[0]; pool = pool.filter(o => o !== worst);
  }
  return null;
}
function planSummary(st, dates) {
  const segs = []; for (const o of st.path) { if (o.gap) { const last = segs[segs.length - 1]; if (last?.gap) last.n++; else segs.push({ gap: true, s: o.s, n: 1 }); } else segs.push(o); }
  const t = { value: 0, cash: 0, pts: {}, snu: 0, sp: 0, covered: 0, moves: st.mv };
  for (const o of st.path) if (!o.gap) { t.value += o.value; t.cash += o.cash; if (o.pts) t.pts[o.chain] = (t.pts[o.chain] || 0) + o.pts; t.snu += o.snu; t.sp += o.sp; t.covered += o.n; }
  return { segs, t, dates };
}
function makePlans(from, nights, where, opt) {
  const { dates, opts } = planOptions(from, nights, where, opt);
  if (!opts.length) return { dates, plans: [], n: 0 };
  const lim = { maxMoves: opt.moves, snu: hasProfile() ? (profile.snu || 0) : 9, sp: hasProfile() ? (profile.stayPlus || 0) : 9 };
  const plans = [];
  const A = planFix(nights, opts, o => o.value, lim); if (A) plans.push(Object.assign({ key: 'max', title: '혜택 최대', sub: '티어 가치가 가장 큰 조합' }, planSummary(A, dates)));
  // 한 호텔에서 쭉: 호텔마다 계산해서 (덮는 밤 수, 가치)가 가장 큰 곳
  let B = null; for (const hk of new Set(opts.map(o => o.h.key))) { const st = planFix(nights, opts, o => o.value + o.n * 1e6, Object.assign({}, lim, { onlyHotel: hk, maxMoves: 0 })); if (st && (!B || st.sc > B.sc)) B = st; }
  if (B) plans.push(Object.assign({ key: 'one', title: '한 호텔에서 쭉', sub: '짐 한 번만 푸는 일정' }, planSummary(B, dates)));
  // 현금 최소: 밤을 최대한 덮되 현금을 가장 적게 (포인트·바우처 우선)
  const C = planFix(nights, opts, o => o.n * 1e6 - o.cash + o.value * 0.05, lim); if (C) plans.push(Object.assign({ key: 'cash', title: '현금 최소', sub: '포인트·바우처를 먼저 쓰는 조합' }, planSummary(C, dates)));
  // 같은 결과는 하나로
  const seen = new Set(); const uniq = plans.filter(p => { const k = p.segs.map(x => x.gap ? 'g' + x.n : x.r.h + x.r.d + x.r.br).join(','); if (seen.has(k)) return false; seen.add(k); return true; });
  return { dates, plans: uniq, n: opts.length };
}
function planCard(p) {
  const fmt = (d) => `${d.slice(5).replace('-', '.')} ${DOW[dow(d)]}`;
  const segs = p.segs.map(o => {
    if (o.gap) return `<li class="gap"><span class="pd">${fmt(p.dates[o.s])}${o.n > 1 ? ` – ${fmt(addDays(p.dates[o.s], o.n))}` : ''} · ${o.n}박</span><span class="ph muted">혜택 없는 밤 · 일반 예약이나 다른 체인으로</span></li>`;
    const r = o.r, h = o.h; const isPt = !!o.pts;
    return `<li><span class="pd">${fmt(r.d)} – ${fmt(addDays(r.d, o.n))} · ${o.n}박</span>
      <span class="ph"><a href="#hotel/${encodeURIComponent(h.key)}">${esc(h.name)}</a> <span class="muted small">${starsHtml(h)}${CHAIN[h.chain]} · ${esc(h.city || '')}</span></span>
      <span class="pb"><span class="badge ${r.b}">${badgeLabel(r)}</span> ${isPt ? `${o.pts.toLocaleString()}pt` : won(r.my)}${chg(r)}</span>
      <span class="pv">+${won(o.value)} <a class="lnk small" href="${link(r)}" target="_blank" rel="noopener">예약 ↗</a></span></li>`;
  }).join('');
  const pts = Object.entries(p.t.pts).map(([c, v]) => `${CHAIN[c]} ${v.toLocaleString()}pt`).join(' · ');
  const used = [p.t.snu ? `SNU ${p.t.snu}장` : '', p.t.sp ? `Stay Plus ${p.t.sp}장` : '', pts].filter(Boolean).join(' · ');
  return `<article class="pcard ${p.key}"><header><b>${p.title}</b><span class="muted">${p.sub}</span></header>
    <div class="ptot"><div><em>+${won(p.t.value)}</em><span>티어 가치</span></div><div><em>${won(p.t.cash)}</em><span>현금</span></div><div><em>${p.t.covered}/${p.dates.length}</em><span>혜택 박</span></div><div><em>${p.t.moves}</em><span>이동</span></div></div>
    ${used ? `<p class="small muted" style="margin:6px 0 0">사용: ${esc(used)}</p>` : ''}
    <ol class="psegs">${segs}</ol></article>`;
}
function viewPlan() {
  const el = $('#v-plan'); const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const lp = PLAN.last || { from: addDays(today, 7) > (D.meta.dateTo || today) ? today : addDays(today, 7), nights: 3, where: '', lounge: false, stars: 0, moves: 1 };
  el.innerHTML = `<h1>여행 플래너</h1><p class="lead">기간과 지역을 고르면, <b>내 티어·바우처·포인트</b>로 쓸 수 있는 혜택을 이어 붙여 숙박 일정 3안을 만들어요. ${hasProfile() ? '' : '<a href="#" data-open-profile>티어를 넣으면</a> 내가 쓸 수 있는 것만으로 계산해요.'}</p>
    <form id="planForm" class="pform">
      <label>체크인<input type="date" name="from" value="${lp.from}" min="${D.meta.dateFrom || today}" max="${D.meta.dateTo || ''}"></label>
      <label>박수<select name="nights">${Array.from({ length: 14 }, (_, i) => `<option value="${i + 1}" ${lp.nights === i + 1 ? 'selected' : ''}>${i + 1}박</option>`).join('')}</select></label>
      <label class="w">어디<select name="where">${$('#fWhere')?.innerHTML || '<option value="">전체</option>'}</select></label>
      <label>호텔 이동<select name="moves"><option value="0" ${lp.moves === 0 ? 'selected' : ''}>안 옮김</option><option value="1" ${lp.moves === 1 ? 'selected' : ''}>최대 1번</option><option value="2" ${lp.moves === 2 ? 'selected' : ''}>최대 2번</option></select></label>
      <label>성급<select name="stars"><option value="0">전체</option><option value="4" ${lp.stars === 4 ? 'selected' : ''}>4성 이상</option><option value="5" ${lp.stars === 5 ? 'selected' : ''}>5성만</option></select></label>
      <label class="ck"><input type="checkbox" name="lounge" ${lp.lounge ? 'checked' : ''}> 라운지 있는 곳</label>
      <button class="btn" type="submit">일정 짜기</button>
    </form>
    <div id="planOut"></div>
    <p class="small muted" style="margin-top:18px">※ 1박·2박 단위로 수집한 결과를 이어 붙인 추정이에요. 연박 요금·객실 재고는 예약 직전 각 체인 공식 사이트에서 확인하세요.</p>`;
  const f = $('#planForm'); f.where.value = lp.where;
  const go = () => {
    const q = { from: f.from.value, nights: +f.nights.value, where: f.where.value, moves: +f.moves.value, stars: +f.stars.value, lounge: f.lounge.checked }; PLAN.last = q;
    const out = $('#planOut');
    if (q.from < (D.meta.dateFrom || '') || addDays(q.from, q.nights - 1) > (D.meta.dateTo || '9999')) { out.innerHTML = `<div class="empty">지금 데이터는 ${D.meta.dateFrom?.slice(5).replace('-', '.')} – ${D.meta.dateTo?.slice(5).replace('-', '.')} 범위예요. 그 안에서 골라 주세요.${D.meta.pro ? '' : ' (무료는 오늘부터 7일)'}</div>`; return; }
    const res = makePlans(q.from, q.nights, q.where, q);
    out.innerHTML = res.plans.length ? `<div class="plgrid">${res.plans.map(planCard).join('')}</div>` : `<div class="empty">이 기간·지역에 ${hasProfile() ? '내가 쓸 수 있는 ' : ''}혜택이 없어요. 날짜를 옮기거나 지역을 넓혀 보세요.</div>`;
  };
  f.addEventListener('submit', (e) => { e.preventDefault(); go(); });
  if (PLAN.last) go();
}


// ---------- 운영자 데이터 점검 ----------
// 의심스러운 데이터를 한 화면에: 정가 이상치(보정된 행) · 사진 없는 호텔 · 지역 미배정 · 이름 의심 · 체인별 수집 상태. 각 줄에서 호텔 편집으로 바로.
function viewCheck() {
  const el = $('#v-check');
  if (!D.meta?.owner) { el.innerHTML = '<h1>데이터 점검</h1><div class="empty">운영자만 볼 수 있어요.</div>'; return; }
  const H = [...D.hotels.values()]; const rows = D.rows;
  const byChain = {}; for (const r of rows) byChain[r.chain] = (byChain[r.chain] || 0) + 1;
  const hByChain = {}; for (const h of H) hByChain[h.chain] = (hByChain[h.chain] || 0) + 1;
  const hl = (h) => `<a href="#hotel/${encodeURIComponent(h.key)}">${esc(h.name)}</a> <span class="muted small">${CHAIN[h.chain]} · ${esc(h.country || h.cc || '')} ${esc(h.city || '')}</span>`;
  // 1) 정가 이상치 (사이트에서 보정한 행)
  const odd = rows.filter(r => r.odd).sort((a, b) => (b.ref0 / (b.n || 1)) / (b.ref / (b.n || 1)) - (a.ref0 / (a.n || 1)) / (a.ref / (a.n || 1)));
  const oddBy = new Map(); for (const r of odd) (oddBy.get(r.h) || oddBy.set(r.h, []).get(r.h)).push(r);
  // 2) 사진 없음
  const noImg = H.filter(h => !hImg(h));
  // 3) 지역 미배정
  const noCity = H.filter(h => !h.city || h.city === '기타');
  // 4) 이름 의심: 코드 그대로·"단계"·너무 짧음·한글 없음(일본·동남아는 영문 허용)
  const badName = H.filter(h => !h.name || h.name === h.id || /단계|객실 선택/.test(h.name) || h.name.length < 4);
  // 5) 혜택 없는 호텔
  const hotelsWithRows = new Set(rows.map(r => r.h)); const noRows = H.filter(h => !hotelsWithRows.has(h.key));
  // 6) 수정됨
  const edited = H.filter(h => h._edited);
  const sec = (title, n, body, open = false) => `<details ${open ? 'open' : ''}><summary><b>${title}</b> <span class="muted">${n}</span></summary>${body}</details>`;
  const list = (arr, f, max = 80) => arr.length ? `<ul class="chk">${arr.slice(0, max).map(f).join('')}</ul>${arr.length > max ? `<p class="muted small">… 외 ${arr.length - max}곳</p>` : ''}` : '<p class="muted small">없음</p>';
  el.innerHTML = `<h1>데이터 점검</h1><p class="lead">운영자 전용. 의심스러운 데이터를 모아 보여줘요. 호텔 이름을 누르면 바로 수정할 수 있어요. 마지막 수집 ${D.meta.collectedAt ? new Date(D.meta.collectedAt).toLocaleString('ko-KR') : '–'} · 데이터 범위 ${D.meta.dateFrom || ''} – ${D.meta.dateTo || ''}</p>
    <div class="kpis">${['accor', 'ihg', 'marriott', 'hilton'].map(c => `<div class="kpi ${byChain[c] ? '' : 'warn'}"><b>${(byChain[c] || 0).toLocaleString()}</b><span>${CHAIN[c]} 혜택 · 호텔 ${hByChain[c] || 0}</span></div>`).join('')}<div class="kpi"><b>${rows.length.toLocaleString()}</b><span>전체 행</span></div></div>
    ${sec('정가 이상치 (하루만 2배 넘게 튀어 보정됨)', `${odd.length}행 · ${oddBy.size}곳`, list([...oddBy.entries()].sort((a, b) => b[1].length - a[1].length), ([k, rs]) => { const h = D.hotels.get(k) || { key: k, name: k }; const worst = rs[0]; return `<li>${hl(h)} <span class="small">· ${rs.length}행 · 예: ${worst.d.slice(5).replace('-', '.')} ${badgeLabel(worst)} 정가 ${won(worst.ref0)} → ${won(worst.ref)}</span></li>`; }), true)}
    ${sec('사진 없는 호텔', noImg.length, list(noImg, h => `<li>${hl(h)}</li>`))}
    ${sec('지역 미배정 (기타)', noCity.length, list(noCity, h => `<li>${hl(h)} <span class="small muted">· 수집 도시 "${esc(h.city0 || '')}"${h.lat ? ` · ${h.lat.toFixed(2)}, ${h.lng.toFixed(2)}` : ' · 좌표 없음'}</span></li>`))}
    ${sec('이름 의심', badName.length, list(badName, h => `<li>${hl(h)} <span class="small muted">· "${esc(h.name)}"</span></li>`))}
    ${sec('혜택이 하나도 없는 호텔', noRows.length, list(noRows, h => `<li>${hl(h)}</li>`))}
    ${sec('운영자가 수정한 호텔', edited.length, list(edited, h => `<li>${hl(h)} <span class="small muted">· ${Object.keys(h._edited).map(k => EDIT_LABEL[k] || k).join(', ')}</span></li>`))}`;
}


// ---------- 관심 목록 + 알림 ----------
// 관심(tr_watches)은 사용자가 걸어두는 조건, 알림(tr_alerts)은 수집기가 새 데이터와 맞춰 넣는다. 사이트는 읽고(읽음 처리), 관심을 추가·삭제만 한다.
const WATCH = { list: [], alerts: [], unread: 0 };
const restUrl = (p) => `${window.TR_SERVER.url.replace(/\/$/, '')}/rest/v1/${p}`;
async function loadWatches() {
  if (!AUTH.s || !window.TR_SERVER?.url) { WATCH.list = []; WATCH.alerts = []; WATCH.unread = 0; renderBell(); return; }
  try { await authEnsure();
    const [w, a] = await Promise.all([
      fetch(restUrl('tr_watches?select=*&active=eq.true&order=created_at.desc'), { headers: restHeaders() }).then(r => r.ok ? r.json() : []),
      fetch(restUrl('tr_alerts?select=*&order=created_at.desc&limit=200'), { headers: restHeaders() }).then(r => r.ok ? r.json() : [])]);
    WATCH.list = w; WATCH.alerts = a; WATCH.unread = a.filter(x => !x.read_at).length;
  } catch (e) {}
  renderBell();
}
function renderBell() {
  for (const el of document.querySelectorAll('.bellBtn')) { el.hidden = !AUTH.s; el.innerHTML = `알림${WATCH.unread ? `<b class="bdg">${WATCH.unread}</b>` : ''}`; }
  const m = $('#moreAlerts'); if (m) { m.hidden = !AUTH.s; m.textContent = `Alerts — 알림${WATCH.unread ? ` (${WATCH.unread})` : ''} · 관심 ${WATCH.list.length}`; }
}
async function markAlertsRead() {
  const ids = WATCH.alerts.filter(a => !a.read_at).map(a => a.id); if (!ids.length) return;
  try { await fetch(restUrl(`tr_alerts?id=in.(${ids.join(',')})`), { method: 'PATCH', headers: restHeaders(), body: JSON.stringify({ read_at: new Date().toISOString() }) }); for (const a of WATCH.alerts) a.read_at = a.read_at || new Date().toISOString(); WATCH.unread = 0; renderBell(); } catch (e) {}
}
async function addWatch(p) {
  await authEnsure();
  const r = await fetch(restUrl('rpc/tr_add_watch'), { method: 'POST', headers: restHeaders(), body: JSON.stringify({ p }) });
  if (!r.ok) { const t = await r.json().catch(() => ({})); throw new Error((t.message || t.hint || ('HTTP ' + r.status)).replace(/^.*?: /, '')); }
  await loadWatches();
}
async function removeWatch(id) { await authEnsure(); await fetch(restUrl(`tr_watches?id=eq.${id}`), { method: 'DELETE', headers: restHeaders() }); await loadWatches(); }
// "열리면 알려줘" 창: 호텔 화면(호텔 고정) 또는 검색 화면(지금 조건: 지역·날짜·혜택)
function openWatchDialog(preset) {
  const d = $('#dlgWatch'); if (!d) return;
  if (!AUTH.s) { openLogin(); return; }
  const f = $('#watchForm'); f.reset(); $('#watchMsg').textContent = '';
  $('#watchTarget').textContent = preset.hotel_key ? `호텔 · ${preset.hn}` : preset.cc ? `지역 · ${preset.where}` : '전체 지역';
  f.hotel_key.value = preset.hotel_key || ''; f.cc.value = preset.cc || ''; f.city.value = preset.city || '';
  f.date_from.value = preset.date_from || ''; f.date_to.value = preset.date_to || '';
  for (const cb of f.querySelectorAll('input[name=b]')) cb.checked = !preset.b || preset.b.includes(cb.value);
  f.maxPt.value = preset.maxPt || ''; f.maxMy.value = preset.maxMy || ''; f.label.value = preset.label || '';
  d.showModal();
}
$('#watchForm')?.addEventListener('submit', async (e) => {
  e.preventDefault(); const f = e.target; const msg = $('#watchMsg'); const b = [...f.querySelectorAll('input[name=b]:checked')].map(x => x.value);
  if (!b.length) { msg.textContent = '혜택을 하나 이상 고르세요'; return; }
  const cond = { b }; if (+f.maxPt.value) cond.maxPt = +f.maxPt.value; if (+f.maxMy.value) cond.maxMy = Math.round(+f.maxMy.value);
  const p = { hotel_key: f.hotel_key.value, cc: f.cc.value, city: f.city.value, date_from: f.date_from.value || null, date_to: f.date_to.value || null, cond, label: f.label.value || $('#watchTarget').textContent };
  msg.textContent = '저장 중…'; $('#watchSave').disabled = true;
  try { await addWatch(p); $('#dlgWatch').close(); if (location.hash === '#alerts') viewAlerts(); } catch (err) { msg.textContent = err.message; }
  $('#watchSave').disabled = false;
});
document.addEventListener('click', (e) => {
  const w = e.target.closest('[data-watch-hotel]'); if (w) { e.preventDefault(); const h = D.hotels.get(w.dataset.watchHotel); if (h) openWatchDialog({ hotel_key: h.key, hn: h.name }); return; }
  const q = e.target.closest('[data-watch-query]'); if (q) { e.preventDefault(); const whereV = $('#fWhere')?.value || ''; const [k, cc, city] = whereV.split(':'); const whereT = $('#fWhere')?.selectedOptions?.[0]?.textContent || '전체';
    openWatchDialog({ cc: cc || '', city: k === 't' ? city : '', where: whereT, date_from: $('#fFrom')?.value, date_to: $('#fTo')?.value, b: ui.benefits.size < 4 ? [...ui.benefits] : null }); return; }
  const b = e.target.closest('.bellBtn, #moreAlerts'); if (b) { e.preventDefault(); $('#dlgMore')?.open && $('#dlgMore').close(); location.hash = '#alerts'; return; }
  const del = e.target.closest('[data-del-watch]'); if (del) { e.preventDefault(); if (confirm('이 관심을 지울까요?')) removeWatch(del.dataset.delWatch).then(() => viewAlerts()); }
});
function alertText(a) {
  const x = a.data || {};
  if (a.kind === 'voucher') return `<b>${esc(x.name)} ${x.count}장</b>이 <b>${esc(x.exp)}</b>에 만료돼요 (${x.days}일 남음). 쓸 수 있는 곳을 <a href="#radar">지금 확인</a>하세요.`;
  const how = x.br === 'SNU' ? 'SNU 스위트' : x.br === 'STAY_PLUS' ? 'Stay Plus 1+1' : x.br === 'AMB' ? '앰배서더 주말 1+1' : x.br === 'FIVE4' ? '포인트 5박 무료' : x.b === 'POINTS' ? '포인트' : x.b === 'SALE' ? '회원 특가' : x.b === 'SUITE' ? '스위트' : '혜택';
  const cost = x.pt ? `${x.pt.toLocaleString()}pt` : x.my != null ? won(x.my) : '';
  return `<a href="#hotel/${encodeURIComponent(x.h)}"><b>${esc(x.hn)}</b></a> ${x.d.slice(5).replace('-', '.')} ${DOW[dow(x.d)]}${x.n > 1 ? ` · ${x.n}박` : ''} — <b>${how}</b> 열림${cost ? ` · ${cost}` : ''}${x.sv ? ` · 절약 ${won(x.sv)}` : ''}${x.label ? ` <span class="muted small">(${esc(x.label)})</span>` : ''}`;
}
function viewAlerts() {
  const el = $('#v-alerts');
  if (!AUTH.s) { el.innerHTML = `<h1>알림</h1><div class="empty"><a href="#" data-login>로그인</a>하면 관심 호텔이 열릴 때 알려드려요.</div>`; return; }
  const ws = WATCH.list, as = WATCH.alerts; const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const wline = (w) => { const h = w.hotel_key ? D.hotels.get(w.hotel_key) : null; const target = h ? `<a href="#hotel/${encodeURIComponent(h.key)}">${esc(h.name)}</a>` : w.city ? esc(w.city) : w.cc ? esc((D.meta.countries || []).find(c => c.cc === w.cc)?.label || w.cc) : '전체 지역';
    const c = w.cond || {}; const bits = [(c.b || []).map(b => BEN[b]?.label || b).join('·'), c.maxPt ? `≤${c.maxPt.toLocaleString()}pt` : '', c.maxMy ? `≤${won(c.maxMy)}/박` : '', w.date_from || w.date_to ? `${(w.date_from || '').slice(5)}~${(w.date_to || '').slice(5)}` : '아무 때나'].filter(Boolean).join(' · ');
    return `<li><span>${target} <span class="muted small">${bits}</span></span><a href="#" class="lnk small" data-del-watch="${w.id}">지우기</a></li>`; };
  el.innerHTML = `<h1>알림</h1><p class="lead">관심으로 걸어둔 조건이 새 수집에서 <b>처음 열리는 순간</b> 여기에 쌓여요. 바우처 만료도 60·30·14·7일 전에 알려드려요. ${D.meta?.pro ? '' : '무료는 관심 1개, <b>PRO</b>는 무제한이에요.'}</p>
    <h2>내 관심 <span class="muted small">${ws.length}</span> <button type="button" class="btn" data-watch-query style="margin-left:12px">지금 검색 조건으로 추가</button></h2>
    ${ws.length ? `<ul class="wlist">${ws.map(wline).join('')}</ul>` : '<p class="muted">아직 없어요. 호텔 화면의 "열리면 알려줘"나 위 버튼으로 추가하세요.</p>'}
    <h2>최근 알림 <span class="muted small">${as.length}</span></h2>
    ${as.length ? `<ul class="alist">${as.map(a => `<li class="${a.read_at ? '' : 'new'}"><span class="at">${new Date(a.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span><span>${alertText(a)}</span></li>`).join('')}</ul>` : '<p class="muted">아직 알림이 없어요. 다음 수집(매일 새벽)부터 조건이 맞으면 생겨요.</p>'}`;
  markAlertsRead();
}


// ---------- 데이터 뉴스 ----------
// 외부 기사가 아니라 우리 수집 데이터에서 나오는 소식: 새로 열린 혜택 · 포인트가/현금 하락 · 마감 임박 · 새로 들어온 호텔 · 어제 대비 규모
function newsItems() {
  const now = Date.now(); const h48 = now - 48 * 3600e3; const today = new Date(now + 9 * 3600e3).toISOString().slice(0, 10);
  const H = D.hotels; const name = (k) => H.get(k)?.name || k; const city = (k) => H.get(k)?.city || '';
  const rows = D.rows; const mine = hasProfile() ? rows.filter(eligible) : rows;
  const how = (r) => r.br === 'SNU' ? 'SNU 스위트' : r.br === 'STAY_PLUS' ? 'Stay Plus 1+1' : r.br === 'AMB' ? '앰배서더 주말 1+1' : r.br === 'FIVE4' ? '포인트 5박 무료' : r.b === 'POINTS' ? '포인트' : r.b === 'SALE' ? '회원 특가' : r.b === 'SUITE' ? '스위트' : BEN[r.b]?.label || '';
  const dstr = (d) => `${d.slice(5).replace('-', '.')} ${DOW[dow(d)]}`;
  const link = (r) => `<a href="#hotel/${encodeURIComponent(r.h)}">${esc(name(r.h))}</a>`;
  const out = [];
  // 1) 새로 들어온 호텔 (모든 행이 48시간 안에 처음 보임)
  const byH = new Map(); for (const r of rows) (byH.get(r.h) || byH.set(r.h, []).get(r.h)).push(r);
  const newHotels = [...byH.entries()].filter(([, rs]) => rs.length >= 3 && rs.every(r => r.first && r.first >= h48)).map(([k]) => H.get(k)).filter(Boolean);
  if (newHotels.length) { const byC = {}; for (const h of newHotels) (byC[h.country || h.cc] = byC[h.country || h.cc] || []).push(h);
    out.push({ kind: 'new-hotels', title: `새로 들어온 호텔 ${newHotels.length}곳`, sub: Object.entries(byC).map(([c, a]) => `${c} ${a.length}`).join(' · '), items: newHotels.slice(0, 12).map(h => `<a href="#hotel/${encodeURIComponent(h.key)}">${esc(h.name)}</a> <span class="muted small">${esc(h.city || '')}</span>`), more: newHotels.length > 12 ? newHotels.length - 12 : 0 }); }
  // 2) 새로 열린 혜택 (48시간) — 희소 혜택(스위트·1+1) 우선, 티어 가치 순
  const freshRows = mine.filter(r => r.first && r.first >= h48 && !newHotels.some(h => h.key === r.h));
  if (freshRows.length) { const g = groupHotels(freshRows).sort((a, b) => b.tierValue - a.tierValue);
    out.push({ kind: 'fresh', title: `새로 열린 혜택 ${freshRows.length}건 · ${g.length}곳`, sub: ['SUITE', 'FREE_NIGHT', 'POINTS', 'SALE'].map(b => { const n = freshRows.filter(r => r.b === b).length; return n ? `${BEN[b].label} ${n}` : ''; }).filter(Boolean).join(' · '),
      items: g.slice(0, 10).map(o => `${link(o.best)} <span class="small">${dstr(o.best.d)} · <b>${how(o.best)}</b>${o.best.pt ? ` ${o.best.pt.toLocaleString()}pt` : o.best.my != null ? ` ${won(o.best.my)}` : ''}${o.rows.length > 1 ? ` 외 ${o.rows.length - 1}일` : ''}</span>`), more: Math.max(0, g.length - 10) }); }
  // 3) 포인트가 내림 (최근 7일 변동)
  const ptDown = rows.filter(r => r.ca && r.pp && r.pt && r.pp > r.pt).map(r => ({ r, pct: (r.pp - r.pt) / r.pp })).sort((a, b) => b.pct - a.pct);
  const seenP = new Set(); const ptList = ptDown.filter(x => !seenP.has(x.r.h) && seenP.add(x.r.h)).slice(0, 10);
  if (ptList.length) out.push({ kind: 'pt-down', title: `포인트가 내린 곳 ${seenP.size}곳`, sub: '최근 7일, 가장 많이 내린 날 기준', items: ptList.map(({ r, pct }) => `${link(r)} <span class="small">${dstr(r.d)} · ${r.pp.toLocaleString()} → <b>${r.pt.toLocaleString()}pt</b> <span class="chg dn">▼${Math.round(pct * 100)}%</span></span>`) });
  // 4) 현금 내림
  const cashDown = rows.filter(r => r.ca && !r.pt && r.pc != null && r.my != null && r.pc > r.my).map(r => ({ r, pct: (r.pc - r.my) / r.pc })).sort((a, b) => b.pct - a.pct);
  const seenC = new Set(); const cashList = cashDown.filter(x => !seenC.has(x.r.h) && seenC.add(x.r.h)).slice(0, 10);
  if (cashList.length) out.push({ kind: 'cash-down', title: `회원가 내린 곳 ${seenC.size}곳`, sub: '최근 7일', items: cashList.map(({ r, pct }) => `${link(r)} <span class="small">${dstr(r.d)} · ${how(r)} ${won(r.pc)} → <b>${won(r.my)}</b> <span class="chg dn">▼${Math.round(pct * 100)}%</span></span>`) });
  // 5) 마감 임박: 3일 안 체크인인 희소 혜택
  const soonTo = addDays(today, 3); const soon = mine.filter(r => (r.b === 'SUITE' || r.b === 'FREE_NIGHT') && r.d >= today && r.d <= soonTo).sort((a, b) => (b.sv || 0) - (a.sv || 0));
  const seenS = new Set(); const soonList = soon.filter(r => !seenS.has(r.h) && seenS.add(r.h)).slice(0, 10);
  if (soonList.length) out.push({ kind: 'soon', title: `이번 주 바로 갈 수 있는 스위트·1+1 ${seenS.size}곳`, sub: '3일 안 체크인', items: soonList.map(r => `${link(r)} <span class="small">${dstr(r.d)} · <b>${how(r)}</b>${r.sv ? ` · 절약 ${won(r.sv)}` : ''}</span>`) });
  // 6) 포인트가 오름 (참고)
  const ptUp = rows.filter(r => r.ca && r.pp && r.pt && r.pp < r.pt).map(r => ({ r, pct: (r.pt - r.pp) / r.pp })).sort((a, b) => b.pct - a.pct);
  const seenU = new Set(); const upList = ptUp.filter(x => !seenU.has(x.r.h) && seenU.add(x.r.h)).slice(0, 6);
  if (upList.length) out.push({ kind: 'pt-up', title: `포인트가 오른 곳 ${seenU.size}곳`, sub: '최근 7일 · 서두르거나 다른 날짜로', items: upList.map(({ r, pct }) => `${link(r)} <span class="small">${dstr(r.d)} · ${r.pp.toLocaleString()} → <b>${r.pt.toLocaleString()}pt</b> <span class="chg up">▲${Math.round(pct * 100)}%</span></span>`) });
  return out;
}
// ---------- 호텔 소식 (메일로 오는 뉴스레터를 정리한 시트) ----------
// 회사 Google 시트 'Travel Radar 호텔 소식'(누구나 보기 가능) → gviz JSON. 열: id,date,source,chain,region,kind,title,summary,url,score,show
const NEWS_SHEET = '1Ujl6wN9ZlSGL4K0mVNwDOXdTNVd4H799o2bLriHhcF4';
let NEWS = { items: null, at: 0, err: null };
async function loadNews(force) {
  if (!force && NEWS.items && Date.now() - NEWS.at < 3600e3) return NEWS.items;
  const url = `https://docs.google.com/spreadsheets/d/${NEWS_SHEET}/gviz/tq?tqx=out:json&sheet=news&headers=1`;
  const parse = (txt) => { const m = /setResponse\(([\s\S]*)\);?\s*$/.exec(txt); const j = JSON.parse(m ? m[1] : txt); const cols = j.table.cols.map(c => (c.label || c.id || '').trim()); return j.table.rows.map(r => { const o = {}; r.c.forEach((c, i) => { o[cols[i]] = c ? (c.f ?? c.v) : ''; }); return o; }); };
  let items = null;
  try { const r = await fetch(url, { cache: 'no-store' }); if (r.ok) items = parse(await r.text()); } catch (e) { NEWS.err = e; }
  if (!items) { try { const cache = await caches.open('tr-data-cache'); const c = await cache.match('news'); if (c) items = await c.json(); } catch (e) {} }
  else { try { const cache = await caches.open('tr-data-cache'); await cache.put('news', new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } })); } catch (e) {} }
  items = (items || []).map(x => ({ id: String(x.id || ''), date: String(x.date || '').replace(/^'/, '').slice(0, 10), source: String(x.source || ''), chain: String(x.chain || 'other').toLowerCase(), region: String(x.region || ''), kind: String(x.kind || 'news'), title: String(x.title || ''), summary: String(x.summary || ''), url: String(x.url || ''), score: +x.score || 0, show: String(x.show ?? '1') !== '0' }))
    .filter(x => x.title && x.show).sort((a, b) => b.date.localeCompare(a.date) || b.score - a.score);
  NEWS = { items, at: Date.now(), err: NEWS.err }; return items;
}
const NEWS_KIND = { news: '소식', promo: '프로모션', brand: '브랜드', guide: '가이드' };
function newsCardHtml(x) {
  const mine = ['accor', 'ihg', 'marriott', 'hilton'].includes(x.chain); const tag = mine ? `<span class="ctag ${x.chain}">${CHAIN[x.chain]}</span>` : `<span class="ctag other">기타</span>`;
  const d = x.date ? `${x.date.slice(5).replace('-', '.')} ${DOW[dow(x.date)]}` : '';
  return `<a class="nitem ${mine ? x.chain : 'other'} ${x.kind}" href="${esc(x.url)}" target="_blank" rel="noopener"><span class="nmeta">${tag}<span class="nk">${NEWS_KIND[x.kind] || x.kind}</span>${x.region && x.region !== '전체' ? `<span class="nr">${esc(x.region)}</span>` : ''}<span class="nd">${d}</span></span><b>${esc(x.title)}</b><p>${esc(x.summary)}</p><span class="nsrc">${esc(x.source)} ↗</span></a>`;
}
async function viewNews() {
  const el = $('#v-news');
  el.innerHTML = `<h1>호텔 소식</h1><p class="lead">메일로 오는 호텔 뉴스레터(LoyaltyLobby · 체인 공지 · Tablet 등)에서 <b>우리 체인·여행지에 쓸모 있는 것만</b> 골라 한 줄로 정리해요. 제목을 누르면 원문으로 갑니다.</p><div class="nfilt" id="nfilt"></div><div class="nlist" id="nlist"><div class="loadingNote"><span></span>소식을 불러오는 중</div></div><details class="ndata" id="ndata"><summary>데이터 변화 — 수집 데이터에서 자동으로 뽑은 변동</summary><div id="ndataBody"></div></details>`;
  const items = await loadNews(); if (location.hash.replace(/^#\/?/, '').split('/')[0] !== 'news') return;
  const mineChains = ['accor', 'ihg', 'marriott', 'hilton']; let chain = 'all';
  const render = () => {
    const list = items.filter(x => chain === 'all' ? true : chain === 'mine' ? mineChains.includes(x.chain) : x.chain === chain);
    const my = list.filter(x => mineChains.includes(x.chain)), other = list.filter(x => !mineChains.includes(x.chain));
    $('#nlist').innerHTML = list.length ? (chain === 'all' ? my.map(newsCardHtml).join('') + (other.length ? `<div class="lsep">다른 체인·플랫폼 소식</div>` + other.map(newsCardHtml).join('') : '') : list.map(newsCardHtml).join('')) : `<div class="empty">${NEWS.err ? '소식을 불러오지 못했어요. 잠시 후 다시 열어 보세요.' : '아직 올라온 소식이 없어요.'}</div>`;
  };
  const counts = { all: items.length, mine: items.filter(x => mineChains.includes(x.chain)).length }; for (const c of mineChains) counts[c] = items.filter(x => x.chain === c).length;
  $('#nfilt').innerHTML = [['all', '전체'], ['mine', '내 4체인'], ...mineChains.map(c => [c, CHAIN[c]])].map(([k, l]) => `<button type="button" class="chip ${k === chain ? 'on' : ''}" data-nc="${k}">${l} <span class="muted">${counts[k] || 0}</span></button>`).join('');
  $('#nfilt').addEventListener('click', (e) => { const b = e.target.closest('[data-nc]'); if (!b) return; chain = b.dataset.nc; $('#nfilt').querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x.dataset.nc === chain)); render(); });
  render();
  // 데이터 변화는 아래 접힌 칸에 (예전 뉴스 탭 내용)
  const dItems = newsItems(); const snaps = (D.meta.snapshots || []).slice(-2); const diff = snaps.length === 2 ? snaps[1].total - snaps[0].total : null;
  const head = `수집 ${D.meta.collectedAt ? new Date(D.meta.collectedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''} · 혜택 ${D.rows.length.toLocaleString()}건${diff != null ? ` (지난 수집 대비 ${diff >= 0 ? '+' : ''}${diff.toLocaleString()})` : ''} · 호텔 ${D.hotels.size}곳${hasProfile() ? ' · 내 티어 기준' : ''}`;
  $('#ndataBody').innerHTML = `<p class="muted small">${head}</p>` + (dItems.length ? dItems.map(it => `<article class="ncard ${it.kind}"><h2>${esc(it.title)}</h2>${it.sub ? `<p class="muted small">${esc(it.sub)}</p>` : ''}<ol>${it.items.map(x => `<li>${x}</li>`).join('')}</ol>${it.more ? `<p class="muted small">… 외 ${it.more}곳</p>` : ''}</article>`).join('') : '<div class="empty">아직 변화가 없어요. 수집이 이틀 이상 쌓이면 여기에 생겨요.</div>');
}

// ---------- 라우터 ----------
const views = { radar: viewRadar, me: viewMe, plan: viewPlan, check: viewCheck, alerts: viewAlerts, news: viewNews, best: viewBest, map: viewMap, hotel: viewHotel, hotels: viewHotels, guide: viewGuide, promos: viewPromos };
function route() {
  const hash = location.hash.replace(/^#\/?/, '') || 'radar'; const [name, ...rest] = hash.split('/'); const arg = decodeURIComponent(rest.join('/'));
  document.querySelectorAll('.nav a, .tabbar a').forEach(a => a.classList.toggle('on', a.dataset.v === name || (name === 'hotel' && a.dataset.v === 'hotels')));
  document.querySelectorAll('main > section').forEach(s => s.hidden = s.id !== 'v-' + (views[name] ? name : 'radar'));
  (views[name] || viewRadar)(arg); if (!QUIET) window.scrollTo({ top: 0 });
  // 섹션 제목 위 금색 아이브로우 (브랜드)
  const EYE = { news: 'Hotel news · from my inbox', plan: 'Trip planner', check: 'Owner · Data check', alerts: 'Watchlist & alerts', me: 'Members only · Today', best: 'Best of the month', map: 'On the map', hotels: 'Hotels', hotel: 'Hotel', guide: 'Membership guide', promos: 'Offers' };
  const sec = document.getElementById('v-' + (views[name] ? name : 'radar')); const h1 = sec?.querySelector('h1');
  if (h1 && EYE[name] && !h1.previousElementSibling?.classList?.contains('eyebrow')) h1.insertAdjacentHTML('beforebegin', `<div class="eyebrow">${EYE[name]}</div>`);
}
window.addEventListener('hashchange', route);

// ---------- 홈 = 내 티어로 검색 (시안 E) ----------
const ui = { benefits: new Set(['SUITE', 'FREE_NIGHT', 'POINTS', 'SALE']), chains: new Set(['accor', 'ihg', 'marriott', 'hilton']), limit: 300, view: 'cards', cardLimit: 24, mLimit: 24 };
try { ui.view = localStorage.getItem('tr_view') || 'cards'; } catch (e) {}
const TIER_KEY = { accor: 'accorTier', ihg: 'ihgTier', marriott: 'marriottTier', hilton: 'hiltonTier' };
const myTier = (chain) => profile[TIER_KEY[chain]] || '';
const TIER_KO = { Classic: '클래식', Silver: '실버', Gold: '골드', Platinum: '플래티넘', Diamond: '다이아몬드', Limitless: '리미트리스', Club: '클럽', Member: '멤버', Titanium: '티타늄', Ambassador: '앰배서더' };
const tierKo = (t) => TIER_KO[t] || t;

// 티어별로 호텔에서 받는 것 — s: ok(확정) · maybe(가능 시) · no(이 티어엔 없음). v: 원화 환산(티어 가치 계산용). lounge:true 는 라운지가 있는 호텔에서만.
// 출처: programs/*.md (2026-10 약관). 숫자는 보수적 추정이며 설정에서 바꿀 수 있게 상수로 둔다.
const BV = { lounge: 90000, breakfast: 60000, upgradeOk: 50000, upgradeMaybe: 20000, lateOk: 20000, lateMaybe: 8000, welcome: 10000 };
const B = (label, s, v, extra) => Object.assign({ label, s, v: v || 0 }, extra || {});
const TIER_BENEFITS = {
  accor: {
    Silver: [B('웰컴 드링크', 'ok', BV.welcome), B('레이트 체크아웃', 'maybe', BV.lateMaybe)],
    Gold: [B('업그레이드', 'maybe', BV.upgradeMaybe), B('레이트 체크아웃', 'maybe', BV.lateMaybe), B('웰컴 드링크', 'ok', BV.welcome)],
    Platinum: [B('라운지', 'ok', BV.lounge, { lounge: true }), B('업그레이드', 'maybe', BV.upgradeMaybe), B('레이트 체크아웃', 'maybe', BV.lateMaybe), B('웰컴 드링크', 'ok', BV.welcome)],
    Diamond: [B('라운지', 'ok', BV.lounge, { lounge: true }), B('조식 (주말·일부 브랜드)', 'maybe', BV.breakfast * .5), B('업그레이드', 'maybe', BV.upgradeMaybe), B('레이트 체크아웃', 'maybe', BV.lateMaybe), B('웰컴 드링크', 'ok', BV.welcome)],
    Limitless: [B('라운지', 'ok', BV.lounge, { lounge: true }), B('조식 (주말·일부 브랜드)', 'maybe', BV.breakfast * .5), B('업그레이드', 'maybe', BV.upgradeMaybe), B('레이트 체크아웃', 'ok', BV.lateOk), B('웰컴 드링크', 'ok', BV.welcome)],
  },
  ihg: {
    Silver: [B('레이트 체크아웃', 'maybe', BV.lateMaybe)],
    Gold: [B('레이트 체크아웃', 'maybe', BV.lateMaybe), B('웰컴 어메니티', 'maybe', BV.welcome * .5), B('업그레이드', 'no')],
    Platinum: [B('업그레이드', 'maybe', BV.upgradeMaybe), B('레이트 체크아웃', 'maybe', BV.lateMaybe), B('웰컴 어메니티', 'ok', BV.welcome), B('조식', 'no'), B('라운지', 'no', 0, { note: '클럽 객실 예약 시' })],
    Diamond: [B('조식 (또는 웰컴 어메니티)', 'ok', BV.breakfast), B('업그레이드', 'maybe', BV.upgradeMaybe), B('레이트 체크아웃', 'maybe', BV.lateMaybe), B('라운지', 'no', 0, { note: '클럽 객실 예약 시' })],
  },
  marriott: {
    Silver: [B('레이트 체크아웃', 'maybe', BV.lateMaybe)],
    Gold: [B('업그레이드', 'maybe', BV.upgradeMaybe), B('14시 체크아웃', 'maybe', BV.lateMaybe), B('웰컴 포인트', 'ok', BV.welcome * .5), B('조식', 'no'), B('라운지', 'no', 0, { note: '플래티넘부터' })],
    Platinum: [B('라운지', 'ok', BV.lounge, { lounge: true }), B('조식 (라운지·선택 혜택)', 'ok', BV.breakfast), B('업그레이드 (스위트 포함)', 'maybe', BV.upgradeMaybe), B('16시 체크아웃', 'ok', BV.lateOk)],
    Titanium: [B('라운지', 'ok', BV.lounge, { lounge: true }), B('조식 (라운지·선택 혜택)', 'ok', BV.breakfast), B('업그레이드 (스위트 포함)', 'maybe', BV.upgradeMaybe), B('16시 체크아웃', 'ok', BV.lateOk)],
    Ambassador: [B('라운지', 'ok', BV.lounge, { lounge: true }), B('조식 (라운지·선택 혜택)', 'ok', BV.breakfast), B('업그레이드 (스위트 포함)', 'maybe', BV.upgradeMaybe), B('16시 체크아웃', 'ok', BV.lateOk)],
  },
  hilton: {
    Silver: [B('5박 무료', 'ok', 0), B('조식', 'no', 0, { note: '골드부터' })],
    Gold: [B('조식·F&B 크레딧', 'ok', BV.breakfast), B('업그레이드', 'maybe', BV.upgradeMaybe), B('5박 무료', 'ok', 0), B('라운지', 'no', 0, { note: '다이아부터' })],
    Diamond: [B('라운지', 'ok', BV.lounge, { lounge: true }), B('조식·F&B 크레딧', 'ok', BV.breakfast), B('업그레이드', 'maybe', BV.upgradeMaybe), B('5박 무료', 'ok', 0)],
  },
};
// IHG 앰배서더(인터컨티넨탈 한정) 추가 혜택
const AMB_BENEFITS = [B('1단계 업그레이드', 'ok', BV.upgradeOk), B('16시 체크아웃', 'ok', BV.lateOk), B('웰컴 어메니티', 'ok', BV.welcome)];
// 라운지 유무: 힐튼은 수집한 amenity, 나머지는 라운지가 있는 브랜드로 추정
const LOUNGE_BRAND = { accor: /sofitel|pullman|fairmont|swiss|raffles|m[öo]venpick|소피텔|풀만|페어몬트|스위소텔|래플스/i, marriott: /jw |westin|sheraton|marriott|renaissance|m[ée]ridien|autograph|웨스틴|쉐라톤|메리어트|르네상스|메르디앙/i, ihg: /intercontinental|인터컨티넨탈/i, hilton: /conrad|waldorf|hilton |콘래드|월도프/i };
function hasLounge(h) {
  if (h.lounge === true || h.lounge === 1) return true; if (h.lounge === false) return false;
  return LOUNGE_BRAND[h.chain]?.test(`${h.brand || ''} ${h.name || ''}`) ? null : false;   // null = 브랜드로 추정
}
function tierBenefits(h) {
  const tier = myTier(h.chain); if (!tier) return null;
  let list = (TIER_BENEFITS[h.chain] || {})[tier] || [];
  if (h.chain === 'ihg' && profile.ambassador && /intercontinental|인터컨티넨탈/i.test(`${h.brand} ${h.name}`)) list = AMB_BENEFITS.concat(list.filter(b => !/업그레이드|체크아웃|웰컴/.test(b.label)));
  const lg = hasLounge(h);
  return list.map(b => {
    if (!b.lounge) return b;
    if (lg === false) return B('라운지', 'no', 0, { note: '이 호텔엔 라운지 없음' });
    if (lg === null) return B('라운지', 'maybe', b.v * .7, { note: '브랜드 기준 추정' });
    return b;
  });
}
const benefitValue = (list) => (list || []).reduce((s, b) => s + (b.s === 'ok' ? b.v : b.s === 'maybe' ? b.v * .4 : 0), 0);

// 검색어 파서: "방콕 11월 2박 포인트 라운지" → 조건으로
const Q_CHAIN = { 아코르: 'accor', accor: 'accor', ihg: 'ihg', 메리어트: 'marriott', marriott: 'marriott', 힐튼: 'hilton', hilton: 'hilton' };
const Q_BEN = { 포인트: 'POINTS', 스위트: 'SUITE', 세일: 'SALE', 무료박: 'FREE_NIGHT', 무료: 'FREE_NIGHT', 바우처: 'VOUCHER' };
function parseQ(q) {
  const out = { text: [], chains: new Set(), bens: new Set(), month: null, nights: null, weekend: false, holiday: false, lounge: false, breakfast: false, five4: false, voucher: false, onePlusOne: false, city: null };
  const cities = new Set(); for (const h of D.hotels.values()) if (h.city) cities.add(h.city);
  for (let t of q.toLowerCase().split(/\s+/).filter(Boolean)) {
    let m;
    if ((m = /^(\d{1,2})월$/.exec(t))) { out.month = +m[1]; continue; }
    if ((m = /^(\d)박$/.exec(t))) { if (m[1] === '5') out.five4 = true; else out.nights = +m[1]; continue; }
    if (/^(이번\s*)?주말$|^금토$/.test(t) || t === '이번') { if (t !== '이번') out.weekend = true; continue; }
    if (t === '1+1' || t === '1+1박' || t === '원플러스원') { out.onePlusOne = true; continue; }
    if (t === '연휴' || t === '공휴일' || t === '황금연휴') { out.holiday = true; continue; }
    if (t === '라운지') { out.lounge = true; continue; }
    if (t === '조식') { out.breakfast = true; continue; }
    if (t === '바우처') { out.voucher = true; continue; }
    if (Q_CHAIN[t]) { out.chains.add(Q_CHAIN[t]); continue; }
    if (Q_BEN[t]) { if (Q_BEN[t] === 'VOUCHER') out.voucher = true; else out.bens.add(Q_BEN[t]); continue; }
    const city = [...cities].find(c => c.toLowerCase() === t || c.toLowerCase().startsWith(t) && t.length >= 2); if (city && !out.city) { out.city = city; continue; }
    out.text.push(t);
  }
  return out;
}
const isVoucher = (r) => ['SNU', 'STAY_PLUS', 'AMB'].includes(r.br);
function fillWhere() {
  const sel = $('#fWhere'); sel.innerHTML = '<option value="">전체</option>';
  const byC = {}; for (const h of D.hotels.values()) { if (!h.cc) continue; (byC[h.cc] = byC[h.cc] || { label: h.country, cities: {} }); byC[h.cc].cities[h.city] = (byC[h.cc].cities[h.city] || 0) + (h.n || 0); }
  for (const [cc, c] of Object.entries(byC)) {
    const og = document.createElement('optgroup'); og.label = c.label;
    const o = document.createElement('option'); o.value = 'c:' + cc; o.textContent = `${c.label} 전체`; og.appendChild(o);
    const order = (D.meta.areas || {})[cc] || []; const rank = (city) => city === '기타' ? 9999 : (order.indexOf(city) >= 0 ? order.indexOf(city) : 999);
    for (const [city, n] of Object.entries(c.cities).sort((a, b) => rank(a[0]) - rank(b[0]) || b[1] - a[1])) { if (!city) continue; const oc = document.createElement('option'); oc.value = `t:${cc}:${city}`; oc.textContent = `${city} (${n})`; og.appendChild(oc); }
    sel.appendChild(og);
  }
  const today = new Date().toISOString().slice(0, 10); if (!$('#fFrom').value) $('#fFrom').value = D.meta.dateFrom > today ? D.meta.dateFrom : today; if (!$('#fTo').value) $('#fTo').value = D.meta.dateTo || addDays(today, 30);
  if (!hasProfile()) $('#fSort').value = 'cost';
}
let lastQ = null;
function filtered() {
  const from = $('#fFrom').value, to = $('#fTo').value, where = $('#fWhere').value, q = $('#fText').value.trim(), we = $('#fWeekend').checked, mine = $('#fMine').checked;
  const qp = lastQ = parseQ(q);
  // 메리어트 5박 묶음은 표에서는 금·토 시작일만 (호텔 페이지 달력에는 전부 표시)
  let rows = D.rows.filter(r => ui.benefits.has(r.b) && ui.chains.has(r.chain) && (!from || r.d >= from) && (!to || r.d <= to) && !(r.br === 'FIVE4' && ![5, 6].includes(dow(r.d))));
  if (where.startsWith('c:')) rows = rows.filter(r => r.cc === where.slice(2));
  else if (where.startsWith('t:')) { const [, cc, city] = where.split(':'); rows = rows.filter(r => r.cc === cc && r.city === city); }
  if (we || qp.weekend) rows = rows.filter(r => [5, 6].includes(dow(r.d)));
  if (qp.holiday) rows = rows.filter(r => inLongWeekend(r.d, r.n || 1));
  if (qp.month) rows = rows.filter(r => +r.d.slice(5, 7) === qp.month);
  if (qp.nights) rows = rows.filter(r => (r.n || 1) === qp.nights);
  if (qp.five4) rows = rows.filter(r => r.br === 'FIVE4');
  if (qp.onePlusOne) rows = rows.filter(r => r.br === 'STAY_PLUS' || r.br === 'AMB');   // 2박 중 1박 무료 (아코르 Stay Plus · IHG 앰배서더 주말)
  if (qp.chains.size) rows = rows.filter(r => qp.chains.has(r.chain));
  if (qp.bens.size) rows = rows.filter(r => qp.bens.has(r.b));
  if (qp.voucher) rows = rows.filter(isVoucher);
  if (qp.city) rows = rows.filter(r => r.city === qp.city);
  if (qp.lounge) rows = rows.filter(r => { const h = D.hotels.get(r.h); return h && hasLounge(h) !== false; });
  if (qp.breakfast) rows = rows.filter(r => { const h = D.hotels.get(r.h); return h && (tierBenefits(h) || []).some(b => /조식/.test(b.label) && b.s !== 'no'); });
  if (qp.text.length) { const t = qp.text.join(' '); rows = rows.filter(r => (r.hn + ' ' + (r.city || '') + ' ' + (D.hotels.get(r.h)?.brand || '')).toLowerCase().includes(t)); }
  if (mine) rows = rows.filter(eligible);
  const sort = $('#fSort').value;
  const by = { pricey: (a, b) => ((b.ref || b.my || 0) / (b.n || 1)) - ((a.ref || a.my || 0) / (a.n || 1)), date: (a, b) => a.d.localeCompare(b.d) || (b.sv || 0) - (a.sv || 0), saving: (a, b) => (b.sv || 0) - (a.sv || 0), cost: (a, b) => (a.my ?? 9e12) - (b.my ?? 9e12), hotel: (a, b) => a.hn.localeCompare(b.hn, 'ko') || a.d.localeCompare(b.d), new: (a, b) => (b.first || 0) - (a.first || 0), tier: (a, b) => (b.sv || 0) - (a.sv || 0) };
  return rows.sort(by[sort] || by.date);
}
function rowHtml(r, showHotel = true) {
  const h = D.hotels.get(r.h) || {}; const b = BEN[r.b]; const we = [5, 6].includes(dow(r.d));
  const cost = r.pt ? `${r.pt.toLocaleString()}pt<span class="pt">≈ ${won(r.my)}</span>` : won(r.my);
  const ref = r.ref != null ? `<s>${won(r.ref)}</s>` : '<span class="muted">–</span>';
  const note = NOTE[r.br] || ''; const elig = hasProfile() ? `<span class="elig ${eligible(r) ? '' : 'no'}">${eligible(r) ? '✓ 사용 가능' : '자격 없음'}</span>` : `<span class="elig">${eligLabel(r)}</span>`;
  const rooms = r.rooms ? `<div class="rooms">${r.rooms.map(x => `<span class="rc ${x.s ? 's' : ''}">${esc(x.c)}${x.n > 1 ? ' ×' + x.n : ''}</span>`).join('')}</div>` : (r.rem ? `<span class="muted small">잔여 ${r.rem}</span>` : '');
  return `<tr class="r">
    <td class="date">${r.d.slice(5).replace('-', '.')} <span class="dow ${we ? 'we' : ''}">${DOW[dow(r.d)]}</span>${holiTag(r.d)}<div class="muted small">${r.n || 1}박</div></td>
    <td class="hotel">${showHotel ? `<a class="hname" href="#hotel/${encodeURIComponent(r.h)}">${esc(r.hn)}</a>` : ''}<div class="hsub"><span class="ctag ${r.chain}">${CHAIN[r.chain]}</span>${esc(h.brand || '')} · ${esc(h.country || '')} ${esc(h.city || '')}</div></td>
    <td class="benefit"><span class="badge ${r.b}">${badgeLabel(r)}</span>${r.also ? '<span class="tag">Red Hot</span>' : ''}<span class="blabel">${esc(rawLabel(r))}</span>${elig}</td>
    <td class="cost">${cost}${chg(r)}</td>
    <td class="refc"><span class="ref">${ref}<span class="note">${esc(note)}</span></span></td>
    <td class="savec">${r.sv ? `<span class="save">${won(r.sv)}${r.ap ? ' <span class="ap">추정</span>' : ''}</span>` : '<span class="muted">–</span>'}</td>
    <td class="roomsc">${rooms}</td>
    <td class="book"><a class="btn small" href="${link(r)}" target="_blank" rel="noopener">예약 ↗</a></td>
  </tr>`;
}
// 호텔 단위로 묶기: 결제 방법별 가장 좋은 날 + 티어 가치
function groupHotels(rows) {
  const by = new Map();
  for (const r of rows) { let o = by.get(r.h); if (!o) by.set(r.h, o = { h: D.hotels.get(r.h) || { key: r.h, chain: r.chain, name: r.hn }, rows: [], dates: new Set(), kinds: new Set(), fresh: 0 }); o.rows.push(r); o.dates.add(r.d); o.kinds.add(r.b); if (r.first && r.first >= Date.now() - 48 * 3600e3) o.fresh++; }
  const since = Date.now() - 48 * 3600e3;
  const out = [];
  for (const o of by.values()) {
    // 프로필이 있으면 내가 쓸 수 있는 행을 우선 (없을 때만 전체에서)
    const pick = (list, cmp) => { const el = hasProfile() ? list.filter(eligible) : list; return (el.length ? el : list).slice().sort(cmp)[0] || null; };
    o.cash = pick(o.rows.filter(r => !r.pt && !isVoucher(r) && r.my != null), (a, b) => a.my - b.my);
    o.points = pick(o.rows.filter(r => r.pt), (a, b) => ((b.ref && b.pt ? b.ref / b.pt : 0) - (a.ref && a.pt ? a.ref / a.pt : 0)) || a.pt - b.pt);
    o.voucher = pick(o.rows.filter(isVoucher), (a, b) => (b.sv || 0) - (a.sv || 0));
    // 가장 좋은 방법 = 절약률(정가 대비)이 가장 큰 행, 같으면 1박당 내 비용이 낮은 행
    const rate = (r) => r.sv && r.ref ? r.sv / r.ref : 0; const perN = (r) => (r.my ?? Infinity) / (r.n || 1);
    o.best = pick(o.rows, (a, b) => (rate(b) - rate(a)) || (perN(a) - perN(b)));
    o.bestEligible = !hasProfile() || (o.best && eligible(o.best));
    o.benefits = tierBenefits(o.h); o.bv = benefitValue(o.benefits);
    o.tierValue = (o.bestEligible ? (o.best?.sv || 0) : 0) + o.bv; o.minCost = Math.min(...o.rows.map(r => r.my ?? Infinity)); o.newest = Math.max(...o.rows.map(r => r.first || 0));
    out.push(o);
  }
  return out;
}
// ±3일 유연 힌트: 같은 호텔·같은 혜택·같은 박수에서 전후 3일 안에 더 싼 날이 있으면 한 줄 (포인트 숙박은 하루 차이로 2배 나기도 한다). 기능 플래그 FEAT.flex
function flexAlt(o) {
  if (!FEAT.flex || !o.best) return null; const b = o.best;
  const same = o.rows.filter(r => r !== b && r.br === b.br && (r.n || 1) === (b.n || 1) && Math.abs(daysBetween(b.d, r.d)) <= 3 && (!hasProfile() || eligible(r) === eligible(b)));
  if (!same.length) return null; const key = b.pt ? (r => r.pt || Infinity) : (r => r.my ?? Infinity);
  const alt = same.slice().sort((x, y) => key(x) - key(y))[0]; const cur = key(b); if (!isFinite(cur) || !isFinite(key(alt)) || key(alt) >= cur * 0.95) return null;
  const dd = daysBetween(b.d, alt.d); return { alt, diff: cur - key(alt), dd, pt: !!b.pt, when: dd === -1 ? '하루 앞당기면' : dd === 1 ? '하루 미루면' : dd < 0 ? `${-dd}일 앞당기면` : `${dd}일 미루면` };
}
const flexHint = (o, cls) => { const f = flexAlt(o); return f ? `<span class="flex ${cls || ''}">${f.when} <b>−${f.pt ? f.diff.toLocaleString() + 'pt' : won(f.diff)}</b> <small>${f.alt.d.slice(5).replace('-', '.')} ${DOW[dow(f.alt.d)]}</small></span>` : ''; };
const payCell = (label, r, kind) => {
  if (!r) return `<div class="pay"><span class="pl">${label}</span><span class="pv muted">—</span></div>`;
  const v = kind === 'points' ? `${r.pt.toLocaleString()}<small>pt</small>` : kind === 'voucher' ? (r.br === 'SNU' ? won(r.my) : `${won(r.my)}<small>/${r.n || 1}박</small>`) : won(r.my);
  const sub = kind === 'points' ? (r.ref ? `정가 ${won(r.ref)}` : '') : kind === 'voucher' ? (FREE_SHORT[r.br] || RAW[r.br] || '') : (r.ref ? `<s>${won(r.ref)}</s>` : (RAW[r.br] || ''));
  return `<div class="pay ${kind}"><span class="pl">${label}${eligible(r) ? '' : ' <i class="x" title="자격 없음">✗</i>'}</span><span class="pv">${v}</span><span class="ps">${sub}</span><span class="pd">${r.d.slice(5).replace('-', '.')} ${DOW[dow(r.d)]}</span></div>`;
};
// 성급: 아코르는 공식 성급(API), 나머지 체인은 성급 제도가 없어 브랜드 기준으로 추정 (est)
const BRAND_STARS = [
  [5, /ritz|st\.? ?regis|edition|jw ?marriott|luxury collection|\bw\b|w hotel|bulgari|waldorf|conrad|lxr|intercontinental|regent|six senses|kimpton|vignette|raffles|fairmont|sofitel|banyan|mondrian|so\/|orient express|리츠|세인트 ?레지스|에디션|JW|월도프|콘래드|인터컨티넨탈|리젠트|식스센스|킴튼|래플스|페어몬트|소피텔|반얀/i],
  [4, /marriott|sheraton|westin|renaissance|m[ée]ridien|autograph|delta|tribute|hilton|doubletree|curio|tapestry|canopy|signia|crowne|voco|indigo|hotel indigo|pullman|m[öo]venpick|swiss|grand mercure|mgallery|angsana|cassia|novotel|메리어트|쉐라톤|웨스틴|르네상스|메르디앙|오토그래프|힐튼|더블트리|큐리오|태피스트리|캐노피|크라운|보코|인디고|풀만|뫼벤픽|스위소|그랜드 머큐어|노보텔/i],
  [3, /courtyard|four points|aloft|ac hotel|moxy|fairfield|element|residence inn|garden inn|hampton|home2|homewood|tru\b|motto|spark|holiday inn|staybridge|candlewood|avid|garner|mercure|ibis styles|tribe|handwritten|코트야드|포 ?포인츠|알로프트|목시|페어필드|가든 ?인|햄튼|홀리데이 ?인|머큐어|이비스 스타일/i],
  [2, /ibis|이비스|holiday inn express/i],
];
function starsOf(h) {
  if (h.stars) return { n: h.stars, est: false };
  const t = `${h.brand || ''} ${h.name || ''}`; for (const [n, re] of BRAND_STARS) if (re.test(t)) return { n, est: true };
  return null;
}
const starsHtml = (h, cls) => { const s = starsOf(h); return s ? `<span class="stars ${cls || ''} ${s.est ? 'est' : ''}" title="${s.est ? '브랜드 기준 추정' : '공식 성급'}">${'★'.repeat(Math.floor(s.n))}${s.n % 1 ? '½' : ''}</span>` : ''; };
function cardHtml(o, i) {
  const h = o.h; const tier = myTier(h.chain);
  const bestKind = o.best ? (o.best.pt ? 'points' : isVoucher(o.best) ? 'voucher' : 'cash') : '';
  const KIND_KO = { cash: '현금', points: '포인트', voucher: '바우처' };
  const perNight = (r) => r.my != null ? won(r.my / (r.n || 1)) + '/박' : '';
  const pay = (r, kind) => !r ? null : kind === 'points' ? `${r.pt.toLocaleString()}pt${(r.n || 1) > 1 ? ` / ${r.n}박` : ''}` : kind === 'voucher' ? (r.br === 'SNU' ? `${won(r.my)} 스위트` : `${won(r.my)} / ${r.n || 1}박`) : won(r.my);
  const pct = (r) => r.sv && r.ref ? Math.round(r.sv / r.ref * 100) : 0;
  const how = (r) => r.br === 'SNU' ? 'SNU로 스위트' : r.br === 'STAY_PLUS' ? 'Stay Plus · 1박 무료' : r.br === 'AMB' ? 'Ambassador · 주말 1박 무료' : r.br === 'FIVE4' ? '포인트 5박 · 1박 무료' : r.b === 'POINTS' ? '포인트' : r.br === 'RED_HOT' ? 'Red Hot Room' : r.b === 'SALE' ? '회원 특가' : KIND_KO[bestKind];
  const bestTxt = o.best ? `<i class="how">${how(o.best)}</i>${pay(o.best, bestKind)}${chg(o.best)}` : '—';
  const bestSub = o.best ? [perNight(o.best), pct(o.best) ? `정가 대비 ${pct(o.best)}% 절약` : ''].filter(Boolean).join(' · ') : '';
  const others = [['cash', '현금', o.cash], ['points', '포인트', o.points], ['voucher', '바우처', o.voucher]].filter(([k]) => k !== bestKind).map(([k, l, r]) => `${l} ${r ? pay(r, k) : '—'}`).join(' · ');
  const forYou = tier
    ? (o.benefits || []).map(b => `<span class="bf ${b.s}">${esc(b.label)} ${b.s === 'ok' ? '✓' : b.s === 'maybe' ? '△' : '✗'}${b.note ? ` <em>${esc(b.note)}</em>` : ''}</span>`).join('')
    : `<span class="bf lock">${hasProfile() ? '이 체인 티어 없음' : '<a href="#" data-open-profile>티어를 넣으면</a> 당신이 받는 것이 보여요'}</span>`;
  const dr = o.best ? `${o.best.d.slice(5).replace('-', '.')} ${DOW[dow(o.best.d)]}` : ''; const dout = o.best ? addDays(o.best.d, o.best.n || 1) : '';
  return `<article class="lrow ${bestKind}">
    <span class="num">${String(i + 1).padStart(2, '0')}</span>
    <span class="ld"><b>${dr}</b><span class="muted">– ${o.best ? dout.slice(5).replace('-', '.') + ' ' + DOW[dow(dout)] : ''} · ${o.best?.n || 1}박${o.fresh ? ' · <i class="new">new</i>' : ''}</span>${o.best ? holiTag(o.best.d) : ''}</span>
    <a class="li ${hImg(h) && !NO_EXT_IMG ? '' : 'noimg'}" href="#hotel/${encodeURIComponent(h.key)}">${hImg(h) && !NO_EXT_IMG ? `<img src="${esc(hImg(h))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="trImgErr(this, '${esc(h.img ? h.image || '' : '')}', 'parent')">` : ''}</a>
    <span class="lh"><a class="hname" href="#hotel/${encodeURIComponent(h.key)}">${esc(h.name)}</a><span class="muted">${starsHtml(h)}${esc(h.brand || '')} · ${CHAIN[h.chain]} · ${esc(h.city || '')} · ${o.dates.size}일 가능</span></span>
    <span class="lf">${forYou}</span>
    <span class="lb"><b class="gold">${bestTxt}</b><span class="sub">${bestSub}</span>${flexHint(o)}<span class="muted">${others}</span></span>
    <span class="lv">${tier ? `<b>+${won(o.tierValue)}</b><span class="muted">티어 가치</span>` : (o.best?.sv ? `<b>${won(o.best.sv)}</b><span class="muted">최대 절약</span>` : '')}</span>
    <span class="la"><a href="#hotel/${encodeURIComponent(h.key)}">달력</a>${o.best ? `<a href="${esc(link(o.best))}" target="_blank" rel="noopener">예약 ↗</a>` : ''}${FEAT.share ? `<a href="#" data-share="${esc(h.key)}" data-share-row="${esc(rowId(o.best))}" title="이미지로 공유">공유</a>` : ''}</span>
  </article>`;
}
// 이 조건(기간·지역·체인·검색어)에서 혜택 행이 하나도 없는 호텔 — 목록 끝에 "혜택 없음"으로 보여 준다 (호텔이 빠진 게 아니라 혜택이 없는 것임을 알 수 있게)
function noBenefitHotels(groups) {
  const have = new Set(groups.map(o => o.h.key)); const where = $('#fWhere').value; const qp = lastQ || {}; const t = (qp.text || []).join(' ');
  const inWhere = (h) => !where || (where.startsWith('c:') ? h.cc === where.slice(2) : (() => { const [, cc, city] = where.split(':'); return h.cc === cc && h.city === city; })());
  return [...D.hotels.values()].filter(h => !have.has(h.key) && h.name && ui.chains.has(h.chain) && inWhere(h) && (!qp.chains?.size || qp.chains.has(h.chain)) && (!qp.city || h.city === qp.city)
    && (!t || `${h.name} ${h.city || ''} ${h.brand || ''}`.toLowerCase().includes(t)) && !(qp.lounge && hasLounge(h) === false))
    .sort((a, b) => (a.country || '').localeCompare(b.country || '', 'ko') || (a.city || '').localeCompare(b.city || '', 'ko') || a.name.localeCompare(b.name, 'ko'));
}
function noneCardHtml(h, i) {
  const mine = $('#fMine').checked; const tier = myTier(h.chain);
  const why = mine && hasProfile() ? '이 기간엔 내 티어로 쓸 수 있는 혜택이 없어요' : '이 기간엔 수집된 티어 혜택 요금이 없어요';
  return `<article class="lrow none">
    <span class="num">${String(i + 1).padStart(2, '0')}</span>
    <span class="ld"><span class="muted">—</span></span>
    <a class="li ${hImg(h) && !NO_EXT_IMG ? '' : 'noimg'}" href="#hotel/${encodeURIComponent(h.key)}">${hImg(h) && !NO_EXT_IMG ? `<img src="${esc(hImg(h))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="trImgErr(this, '${esc(h.img ? h.image || '' : '')}', 'parent')">` : ''}</a>
    <span class="lh"><a class="hname" href="#hotel/${encodeURIComponent(h.key)}">${esc(h.name)}</a><span class="muted">${starsHtml(h)}${esc(h.brand || '')} · ${CHAIN[h.chain]} · ${esc(h.city || '')}</span></span>
    <span class="lf">${tier ? (tierBenefits(h) || []).filter(b => b.s !== 'no').slice(0, 3).map(b => `<span class="bf ${b.s}">${esc(b.label)} ${b.s === 'ok' ? '✓' : '△'}</span>`).join('') : ''}</span>
    <span class="lb"><b class="muted">혜택 없음</b><span class="sub">${why}</span></span>
    <span class="lv"></span>
    <span class="la"><a href="#hotel/${encodeURIComponent(h.key)}">달력</a></span>
  </article>`;
}
// ---------- 카드 이미지 공유 (1080×1350 · 카톡/인스타) — 기능 플래그 FEAT.share ----------
// 호텔 사진 + 이름 + 가장 좋은 날·혜택 + 티어 가치 + 내 티어 혜택을 한 장으로. Web Share가 되면 바로 공유, 아니면 PNG 내려받기.
const rowId = (r) => r ? `${r.br}|${r.d}|${r.n || 1}` : '';
function loadImg(src) { return new Promise((res) => { if (!src) return res(null); const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
function wrapText(ctx, text, maxW, maxLines) {
  const words = text.split(/(\s+)/).filter(w => w.trim()); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  // 한글은 띄어쓰기가 드물어 글자 단위로 한 번 더
  const out = []; for (const l of lines) { if (ctx.measureText(l).width <= maxW) { out.push(l); continue; } let c = ''; for (const ch of l) { if (ctx.measureText(c + ch).width > maxW) { out.push(c); c = ch; } else c += ch; } if (c) out.push(c); }
  if (out.length > maxLines) { const k = out.slice(0, maxLines); k[maxLines - 1] = k[maxLines - 1].replace(/.{2}$/, '') + '…'; return k; } return out;
}
async function shareCard(hotelKey, rowKey) {
  const h = D.hotels.get(hotelKey); if (!h) return;
  const rows = D.rows.filter(r => r.h === hotelKey); const o = groupHotels(rows)[0] || { h, rows, best: null, benefits: tierBenefits(h), dates: new Set(), tierValue: 0 };
  const r = rowKey ? rows.find(x => rowId(x) === rowKey) || o.best : o.best; const tier = myTier(h.chain);
  const W = 1080, H = 1350; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const SERIF = '"Playfair Display", "Gowun Batang", "Noto Serif KR", Georgia, serif', SANS = '"Pretendard", "Noto Sans KR", system-ui, sans-serif';
  const GOLD = '#d4a84b', FG = '#ece7da', MUTED = '#a39f93', BG = '#10172a';
  try { await document.fonts?.load(`600 62px ${SERIF}`); await document.fonts?.load(`500 28px ${SANS}`); } catch (e) {}
  x.fillStyle = BG; x.fillRect(0, 0, W, H);
  const im = await loadImg(hImg(h) && !NO_EXT_IMG ? hImg(h) : null);
  // 본문 높이를 먼저 재서 사진 높이를 정한다 (호텔명 2줄·혜택 줄이 있어도 겹치지 않게). 푸터 100px 고정
  x.font = `600 62px ${SERIF}`; const nameLines = wrapText(x, h.name, W - 128, 2); const benLine = tier && o.benefits?.length ? o.benefits.filter(b => b.s !== 'no').slice(0, 5).map(b => `${b.label} ${b.s === 'ok' ? '✓' : '△'}`).join('   ·   ') : '';
  const hasSub = r ? (r.pt ? r.my != null : !!r.ref) : false;
  const bodyH = 24 + nameLines.length * 72 + 70 + (r ? 54 + 46 + 100 + (hasSub ? 44 : 0) + 64 + 20 : 60) + (benLine ? 64 + 44 : 0);
  const PH = Math.max(520, Math.min(760, H - 120 - bodyH + 40));   // 본문 시작 = PH - 120, 끝 ≤ 푸터 선(H-100) 위 20px
  if (im) { const s = Math.max(W / im.width, (PH + 80) / im.height); const dw = im.width * s, dh = im.height * s; try { x.drawImage(im, (W - dw) / 2, (PH + 80 - dh) / 2, dw, dh); } catch (e) {} }
  else { const g = x.createLinearGradient(0, 0, W, PH); g.addColorStop(0, '#1c2640'); g.addColorStop(1, '#0a0f1e'); x.fillStyle = g; x.fillRect(0, 0, W, PH); }
  const g2 = x.createLinearGradient(0, PH * .35, 0, PH); g2.addColorStop(0, 'rgba(16,23,42,0)'); g2.addColorStop(1, BG); x.fillStyle = g2; x.fillRect(0, 0, W, PH); x.fillStyle = BG; x.fillRect(0, PH - 1, W, H - PH + 1);
  const g3 = x.createLinearGradient(0, 0, 0, 260); g3.addColorStop(0, 'rgba(16,23,42,.75)'); g3.addColorStop(1, 'rgba(16,23,42,0)'); x.fillStyle = g3; x.fillRect(0, 0, W, 260);
  // 상단 브랜드
  x.fillStyle = GOLD; x.beginPath(); x.roundRect(64, 64, 72, 72, 18); x.fill(); x.strokeStyle = BG; x.lineWidth = 7; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(82, 86); x.lineTo(104, 86); x.moveTo(93, 86); x.lineTo(93, 114); x.moveTo(106, 114); x.lineTo(106, 96); x.lineTo(114, 96); x.arc(114, 101, 5, -Math.PI / 2, Math.PI / 2); x.lineTo(106, 106); x.moveTo(114, 106); x.lineTo(122, 114); x.stroke();
  x.fillStyle = FG; x.font = `600 30px ${SERIF}`; x.textBaseline = 'alphabetic'; x.fillText('TRAVEL RADAR', 156, 96); x.fillStyle = GOLD; x.font = `500 20px ${SANS}`; x.fillText('M E M B E R S   O N L Y', 156, 126);
  if (tier) { const t = `${CHAIN[h.chain]} ${tierKo(tier)}`; x.font = `600 22px ${SANS}`; const tw = x.measureText(t).width + 40; x.fillStyle = 'rgba(16,23,42,.72)'; x.beginPath(); x.roundRect(W - 64 - tw, 72, tw, 48, 24); x.fill(); x.fillStyle = GOLD; x.fillText(t, W - 64 - tw + 20, 104); }
  // 호텔
  let y = PH - 120; x.fillStyle = GOLD; x.font = `500 22px ${SANS}`; x.fillText([starsOf(h) ? '★'.repeat(Math.floor(starsOf(h).n)) : '', (h.brand || '').toUpperCase(), CHAIN[h.chain].toUpperCase(), ((h.country || '') + ' ' + (h.city || '')).trim()].filter(Boolean).join('  ·  '), 64, y);
  y += 24; x.fillStyle = FG; x.font = `600 62px ${SERIF}`; for (const l of nameLines) { y += 72; x.fillText(l, 64, y); }
  // 날짜·혜택
  y += 70; x.strokeStyle = 'rgba(201,189,160,.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(64, y); x.lineTo(W - 64, y); x.stroke();
  if (r) {
    const dout = addDays(r.d, r.n || 1); const how = r.br === 'SNU' ? 'SNU로 스위트' : r.br === 'STAY_PLUS' ? 'Stay Plus · 1박 무료' : r.br === 'AMB' ? 'Ambassador · 주말 1박 무료' : r.br === 'FIVE4' ? '포인트 5박 · 1박 무료' : r.b === 'POINTS' ? '포인트 숙박' : r.br === 'RED_HOT' ? 'Red Hot Room' : r.b === 'SALE' ? '회원 특가' : r.b === 'SUITE' ? '스위트' : '회원 요금';
    y += 54; x.fillStyle = MUTED; x.font = `500 28px ${SANS}`; x.fillText(`${r.d.slice(5).replace('-', '.')} ${DOW[dow(r.d)]} – ${dout.slice(5).replace('-', '.')} ${DOW[dow(dout)]} · ${r.n || 1}박${holiName(r.d) ? ' · ' + holiName(r.d) : ''}`, 64, y);
    y += 46; x.fillStyle = GOLD; x.font = `600 30px ${SANS}`; x.fillText(how, 64, y);
    const big = r.pt ? `${r.pt.toLocaleString()}pt` : won(r.my); const sub = r.pt ? (r.my != null ? `현금이면 ${won(r.my)}` : '') : (r.ref ? `정가 ${won(r.ref)}` : '');
    y += 100; x.fillStyle = FG; x.font = `600 96px ${SERIF}`; x.fillText(big, 64, y); const bw = x.measureText(big).width; x.fillStyle = MUTED; x.font = `500 34px ${SANS}`; x.fillText(`/ ${r.n || 1}박`, 64 + bw + 16, y);
    if (sub) { y += 44; x.fillStyle = MUTED; x.font = `500 28px ${SANS}`; x.fillText(sub, 64, y); }
    const pct = r.sv && r.ref ? Math.round(r.sv / r.ref * 100) : 0; const pills = []; if (r.sv) pills.push(`혜택 ${won(r.sv)}`); if (pct) pills.push(`정가 대비 −${pct}%`); if (tier && o.tierValue) pills.push(`티어 가치 +${won(o.tierValue)}`);
    let px = 64; y += 64; for (const pt of pills) { x.font = `600 26px ${SANS}`; const w = x.measureText(pt).width + 44; x.fillStyle = 'rgba(212,168,75,.16)'; x.beginPath(); x.roundRect(px, y - 36, w, 54, 27); x.fill(); x.fillStyle = GOLD; x.fillText(pt, px + 22, y); px += w + 14; }
  } else { y += 60; x.fillStyle = MUTED; x.font = `500 30px ${SANS}`; x.fillText('이 기간엔 수집된 티어 혜택 요금이 없어요', 64, y); }
  // 내 티어 혜택 (본문 흐름대로 이어서)
  if (benLine) { y += 64; x.fillStyle = MUTED; x.font = `500 24px ${SANS}`; x.fillText(`${tierKo(tier)}인 당신은`, 64, y); y += 44; x.fillStyle = FG; x.font = `500 28px ${SANS}`; x.fillText(wrapText(x, benLine, W - 128, 1)[0] || '', 64, y); }
  // 하단
  x.fillStyle = 'rgba(201,189,160,.35)'; x.fillRect(64, H - 100, W - 128, 1); x.fillStyle = MUTED; x.font = `500 21px ${SANS}`; x.fillText('개인 수집 데이터 · 예약은 각 체인 공식 사이트에서 본인 계정으로', 64, H - 62); x.fillStyle = GOLD; x.font = `600 21px ${SANS}`; const url = (location.origin + location.pathname).replace(/^https?:\/\//, '').replace(/\/(index\.html)?$/, ''); x.fillText(url, 64, H - 28);
  const blob = await new Promise(res => c.toBlob(res, 'image/png')); if (!blob) return;
  const file = new File([blob], `travel-radar-${(h.name || 'hotel').replace(/[^\w가-힣]+/g, '-').slice(0, 40)}.png`, { type: 'image/png' });
  const pageUrl = `${location.origin}${location.pathname}#hotel/${encodeURIComponent(h.key)}`;
  // 휴대폰: 공유 시트(카톡·인스타로 바로). PC: 공유창은 파일을 앱으로 넘길 뿐 붙여넣기가 안 되니 미리보기 + 이미지 복사 / 링크 복사 / 저장
  const phone = /Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 900);
  if (phone && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: h.name, text: `${h.name} · Travel Radar\n${pageUrl}` }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  openShareDialog(blob, file.name, pageUrl, h.name);
}
function openShareDialog(blob, name, pageUrl, title) {
  let dlg = $('#dlgShare');
  if (!dlg) { document.body.insertAdjacentHTML('beforeend', `<dialog id="dlgShare" class="dlg share"><div class="dlgBody"><div class="dlgHead"><b>이미지로 공유</b><button type="button" class="x" data-close>✕</button></div><img id="shareImg" alt=""><p class="muted small" id="shareNote">이미지를 복사한 뒤 카톡·메신저 대화창에 붙여넣기(Ctrl+V) 하세요.</p><div class="dlgBtns"><button type="button" class="btn" id="shareCopy">이미지 복사</button><button type="button" class="btn ghost" id="shareLink">링크 복사</button><a class="btn ghost" id="shareDl" download>PNG 저장</a></div></div></dialog>`); dlg = $('#dlgShare'); dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); }); }
  const url = URL.createObjectURL(blob); const img = $('#shareImg'); if (img.dataset.url) URL.revokeObjectURL(img.dataset.url); img.src = url; img.dataset.url = url; const dl = $('#shareDl'); dl.href = url; dl.download = name;
  const note = $('#shareNote'); const say = (t) => { note.textContent = t; };
  $('#shareCopy').onclick = async () => { if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return say('이 브라우저는 이미지 복사를 지원하지 않아요. "PNG 저장" 뒤 갤러리에서 공유하세요.'); try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); say('이미지를 복사했어요. 대화창에 Ctrl+V 로 붙여넣으세요.'); } catch (e) { say('이 브라우저에선 이미지 복사가 막혀 있어요. "PNG 저장" 후 파일을 끌어다 넣어 주세요.'); } };
  $('#shareLink').onclick = async () => { try { await navigator.clipboard.writeText(`${title} · Travel Radar\n${pageUrl}`); say('호텔 페이지 링크를 복사했어요. (이 사이트는 로그인한 멤버만 볼 수 있어요)'); } catch (e) { say(pageUrl); } };
  say('이미지를 복사한 뒤 카톡·메신저 대화창에 붙여넣기(Ctrl+V) 하세요.'); dlg.showModal();
}
// 배포 확인용 빌드 버전(푸터): app.js?v=YYYYMMDDHHMM → "build 11.06 16:03"
{ const m = /app\.js\?v=(\d{12})/.exec([...document.scripts].map(x => x.src).join(' ')); const el = document.getElementById('buildVer'); if (m && el) el.textContent = `build ${m[1].slice(4, 6)}.${m[1].slice(6, 8)} ${m[1].slice(8, 10)}:${m[1].slice(10, 12)}`; }
document.addEventListener('click', (e) => { const b = e.target.closest('[data-share]'); if (!b) return; e.preventDefault(); b.classList.add('busy'); shareCard(b.dataset.share, b.dataset.shareRow || '').finally(() => b.classList.remove('busy')); });
function tierBarHtml() {
  const chips = ['accor', 'ihg', 'marriott', 'hilton'].map(c => { const t = myTier(c); const on = ui.chains.has(c); return `<button class="tchip ${c} ${on ? 'on' : ''} ${t ? '' : 'none'}" data-tc="${c}" title="${on ? '이 체인 숨기기' : '이 체인 보이기'}">${CHAIN[c]} ${t ? `<b>${esc(tierKo(t))}</b>${c === 'accor' && profile.explorer ? ' +Explorer' : ''}${c === 'ihg' && profile.ambassador ? ' +Amb' : ''}` : '<span class="muted">—</span>'}</button>`; }).join('');
  return `<span class="tl">${hasProfile() ? 'My tier' : 'No tier yet'}</span>${chips}<button class="lnk" data-open-profile>${hasProfile() ? '수정' : '내 티어 넣기'}</button>`;
}
// ---------- 모바일 앱 모드 (시안 G2 · 720px 이하) ----------
const MOBILE = () => window.matchMedia('(max-width: 720px)').matches;
function mPhotoCard(o, i, opts) {
  const h = o.h; const tier = myTier(h.chain); const r = o.best; const small = opts?.small;
  const kind = r ? (r.pt ? '포인트' : r.br === 'STAY_PLUS' || r.br === 'AMB' ? '1+1' : r.br === 'SNU' ? 'SNU' : r.br === 'FIVE4' ? '5박 무료' : r.b === 'SALE' ? '특가' : '현금') : '';
  const pct = r && r.sv && r.ref ? Math.round(r.sv / r.ref * 100) : 0;
  // 포인트 혜택은 포인트로 보여준다 (우린 가격이 아니라 티어 혜택을 보여주는 곳) — 현금 환산은 작게
  const isPt = r && r.pt && (r.b === 'POINTS' || r.br === 'FIVE4' || r.br === 'POINTS_SUITE');
  const per = isPt ? `${Math.round(r.pt / (r.n || 1)).toLocaleString()}<small>pt/박</small>` : (r && r.my != null ? won(r.my / (r.n || 1)) : '');
  const bens = tier ? (o.benefits || []).filter(b => !/웰컴/.test(b.label)).slice(0, 4).map(b => `<i class="${b.s}">${esc(b.label.replace(/\s*\(.*\)$/, ''))}</i>`).join('') : '';
  const img = hImg(h) && !NO_EXT_IMG ? `<img src="${esc(hImg(h))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="trImgErr(this, '${esc(h.img ? h.image || '' : '')}')">` : '';
  const date = r ? `${r.d.slice(5).replace('-', '.')} ${DOW[dow(r.d)]}${holiTag(r.d, 'w')}` : '';
  return `<a class="mpc ${small ? 'sm' : ''} ${hImg(h) ? '' : 'noimg'}" href="#hotel/${encodeURIComponent(h.key)}">${img}<span class="ov"></span>
    <span class="tl"><b class="pill">${r ? `Best · ${kind}` : '열림'}</b>${pct ? `<b class="pill w">−${pct}%</b>` : ''}${o.fresh ? '<b class="pill w">New</b>' : ''}</span>
    ${tier && o.bv ? `<span class="tr pill w">혜택 ${won(o.bv)}</span>` : ''}
    <span class="tx"><small>${starsHtml(h, 'w')}${esc(h.brand || '')} · ${CHAIN[h.chain]} · ${esc(h.city || '')}</small><b>${esc(h.name)}</b>${small ? '' : `<span class="bens">${bens}</span>`}<span class="pr"><span>${date}${r && (r.n || 1) > 1 ? ` · ${r.n}박` : ''}${isPt ? (r.my != null ? ` · 현금이면 ${won(r.my / (r.n || 1))}` : '') : (r && r.ref && r.my != null ? ` · 정가 ${won(r.ref / (r.n || 1))}` : '')}</span><em>${per}${!isPt && r && r.my != null ? '<small>/박</small>' : ''}</em></span>${small ? '' : flexHint(o, 'w')}</span></a>`;
}
const refMax = (o) => Math.max(0, ...o.rows.map(r => (r.ref || r.my || 0) / (r.n || 1)));   // 정가(1박) 기준 — 호텔의 급
function mobileHome(rows, groups) {
  const P = profile;
  // 메인 사진: 소피텔·식스센스·리츠칼튼 중에서 (사진 있는 호텔) 열 때마다 하나 랜덤. 없으면 가장 비싼 호텔.
  const HERO_BRANDS = /sofitel|소피텔|six senses|식스센스|ritz|리츠/i;
  const picks = groups.filter(o => hImg(o.h) && HERO_BRANDS.test(`${o.h.brand || ''} ${o.h.name || ''}`));
  const hero = picks.length ? picks[Math.floor(Math.random() * picks.length)] : (groups.filter(o => hImg(o.h)).sort((a, b) => refMax(b) - refMax(a))[0] || groups[0]);
  const tiers = ['accor', 'ihg', 'marriott', 'hilton'].filter(myTier);
  const main = tiers[0]; let band = '';
  if (main) {
    const ladder = TIERS_N[main]; const tier = myTier(main); const nights = P[main + 'Nights'] || 0; const idx = ladder.findIndex(([n]) => n === tier); const next = idx >= 0 ? ladder[idx + 1] : ladder.find(([, n]) => n > nights); const target = next || ladder[idx] || ladder[ladder.length - 1];
    const pct = Math.min(100, Math.round(nights / target[1] * 100)); const left = Math.max(0, target[1] - nights);
    band = `<div class="mband"><div class="l"><b>${CHAIN[main]} ${tierKo(tier)}</b><span>${next ? `${left}박 더 묵으면 ${tierKo(next[0])}` : `${tierKo(tier)} 유지 · 올해 ${daysTo(todayStr().slice(0, 4) + '-12-31')}일 남음`}</span></div><div class="r"><span><b>${nights}</b> / ${target[1]}박</span><i><em style="width:${pct}%"></em></i></div><div class="others">${tiers.slice(1).map(c => `${CHAIN[c]} ${tierKo(myTier(c))}`).join(' · ')}</div></div>`;
  }
  const pts = (P.accorPts || 0) + (P.ihgPts || 0) + (P.marriottPts || 0) + (P.hiltonPts || 0);
  const vs = []; if (P.snu > 0) vs.push(['SNU', P.snu, P.snuExp]); if (P.explorer && P.stayPlus > 0) vs.push(['Stay Plus', P.stayPlus, P.stayPlusExp]); if (P.ambassador) vs.push(['IHG Ambassador 무료 주말', 1, P.ambExp]);
  const nv = vs.reduce((a, v) => a + v[1], 0); const soon = vs.map(v => [v, daysTo(v[2])]).filter(([, d]) => d != null).sort((a, b) => a[1] - b[1])[0];
  const wallet = hasProfile() ? `<div class="mwal"><a href="#me"><small>Points</small><b>${pts.toLocaleString()}</b><i>›</i></a><a href="#me"><small>Vouchers</small><b>${nv}${soon ? ` <em>D-${soon[1]}</em>` : ''}</b><i>›</i></a></div>` : `<div class="mwal one"><a href="#" data-open-profile><small>Members only</small><b>내 티어 넣기</b><i>›</i></a></div>`;
  const soonHtml = soon && soon[1] <= 60 ? `<div class="mlab">곧 사라지는 것</div><a class="msoon" href="#me"><b>${esc(soon[0][0])} · ${soon[1] <= 1 ? '내일' : `D-${soon[1]}`} 만료</b><span>쓸 수 있는 호텔 ${new Set(D.rows.filter(r => isVoucher(r) && eligible(r) && (!soon[0][2] || r.d <= soon[0][2])).map(r => r.h)).size}곳</span><i>›</i></a>` : '';
  const wl = $('#fWhere').value ? $('#fWhere').options[$('#fWhere').selectedIndex].textContent.replace(/ \(\d+\)$/, '') : (lastQ?.city || '');
  const q = $('#fText').value;
  return `<div class="mhero">${hero && hImg(hero.h) && !NO_EXT_IMG ? `<img src="${esc(hImg(hero.h))}" alt="" referrerpolicy="no-referrer" onerror="trImgErr(this, '${esc(hero.h.img ? hero.h.image || '' : '')}')">` : ''}<span class="ov"></span>
      <div class="brand"><svg viewBox="0 0 200 200"><rect x="10" y="10" width="180" height="180" rx="40" fill="#d4a84b"/><path d="M52 72 H108 M80 72 V140 M110 140 V96 H130 a14 14 0 0 1 0 28 H110 M126 124 L146 140" fill="none" stroke="#141a2e" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg><span><b>Travel Radar</b><small>Members only</small></span></div>
      <div class="tx"><b class="pill">Today${q ? ' · ' + esc(q) : ''}</b><h1>오직 멤버들에게만,<br>${wl ? esc(wl) + ' ' : '오늘 '}<em>${groups.length.toLocaleString()}곳</em>이 열립니다</h1><p>${heroSub(rows, groups).split('.')[0]}</p>${hero ? `<small>사진 · ${esc(hero.h.name)}</small>` : ''}</div></div>
    ${band}${wallet}
    <form class="msearch" id="mSearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input type="search" placeholder="방콕 11월 2박 라운지" value="${esc(q)}"><button type="button" class="mflt">필터</button></form>
    <div class="mchips">${['연휴', '1+1', '포인트', '바우처', '5박 무료', '라운지', '조식', '스위트'].map(c => `<button type="button" class="${q.includes(c) ? 'on' : ''}" data-mq="${c}">${c}</button>`).join('')}</div>
    ${limitText() ? `<p class="limitNote m">${limitText()}</p>` : ''}
    <div class="mlab">오늘 당신에게 열린 곳</div>
    <div class="mrow">${groups.slice(0, 8).map((o, i) => mPhotoCard(o, i)).join('')}</div>
    ${soonHtml}
    <div class="mlab">전체 ${groups.length.toLocaleString()}곳 · 가장 이득 순</div>
    <div class="mlist" id="mList">${groups.slice(0, ui.mLimit).map((o, i) => mPhotoCard(o, i, { small: true })).join('')}</div>
    ${groups.length > ui.mLimit ? `<button type="button" class="mmore" id="mMore">호텔 ${(groups.length - ui.mLimit).toLocaleString()}곳 더 보기</button>` : ''}`;
}
function resTitle(rows, groups) {
  const qp = lastQ || {}; const where = $('#fWhere'); const wl = where.value ? where.options[where.selectedIndex].textContent.replace(/ \(\d+\)$/, '').replace(' 전체', '') : (qp.city || '');
  const n = `<em>${groups.length}곳</em>`;
  if (!groups.length) return `${wl ? wl + '에서는' : '이 조건으로는'} 지금 열린 곳이 없습니다.`;
  return `오직 멤버들에게만,<br>${wl ? wl + ' ' : ''}${n}이 열립니다.`;
}
function heroEyebrow(rows) {
  const qp = lastQ || {}; const from = $('#fFrom').value, to = $('#fTo').value;
  const when = qp.month ? `${qp.month}월` : (from && to ? `${from.slice(5).replace('-', '.')} – ${to.slice(5).replace('-', '.')}` : '');
  const where = $('#fWhere'); const wl = where.value ? where.options[where.selectedIndex].textContent.replace(/ \(\d+\)$/, '') : (qp.city || '전체');
  return [when, wl, qp.nights ? `${qp.nights}박` : '', `${rows.length.toLocaleString()}건`].filter(Boolean).join(' · ');
}
function heroSub(rows, groups) {
  // 첫 문장: 어떤 티어 기준인지. 둘째 문장: 방법별로 몇 곳인지 (0인 항목은 아예 말하지 않는다)
  const mine = hasProfile();
  const el = (o) => !mine || o.bestEligible;
  const nCash = groups.filter(o => el(o) && o.cash).length, nPts = groups.filter(o => el(o) && o.points && (!mine || eligible(o.points))).length, nVch = groups.filter(o => o.voucher && (!mine || eligible(o.voucher))).length;
  const lounge = groups.filter(o => (o.benefits || []).some(b => /라운지/.test(b.label) && b.s !== 'no')).length;
  const fresh = groups.filter(o => o.fresh).length;
  const tiers = ['accor', 'ihg', 'marriott', 'hilton'].filter(c => ui.chains.has(c) && myTier(c)).map(c => `${CHAIN[c]} ${tierKo(myTier(c))}`);
  const first = mine && tiers.length ? `${tiers.join(' · ')}로 쓸 수 있는 것만 골랐습니다.` : '티어를 넣으면 당신이 쓸 수 있는 것만 남깁니다.';
  const parts = [nCash ? `회원가·특가 ${nCash}곳` : '', nPts ? `포인트 ${nPts}곳` : '', nVch ? `바우처·무료박 ${nVch}곳` : '', mine && lounge ? `라운지 ${lounge}곳` : '', fresh ? `이틀 새 새로 열린 ${fresh}곳` : ''].filter(Boolean);
  return first + (parts.length ? ' ' + parts.join(' · ') + '.' : '');
}
function viewRadar() {
  const rows = filtered(); const groups = groupHotels(rows);
  const sort = $('#fSort').value;
  const gby = { pricey: (a, b) => refMax(b) - refMax(a) || b.tierValue - a.tierValue, tier: (a, b) => b.tierValue - a.tierValue || a.minCost - b.minCost, cost: (a, b) => a.minCost - b.minCost, saving: (a, b) => (b.best?.sv || 0) - (a.best?.sv || 0), date: (a, b) => a.best.d.localeCompare(b.best.d), new: (a, b) => b.newest - a.newest, hotel: (a, b) => a.h.name.localeCompare(b.h.name, 'ko') };
  groups.sort(gby[sort] || gby.tier);
  $('#tierBar').innerHTML = tierBarHtml();
  $('#resTitle').innerHTML = resTitle(rows, groups); $('#heroEyebrow').textContent = heroEyebrow(rows); $('#resSub').textContent = heroSub(rows, groups);
  const isCards = ui.view === 'cards'; const mob = MOBILE() && isCards; document.body.classList.toggle('app-m', mob);
  const mApp = $('#mApp'); if (mApp) { mApp.hidden = !mob; if (mob) { mApp.innerHTML = mobileHome(rows, groups); const inp = mApp.querySelector('#mSearch input'); mApp.querySelector('#mSearch').addEventListener('submit', (e) => { e.preventDefault(); $('#fText').value = inp.value; viewRadar(); inp.blur(); }); mApp.querySelector('.mflt').addEventListener('click', () => { document.body.classList.remove('app-m'); mApp.hidden = true; $('#filtersBox').open = true; $('#filtersBox').scrollIntoView({ behavior: 'smooth' }); }); mApp.querySelectorAll('[data-mq]').forEach(b => b.addEventListener('click', () => { const t = $('#fText'); const c = b.dataset.mq; t.value = t.value.includes(c) ? t.value.replace(c, '').replace(/\s+/g, ' ').trim() : (t.value + ' ' + c).trim(); viewRadar(); }));
      // 더 보기: 24곳씩 이어 붙인다 (화면을 다시 그리지 않아 스크롤 위치 유지)
      mApp.querySelector('#mMore')?.addEventListener('click', () => { const from = ui.mLimit; ui.mLimit += 24; mApp.querySelector('#mList').insertAdjacentHTML('beforeend', groups.slice(from, ui.mLimit).map((o, i) => mPhotoCard(o, from + i, { small: true })).join('')); const b = mApp.querySelector('#mMore'); if (groups.length > ui.mLimit) b.textContent = `호텔 ${(groups.length - ui.mLimit).toLocaleString()}곳 더 보기`; else b.remove(); }); } }
  $('#cards').hidden = !isCards || mob; $('#tableWrap').hidden = isCards;
  document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.view === ui.view));
  const none = isCards ? noBenefitHotels(groups) : [];
  if (isCards) {
    const all = groups.concat(none.map(h => ({ none: true, h }))); const show = all.slice(0, ui.cardLimit); const firstNone = show.findIndex(o => o.none);
    $('#cards').innerHTML = `<div class="lhead"><span>No.</span><span>Date</span><span></span><span>Hotel</span><span>For you</span><span>Best way</span><span>Tier value</span><span></span></div>` + show.map((o, i) => (o.none ? (i === firstNone ? `<div class="lsep">혜택 없는 호텔 ${none.length.toLocaleString()}곳 — 이 기간·조건에선 티어 혜택 요금이 안 잡힌 곳</div>` : '') + noneCardHtml(o.h, i) : cardHtml(o, i))).join('');
    $('#more').hidden = all.length <= ui.cardLimit; $('#more button').textContent = `호텔 ${(all.length - ui.cardLimit).toLocaleString()}곳 더 보기`;
  }
  else { $('#tbody').innerHTML = rows.slice(0, ui.limit).map(r => rowHtml(r)).join(''); $('#more').hidden = rows.length <= ui.limit; $('#more button').textContent = `${(rows.length - ui.limit).toLocaleString()}건 더 보기`; }
  $('#empty').hidden = rows.length > 0 || none.length > 0 || mob;
  $('#fSummary').textContent = [$('#fWeekend').checked ? '금·토' : '', $('#fMine').checked ? '내 것만' : '', ui.benefits.size < 4 ? `혜택 ${ui.benefits.size}종` : '', ].filter(Boolean).join(' · ');
  renderProfileBtn(); renderRail(rows);
  $('#fClear').hidden = !$('#fText').value;
  document.querySelectorAll('#quick .chip').forEach(c => c.classList.toggle('on', $('#fText').value.includes(c.dataset.q)));
}
function renderProfileBtn() {
  const b = $('#profileBtn'); const dots = ['accor', 'ihg', 'marriott', 'hilton'].filter(myTier).map(c => `<i class="${c}"></i>`).join('');
  b.querySelector('.tdots').innerHTML = ''; b.querySelector('.tlabel').textContent = hasProfile() ? ['accor', 'ihg', 'marriott', 'hilton'].filter(myTier).map(c => tierKo(myTier(c))).join(' · ') : '내 티어 넣기';
}
// 우측 레일: 바우처 D-day · 미니 달력(내 최저) · 티어 플래너 · 이번 주 변화
function renderRail(rows) {
  const el = $('#rail'); if (!el) return; const P = profile; const out = [];
  // 내 지갑: 체인별 한 칸 — 바우처·인증서·포인트와 지금 쓸 수 있는 호텔 수
  const wallet = $('#wallet');
  if (wallet) {
    if (!hasProfile()) wallet.innerHTML = '';
    else {
      const cnt = (fn) => new Set(D.rows.filter(r => eligible(r) && fn(r)).map(r => r.h)).size;
      const chainOf = (r) => r.h.split('|')[0];
      const md = (d) => d ? d.slice(5).replace('-', '.') : '';
      const item = (name, n, exp, usable, note) => { const dd = daysTo(exp); return `<div class="wi ${dd != null && dd <= 45 ? 'hot' : ''}"><b class="rv">${esc(name)}${n != null ? ` ${n}` : ''}${dd != null ? ` · <i>D-${dd}</i>` : ''}</b><span class="rs">${usable != null ? `${usable}곳` : ''}${exp ? ` · ${md(exp)} 전` : ''}${note ? ` · ${note}` : ''}</span></div>`; };
      const pts = (chain, p) => { const ok = cnt(r => chainOf(r) === chain && r.pt); return `<div class="wi pts"><span class="rs"><b>${(p || 0).toLocaleString()}pt</b> 보유${p && ok ? ` · 포인트로 ${ok}곳` : ''}</span></div>`; };
      const cards = [];
      for (const c of ['accor', 'ihg', 'marriott', 'hilton']) {
        const tier = myTier(c); const items = [];
        if (!tier) { cards.push(`<a class="wcard off" href="#me"><div class="rl"><span><span class="ctag ${c}">${CHAIN[c]}</span></span><span class="muted">티어 미등록</span></div><div class="wi"><span class="rs">티어를 넣으면 이 체인 혜택도 셉니다 →</span></div></a>`); continue; }
        if (c === 'accor') {
          if (P.snu > 0) items.push(item('SNU', P.snu, P.snuExp, cnt(r => r.br === 'SNU' && (!P.snuExp || r.d <= P.snuExp)))); else items.push(item('SNU', 0, '', null, '스위트 업그레이드 바우처 없음'));
          if (P.explorer) items.push(item('Stay Plus', P.stayPlus || 0, P.stayPlusExp, P.stayPlus > 0 ? cnt(r => r.br === 'STAY_PLUS' && (!P.stayPlusExp || r.d <= P.stayPlusExp)) : null, P.stayPlus > 0 ? '' : '남은 무료박 없음'));
          items.push(pts('accor', P.accorPts));
        } else if (c === 'ihg') {
          if (P.ambassador) items.push(item('Ambassador 무료 주말', 1, P.ambExp, cnt(r => r.br === 'AMB' && (!P.ambExp || r.d <= P.ambExp)))); else items.push(item('Ambassador', null, '', null, '미가입 · 주말 2박 중 1박 무료'));
          items.push(pts('ihg', P.ihgPts));
        } else if (c === 'marriott') {
          items.push(item('5박 중 1박 무료', null, '', cnt(r => chainOf(r) === 'marriott' && r.br === 'FIVE4'), '포인트 5박'));
          items.push(pts('marriott', P.marriottPts));
        } else {
          const ok5 = ['Silver', 'Gold', 'Diamond'].includes(tier);
          items.push(item('5박 무료', null, '', ok5 ? cnt(r => chainOf(r) === 'hilton' && r.br === 'FIVE4') : null, ok5 ? '포인트 5박' : '실버부터'));
          items.push(pts('hilton', P.hiltonPts));
        }
        cards.push(`<a class="wcard" href="#me"><div class="rl"><span><span class="ctag ${c}">${CHAIN[c]}</span> ${tierKo(tier)}</span><span class="muted">My wallet</span></div>${items.join('')}</a>`);
      }
      wallet.innerHTML = cards.join('');
    }
  }
  // 미니 달력: 조건 안 날짜별 내 최저 비용
  const from = $('#fFrom').value || D.meta.dateFrom, to = $('#fTo').value || D.meta.dateTo;
  if (from && to) {
    const min = {}; for (const r of rows) if (r.my != null) min[r.d] = Math.min(min[r.d] ?? Infinity, r.my);
    const vals = Object.values(min).sort((a, b) => a - b); const q = (p) => vals.length ? vals[Math.min(vals.length - 1, Math.floor(vals.length * p))] : 0;
    let d = addDays(from, -dow(from)); const cells = []; let n = 0;
    while ((d <= to || dow(d) !== 0) && n < 49) { const inR = d >= from && d <= to; const v = min[d]; const lv = v == null ? 0 : v <= q(.2) ? 3 : v <= q(.5) ? 2 : 1; cells.push(`<i class="l${inR ? lv : 0} ${inR ? '' : 'off'}" title="${d}${v != null ? ' · ' + won(v) : ''}" data-d="${d}">${+d.slice(8)}</i>`); d = addDays(d, 1); n++; if (d > to && dow(d) === 0) break; }
    const best = Object.entries(min).sort((a, b) => a[1] - b[1])[0];
    out.push(`<div class="rcard"><div class="rl"><span>Calendar</span><span class="muted">${from.slice(5).replace('-', '.')} – ${to.slice(5).replace('-', '.')}</span></div><div class="mini">${DOW.map(x => `<span>${x}</span>`).join('')}${cells.join('')}</div><div class="rs">${best ? `가장 싼 날 ${fmtD(best[0])} · ${won(best[1])}` : '조건에 맞는 날이 없어요'} · 진할수록 싼 날</div></div>`);
  }
  if (hasProfile()) {
    const plans = [['accor', P.accorTier, P.accorNights], ['ihg', P.ihgTier, P.ihgNights], ['marriott', P.marriottTier, P.marriottNights], ['hilton', P.hiltonTier, P.hiltonNights]].filter(([, t]) => t);
    const bars = plans.map(([c, tier, nights]) => { const ladder = TIERS_N[c]; const idx = ladder.findIndex(([nm]) => nm === tier); const next = idx >= 0 ? ladder[idx + 1] : ladder.find(([, n]) => n > (nights || 0)); const cur = idx >= 0 ? ladder[idx] : null; const target = next || cur; if (!target) return ''; const pct = Math.min(100, Math.round((nights || 0) / target[1] * 100)); const left = Math.max(0, target[1] - (nights || 0)); return `<div class="plan"><span><span class="ctag ${c}">${CHAIN[c]}</span> ${next ? `${tierKo(next[0])}까지` : `${tierKo(tier)} 유지`}</span><b>${left ? `${left}박` : '달성'}</b><div class="bar"><i class="${c}" style="width:${pct}%"></i></div></div>`; }).join('');
    if (bars) out.push(`<a class="rcard" href="#me"><div class="rl"><span>Tier</span><span class="muted">올해 ${daysTo(todayStr().slice(0, 4) + '-12-31')}일 남음</span></div>${bars}</a>`);
  }
  const since = Date.now() - 7 * 86400e3; const fresh = new Set(D.rows.filter(r => r.first && r.first >= since).map(r => r.h)).size; const gone = (D.meta.gone || []).length;
  out.push(`<a class="rcard" href="#me"><div class="rl"><span>This week</span></div><div class="rs"><b class="ok">새로 열림 ${fresh}곳</b> · <b class="hot">사라진 특가 ${gone}곳</b></div><div class="rs muted">${D.meta.collectedAt ? `마지막 수집 ${new Date(D.meta.collectedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ` : ''}호텔 ${D.hotels.size}곳</div></a>`);
  el.innerHTML = out.join('');
  el.querySelectorAll('.mini i[data-d]').forEach(i => i.addEventListener('click', () => { $('#fFrom').value = i.dataset.d; $('#fTo').value = i.dataset.d; viewRadar(); }));
}
['#fFrom', '#fTo', '#fWhere', '#fText', '#fWeekend', '#fMine', '#fSort'].forEach(s => $(s).addEventListener('input', () => { ui.limit = 300; ui.cardLimit = 24; ui.mLimit = 24; if (location.hash && !/^#\/?radar/.test(location.hash) && location.hash !== '') { if (s === '#fText') location.hash = '#radar'; } viewRadar(); }));
$('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); location.hash = '#radar'; viewRadar(); $('#fText').blur(); });
$('#fClear').addEventListener('click', () => { $('#fText').value = ''; viewRadar(); });
document.querySelectorAll('#quick .chip').forEach(c => c.addEventListener('click', () => { const t = $('#fText'); const q = c.dataset.q; t.value = t.value.includes(q) ? t.value.replace(q, '').replace(/\s+/g, ' ').trim() : (t.value + ' ' + q).trim(); viewRadar(); }));
document.querySelectorAll('.chip[data-b]').forEach(c => c.addEventListener('click', () => { const b = c.dataset.b; ui.benefits.has(b) ? ui.benefits.delete(b) : ui.benefits.add(b); c.classList.toggle('on', ui.benefits.has(b)); viewRadar(); }));
document.querySelectorAll('.chip[data-c]').forEach(c => c.addEventListener('click', () => { const k = c.dataset.c; ui.chains.has(k) ? ui.chains.delete(k) : ui.chains.add(k); c.classList.toggle('on', ui.chains.has(k)); viewRadar(); }));
document.addEventListener('click', (e) => {
  const tc = e.target.closest('[data-tc]'); if (tc) { const k = tc.dataset.tc; ui.chains.has(k) ? ui.chains.delete(k) : ui.chains.add(k); document.querySelector(`.chip[data-c="${k}"]`)?.classList.toggle('on', ui.chains.has(k)); viewRadar(); return; }
  if (e.target.closest('[data-open-profile]')) { e.preventDefault(); $('#profileBtn').click(); }
});
document.querySelectorAll('#viewSeg button').forEach(b => b.addEventListener('click', () => { ui.view = b.dataset.view; try { localStorage.setItem('tr_view', ui.view); } catch (e) {} viewRadar(); }));
$('#more button').addEventListener('click', () => { ui.limit += 300; ui.cardLimit += 24; viewRadar(); });
$('#fReset').addEventListener('click', () => { $('#fFrom').value = ''; $('#fTo').value = ''; $('#fWhere').value = ''; $('#fText').value = ''; $('#fWeekend').checked = false; $('#fMine').checked = false; $('#fSort').value = hasProfile() ? 'tier' : 'cost'; ['SUITE', 'FREE_NIGHT', 'POINTS', 'SALE'].forEach(b => ui.benefits.add(b)); ['accor', 'ihg', 'marriott', 'hilton'].forEach(c => ui.chains.add(c)); document.querySelectorAll('.chip[data-b],.chip[data-c]').forEach(c => c.classList.add('on')); fillWhere(); viewRadar(); });
$('#moreTab')?.addEventListener('click', () => $('#dlgMore').showModal());
$('#dlgMore')?.addEventListener('click', (e) => { if (e.target.tagName === 'A') $('#dlgMore').close(); });
$('#moreProfile')?.addEventListener('click', (e) => { e.preventDefault(); $('#dlgMore').close(); $('#profileBtn').click(); });


// ---------- 베스트 (국가별 혜택 좋은 호텔 5곳, 매일 수집 결과로 자동 계산) ----------
// 혜택 종류마다 "값"의 성격이 달라서(스위트는 객실 차액, 포인트는 포인트 가치, 무료박은 1박 공짜) 그대로 비교하면 한 체인만 올라온다.
// → 혜택 종류 안에서의 백분위(상위 몇 %)로 바꿔 비교하고, TOP 5는 체인당 최대 2곳으로 섞는다.
function rowValue(r) {
  if (r.b === 'POINTS') return r.pt && r.ref ? r.ref / r.pt : 0;            // 포인트 1pt당 원 가치 (높을수록 좋음)
  return r.sv && r.ref ? r.sv / r.ref : 0;                                    // 정가 대비 절약률
}
function percentiles(rows) {
  const byB = {}; for (const r of rows) (byB[r.b] = byB[r.b] || []).push(rowValue(r));
  const sorted = {}; for (const b in byB) sorted[b] = byB[b].filter(v => v > 0).sort((a, b) => a - b);
  return (r) => { const arr = sorted[r.b]; const v = rowValue(r); if (!arr || !arr.length || !v) return 0; let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo / arr.length; };
}
function bestOf(rows, pct) {
  // 점수 = 그 호텔에서 가장 많이 아끼는 혜택의 절약액(₩) + 티어 혜택 가치(라운지·조식 등) — 레저의 '티어 가치'와 같은 기준.
  // (예전: 같은 종류 안 절약률 상위 % → 싼 호텔의 큰 할인율이 비싼 호텔의 큰 절약보다 위로 올라왔다)
  const by = {};
  for (const r of rows) { const o = by[r.h] || (by[r.h] = { h: r.h, rows: [], kinds: new Set(), dates: new Set() }); o.rows.push(r); o.kinds.add(r.b); o.dates.add(r.d); }
  const out = [];
  for (const o of Object.values(by)) {
    const top = o.rows.filter(r => (r.sv || 0) > 0).sort((a, b) => (b.sv || 0) - (a.sv || 0) || (a.ap ? 1 : 0) - (b.ap ? 1 : 0))[0]; if (!top) continue;
    const h = D.hotels.get(o.h) || {}; const bv = benefitValue(tierBenefits(h));
    const score = (top.sv || 0) + bv;
    out.push({ h: o.h, chain: o.h.split('|')[0], score, bv, best: top, ratio: top.sv && top.ref ? top.sv / top.ref : 0, kinds: [...o.kinds], days: o.dates.size });
  }
  return out.sort((a, b) => b.score - a.score || b.days - a.days);
}
// 체인당 최대 perChain곳 (후보가 모자라면 채움)
function mixChains(list, n, perChain = 2) {
  const cnt = {}, out = [], rest = [];
  for (const b of list) { if (out.length >= n) break; if ((cnt[b.chain] || 0) < perChain) { out.push(b); cnt[b.chain] = (cnt[b.chain] || 0) + 1; } else rest.push(b); }
  while (out.length < n && rest.length) out.push(rest.shift());
  return out;
}
function bestCard(b, i) {
  const h = D.hotels.get(b.h) || {}; const r = b.best; const bl = BEN[r.b];
  const val = r.b === 'POINTS' && r.pt && r.ref ? `${won(r.sv)} 절약 · 1pt당 ₩${(r.ref / r.pt).toFixed(1)} (정가 ${won(r.ref)} → ${r.pt.toLocaleString()}pt)` : r.sv ? `${badgeLabel(r)}로 ${won(r.sv)} 절약${b.ratio ? ` (정가 대비 ${Math.round(b.ratio * 100)}%)` : ''}` : badgeLabel(r);
  const tv = `티어 가치 +${won(b.score)}${b.bv ? ` <span class="muted">(절약 ${won(r.sv)} + 혜택 ${won(b.bv)})</span>` : ''}`;
  const why = [val, `${b.days}일 가능`, b.kinds.length > 1 ? `혜택 ${b.kinds.length}종` : ''].filter(Boolean).join(' · ');
  const img = hImg(h) && !NO_EXT_IMG ? `<img src="${esc(hImg(h))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="trImgErr(this, '${esc(h.img ? h.image || '' : '')}', 'parent')">` : '';
  return `<a class="bcard ${h.chain} ${img ? '' : 'noimg'}" href="#hotel/${encodeURIComponent(b.h)}"><div class="bimg">${img}<span class="brank">${i + 1}</span></div><div class="bbody"><div class="hname">${esc(h.name)}</div><div class="hsub"><span class="ctag ${h.chain}">${CHAIN[h.chain]}</span>${esc(h.brand || '')} · ${esc(h.city || '')}</div><div class="btv">${tv}</div><div class="bwhy"><span class="badge ${r.b}">${badgeLabel(r)}</span> <span class="small">${esc(why)}</span></div><div class="bkinds">${b.kinds.map(k => `<i class="dot ${k}" title="${BEN[k].label}"></i>`).join('')}<span class="muted small">가장 좋은 날 ${r.d.slice(5).replace('-', '.')} · 내 비용 ${r.pt ? r.pt.toLocaleString() + 'pt' : won(r.my)}</span></div></div></a>`;
}
function viewBest() {
  const el = $('#v-best'); let mine = hasProfile() ? D.rows.filter(eligible) : D.rows; let note = '';
  // 내 프로필로 쓸 수 있는 혜택이 하나도 없으면(티어만 넣고 바우처·포인트는 0 등) 빈 화면 대신 전체 기준으로 보여주고 이유를 알려준다
  if (hasProfile() && !mine.length) { mine = D.rows; note = `<p class="note">지금 프로필로 쓸 수 있는 혜택이 이 기간엔 없어서 <b>전체 기준</b>으로 보여드려요. 바우처(SNU·Stay Plus)나 포인트 잔액을 넣으면 내 기준으로 바뀝니다. <a href="#" id="bestProfile">프로필 수정</a></p>`; }
  if (!mine.length) note = `<p class="note">아직 불러온 데이터가 없어요. 잠시 뒤 다시 열어 주세요.</p>`;
  const pct = percentiles(mine);
  const byC = {}; for (const r of mine) { if (!r.cc) continue; (byC[r.cc] = byC[r.cc] || []).push(r); }
  const ORDER = ['KR', 'JP', 'TH', 'VN', 'SG', 'HK']; const label = (cc) => (D.meta.countries || []).find(c => c.cc === cc)?.label || cc;
  const all = bestOf(mine, pct); const overall = mixChains(all, 5);
  const KINDS = [['SUITE', '스위트 업그레이드', '스위트 vs 일반 객실 차액이 큰 곳'], ['FREE_NIGHT', '무료박', 'IHG 앰배서더 주말·아코르 Stay Plus·메리어트/힐튼 5박 무료'], ['POINTS', '포인트 가치', '포인트 1pt가 가장 비싸게 쓰이는 곳'], ['SALE', '세일', '회원 전용 특가']];
  const sections = KINDS.map(([b, title, sub]) => { const list = mixChains(bestOf(mine.filter(r => r.b === b), pct), 3, 2); return list.length ? `<h2>${title} <span class="muted small">${sub}</span></h2><div class="bgrid">${list.map(bestCard).join('')}</div>` : ''; }).join('');
  el.innerHTML = `<h1>이번 달 베스트</h1><p class="lead">수집된 혜택을 바탕으로 매일 자동 계산해요. 순위는 <b>실제로 아끼는 금액(₩)</b>에 라운지·조식 같은 <b>티어 혜택 가치</b>를 더한 <b>티어 가치</b> 순이고, TOP 5는 체인당 최대 2곳으로 섞습니다. 정가가 비정상적으로 높게 잡힌 날은 평소 값으로 보정해요.</p>
    ${note}<h2>전체 TOP 5</h2><div class="bgrid">${overall.map(bestCard).join('')}</div>
    ${sections}
    ${ORDER.filter(cc => byC[cc]).map(cc => `<h2>${esc(label(cc))} TOP 5</h2><div class="bgrid">${mixChains(bestOf(byC[cc], pct), 5).map(bestCard).join('')}</div>`).join('')}`;
  $('#bestProfile')?.addEventListener('click', (e) => { e.preventDefault(); $('#profileBtn').click(); });
}


// ---------- 지도 (Leaflet + OpenStreetMap, 키 불필요) ----------
const chainColor = (c) => getComputedStyle(document.documentElement).getPropertyValue(`--c-${c}`).trim() || '#555';
// 타일: OSM 본 서버는 확장에서 오는 요청에 403을 "그림"으로 돌려주고(에러 이벤트 없음), CARTO는 API 키 필수 → 키·referrer 제약 없는 Esri.
// Esri 거리지도는 한국 등에서 줌 13~14까지만 상세 타일이 있어 그 위로는 "Map data not yet available" → 줌 15부터 위성사진 + 지명 레이어로 전환.
// 지도 타일: OpenFreeMap 벡터 지도(무료·키 없음·상업 이용 가능)를 MapLibre로 그리고, 색은 사이트 톤(미드나잇·골드), 지명은 한국어 → 영어 → 현지어 순.
// MapLibre(약 0.8MB)는 지도를 처음 열 때만 불러온다. WebGL이 없거나 실패하면 예전 Esri 다크 그림 타일로 자동 대체.
// dark 주소는 공식 안내에 없어서, 확인된 positron 을 2순위로 (어차피 색은 전부 다시 칠한다)
const MAPSTYLE_URLS = ['https://tiles.openfreemap.org/styles/dark', 'https://tiles.openfreemap.org/styles/positron', 'https://tiles.openfreemap.org/styles/liberty'];
const PAL = { bg: '#10172a', water: '#0a1020', land: '#131c33', park: '#142338', building: '#1a2440', road: '#232f4d', roadMajor: '#2f3d62', motorway: 'rgba(212,168,75,.45)', rail: '#2a3454', border: '#4a5578', text: '#b9c0d2', textMajor: '#ece7da', halo: '#0c1222', waterText: '#5d6d93' };
let _mlLoad = null;
function loadMapLibre() {
  if (window.maplibregl && L.maplibreGL) return Promise.resolve();
  if (_mlLoad) return _mlLoad;
  const add = (tag, attrs) => new Promise((res, rej) => { const el = document.createElement(tag); Object.assign(el, attrs); el.onload = res; el.onerror = rej; document.head.appendChild(el); });
  // 1순위 공용 CDN(jsDelivr, 버전 고정) → 2순위 사이트의 vendor/maplibre/ (GitHub에 파일을 안 올려도 동작)
  const CDN = { 'maplibre-gl.css': 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css', 'maplibre-gl.js': 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js', 'leaflet-maplibre-gl.js': 'https://cdn.jsdelivr.net/npm/@maplibre/maplibre-gl-leaflet@0.1.3/leaflet-maplibre-gl.js' };
  const both = (tag, key, name) => { const extra = tag === 'link' ? { rel: 'stylesheet' } : {}; return add(tag, { [key]: CDN[name], crossOrigin: 'anonymous', ...extra }).catch(() => add(tag, { [key]: 'vendor/maplibre/' + name, ...extra })); };
  _mlLoad = both('link', 'href', 'maplibre-gl.css').catch(() => null)
    .then(() => window.maplibregl ? null : both('script', 'src', 'maplibre-gl.js'))
    .then(() => L.maplibreGL ? null : both('script', 'src', 'leaflet-maplibre-gl.js'));
  return _mlLoad;
}
let _styleP = null;
function brandStyle() {
  if (_styleP) return _styleP;
  const tryUrls = async () => { let last; for (const u of MAPSTYLE_URLS) { try { const r = await fetch(u); if (r.ok) { const j = await r.json(); if (j?.layers?.length) return j; } last = new Error('style ' + r.status + ' ' + u); } catch (e) { last = e; } } throw last; };
  _styleP = tryUrls().then(st => {
    const KO = ['coalesce', ['get', 'name:ko'], ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']];
    const keep = [];
    for (const ly of st.layers) {
      const sl = ly['source-layer'] || ''; const id = ly.id || ''; ly.paint = ly.paint || {}; ly.layout = ly.layout || {};
      if (sl === 'poi' || /poi|housenumber|aerodrome_label/.test(id)) continue;          // 상점·번지 등 잡음 제거
      if (ly.type === 'background') ly.paint['background-color'] = PAL.bg;
      else if (ly.type === 'fill') {
        ly.paint['fill-color'] = sl === 'water' ? PAL.water : sl === 'building' ? PAL.building : /park|wood|grass|landcover/.test(sl + id) ? PAL.park : PAL.land;
        if (sl === 'building') ly.paint['fill-opacity'] = 0.7;
        delete ly.paint['fill-pattern']; delete ly.paint['fill-outline-color'];
      }
      else if (ly.type === 'line') {
        if (sl === 'transportation') ly.paint['line-color'] = /motorway|trunk/.test(id) ? PAL.motorway : /primary|secondary/.test(id) ? PAL.roadMajor : /rail|transit/.test(id) ? PAL.rail : PAL.road;
        else if (sl === 'boundary') ly.paint['line-color'] = PAL.border;
        else if (sl === 'waterway') ly.paint['line-color'] = PAL.water;
        else ly.paint['line-color'] = PAL.road;
        delete ly.paint['line-pattern'];
      }
      else if (ly.type === 'fill-extrusion') { ly.paint['fill-extrusion-color'] = PAL.building; ly.paint['fill-extrusion-opacity'] = 0.6; }
      else if (ly.type === 'circle') { ly.paint['circle-color'] = PAL.roadMajor; }
      else if (ly.type === 'symbol') {
        const tf = ly.layout['text-field']; if (tf && JSON.stringify(tf).includes('name')) ly.layout['text-field'] = KO;
        if (ly.layout['icon-image'] && sl !== 'transportation_name') delete ly.layout['icon-image'];
        const major = /place_(city|country|capital|state)|country|city/.test(id);
        ly.paint['text-color'] = /water/.test(sl + id) ? PAL.waterText : major ? PAL.textMajor : PAL.text;
        ly.paint['text-halo-color'] = PAL.halo; ly.paint['text-halo-width'] = 1.2;
      }
      keep.push(ly);
    }
    st.layers = keep; return st;
  });
  return _styleP;
}
function esriTiles() {
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
  return [L.tileLayer(ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { minZoom: 1, maxZoom: 16, attribution: 'Tiles &copy; Esri' }),
          L.tileLayer(ESRI + 'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { minZoom: 1, maxZoom: 16, pane: 'overlayPane', opacity: .9 }),
          L.tileLayer(ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', { minZoom: 17, maxZoom: 19, attribution: 'Tiles &copy; Esri' })];
}
const webglOK = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };
const osmTiles = () => {
  const g = L.layerGroup();
  const fallback = () => { if (g._fb) return; g._fb = true; esriTiles().forEach(l => g.addLayer(l)); };
  if (!webglOK()) { fallback(); return g; }
  let done = false; const timer = setTimeout(() => { if (!done) { console.warn('[map] 벡터 지도 시간 초과 → Esri 대체'); fallback(); } }, 15000);
  Promise.all([loadMapLibre(), brandStyle()]).then(([, style]) => {
    done = true; clearTimeout(timer); if (g._fb) return;
    const gl = L.maplibreGL({ style, localIdeographFontFamily: "'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif", attributionControl: false, interactive: false });
    g.addLayer(gl);
    const m = g._map; if (m) m.attributionControl?.addAttribution('<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>');
  }).catch((e) => { done = true; clearTimeout(timer); console.warn('[map] 벡터 지도 실패 → Esri 대체:', e && (e.message || e.type || e)); fallback(); });
  return g;
};
const MAP_DOT = { accor: '#8ea8e8' };   // 아코르 남색은 밤 지도에서 안 보여서 지도에서만 밝게
const markerStyle = (chain, r) => ({ radius: r, color: '#fff', weight: 1.5, fillColor: MAP_DOT[chain] || chainColor(chain), fillOpacity: .9 });
const MAP = { map: null, layer: null, bounds: {} };
// ※ 아래 지도 로직은 레이더/베스트와 같은 데이터(D.rows)를 쓴다.
// 좌표 없는 호텔은 지역 중심에 살짝 흩어서(대략 위치) 놓는다
function hotelPos(h) {
  if (h.lat != null && h.lng != null && Math.abs(h.lat) <= 90) return { lat: h.lat, lng: h.lng, approx: false };
  const CC = { KR: [36.5, 127.8, 60], JP: [36.2, 138.3, 80], TH: [13.75, 100.5, 60], VN: [16.0, 108.0, 60], SG: [1.35, 103.82, 10], HK: [22.32, 114.17, 10] };
  let a = ((D.meta.areaGeo || {})[h.cc] || []).find(x => x.name === h.city); if (!a && CC[h.cc]) a = { lat: CC[h.cc][0], lng: CC[h.cc][1], r: CC[h.cc][2] }; if (!a) return null;
  let seed = 0; for (const ch of h.key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0; const ang = (seed % 360) * Math.PI / 180, dist = 0.004 + ((seed >> 9) % 100) / 100 * Math.min(a.r || 20, 25) * 0.004;
  return { lat: a.lat + Math.sin(ang) * dist, lng: a.lng + Math.cos(ang) * dist / Math.cos(a.lat * Math.PI / 180), approx: true };
}
function mapRows() {
  const from = $('#mFrom').value, to = $('#mTo').value, mine = $('#mMine').checked;
  let rows = D.rows.filter(r => ui.benefits.has(r.b) && ui.chains.has(r.chain) && (!from || r.d >= from) && (!to || r.d <= to) && !(r.br === 'FIVE4' && ![5, 6].includes(dow(r.d))));
  if (mine) rows = rows.filter(eligible);
  return rows;
}
function viewMap() {
  const el = $('#v-map');
  if (!window.L) { $('#mapNote').textContent = '지도 라이브러리를 불러오지 못했어요.'; return; }
  if (!$('#mFrom').value) { $('#mFrom').value = $('#fFrom').value; $('#mTo').value = $('#fTo').value; }
  // 칩(혜택·체인)은 레이더와 같은 상태(ui)를 공유
  const chips = $('#mapChips'); if (!chips.children.length) {
    chips.innerHTML = Object.entries(BEN).map(([k, v]) => `<button class="chip ${ui.benefits.has(k) ? 'on' : ''}" data-mb="${k}">${v.icon} ${v.label}</button>`).join('') + '<span class="sep"></span>' + ['accor', 'ihg', 'marriott', 'hilton'].map(c => `<button class="chip ${ui.chains.has(c) ? 'on' : ''}" data-mc="${c}" data-c="${c}">${CHAIN[c]}</button>`).join('');
    chips.querySelectorAll('[data-mb]').forEach(c => c.addEventListener('click', () => { const b = c.dataset.mb; ui.benefits.has(b) ? ui.benefits.delete(b) : ui.benefits.add(b); c.classList.toggle('on', ui.benefits.has(b)); document.querySelector(`.chip[data-b="${b}"]`)?.classList.toggle('on', ui.benefits.has(b)); drawMap(); }));
    chips.querySelectorAll('[data-mc]').forEach(c => c.addEventListener('click', () => { const k = c.dataset.mc; ui.chains.has(k) ? ui.chains.delete(k) : ui.chains.add(k); c.classList.toggle('on', ui.chains.has(k)); document.querySelector(`.chip[data-c="${k}"]:not([data-mc])`)?.classList.toggle('on', ui.chains.has(k)); drawMap(); }));
    ['#mFrom', '#mTo', '#mMine'].forEach(sel => $(sel).addEventListener('input', drawMap));
  } else { chips.querySelectorAll('[data-mb]').forEach(c => c.classList.toggle('on', ui.benefits.has(c.dataset.mb))); chips.querySelectorAll('[data-mc]').forEach(c => c.classList.toggle('on', ui.chains.has(c.dataset.mc))); }
  if (!MAP.map) {
    MAP.map = L.map('map', { worldCopyJump: true, maxZoom: 19 }).setView([15, 108], 4); osmTiles().addTo(MAP.map); MAP.layer = L.layerGroup().addTo(MAP.map);
    const ORDER = ['KR', 'JP', 'TH', 'VN', 'SG', 'HK']; const label = (cc) => (D.meta.countries || []).find(c => c.cc === cc)?.label || cc;
    $('#mapJump').innerHTML = '<button data-cc="">전체</button>' + ORDER.filter(cc => (D.meta.countries || []).some(c => c.cc === cc)).map(cc => `<button data-cc="${cc}">${label(cc)}</button>`).join('');
    $('#mapJump').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { const bb = MAP.bounds[b.dataset.cc || 'ALL']; if (bb && bb.isValid()) MAP.map.fitBounds(bb, { padding: [30, 30], maxZoom: 12 }); }));
  }
  setTimeout(() => { MAP.map.invalidateSize(); drawMap(true); }, 0);
}
function drawMap(fit) {
  const rows = mapRows(); const pct = percentiles(rows);
  const by = {}; for (const r of rows) { const o = by[r.h] || (by[r.h] = { rows: [], kinds: new Set(), dates: new Set() }); o.rows.push(r); o.kinds.add(r.b); o.dates.add(r.d); }
  MAP.layer.clearLayers(); MAP.bounds = { ALL: L.latLngBounds([]) }; let shown = 0, approxN = 0, noPos = 0;
  for (const [key, o] of Object.entries(by)) {
    const h = D.hotels.get(key); if (!h) continue; const pos = hotelPos(h); if (!pos) { noPos++; continue; }
    const best = o.rows.map(r => ({ r, p: pct(r) })).sort((a, b) => (b.p - a.p) || ((b.r.sv || 0) - (a.r.sv || 0)))[0].r;
    const days = o.dates.size; const radius = 5 + Math.min(days, 30) / 30 * 9;
    const st = markerStyle(h.chain, radius); if (pos.approx) { Object.assign(st, { dashArray: '3 3', color: chainColor(h.chain), weight: 2, fillColor: '#fff', fillOpacity: .6 }); approxN++; }
    const m = L.circleMarker([pos.lat, pos.lng], st).addTo(MAP.layer);
    const val = best.b === 'POINTS' && best.pt && best.ref ? `1pt당 ₩${(best.ref / best.pt).toFixed(1)} 가치` : best.sv ? `${won(best.sv)} 절약${best.ref ? ` (정가 대비 ${Math.round(best.sv / best.ref * 100)}%)` : ''}` : '';
    m.bindTooltip(`${h.name} · ${days}일${pos.approx ? ' · 대략 위치' : ''}`, { direction: 'top', offset: [0, -radius] });
    m.bindPopup(`<div class="pn">${esc(h.name)}</div><div><span class="ctag ${h.chain}">${CHAIN[h.chain]}</span> ${esc(h.brand || '')} · ${esc(h.city || '')}${pos.approx ? ' <span class="approx">· 대략 위치</span>' : ''}</div>
      <div style="margin-top:6px">${[...o.kinds].map(k => `<span class="badge ${k}">${BEN[k].label}</span>`).join(' ')} <span class="muted">${days}일 가능</span></div>
      <div style="margin-top:6px">가장 좋은 날 <b>${fmtD(best.d)}</b> · ${badgeLabel(best)}${val ? ' · ' + val : ''}<br><span class="muted">내 비용 ${best.pt ? best.pt.toLocaleString() + 'pt' : won(best.my)}</span></div>
      <div class="pl"><a href="#hotel/${encodeURIComponent(key)}">달력 보기 →</a><a href="${esc(link(best))}" target="_blank" rel="noopener">예약 ↗</a></div>`, { maxWidth: 320 });
    MAP.bounds.ALL.extend([pos.lat, pos.lng]); (MAP.bounds[h.cc] = MAP.bounds[h.cc] || L.latLngBounds([])).extend([pos.lat, pos.lng]); shown++;
  }
  $('#mapNote').textContent = (IN_ARTIFACT ? '테스트 페이지에서는 지도 배경(타일)이 차단될 수 있어요 — 점과 팝업은 동작합니다. ' : '') + `${shown}개 호텔${approxN ? ` · 그중 ${approxN}곳은 좌표가 없어 지역 중심 근처에 표시(점선)` : ''}${noPos ? ` · ${noPos}곳은 지역 정보가 없어 생략` : ''} · 지도: OpenFreeMap`;
  if (fit && MAP.bounds.ALL.isValid()) MAP.map.fitBounds(MAP.bounds.ALL, { padding: [30, 30] });
}


// ---------- 내 혜택 (프로필 기준 "지금 뭘 해야 하나") ----------
const TIERS_N = {   // 숙박 수 기준 티어 (연말 리셋)
  accor: [['Silver', 10], ['Gold', 30], ['Platinum', 60]],
  ihg: [['Silver', 10], ['Gold', 20], ['Platinum', 40], ['Diamond', 70]],
  marriott: [['Silver', 10], ['Gold', 25], ['Platinum', 50], ['Titanium', 75], ['Ambassador', 100]],
  hilton: [['Silver', 10], ['Gold', 25], ['Diamond', 50]],
};
const TIER_NOTE = { accor: '아코르 Diamond는 숙박 수가 아니라 상태 포인트 26,000 기준이에요. 포인트 전액 결제 숙박은 숙박 수에 안 들어갑니다.', ihg: 'IHG는 포인트 숙박도 숙박 수로 인정돼요.', marriott: '메리어트는 포인트 숙박도 숙박 수로 인정돼요. 수집 데이터가 포인트 기준이라 현금 최저가는 공식 사이트에서 확인하세요.', hilton: '힐튼은 2026년부터 Gold 25박·Diamond 50박. 포인트 숙박도 숙박 수로 인정돼요. 5박 무료는 실버 이상.' };
const daysTo = (d) => d ? Math.ceil((Date.parse(d + 'T23:59:59+09:00') - Date.now()) / 86400e3) : null;
const todayStr = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
function miniRows(rows, n = 6) {
  return `<div class="tablewrap"><table><thead><tr><th>체크인</th><th>호텔</th><th>혜택</th><th>내 비용 (₩)</th><th>비교 기준</th><th>절약</th><th>객실</th><th>예약</th></tr></thead><tbody>${rows.slice(0, n).map(r => rowHtml(r)).join('')}</tbody></table></div>`;
}
function viewMe() {
  const el = $('#v-me'); const P = profile;
  if (!hasProfile()) { el.innerHTML = `<h1>오늘의 혜택</h1><p class="lead">티어·포인트·바우처를 넣으면 지금 내가 받을 수 있는 혜택과 놓치기 전에 써야 할 것을 한 화면에 모아 보여드려요. 로그인 없이 이 브라우저에만 저장됩니다.</p><p><button class="btn primary" id="meProfile">내 프로필 입력</button></p>`; $('#meProfile').addEventListener('click', () => $('#profileBtn').click()); return; }
  const today = todayStr(); const mine = D.rows.filter(eligible); const out = [];
  // 요약
  const sum = [];
  if (P.accorTier) sum.push(`<div class="kpi accor"><b>Accor ${esc(P.accorTier)}</b><span>${(P.accorPts || 0).toLocaleString()}pt · ${P.accorNights || 0}박${P.explorer ? ' · Explorer' : ''}</span></div>`);
  if (P.ihgTier) sum.push(`<div class="kpi ihg"><b>IHG ${esc(P.ihgTier)}</b><span>${(P.ihgPts || 0).toLocaleString()}pt · ${P.ihgNights || 0}박${P.ambassador ? ' · Ambassador' : ''}</span></div>`);
  if (P.marriottTier) sum.push(`<div class="kpi marriott"><b>Marriott ${esc(P.marriottTier)}</b><span>${(P.marriottPts || 0).toLocaleString()}pt · ${P.marriottNights || 0}박</span></div>`);
  if (P.hiltonTier) sum.push(`<div class="kpi hilton"><b>Hilton ${esc(P.hiltonTier)}</b><span>${(P.hiltonPts || 0).toLocaleString()}pt · ${P.hiltonNights || 0}박</span></div>`);
  out.push(`<h1>오늘의 혜택</h1><p class="lead">내 티어·포인트·바우처로 지금 받을 수 있는 혜택, 놓치기 전에 써야 할 것, 포인트로 갈 수 있는 곳을 모았어요. <a href="#" id="meEdit">프로필 수정</a></p><div class="kpis">${sum.join('')}</div>`);
  // 1) 바우처 소진 플래너
  const vouchers = [];
  if (P.accorTier && P.snu > 0) vouchers.push({ name: 'SNU (스위트 업그레이드)', chain: 'accor', count: P.snu, exp: P.snuExp, rows: mine.filter(r => r.br === 'SNU') });
  if (P.explorer && P.stayPlus > 0) vouchers.push({ name: 'Stay Plus (2박 중 1박 무료)', chain: 'accor', count: P.stayPlus, exp: P.stayPlusExp, rows: mine.filter(r => r.br === 'STAY_PLUS') });
  if (P.ambassador) vouchers.push({ name: 'Ambassador 주말 무료박', chain: 'ihg', count: 1, exp: P.ambExp, rows: mine.filter(r => r.br === 'AMB') });
  if (vouchers.length) {
    out.push(`<h2>바우처 소진 플래너</h2>`);
    for (const v of vouchers) {
      const dd = daysTo(v.exp); const usable = v.rows.filter(r => !v.exp || r.d <= v.exp).sort((a, b) => (b.sv || 0) - (a.sv || 0)); const seenH = new Set(); const top = usable.filter(r => !seenH.has(r.h) && seenH.add(r.h));
      const hotels = new Set(usable.map(r => r.h)); const urgent = dd != null && dd <= 45;
      out.push(`<div class="mecard ${v.chain} ${urgent ? 'urgent' : ''}"><div class="meh"><span class="ctag ${v.chain}">${CHAIN[v.chain]}</span><b>${esc(v.name)}</b> ${v.count}장${v.exp ? ` · 만료 ${v.exp.slice(5).replace('-', '.')} <span class="dday ${urgent ? 'hot' : ''}">D-${dd}</span>` : ' · <span class="muted">만료일 미입력</span>'}</div>
        <div class="small muted">${v.exp ? '만료 전' : '수집 범위 안'} 쓸 수 있는 날 ${new Set(usable.map(r => r.d)).size}일 · 호텔 ${hotels.size}곳${urgent && usable.length ? ' · <b>서두르세요</b>' : ''}${!usable.length ? ' · 지금은 쓸 수 있는 날짜가 없어요' : ''}</div>
        ${top.length ? '<div class="small" style="margin:6px 0 2px">호텔별 가장 좋은 날 (절약 큰 순)</div>' + miniRows(top, 5) : ''}</div>`);
    }
  }
  // 2) 내 포인트로 갈 수 있는 곳
  const ptChains = [['accor', P.accorPts], ['ihg', P.ihgPts], ['marriott', P.marriottPts], ['hilton', P.hiltonPts]].filter(([c, p]) => p > 0 && (c === 'accor' ? P.accorTier : c === 'ihg' ? P.ihgTier : c === 'marriott' ? P.marriottTier : P.hiltonTier));
  if (ptChains.length) {
    out.push(`<h2>내 포인트로 지금 갈 수 있는 곳</h2><p class="muted small">보유 포인트로 1박(메리어트는 5박 묶음 포함) 결제가 가능한 호텔만. 1pt 가치가 높은 순.</p>`);
    for (const [c, pts] of ptChains) {
      if (c === 'accor') {   // 아코르 포인트는 2,000pt = €40 로 현금처럼 차감 → "포인트만으로 결제되는 1박"
        const val = Math.floor(pts / 2000) * 2000 * 29.8; const rows = D.rows.filter(r => r.chain === 'accor' && (r.n || 1) === 1 && r.my && r.my <= val).sort((a, b) => b.my - a.my); const seenA = new Set(); const list = rows.filter(r => !seenA.has(r.h) && seenA.add(r.h)).slice(0, 8);
        out.push(`<h3 class="cityh"><span class="ctag accor">Accor</span> ${pts.toLocaleString()}pt ≈ ${won(val)} 차감 가능 (2,000pt 단위) · 포인트만으로 되는 1박 ${seenA.size}곳</h3>` + (list.length ? miniRows(list, 6) : '<p class="muted small">포인트만으로 결제되는 1박이 지금은 없어요. 일부 차감은 어느 예약이든 가능합니다.</p>'));
        continue;
      }
      const rows = D.rows.filter(r => r.chain === c && r.pt && r.pt <= pts && (r.b === 'POINTS' || r.br === 'FIVE4' || r.br === 'POINTS_SUITE'));
      const by = {}; for (const r of rows) { const v = r.ref && r.pt ? r.ref / r.pt : 0; const o = by[r.h]; if (!o || v > o.v) by[r.h] = { r, v, days: (o?.days || 0) + 1 }; else o.days++; }
      const list = Object.values(by).sort((a, b) => b.v - a.v).slice(0, 8);
      out.push(`<h3 class="cityh"><span class="ctag ${c}">${CHAIN[c]}</span> ${pts.toLocaleString()}pt로 ${Object.keys(by).length}곳</h3>` + (list.length ? `<div class="bgrid">${list.map(({ r, v, days }) => { const h = D.hotels.get(r.h) || {}; return `<a class="bcard ${c} noimg" href="#hotel/${encodeURIComponent(r.h)}"><div class="bimg"></div><div class="bbody"><div class="hname">${esc(h.name)}</div><div class="hsub">${esc(h.brand || '')} · ${esc(h.city || '')}</div><div class="bwhy"><span class="badge ${r.b}">${badgeLabel(r)}</span> <span class="small">${r.pt.toLocaleString()}pt${v ? ` · 1pt당 ₩${v.toFixed(1)}` : ''}${r.ref ? ` · 정가 ${won(r.ref)}` : ''}</span></div><div class="bkinds"><span class="muted small">가장 좋은 날 ${fmtD(r.d)} · ${days}일 가능</span></div></div></a>`; }).join('')}</div>` : '<p class="muted small">지금 포인트로 가능한 곳이 없어요.</p>'));
    }
  }
  // 3) 티어 플래너
  const plans = [['accor', P.accorTier, P.accorNights], ['ihg', P.ihgTier, P.ihgNights], ['marriott', P.marriottTier, P.marriottNights], ['hilton', P.hiltonTier, P.hiltonNights]].filter(([c, t]) => t);
  const yearEnd = daysTo(today.slice(0, 4) + '-12-31');
  out.push(`<h2>티어 플래너 <span class="muted small">올해 마감까지 ${yearEnd}일</span></h2>`);
  for (const [c, tier, nights] of plans) {
    const ladder = TIERS_N[c]; const idx = ladder.findIndex(([name]) => name === tier); const cur = idx >= 0 ? ladder[idx] : null; const next = idx >= 0 ? ladder[idx + 1] : ladder.find(([, n]) => n > (nights || 0));
    const keep = cur && (nights || 0) < cur[1] ? cur[1] - (nights || 0) : 0;
    const cheap = D.rows.filter(r => r.chain === c && (r.n || 1) === 1 && r.my).sort((a, b) => a.my - b.my); const seen = new Set(); const pick = cheap.filter(r => !seen.has(r.h) && seen.add(r.h)).slice(0, 5);
    out.push(`<div class="mecard ${c}"><div class="meh"><span class="ctag ${c}">${CHAIN[c]}</span><b>${esc(tier)}</b> · 올해 ${nights || 0}박${keep ? ` · <b>${tier} 유지</b>까지 <b>${keep}박</b>` : ''}${next ? ` · <b>${next[0]}</b>까지 <b>${Math.max(0, next[1] - (nights || 0))}박</b>` : ' · 숙박 수 기준 최고 티어'}</div><div class="small muted">${TIER_NOTE[c]}${(keep || next) && yearEnd < 120 ? ` 남은 ${yearEnd}일 안에 ${keep || Math.max(0, next[1] - (nights || 0))}박이면 주당 ${Math.ceil((keep || Math.max(0, next[1] - (nights || 0))) / Math.max(1, Math.floor(yearEnd / 7)))}박 꼴.` : ''}</div>
      ${pick.length ? `<div class="small" style="margin:6px 0 2px">숙박 수 채우기에 가장 싼 1박 (내 비용 기준)</div>${miniRows(pick, 5)}` : ''}</div>`);
  }
  // 4) 새로 열림 / 사라짐
  const since = Date.now() - 48 * 3600e3; const fresh = mine.filter(r => r.first && r.first >= since).sort((a, b) => (b.sv || 0) - (a.sv || 0));
  const gone = (D.meta.gone || []).filter(g => !hasProfile() || eligible(Object.assign({ chain: g.h.split('|')[0] }, g))).slice(0, 8);
  const allNew = fresh.length > mine.length * 0.5; out.push(`<h2>최근 48시간 새로 열린 혜택 <span class="muted small">${fresh.length}건${allNew ? ' · 최근 첫 수집이라 대부분이 새 항목이에요. 내일부터 진짜 "새로 열린 것"만 남습니다' : ''}</span></h2>` + (fresh.length ? miniRows(fresh, 8) : '<p class="muted small">새로 열린 혜택이 없어요. 수집이 매일 돌면 여기에 쌓입니다.</p>'));
  if (gone.length) out.push(`<h2>최근 사라진 혜택 <span class="muted small">먼저 잡힌 날짜들 — 이런 곳은 뜨면 바로 예약</span></h2><ul class="gone">${gone.map(g => { const h = D.hotels.get(g.h) || {}; return `<li><span class="ctag ${h.chain || ''}">${CHAIN[h.chain] || ''}</span> <a href="#hotel/${encodeURIComponent(g.h)}">${esc(h.name || g.h)}</a> · ${fmtD(g.d)} · <span class="badge ${g.b}">${g.bl || BEN[g.b]?.label || ''}</span> · ${g.my ? won(g.my) : ''} <span class="muted small">(체크인 ${g.db}일 전 사라짐)</span></li>`; }).join('')}</ul>`);
  el.innerHTML = out.join(''); $('#meEdit')?.addEventListener('click', (e) => { e.preventDefault(); $('#profileBtn').click(); });
}

// ---------- 테마 (호텔명·브랜드 키워드) ----------
const THEMES = [
  ['풀빌라', /pool ?villa|villa|풀빌라/i], ['비치·리조트', /beach|resort|리조트|비치|island|lagoon|bay\b|coast/i], ['온천·스파', /onsen|hot ?spring|spa\b|온천|스파/i],
  ['골프', /golf|골프|country club/i], ['스키·산', /ski|alpensia|알펜시아|mountain|hill|평창|khao yai|카오야이|dalat|달랏|chiang/i], ['공항', /airport|incheon|인천공항|suvarnabhumi|changi/i],
];
const hotelTheme = (h) => THEMES.filter(([, re]) => re.test(`${h.name} ${h.brand || ''} ${h.city0 || ''}`)).map(([n]) => n);

// ---------- 호텔 페이지 ----------
function viewHotel(key) {
  const h = D.hotels.get(key); const el = $('#v-hotel');
  if (!h) { el.innerHTML = '<div class="empty">호텔을 찾을 수 없어요.</div>'; return; }
  const rows = D.rows.filter(r => r.h === key).sort((a, b) => a.d.localeCompare(b.d) || (b.sv || 0) - (a.sv || 0));
  const c = { SUITE: 0, FREE_NIGHT: 0, POINTS: 0, SALE: 0 }; for (const r of rows) c[r.b]++;
  const byDay = {}; for (const r of rows) (byDay[r.d] = byDay[r.d] || []).push(r);
  // 달력: 수집 범위 첫날이 속한 주의 일요일부터
  const from = D.meta.dateFrom, to = D.meta.dateTo; let start = addDays(from, -dow(from)); const cells = [];
  for (let d = start; d <= to || dow(d) !== 0; d = addDays(d, 1)) {
    const inR = d >= from && d <= to; const rs = byDay[d] || []; const kinds = [...new Set(rs.map(r => r.b))]; const min = rs.length ? Math.min(...rs.map(r => r.my ?? Infinity)) : null;
    cells.push(`<div class="cell ${inR ? '' : 'off'} ${[0, 6].includes(dow(d)) ? 'we' : ''} ${holiName(d) ? 'hol' : ''}" data-d="${d}" ${holiName(d) ? `title="${esc(holiName(d))}"` : ''}><span class="dn">${+d.slice(8) === 1 ? `${+d.slice(5, 7)}/1` : +d.slice(8)}</span>${holiName(d) ? `<span class="hn">${esc(holiName(d))}</span>` : ''}${kinds.length ? `<div class="dots">${kinds.map(k => `<i class="${k}" title="${BEN[k].label}"></i>`).join('')}</div><div class="mn">${isFinite(min) ? (NARROW() ? wonShort(min) : won(min)) : ''}</div>${(() => { const p = rs.filter(r => r.pt).sort((a, b) => a.pt - b.pt)[0]; return p ? `<div class="mp">${NARROW() ? ptShort(p.pt) : p.pt.toLocaleString() + 'pt'}${(p.n || 1) > 1 ? `/${p.n}박` : ''}</div>` : ''; })()}` : ''}</div>`);
    if (d >= to && dow(d) === 6) break;
  }
  const gid = h.chain || 'accor'; const tb = tierBenefits(h); const tier = myTier(h.chain);
  el.innerHTML = `<p><a href="#hotels">← 호텔 목록</a></p>
    <div class="hhead">${hImg(h) && !NO_EXT_IMG ? `<img class="hphoto" src="${esc(hImg(h))}" alt="" referrerpolicy="no-referrer" onerror="trImgErr(this, '${esc(h.img ? h.image || '' : '')}')">` : ''}<div class="t"><h1>${esc(h.name)}</h1><div class="hsub"><span class="ctag ${h.chain}">${CHAIN[h.chain]}</span>${esc(h.brand || '')} ${starsHtml(h)} · ${esc(h.country || '')} ${esc(h.city || '')}${h.city0 && h.city0 !== h.city ? ` <span class="muted">(${esc(h.city0)})</span>` : ''} · <a href="#guide/${gid}">${CHAIN[h.chain]} 멤버십 가이드</a></div>${h.note ? `<p class="hnote">${esc(h.note)}</p>` : ''}<p class="hedit"><button type="button" class="btn" data-watch-hotel="${esc(key)}">열리면 알려줘</button>${FEAT.share ? ` <button type="button" class="btn ghost" data-share="${esc(key)}">이미지로 공유</button>` : ''}</p>${D.meta?.owner ? `<p class="hedit"><button type="button" class="btn" data-edit-hotel="${esc(key)}">호텔 정보 수정</button>${h._edited ? ` <span class="muted small">수정됨 · ${Object.keys(h._edited).map(k => EDIT_LABEL[k] || k).join(', ')}</span>` : ''}</p>` : ''}</div>
      ${tier ? `<div class="band ${h.chain}" style="margin:8px 0"><b>${esc(tierKo(tier))}인 당신은</b>${(tb || []).map(b => `<span class="bf ${b.s}">${esc(b.label)} ${b.s === 'ok' ? '✓' : b.s === 'maybe' ? '△' : '✗'}${b.note ? ` <em>${esc(b.note)}</em>` : ''}</span>`).join('')}</div>` : ''}<div class="stats"><div class="stat"><b>${rows.length}</b><span>혜택 날짜</span></div><div class="stat"><b style="color:var(--suite)">${c.SUITE}</b><span>스위트</span></div><div class="stat"><b style="color:var(--free)">${c.FREE_NIGHT}</b><span>무료박</span></div><div class="stat"><b style="color:var(--points)">${c.POINTS}</b><span>포인트</span></div><div class="stat"><b style="color:var(--sale)">${c.SALE}</b><span>세일</span></div></div></div>
    ${h.lat != null && h.lng != null && window.L ? '<div class="hmap" id="hmap"></div>' : ''}
    <h2>다음 30일 가능한 혜택</h2>
    <div class="legend">${Object.entries(BEN).map(([k, v]) => `<span><i class="${k}"></i>${v.label}</span>`).join('')}<span class="muted">· 칸의 금액은 그날 가장 낮은 내 비용</span></div>
    <div class="cal">${DOW.map((d, i) => `<div class="dh ${i === 0 || i === 6 ? 'we' : ''}">${d}</div>`).join('')}${cells.join('')}</div>
    <h2 id="hdays">날짜별 상세 <span class="muted small" id="hsel"></span></h2>
    <div class="tablewrap"><table><thead><tr><th>체크인</th><th>호텔</th><th>혜택</th><th>내 비용 (₩)</th><th>비교 기준</th><th>절약</th><th>객실</th><th>예약</th></tr></thead><tbody id="htbody">${rows.map(r => rowHtml(r, false)).join('')}</tbody></table></div>
    ${rows.length ? '' : '<div class="empty">이 호텔은 현재 수집 범위에서 가능한 혜택이 없어요.</div>'}`;
  if ($('#hmap')) { try { const m = L.map('hmap', { scrollWheelZoom: false, attributionControl: false }).setView([h.lat, h.lng], 14); osmTiles().addTo(m); L.circleMarker([h.lat, h.lng], Object.assign(markerStyle(h.chain, 9), { fillOpacity: .95 })).addTo(m).bindTooltip(h.name); } catch (e) {} }
  el.querySelectorAll('.cell').forEach(cell => cell.addEventListener('click', () => {
    const d = cell.dataset.d; const sel = cell.classList.contains('sel'); el.querySelectorAll('.cell').forEach(x => x.classList.remove('sel'));
    const list = sel ? rows : rows.filter(r => r.d === d); if (!sel) cell.classList.add('sel');
    $('#htbody').innerHTML = list.map(r => rowHtml(r, false)).join(''); $('#hsel').textContent = sel ? '' : `· ${fmtD(d)}만 표시 (다시 누르면 전체)`;
  }));
}

// ---------- 호텔 목록 ---------- (국가 → 도시별로 묶고, 각 묶음 안에서는 1박 기준가가 비싼 호텔부터)
function viewHotels() {
  const el = $('#v-hotels');
  const cnt = {}, prices = {};
  for (const r of D.rows) {
    const o = cnt[r.h] || (cnt[r.h] = { SUITE: 0, FREE_NIGHT: 0, POINTS: 0, SALE: 0 }); o[r.b]++;
    const per = (r.ref ?? r.my); if (per != null) (prices[r.h] = prices[r.h] || []).push(per / (r.n || 1));   // 비교 기준가(없으면 내 비용)의 1박 환산
  }
  const typical = (k) => { const a = (prices[k] || []).slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };   // 중앙값
  const byC = {};
  for (const h of D.hotels.values()) { if (!h.cc) continue; const c = byC[h.cc] = byC[h.cc] || { label: h.country, cities: {} }; (c.cities[h.city || '기타'] = c.cities[h.city || '기타'] || []).push(h); }
  const ORDER = ['KR', 'JP', 'TH', 'VN', 'SG', 'HK'];
  const theme = ui.theme || ''; if (theme) for (const c of Object.values(byC)) for (const k of Object.keys(c.cities)) { c.cities[k] = c.cities[k].filter(h => hotelTheme(h).includes(theme)); if (!c.cities[k].length) delete c.cities[k]; }
  const chips = `<div class="chips" style="margin:-4px 0 12px"><button class="chip ${theme ? '' : 'on'}" data-theme="">전체</button>${THEMES.map(([n]) => `<button class="chip ${theme === n ? 'on' : ''}" data-theme="${n}">${n}</button>`).join('')}<span class="muted small">호텔명·브랜드 키워드로 고른 테마라 빠지는 곳이 있을 수 있어요</span></div>`;
  el.innerHTML = `<h1>호텔</h1><p class="lead">국가 · 도시별로 묶고, 각 도시 안에서는 1박 기준가(비교 기준 요금의 중앙값)가 비싼 호텔부터 보여드려요. 숫자는 다음 30일 안에 가능한 혜택 날짜 수.</p>` + chips +
    Object.entries(byC).sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0])).map(([cc, c]) => {
      const order = (D.meta.areas || {})[cc] || []; const rank = (city) => city === '기타' ? 9999 : (order.indexOf(city) >= 0 ? order.indexOf(city) : 999);
      const cities = Object.entries(c.cities).sort((a, b) => rank(a[0]) - rank(b[0]) || b[1].reduce((s, h) => s + (h.n || 0), 0) - a[1].reduce((s, h) => s + (h.n || 0), 0));
      return `<h2>${esc(c.label)} <span class="muted small">${Object.values(c.cities).flat().length}곳</span></h2>` + cities.map(([city, list]) => {
        list.sort((a, b) => (typical(b.key) ?? -1) - (typical(a.key) ?? -1) || (b.n || 0) - (a.n || 0) || a.name.localeCompare(b.name, 'ko'));
        return `<h3 class="cityh">${esc(city)} <span class="muted small">${list.length}곳</span></h3><div class="hgrid">${list.map(h => { const o = cnt[h.key] || {}; const t = typical(h.key); return `<a class="hcard ${h.chain}" href="#hotel/${encodeURIComponent(h.key)}"><div class="hname">${esc(h.name)}</div><div class="hsub"><span class="ctag ${h.chain}">${CHAIN[h.chain]}</span>${esc(h.brand || '')} ${starsHtml(h)}</div><div class="cnt">${t != null ? `<span class="price">1박 ${won(t)}~</span>` : ''}${Object.keys(BEN).map(k => o[k] ? `<span class="${k}">${BEN[k].label} <b>${o[k]}</b></span>` : '').join('')}${!h.n ? '<span class="muted">지금은 혜택 없음</span>' : ''}</div></a>`; }).join('')}</div>`;
      }).join('');
    }).join('') + (theme && !Object.values(byC).some(c => Object.keys(c.cities).length) ? '<div class="empty">이 테마에 해당하는 호텔이 없어요.</div>' : '');
  el.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => { ui.theme = b.dataset.theme; viewHotels(); }));
}

// ---------- 멤버십 비교 ----------
let quizAns = {}; try { quizAns = JSON.parse(localStorage.getItem('tr_quiz') || '{}'); } catch (e) {}
const dots = (n) => `<span class="dots3" aria-label="${n}/3">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
function viewGuide(id) {
  const el = $('#v-guide'); const C = window.TR_COMPARE; if (!C) { el.innerHTML = '<div class="empty">비교 데이터를 불러오지 못했어요.</div>'; return; }
  const liveCount = (c) => D.rows.filter(r => r.chain === c).length;
  const rec = Object.keys(quizAns).length ? C.recommend(quizAns) : null;
  const detail = id && C.CHAINS.includes(id) ? id : null;
  el.innerHTML = `<h1>멤버십 비교</h1><p class="lead">Accor · IHG · Marriott · Hilton을 한국 거주 여행자 기준으로 항목별로 나란히 놓았어요. 점(●)이 많을수록 체감 가치가 큽니다. 2026-10 약관 기준 · 달러 금액의 원화는 1달러 ≈ ₩1,400 환산 참고값.</p>
    <div class="recbox" id="recbox">${rec ? recHtml(rec) : `<div class="row"><div><b>내 여행 스타일에 맞는 멤버십은?</b><div class="muted small">여행지 · 숙박 수 · 중요한 혜택 등 7가지 질문, 30초.</div></div><span style="flex:1"></span><button class="btn primary" id="quizBtn">내 스타일 진단</button></div>`}</div>
    <h2>항목별 비교</h2>
    <div class="tablewrap"><table class="cmp"><thead><tr><th>항목</th>${C.CHAINS.map(c => `<th><span class="ctag ${c}">${CHAIN[c]}</span><div class="muted small">${esc(C.TARGET_TIER[c])}</div></th>`).join('')}</tr></thead>
      <tbody>${C.CRITERIA.map(cr => `<tr><th><div>${esc(cr.label)}</div><div class="muted small">${esc(cr.tip)}</div></th>${C.CHAINS.map(c => { const [n, t] = cr.v[c]; return `<td class="s${n}">${dots(n)}<div class="ct">${esc(t)}</div></td>`; }).join('')}</tr>`).join('')}
      <tr><th><div>현실적인 달성 경로</div><div class="muted small">한국 거주자 기준</div></th>${C.CHAINS.map(c => `<td><div class="ct">${esc(C.PATH[c])}</div></td>`).join('')}</tr>
      <tr><th><div>이번 달 레이더</div><div class="muted small">실제 잡힌 혜택 수</div></th>${C.CHAINS.map(c => `<td><div class="ct">${liveCount(c) ? `<a href="#radar"><b>${liveCount(c).toLocaleString()}</b>건</a>` : '<span class="muted">수집 대상 아님 (예정)</span>'}</div></td>`).join('')}</tr></tbody></table></div>
    <h2>체인별 상세</h2>
    <div class="tabs">${C.CHAINS.map(c => `<a href="#guide/${c}" class="${c === detail ? 'on' : ''}">${CHAIN[c]}</a>`).join('')}</div>
    <div id="chainDetail">${detail ? chainDetailHtml(detail) : '<p class="muted">체인을 고르면 티어표와 적립·사용·혜택·꿀팁이 펼쳐져요.</p>'}</div>`;
  $('#quizBtn')?.addEventListener('click', openQuiz);
  el.querySelectorAll('.btnRequiz').forEach(b => b.addEventListener('click', openQuiz));
}
function recHtml(rec) {
  const top = rec[0];
  return `<div class="row"><b>내 스타일 진단 결과</b><span class="muted small">답변은 이 브라우저에만 저장돼요</span><span style="flex:1"></span><button class="btn small ghost btnRequiz">다시 진단</button></div>
    <div class="recgrid">${rec.map((r, i) => `<div class="reccard ${i === 0 ? 'top' : ''}"><div class="rank">${i + 1}위${i === 0 ? ' · 추천' : ''}</div><div class="hname"><span class="ctag ${r.chain}">${CHAIN[r.chain]}</span> ${esc(r.name)}</div><div class="bar"><i style="width:${r.pct}%"></i></div><div class="muted small">노릴 티어: ${esc(r.tier)}</div><ul class="small">${r.why.map(w => `<li>${esc(w)}</li>`).join('') || '<li class="muted">이 스타일에서는 강점이 적어요</li>'}</ul>${i === 0 ? `<div class="small"><b>어떻게 가나</b> ${esc(r.path)}</div>` : ''}</div>`).join('')}</div>`;
}
function chainDetailHtml(c) {
  const C = window.TR_COMPARE; const g = D.guides[c]; const tiers = C.TIERS[c] || [];
  const live = (() => { const rows = D.rows.filter(r => r.chain === c); if (!rows.length) return ''; const cnt = {}; for (const r of rows) cnt[r.br] = (cnt[r.br] || 0) + 1; return `<div class="live"><span><b>${rows.length.toLocaleString()}</b> 이번 달 레이더에 잡힌 ${CHAIN[c]} 혜택</span>${Object.entries(cnt).map(([k, n]) => `<span>${esc(RAW[k] || k)} <b>${n.toLocaleString()}</b></span>`).join('')}<a href="#radar">레이더에서 보기 →</a></div>`; })();
  // 마크다운 가이드를 섹션별 접기(details)로 변환
  let sections = '';
  if (g) { const parts = g.html.replace(/<table>/g, '<div class="tw"><table>').replace(/<\/table>/g, '</table></div>').split(/(?=<h2>)/); sections = parts.map((p, i) => { const m = /^<h2>(.*?)<\/h2>/.exec(p); if (!m) return p; return `<details ${i === 0 ? 'open' : ''}><summary>${m[1]}</summary><div class="dbody">${p.slice(m[0].length)}</div></details>`; }).join(''); }
  return `${live}<div class="doc"><h2 style="margin-top:0">티어 한눈에</h2><div class="tw"><table><thead><tr><th>티어</th><th>자격 (연간)</th><th>적립 보너스</th><th>핵심 혜택</th></tr></thead><tbody>${tiers.map(t => `<tr><td><b>${esc(t[0])}</b></td><td>${esc(t[1])}</td><td>${esc(t[2])}</td><td>${esc(t[3])}</td></tr>`).join('')}</tbody></table></div>
    <div class="small" style="margin:8px 0 16px"><b>현실적인 경로</b> ${esc(C.PATH[c])}</div>${sections}</div>`;
}
function openQuiz() {
  const C = window.TR_COMPARE; const f = $('#quizForm'); const a = quizAns || {};
  f.innerHTML = C.QUIZ.map(q => `<fieldset data-q="${q.id}" ${q.multi ? 'data-multi="1"' : ''} ${q.max ? `data-max="${q.max}"` : ''}><legend>${esc(q.q)}</legend><div class="chips">${q.opts.map(([v, l]) => { const on = q.multi ? (a[q.id] || []).includes(v) : a[q.id] === v; return `<button type="button" class="chip ${on ? 'on' : ''}" data-v="${v}">${esc(l)}</button>`; }).join('')}</div></fieldset>`).join('') +
    `<menu><button type="button" value="cancel" class="btn ghost" id="quizCancel">취소</button><span style="flex:1"></span><button type="button" class="btn primary" id="quizOk">결과 보기</button></menu>`;
  f.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', () => { const fs = ch.closest('fieldset'); if (fs.dataset.multi) { if (!ch.classList.contains('on') && fs.dataset.max && fs.querySelectorAll('.chip.on').length >= +fs.dataset.max) return; ch.classList.toggle('on'); } else { fs.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); ch.classList.add('on'); } }));
  $('#quizCancel').addEventListener('click', () => $('#dlgQuiz').close());
  $('#quizOk').addEventListener('click', () => {
    const ans = {}; for (const fs of f.querySelectorAll('fieldset')) { const on = [...fs.querySelectorAll('.chip.on')].map(x => x.dataset.v); ans[fs.dataset.q] = fs.dataset.multi ? on : on[0]; }
    if (!ans.nights || !ans.regions?.length) { alert('여행지와 숙박 수는 골라 주세요.'); return; }
    quizAns = ans; try { localStorage.setItem('tr_quiz', JSON.stringify(ans)); } catch (e) {}
    $('#dlgQuiz').close(); viewGuide(location.hash.split('/')[1] || ''); $('#recbox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#dlgQuiz').showModal();
}

// 오퍼 출처: Accor·IHG는 수집기 공식 데이터, Marriott·Hilton(+IHG 보강)은 AwardWallet 정리 페이지를 브라우저에서 직접 읽어 파싱 (24시간 캐시)
const PROMO_SRC = {
  marriott: { url: 'https://awardwallet.com/news/marriott-bonvoy/marriott-promotions/', official: 'https://www.marriott.com/ko/offers.mi' },
  hilton: { url: 'https://awardwallet.com/news/hilton-honors/hilton-promotions/', official: 'https://www.hilton.com/ko/offers/' },
  ihg: { url: 'https://awardwallet.com/news/ihg-one-rewards/current-ihg-promotion/', official: 'https://www.ihg.com/content/kr/ko/offers' },
  accor: { official: 'https://all.accor.com/ko/offers/index.shtml' },
};
const BRAND_RX = /marriott|ritz|st\.? regis|edition|westin|sheraton|renaissance|le m[ée]ridien|jw |w hotel|w [a-z]+|courtyard|four points|fairfield|moxy|aloft|element|autograph|tribute|luxury collection|residence inn|hilton [a-z]|conrad|waldorf|doubletree|hampton|canopy|curio|tapestry|embassy|homewood|home2|tru by|lxr|signia|motto|intercontinental|kimpton|hotel indigo|crowne|holiday inn|voco|six senses|regent|vignette|sofitel|novotel|pullman|fairmont|raffles|mercure|ibis|m[öo]venpick|swiss[ôo]tel|mgallery|resort|hotel/i;
const SKIP_RX = /bottom line|terms|conditions|expired|comment|related|share|about|subscribe|table of contents|navigation|faq|summary|key takeaway|how (do|to)|what (is|are)|registration|disclaimer|editorial|newsletter|sign up|log in|menu|search|^marriott bonvoy|^hilton honors|^ihg one rewards|promotions$|promotion$|other ways|earn(ing)? (points|more)|credit card|credit cards|transfer|buy points|status match/i;
const REGION_RX = /^(europe|north america|asia|asia[- ]pacific|middle east|africa|caribbean|latin america|south america|oceania|australia|mexico|united states|canada|japan|korea|china|hong kong|singapore|thailand|vietnam)/i;
function parsePromoPage(html, chain, srcUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const art = doc.querySelector('article .entry-content, article, main') || doc.body; const out = []; let cur = null, region = '';
  const push = () => { if (cur && cur.body.length > 30 && !SKIP_RX.test(cur.title)) out.push(cur); cur = null; };
  for (const n of art.querySelectorAll('h2, h3, h4, p, ul, ol')) {
    const tag = n.tagName.toLowerCase(); const text = n.textContent.replace(/\s+/g, ' ').trim(); if (!text) continue;
    if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
      push(); if (REGION_RX.test(text) || (tag === 'h2' && /property|hotel-specific|specific hotels|individual/i.test(text))) { region = text; continue; }
      if (tag === 'h2') region = '';
      const a = n.querySelector('a'); cur = { chain, title: text.replace(/^\d+[.)]\s*/, ''), body: '', link: a ? a.href : null, region, src: srcUrl, hotel: false };
    } else if (cur) {
      if (cur.body.length < 420) cur.body += (cur.body ? ' ' : '') + text;
      if (!cur.link) { const a = n.querySelector('a[href^="http"]'); if (a) cur.link = a.href; }
    }
  }
  push();
  for (const it of out) { it.body = it.body.slice(0, 300); it.hotel = !!it.region || (BRAND_RX.test(it.title) && !/global|all hotels|all brands|every/i.test(it.title)); it.end = (it.body.match(/(?:through|until|by|ends?|before)\s+([A-Z][a-z]+\.?\s+\d{1,2}(?:,?\s+\d{4})?)/) || [])[1] || null; }
  return out;
}
async function fetchExternalPromos() {
  let cache = null; try { cache = JSON.parse(localStorage.getItem('tr_promos_ext') || 'null'); } catch (e) {}
  if (cache && Date.now() - cache.at < 24 * 3600e3) return cache.items;
  const items = []; const errors = [];
  await Promise.all(Object.entries(PROMO_SRC).filter(([, v]) => v.url).map(async ([chain, v]) => {
    try { const r = await fetch(v.url, { credentials: 'omit' }); if (!r.ok) throw new Error('HTTP ' + r.status); const got = parsePromoPage(await r.text(), chain, v.url); if (got.length < 2) throw new Error('파싱 결과 ' + got.length + '건'); items.push(...got); }
    catch (e) { errors.push(`${CHAIN[chain]}: ${e.message}`); }
  }));
  if (items.length) { try { localStorage.setItem('tr_promos_ext', JSON.stringify({ at: Date.now(), items })); } catch (e) {} }
  return Object.assign(items, { errors });
}
const NO_EXT_IMG = false;   // 외부 이미지는 일단 시도하고, 차단되면 onerror 로 빈 칸 처리 (아티팩트 포함)
const IN_ARTIFACT = /claude\.ai$|preview/.test(location.hostname);
// 이미지 없는 오퍼용 고정 일러스트 (브랜드 선화): 제목 키워드로 고르고, 없으면 제목 해시로 고정 배정
const OFFER_ART = ['city', 'beach', 'mountain', 'pool', 'plane'];
const artSrc = (n) => (window.TR_OFFER_ART && window.TR_OFFER_ART[n]) || `brand/offers/${n}.svg`;
function offerArt(p, i) {
  const t = `${p.title || ''} ${p.desc || p.body || ''}`;
  if (/resort|beach|island|리조트|비치|해변|섬|bali|phuket|푸켓|samui|사무이|maldives/i.test(t)) return 'beach';
  if (/pool|spa|스파|수영|wellness|온천|villa|풀빌라/i.test(t)) return 'pool';
  if (/mountain|ski|hill|산|스키|설악|alpensia|알펜시아|trek/i.test(t)) return 'mountain';
  if (/flight|air|항공|마일|miles|airport|공항|mileage/i.test(t)) return 'plane';
  if (/city|urban|도심|seoul|서울|bangkok|방콕|tokyo|singapore|싱가포르|hong kong|홍콩|downtown/i.test(t)) return 'city';
  return OFFER_ART[(i || 0) % OFFER_ART.length];   // 키워드가 없으면 순서대로 돌려 같은 그림이 나란히 오지 않게
}
// 이미지 없는 오퍼: 같은 체인 호텔의 실제 사진(우리 수집 데이터)을 돌려 쓰고, 그것도 없으면 선화 일러스트
function chainPhoto(chain, i) {
  const pool = [...D.hotels.values()].filter(h => h.chain === chain && hImg(h)).sort((a, b) => (b.stars || 0) - (a.stars || 0) || a.key.localeCompare(b.key));
  return pool.length ? hImg(pool[(i || 0) % Math.min(pool.length, 12)]) : null;
}
function promoCard(p, i) {
  const fallback = chainPhoto(p.chain, i) || artSrc(offerArt(p, i)); const art = artSrc(offerArt(p, i));
  return `<div class="pcard">${p.image && !NO_EXT_IMG ? `<img src="${esc(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.src=this.dataset.art; this.onerror=null" data-art="${esc(fallback)}">` : `<img src="${esc(fallback)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.src=this.dataset.art; this.onerror=null" data-art="${art}">`}<div class="b"><div class="hsub"><span class="ctag ${p.chain}">${CHAIN[p.chain] || p.chain}</span>${p.hotel ? '<span class="ctag">호텔별</span>' : ''}${p.region ? `<span class="muted">${esc(p.region)}</span>` : ''}${p.end ? `<span class="muted">~${esc(p.end)}</span>` : ''}</div><div class="t">${esc(p.title)}</div><div class="muted small">${esc(p.desc || p.body || '')}</div><div class="row small">${p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener">자세히 ↗</a>` : ''}${p.src ? `<a class="muted" href="${esc(p.src)}" target="_blank" rel="noopener">출처: AwardWallet</a>` : `<span class="muted">${p.source === 'official-ko' ? '공식 한국 페이지' : '공식'}</span>`}</div></div></div>`;
}
function isHotelOffer(p) {
  if (p.hotel != null) return !!p.hotel;
  const l = p.link || '';
  if (p.chain === 'marriott') return /\/offers\/[^/]+\/[a-z]{5}-/i.test(l) || /\/hotels\//i.test(l);
  if (p.chain === 'hilton') return /\/hotels\/|ctyhocn=/i.test(l);
  if (p.chain === 'ihg') return /\/hotels\/[a-z]{2}\/[a-z]{2}\/[a-z]+\//i.test(l) && !/offers/i.test(l);
  return /호텔|hotel|resort|리조트/i.test(p.title || '') && !/모든|전체|all /i.test(p.title || '');
}
async function viewPromos() {
  const el = $('#v-promos');
  el.innerHTML = `<h1>진행 중 오퍼</h1><p class="lead">각 체인의 <b>한국어 공식 오퍼 페이지</b>에서 매일 가져옵니다. 체인별로 전체 프로모션과 호텔별 오퍼를 나눠 보여드려요.</p>
    <div class="row small" style="margin-bottom:8px"><span class="muted" id="promoStatus"></span>${window.TR_PROVIDER ? '<button class="btn small ghost" id="promoRefresh">공식 페이지 다시 읽기</button>' : ''}</div><div id="promoBody"></div>
    <details id="promoExt" style="margin-top:20px"><summary class="muted">해외 정리 페이지(영문, AwardWallet) 보기</summary><div class="muted small" id="promoExtStatus" style="margin:6px 0"></div><div id="promoExtBody"></div></details>`;
  const chains = ['accor', 'ihg', 'marriott', 'hilton'];
  const renderMain = () => {
    const last = D.promos.map(p => p.fetchedAt || 0).reduce((a, b) => Math.max(a, b), 0);
    $('#promoStatus').textContent = last ? `마지막 갱신 ${new Date(last).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '';
    $('#promoBody').innerHTML = chains.map(c => {
      const list = D.promos.filter(p => p.chain === c); const g = list.filter(p => !isHotelOffer(p)), h = list.filter(isHotelOffer); const off = PROMO_SRC[c]?.official;
      return `<h2 id="promo-${c}"><span class="ctag ${c}">${CHAIN[c]}</span> ${CHAIN[c]} <span class="muted small">${list.length}건</span> ${off ? `<a class="small" href="${off}" target="_blank" rel="noopener">공식 오퍼 페이지 ↗</a>` : ''}</h2>
        ${list.length ? '' : `<div class="empty">아직 불러온 오퍼가 없어요. ${window.TR_PROVIDER ? '"공식 페이지 다시 읽기"를 누르거나 다음 수집을 기다려 주세요.' : '공식 페이지에서 확인하세요.'}</div>`}
        ${g.length ? `<h3>전체 프로모션 <span class="muted small">${g.length}</span></h3><div class="pgrid">${g.map(promoCard).join('')}</div>` : ''}
        ${h.length ? `<h3>호텔별 오퍼 <span class="muted small">${h.length}</span></h3><div class="pgrid">${h.map(promoCard).join('')}</div>` : ''}`;
    }).join('');
  };
  renderMain();
  $('#promoRefresh')?.addEventListener('click', async () => {
    const b = $('#promoRefresh'); b.disabled = true; b.textContent = '읽는 중… (탭이 잠깐 열렸다 닫혀요)';
    try { const r = await chrome.runtime.sendMessage({ type: 'refreshOffers' }); const d = await window.TR_PROVIDER(); D.promos = d.promos; renderMain(); b.textContent = '완료: ' + Object.entries(r.result || {}).map(([k, v]) => `${CHAIN[k]} ${v}`).join(' · '); }
    catch (e) { b.textContent = '실패: ' + e.message; }
    setTimeout(() => { b.disabled = false; b.textContent = '공식 페이지 다시 읽기'; }, 6000);
  });
  $('#promoExt').addEventListener('toggle', async () => {
    if (!$('#promoExt').open || $('#promoExtBody').dataset.done) return; $('#promoExtStatus').textContent = '불러오는 중…';
    try { const ext = await fetchExternalPromos(); $('#promoExtBody').innerHTML = chains.map(c => { const l = ext.filter(p => p.chain === c); return l.length ? `<h3>${CHAIN[c]} <span class="muted small">${l.length}</span></h3><div class="pgrid">${l.map(promoCard).join('')}</div>` : ''; }).join(''); $('#promoExtStatus').textContent = ext.errors?.length ? '일부 출처를 못 읽었어요: ' + ext.errors.join(' · ') : `${ext.length}건 · 24시간 캐시`; $('#promoExtBody').dataset.done = '1'; }
    catch (e) { $('#promoExtStatus').textContent = '불러오지 못했어요: ' + e.message; }
  }, { once: false });
}

// ---------- 프로필 대화상자 ----------
$('#profileBtn').addEventListener('click', () => {
  const f = $('#profileForm'); f.accorTier.value = profile.accorTier; f.explorer.checked = profile.explorer; f.snu.value = profile.snu; f.stayPlus.value = profile.stayPlus; f.accorPts.value = profile.accorPts;
  f.ihgTier.value = profile.ihgTier; f.ambassador.checked = profile.ambassador; f.ihgPts.value = profile.ihgPts; f.marriottTier.value = profile.marriottTier || ''; f.marriottPts.value = profile.marriottPts || 0; f.accorNights.value = profile.accorNights || 0; f.snuExp.value = profile.snuExp || ''; f.stayPlusExp.value = profile.stayPlusExp || ''; f.ihgNights.value = profile.ihgNights || 0; f.ambExp.value = profile.ambExp || ''; f.marriottNights.value = profile.marriottNights || 0; f.hiltonTier.value = profile.hiltonTier || ''; f.hiltonPts.value = profile.hiltonPts || 0; f.hiltonNights.value = profile.hiltonNights || 0; $('#dlgProfile').showModal();
});
$('#dlgProfile').addEventListener('close', () => {
  const f = $('#profileForm'); const rv = $('#dlgProfile').returnValue;
  if (rv === 'clear') profile = Object.assign({}, PROFILE_DEFAULT);
  else if (rv === 'ok') profile = { accorTier: f.accorTier.value, explorer: f.explorer.checked, snu: +f.snu.value || 0, stayPlus: +f.stayPlus.value || 0, accorPts: +f.accorPts.value || 0, ihgTier: f.ihgTier.value, ambassador: f.ambassador.checked, ihgPts: +f.ihgPts.value || 0, marriottTier: f.marriottTier.value, marriottPts: +f.marriottPts.value || 0, accorNights: +f.accorNights.value || 0, snuExp: f.snuExp.value, stayPlusExp: f.stayPlusExp.value, ihgNights: +f.ihgNights.value || 0, ambExp: f.ambExp.value, marriottNights: +f.marriottNights.value || 0, hiltonTier: f.hiltonTier.value, hiltonPts: +f.hiltonPts.value || 0, hiltonNights: +f.hiltonNights.value || 0 };
  else return;
  try { localStorage.setItem('tr_profile', JSON.stringify(profile)); } catch (e) {}
  profilePush();
  if (!hasProfile()) $('#fMine').checked = false; route();
});
$('#profileForm').addEventListener('submit', (e) => { /* dialog method: 기본 동작으로 닫힘 */ });

// 낮/밤 테마: 기본은 기기 설정을 따르고, 버튼으로 고정
const themeBtn = $('#themeBtn');
function applyTheme() { document.documentElement.setAttribute('data-theme', 'dark'); if (themeBtn) themeBtn.hidden = true; }   // 밤 모드로 통일
themeBtn?.addEventListener('click', () => { const dark = document.documentElement.getAttribute('data-theme') ? document.documentElement.getAttribute('data-theme') === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; try { localStorage.setItem('tr_theme', dark ? 'light' : 'dark'); } catch (e) {} applyTheme(); });
applyTheme();
// PWA: 서비스 워커는 가능한 환경에서만 (아티팩트 미리보기 등에서는 조용히 건너뜀)
if ('serviceWorker' in navigator && location.protocol === 'https:' && !/claude\.ai|preview/.test(location.hostname)) {
  // 워커가 새 버전으로 바뀌면 한 번만 새로고침 → "폰이 옛 화면" 문제 해결
  // 처음 방문(워커가 아직 없던 페이지)에선 새로고침하지 않는다 — 예전엔 이 때문에 첫 화면이 한 번 깜빡이며 다시 떴다
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded || !hadController) return; reloaded = true; location.reload(); });
  navigator.serviceWorker.register('sw.js?v=' + (document.querySelector('script[src^="app.js"]')?.src.split('v=')[1] || '0')).then(r => r.update()).catch(() => {});
}
load().catch(e => { $('#loadingNote')?.remove(); $('#cards').innerHTML = ''; $('#empty').hidden = false; $('#empty').textContent = '데이터를 불러오지 못했어요: ' + e.message; });
// 창 폭이 720px 경계를 넘으면 앱 모드 ↔ 레저 모드 다시 그리기
{ let wasM = MOBILE(); window.addEventListener('resize', () => { const m = MOBILE(); if (m !== wasM) { wasM = m; if (!location.hash || /^#\/?radar/.test(location.hash)) viewRadar(); } }); }
})();
