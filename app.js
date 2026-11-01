// Travel Radar 웹앱 — 데이터는 data/*.json (수집기 내보내기에서 빌드). 라우팅은 해시(#radar, #hotel/accor|1555, #hotels, #guide/accor, #promos).
(() => {
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hImg = (h) => h.img || h.image || '';
// 사진 오류: 보관본이 깨지면 원본 주소로 한 번 더, 그것도 안 되면 자리를 비운다
window.trImgErr = function (el, orig, onFail) { if (orig && el.src !== orig && !el.dataset.retried) { el.dataset.retried = '1'; el.src = orig; return; } if (onFail === 'parent') { el.parentElement?.classList.add('noimg'); } el.remove(); };
const won = (n) => n == null ? '–' : '₩' + Math.round(n).toLocaleString('ko-KR');
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const BEN = { SUITE: { label: '스위트', icon: '' }, FREE_NIGHT: { label: '무료박', icon: '' }, POINTS: { label: '포인트', icon: '' }, SALE: { label: '세일', icon: '' } };
const CHAIN = { accor: 'Accor', ihg: 'IHG', marriott: 'Marriott', hilton: 'Hilton' };
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
  const res = await fetch(`${S.url.replace(/\/$/, '')}/rest/v1/rpc/tr_data`, { method: 'POST', headers, body: '{}' });
  if (!res.ok) throw new Error('server ' + res.status);
  const d = await res.json(); if (!d || !Array.isArray(d.rows)) return null;
  d.meta = d.meta || {}; d.meta.source = 'server'; return d;
}
// ---------- 데이터 로드 ----------
async function load() {
  // 데이터 출처: 확장 프로그램 안에서는 window.TR_PROVIDER(수집 DB 직접), 사이트에서는 data/*.json
  let rows, hotels, promos, guides, meta;
  if (window.TR_PROVIDER) { ({ rows, hotels, promos, guides, meta } = await window.TR_PROVIDER()); }
  else if (window.TR_SERVER?.url && await loadFromServer().then(d => { if (!d) return false; ({ rows, hotels, promos, meta } = d); return true; }).catch(() => false)) {
    guides = await fetch('data/guides.json').then(r => r.json()).catch(() => ({}));
  }
  else { [rows, hotels, promos, guides, meta] = await Promise.all(['radar', 'hotels', 'promos', 'guides', 'meta'].map(n => fetch(`data/${n}.json`).then(r => r.json()))); try { meta.areaGeo = meta.areaGeo || await fetch('data/areas.json').then(r => r.json()); } catch (e) {} }
  for (const h of hotels) if (h.image && !/^https?:/i.test(h.image)) h.image = (h.chain === 'hilton' ? 'https://www.hilton.com' : h.chain === 'ihg' ? 'https://digital.ihg.com' : h.chain === 'marriott' ? 'https://cache.marriott.com' : 'https://www.ahstatic.com') + (h.image.startsWith('/') ? '' : '/') + h.image;   // 상대 경로 사진 → 절대 주소
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
  if (window.TR_PROVIDER) { const b = $('#collectorBtn'); if (b) { b.hidden = false; b.href = '../app.html'; } }
  $('#meta').textContent = meta.collectedAt ? `마지막 수집 ${new Date(meta.collectedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '';
  fillWhere(); $('#filtersBox').open = false; route();
}

// ---------- 라우터 ----------
const views = { radar: viewRadar, me: viewMe, best: viewBest, map: viewMap, hotel: viewHotel, hotels: viewHotels, guide: viewGuide, promos: viewPromos };
function route() {
  const hash = location.hash.replace(/^#\/?/, '') || 'radar'; const [name, ...rest] = hash.split('/'); const arg = decodeURIComponent(rest.join('/'));
  document.querySelectorAll('.nav a, .tabbar a').forEach(a => a.classList.toggle('on', a.dataset.v === name || (name === 'hotel' && a.dataset.v === 'hotels')));
  document.querySelectorAll('main > section').forEach(s => s.hidden = s.id !== 'v-' + (views[name] ? name : 'radar'));
  (views[name] || viewRadar)(arg); window.scrollTo({ top: 0 });
  // 섹션 제목 위 금색 아이브로우 (브랜드)
  const EYE = { me: 'Members only · Today', best: 'Best of the month', map: 'On the map', hotels: 'Hotels', hotel: 'Hotel', guide: 'Membership guide', promos: 'Offers' };
  const sec = document.getElementById('v-' + (views[name] ? name : 'radar')); const h1 = sec?.querySelector('h1');
  if (h1 && EYE[name] && !h1.previousElementSibling?.classList?.contains('eyebrow')) h1.insertAdjacentHTML('beforebegin', `<div class="eyebrow">${EYE[name]}</div>`);
}
window.addEventListener('hashchange', route);

// ---------- 홈 = 내 티어로 검색 (시안 E) ----------
const ui = { benefits: new Set(['SUITE', 'FREE_NIGHT', 'POINTS', 'SALE']), chains: new Set(['accor', 'ihg', 'marriott', 'hilton']), limit: 300, view: 'cards', cardLimit: 24 };
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
  const out = { text: [], chains: new Set(), bens: new Set(), month: null, nights: null, weekend: false, lounge: false, breakfast: false, five4: false, voucher: false, onePlusOne: false, city: null };
  const cities = new Set(); for (const h of D.hotels.values()) if (h.city) cities.add(h.city);
  for (let t of q.toLowerCase().split(/\s+/).filter(Boolean)) {
    let m;
    if ((m = /^(\d{1,2})월$/.exec(t))) { out.month = +m[1]; continue; }
    if ((m = /^(\d)박$/.exec(t))) { if (m[1] === '5') out.five4 = true; else out.nights = +m[1]; continue; }
    if (/^(이번\s*)?주말$|^금토$/.test(t) || t === '이번') { if (t !== '이번') out.weekend = true; continue; }
    if (t === '1+1' || t === '1+1박' || t === '원플러스원') { out.onePlusOne = true; continue; }
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
    <td class="date">${r.d.slice(5).replace('-', '.')} <span class="dow ${we ? 'we' : ''}">${DOW[dow(r.d)]}</span><div class="muted small">${r.n || 1}박</div></td>
    <td class="hotel">${showHotel ? `<a class="hname" href="#hotel/${encodeURIComponent(r.h)}">${esc(r.hn)}</a>` : ''}<div class="hsub"><span class="ctag ${r.chain}">${CHAIN[r.chain]}</span>${esc(h.brand || '')} · ${esc(h.country || '')} ${esc(h.city || '')}</div></td>
    <td class="benefit"><span class="badge ${r.b}">${badgeLabel(r)}</span>${r.also ? '<span class="tag">Red Hot</span>' : ''}<span class="blabel">${esc(rawLabel(r))}</span>${elig}</td>
    <td class="cost">${cost}</td>
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
  const bestTxt = o.best ? `<i class="how">${how(o.best)}</i>${pay(o.best, bestKind)}` : '—';
  const bestSub = o.best ? [perNight(o.best), pct(o.best) ? `정가 대비 ${pct(o.best)}% 절약` : ''].filter(Boolean).join(' · ') : '';
  const others = [['cash', '현금', o.cash], ['points', '포인트', o.points], ['voucher', '바우처', o.voucher]].filter(([k]) => k !== bestKind).map(([k, l, r]) => `${l} ${r ? pay(r, k) : '—'}`).join(' · ');
  const forYou = tier
    ? (o.benefits || []).map(b => `<span class="bf ${b.s}">${esc(b.label)} ${b.s === 'ok' ? '✓' : b.s === 'maybe' ? '△' : '✗'}${b.note ? ` <em>${esc(b.note)}</em>` : ''}</span>`).join('')
    : `<span class="bf lock">${hasProfile() ? '이 체인 티어 없음' : '<a href="#" data-open-profile>티어를 넣으면</a> 당신이 받는 것이 보여요'}</span>`;
  const dr = o.best ? `${o.best.d.slice(5).replace('-', '.')} ${DOW[dow(o.best.d)]}` : ''; const dout = o.best ? addDays(o.best.d, o.best.n || 1) : '';
  return `<article class="lrow ${bestKind}">
    <span class="num">${String(i + 1).padStart(2, '0')}</span>
    <span class="ld"><b>${dr}</b><span class="muted">– ${o.best ? dout.slice(5).replace('-', '.') + ' ' + DOW[dow(dout)] : ''} · ${o.best?.n || 1}박${o.fresh ? ' · <i class="new">new</i>' : ''}</span></span>
    <a class="li ${hImg(h) && !NO_EXT_IMG ? '' : 'noimg'}" href="#hotel/${encodeURIComponent(h.key)}">${hImg(h) && !NO_EXT_IMG ? `<img src="${esc(hImg(h))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="trImgErr(this, '${esc(h.img ? h.image || '' : '')}', 'parent')">` : ''}</a>
    <span class="lh"><a class="hname" href="#hotel/${encodeURIComponent(h.key)}">${esc(h.name)}</a><span class="muted">${starsHtml(h)}${esc(h.brand || '')} · ${CHAIN[h.chain]} · ${esc(h.city || '')} · ${o.dates.size}일 가능</span></span>
    <span class="lf">${forYou}</span>
    <span class="lb"><b class="gold">${bestTxt}</b><span class="sub">${bestSub}</span><span class="muted">${others}</span></span>
    <span class="lv">${tier ? `<b>+${won(o.tierValue)}</b><span class="muted">티어 가치</span>` : (o.best?.sv ? `<b>${won(o.best.sv)}</b><span class="muted">최대 절약</span>` : '')}</span>
    <span class="la"><a href="#hotel/${encodeURIComponent(h.key)}">달력</a>${o.best ? `<a href="${esc(link(o.best))}" target="_blank" rel="noopener">예약 ↗</a>` : ''}</span>
  </article>`;
}
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
  const per = r && r.my != null ? won(r.my / (r.n || 1)) : (r && r.pt ? `${r.pt.toLocaleString()}pt` : '');
  const bens = tier ? (o.benefits || []).filter(b => !/웰컴/.test(b.label)).slice(0, 4).map(b => `<i class="${b.s}">${esc(b.label.replace(/\s*\(.*\)$/, ''))}</i>`).join('') : '';
  const img = hImg(h) && !NO_EXT_IMG ? `<img src="${esc(hImg(h))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="trImgErr(this, '${esc(h.img ? h.image || '' : '')}')">` : '';
  const date = r ? `${r.d.slice(5).replace('-', '.')} ${DOW[dow(r.d)]}` : '';
  return `<a class="mpc ${small ? 'sm' : ''} ${hImg(h) ? '' : 'noimg'}" href="#hotel/${encodeURIComponent(h.key)}">${img}<span class="ov"></span>
    <span class="tl"><b class="pill">${r ? `Best · ${kind}` : '열림'}</b>${pct ? `<b class="pill w">−${pct}%</b>` : ''}${o.fresh ? '<b class="pill w">New</b>' : ''}</span>
    ${tier && o.bv ? `<span class="tr pill w">혜택 ${won(o.bv)}</span>` : ''}
    <span class="tx"><small>${starsHtml(h, 'w')}${esc(h.brand || '')} · ${CHAIN[h.chain]} · ${esc(h.city || '')}</small><b>${esc(h.name)}</b>${small ? '' : `<span class="bens">${bens}</span>`}<span class="pr"><span>${date}${r && (r.n || 1) > 1 ? ` · ${r.n}박` : ''}${r && r.ref && r.my != null ? ` · 정가 ${won(r.ref / (r.n || 1))}` : ''}</span><em>${per}<small>${r && r.my != null ? '/박' : ''}</small></em></span></span></a>`;
}
function mobileHome(rows, groups) {
  const P = profile; const hero = groups.find(o => hImg(o.h)) || groups[0];
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
    <div class="mchips">${['1+1', '포인트', '바우처', '5박 무료', '라운지', '조식', '스위트'].map(c => `<button type="button" class="${q.includes(c) ? 'on' : ''}" data-mq="${c}">${c}</button>`).join('')}</div>
    <div class="mlab">오늘 당신에게 열린 곳</div>
    <div class="mrow">${groups.slice(0, 8).map((o, i) => mPhotoCard(o, i)).join('')}</div>
    ${soonHtml}
    <div class="mlab">전체 ${groups.length.toLocaleString()}곳 · 가장 이득 순</div>
    <div class="mlist">${groups.slice(0, ui.cardLimit).map((o, i) => mPhotoCard(o, i, { small: true })).join('')}</div>`;
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
  const refMax = (o) => Math.max(0, ...o.rows.map(r => (r.ref || r.my || 0) / (r.n || 1)));   // 정가(1박) 기준 — 호텔의 급
  const gby = { pricey: (a, b) => refMax(b) - refMax(a) || b.tierValue - a.tierValue, tier: (a, b) => b.tierValue - a.tierValue || a.minCost - b.minCost, cost: (a, b) => a.minCost - b.minCost, saving: (a, b) => (b.best?.sv || 0) - (a.best?.sv || 0), date: (a, b) => a.best.d.localeCompare(b.best.d), new: (a, b) => b.newest - a.newest, hotel: (a, b) => a.h.name.localeCompare(b.h.name, 'ko') };
  groups.sort(gby[sort] || gby.tier);
  $('#tierBar').innerHTML = tierBarHtml();
  $('#resTitle').innerHTML = resTitle(rows, groups); $('#heroEyebrow').textContent = heroEyebrow(rows); $('#resSub').textContent = heroSub(rows, groups);
  const isCards = ui.view === 'cards'; const mob = MOBILE() && isCards; document.body.classList.toggle('app-m', mob);
  const mApp = $('#mApp'); if (mApp) { mApp.hidden = !mob; if (mob) { mApp.innerHTML = mobileHome(rows, groups); const inp = mApp.querySelector('#mSearch input'); mApp.querySelector('#mSearch').addEventListener('submit', (e) => { e.preventDefault(); $('#fText').value = inp.value; viewRadar(); inp.blur(); }); mApp.querySelector('.mflt').addEventListener('click', () => { document.body.classList.remove('app-m'); mApp.hidden = true; $('#filtersBox').open = true; $('#filtersBox').scrollIntoView({ behavior: 'smooth' }); }); mApp.querySelectorAll('[data-mq]').forEach(b => b.addEventListener('click', () => { const t = $('#fText'); const c = b.dataset.mq; t.value = t.value.includes(c) ? t.value.replace(c, '').replace(/\s+/g, ' ').trim() : (t.value + ' ' + c).trim(); viewRadar(); })); } }
  $('#cards').hidden = !isCards || mob; $('#tableWrap').hidden = isCards;
  document.querySelectorAll('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.view === ui.view));
  if (isCards) { $('#cards').innerHTML = `<div class="lhead"><span>No.</span><span>Date</span><span></span><span>Hotel</span><span>For you</span><span>Best way</span><span>Tier value</span><span></span></div>` + groups.slice(0, ui.cardLimit).map((o, i) => cardHtml(o, i)).join(''); $('#more').hidden = groups.length <= ui.cardLimit; $('#more button').textContent = `호텔 ${(groups.length - ui.cardLimit).toLocaleString()}곳 더 보기`; }
  else { $('#tbody').innerHTML = rows.slice(0, ui.limit).map(r => rowHtml(r)).join(''); $('#more').hidden = rows.length <= ui.limit; $('#more button').textContent = `${(rows.length - ui.limit).toLocaleString()}건 더 보기`; }
  $('#empty').hidden = rows.length > 0 || mob;
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
['#fFrom', '#fTo', '#fWhere', '#fText', '#fWeekend', '#fMine', '#fSort'].forEach(s => $(s).addEventListener('input', () => { ui.limit = 300; ui.cardLimit = 24; if (location.hash && !/^#\/?radar/.test(location.hash) && location.hash !== '') { if (s === '#fText') location.hash = '#radar'; } viewRadar(); }));
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
  pct = pct || percentiles(rows);
  const by = {};
  for (const r of rows) { const o = by[r.h] || (by[r.h] = { h: r.h, rows: [], kinds: new Set(), dates: new Set() }); o.rows.push(r); o.kinds.add(r.b); o.dates.add(r.d); }
  const out = [];
  for (const o of Object.values(by)) {
    const scored = o.rows.map(r => ({ r, p: pct(r), ratio: r.sv && r.ref ? r.sv / r.ref : 0 })).sort((a, b) => (b.p - a.p) || ((b.r.sv || 0) - (a.r.sv || 0)));
    const top = scored[0]; if (!top || !top.p) continue;
    const score = top.p * 100 + Math.log10(1 + (top.r.sv || 0)) * 3 + o.kinds.size * 5 + Math.min(o.dates.size, 30) * 0.4;
    out.push({ h: o.h, chain: o.h.split('|')[0], score, best: top.r, ratio: top.ratio, pctl: top.p, kinds: [...o.kinds], days: o.dates.size });
  }
  return out.sort((a, b) => b.score - a.score);
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
  const val = r.b === 'POINTS' && r.pt && r.ref ? `1pt당 ₩${(r.ref / r.pt).toFixed(1)} 가치 (정가 ${won(r.ref)} → ${r.pt.toLocaleString()}pt)` : r.sv ? `${badgeLabel(r)}로 ${won(r.sv)} 절약${b.ratio ? ` (정가 대비 ${Math.round(b.ratio * 100)}%)` : ''}` : badgeLabel(r);
  const why = [val, `${b.days}일 가능`, b.kinds.length > 1 ? `혜택 ${b.kinds.length}종` : ''].filter(Boolean).join(' · ');
  const img = hImg(h) && !NO_EXT_IMG ? `<img src="${esc(hImg(h))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="trImgErr(this, '${esc(h.img ? h.image || '' : '')}', 'parent')">` : '';
  return `<a class="bcard ${h.chain} ${img ? '' : 'noimg'}" href="#hotel/${encodeURIComponent(b.h)}"><div class="bimg">${img}<span class="brank">${i + 1}</span></div><div class="bbody"><div class="hname">${esc(h.name)}</div><div class="hsub"><span class="ctag ${h.chain}">${CHAIN[h.chain]}</span>${esc(h.brand || '')} · ${esc(h.city || '')}</div><div class="bwhy"><span class="badge ${r.b}">${badgeLabel(r)}</span> <span class="small">${esc(why)}</span></div><div class="bkinds">${b.kinds.map(k => `<i class="dot ${k}" title="${BEN[k].label}"></i>`).join('')}<span class="muted small">가장 좋은 날 ${r.d.slice(5).replace('-', '.')} · 내 비용 ${r.pt ? r.pt.toLocaleString() + 'pt' : won(r.my)}</span></div></div></a>`;
}
function viewBest() {
  const el = $('#v-best'); const mine = hasProfile() ? D.rows.filter(eligible) : D.rows;
  const pct = percentiles(mine);
  const byC = {}; for (const r of mine) { if (!r.cc) continue; (byC[r.cc] = byC[r.cc] || []).push(r); }
  const ORDER = ['KR', 'TH', 'VN', 'SG', 'HK']; const label = (cc) => (D.meta.countries || []).find(c => c.cc === cc)?.label || cc;
  const all = bestOf(mine, pct); const overall = mixChains(all, 5);
  const KINDS = [['SUITE', '스위트 업그레이드', '스위트 vs 일반 객실 차액이 큰 곳'], ['FREE_NIGHT', '무료박', 'IHG 앰배서더 주말·아코르 Stay Plus·메리어트/힐튼 5박 무료'], ['POINTS', '포인트 가치', '포인트 1pt가 가장 비싸게 쓰이는 곳'], ['SALE', '세일', '회원 전용 특가']];
  const sections = KINDS.map(([b, title, sub]) => { const list = mixChains(bestOf(mine.filter(r => r.b === b), pct), 3, 2); return list.length ? `<h2>${title} <span class="muted small">${sub}</span></h2><div class="bgrid">${list.map(bestCard).join('')}</div>` : ''; }).join('');
  el.innerHTML = `<h1>이번 달 베스트</h1><p class="lead">수집된 혜택을 바탕으로 매일 자동 계산해요. 혜택 종류마다 값의 성격이 달라서(스위트 차액·포인트 가치·무료박) <b>같은 종류 안에서 상위 몇 %인지</b>로 비교하고, TOP 5는 체인당 최대 2곳으로 섞습니다.${hasProfile() ? ' <b>내 프로필로 쓸 수 있는 혜택만</b> 반영했어요.' : ' <a href="#" id="bestProfile">내 프로필</a>을 넣으면 나에게 가능한 것만으로 계산해요.'}</p>
    <h2>전체 TOP 5</h2><div class="bgrid">${overall.map(bestCard).join('')}</div>
    ${sections}
    ${ORDER.filter(cc => byC[cc]).map(cc => `<h2>${esc(label(cc))} TOP 5</h2><div class="bgrid">${mixChains(bestOf(byC[cc], pct), 5).map(bestCard).join('')}</div>`).join('')}`;
  $('#bestProfile')?.addEventListener('click', (e) => { e.preventDefault(); $('#profileBtn').click(); });
}


// ---------- 지도 (Leaflet + OpenStreetMap, 키 불필요) ----------
const chainColor = (c) => getComputedStyle(document.documentElement).getPropertyValue(`--c-${c}`).trim() || '#555';
// 타일: OSM 본 서버는 확장에서 오는 요청에 403을 "그림"으로 돌려주고(에러 이벤트 없음), CARTO는 API 키 필수 → 키·referrer 제약 없는 Esri.
// Esri 거리지도는 한국 등에서 줌 13~14까지만 상세 타일이 있어 그 위로는 "Map data not yet available" → 줌 15부터 위성사진 + 지명 레이어로 전환.
// 지도 타일: CARTO 다크(무료·키 없음·밤 모드에 맞음) → 안 되면 OpenStreetMap 표준으로 자동 대체. 15줌 이상은 Esri 위성(선택적).
const osmTiles = () => {
  const carto = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', minZoom: 1, maxZoom: 19, maxNativeZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' });
  let fails = 0; carto.on('tileerror', () => { if (++fails === 6 && carto._map) { const m = carto._map; m.removeLayer(carto); L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m); } });
  return L.layerGroup([carto]);
};
const markerStyle = (chain, r) => ({ radius: r, color: '#fff', weight: 1.5, fillColor: chainColor(chain), fillOpacity: .85 });
const MAP = { map: null, layer: null, bounds: {} };
// ※ 아래 지도 로직은 레이더/베스트와 같은 데이터(D.rows)를 쓴다.
// 좌표 없는 호텔은 지역 중심에 살짝 흩어서(대략 위치) 놓는다
function hotelPos(h) {
  if (h.lat != null && h.lng != null && Math.abs(h.lat) <= 90) return { lat: h.lat, lng: h.lng, approx: false };
  const CC = { KR: [36.5, 127.8, 60], TH: [13.75, 100.5, 60], VN: [16.0, 108.0, 60], SG: [1.35, 103.82, 10], HK: [22.32, 114.17, 10] };
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
    const ORDER = ['KR', 'TH', 'VN', 'SG', 'HK']; const label = (cc) => (D.meta.countries || []).find(c => c.cc === cc)?.label || cc;
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
  $('#mapNote').textContent = (IN_ARTIFACT ? '테스트 페이지에서는 지도 배경(타일)이 차단될 수 있어요 — 점과 팝업은 동작합니다. ' : '') + `${shown}개 호텔${approxN ? ` · 그중 ${approxN}곳은 좌표가 없어 지역 중심 근처에 표시(점선)` : ''}${noPos ? ` · ${noPos}곳은 지역 정보가 없어 생략` : ''} · 지도: Esri`;
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
    cells.push(`<div class="cell ${inR ? '' : 'off'} ${[0, 6].includes(dow(d)) ? 'we' : ''}" data-d="${d}"><span class="dn">${+d.slice(8)}${+d.slice(8) === 1 ? '일 ' + +d.slice(5, 7) + '월' : ''}</span>${kinds.length ? `<div class="dots">${kinds.map(k => `<i class="${k}" title="${BEN[k].label}"></i>`).join('')}</div><div class="mn">${isFinite(min) ? won(min) : ''}</div>${(() => { const p = rs.filter(r => r.pt).sort((a, b) => a.pt - b.pt)[0]; return p ? `<div class="mp">${p.pt.toLocaleString()}pt${(p.n || 1) > 1 ? `/${p.n}박` : ''}</div>` : ''; })()}` : ''}</div>`);
    if (d >= to && dow(d) === 6) break;
  }
  const gid = h.chain || 'accor'; const tb = tierBenefits(h); const tier = myTier(h.chain);
  el.innerHTML = `<p><a href="#hotels">← 호텔 목록</a></p>
    <div class="hhead">${hImg(h) && !NO_EXT_IMG ? `<img class="hphoto" src="${esc(hImg(h))}" alt="" referrerpolicy="no-referrer" onerror="trImgErr(this, '${esc(h.img ? h.image || '' : '')}')">` : ''}<div class="t"><h1>${esc(h.name)}</h1><div class="hsub"><span class="ctag ${h.chain}">${CHAIN[h.chain]}</span>${esc(h.brand || '')} ${starsHtml(h)} · ${esc(h.country || '')} ${esc(h.city || '')}${h.city0 && h.city0 !== h.city ? ` <span class="muted">(${esc(h.city0)})</span>` : ''} · <a href="#guide/${gid}">${CHAIN[h.chain]} 멤버십 가이드</a></div></div>
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
  const ORDER = ['KR', 'TH', 'VN', 'SG', 'HK'];
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
  if (!hasProfile()) $('#fMine').checked = false; route();
});
$('#profileForm').addEventListener('submit', (e) => { /* dialog method: 기본 동작으로 닫힘 */ });

// 낮/밤 테마: 기본은 기기 설정을 따르고, 버튼으로 고정
const themeBtn = $('#themeBtn');
function applyTheme() { document.documentElement.setAttribute('data-theme', 'dark'); if (themeBtn) themeBtn.hidden = true; }   // 밤 모드로 통일
themeBtn?.addEventListener('click', () => { const dark = document.documentElement.getAttribute('data-theme') ? document.documentElement.getAttribute('data-theme') === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; try { localStorage.setItem('tr_theme', dark ? 'light' : 'dark'); } catch (e) {} applyTheme(); });
applyTheme();
// PWA: 서비스 워커는 가능한 환경에서만 (아티팩트 미리보기 등에서는 조용히 건너뜀)
if ('serviceWorker' in navigator && location.protocol === 'https:' && !/claude\.ai|preview/.test(location.hostname)) { navigator.serviceWorker.register('sw.js').catch(() => {}); }
load().catch(e => { $('#cards').innerHTML = ''; $('#empty').hidden = false; $('#empty').textContent = '데이터를 불러오지 못했어요: ' + e.message; });
// 창 폭이 720px 경계를 넘으면 앱 모드 ↔ 레저 모드 다시 그리기
{ let wasM = MOBILE(); window.addEventListener('resize', () => { const m = MOBILE(); if (m !== wasM) { wasM = m; if (!location.hash || /^#\/?radar/.test(location.hash)) viewRadar(); } }); }
})();
