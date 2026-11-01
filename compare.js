// compare.js — 멤버십 비교 데이터 + 내 스타일 진단 (2026-10 기준, 한국 거주 여행자 관점). app.js가 window.TR_COMPARE로 읽는다.
window.TR_COMPARE = (() => {
const CHAINS = ['accor', 'ihg', 'marriott', 'hilton'];
const NAME = { accor: 'Accor ALL', ihg: 'IHG One Rewards', marriott: 'Marriott Bonvoy', hilton: 'Hilton Honors' };
// 각 체인의 "한국 거주자가 현실적으로 노릴 티어"
const TARGET_TIER = { accor: 'Platinum', ihg: 'Platinum (Ambassador)', marriott: 'Platinum', hilton: 'Gold / Diamond' };
const PATH = {
  accor: 'ALL Accor+ Explorer(연 $255 ≈ ₩36만, 30박 보너스) + 실제 30박 → Platinum. 또는 ALL 우리카드 Infinite로 Gold 즉시, 6천만원 사용 시 Platinum.',
  ihg: 'IC Ambassador(연 $225 ≈ ₩32만 또는 45,000P) → 즉시 Platinum + 주말 무료박권. 조식·라운지는 Diamond(70박)부터.',
  marriott: '신한 더 베스트 카드로 Gold 즉시, 실제 50박을 채워야 Platinum. 카드로 Platinum 가는 길은 한국엔 없음.',
  hilton: '롯데 힐튼 아멕스 프리미엄으로 Gold 즉시(조식 2인). 연 2,400만원 사용 시 Diamond + 주말권 2매. 상태 매치로 Diamond 선취 가능.',
};
// 비교 항목: 점수 0~3 + 한 줄. 점수는 "한국 거주자에게 체감되는 가치" 기준.
const CRITERIA = [
  { id: 'breakfast', label: '조식', tip: '어느 티어부터, 어디서 무료 조식이 나오나',
    v: { accor: [3, 'Platinum: 아시아태평양 매일 2인'], ihg: [1, 'Diamond(70박)만 2인'], marriott: [2, 'Platinum: 라운지 또는 2인 (Ritz·EDITION 제외)'], hilton: [3, 'Gold부터 2인 (미국 외)'] } },
  { id: 'lounge', label: '라운지', tip: '클럽 라운지 이용',
    v: { accor: [3, 'Platinum (Fairmont Gold 제외)'], ihg: [1, '티어 혜택 아님 · Milestone 40박 또는 Club IC 요금'], marriott: [3, 'Platinum'], hilton: [2, 'Diamond'] } },
  { id: 'suite', label: '스위트 업그레이드', tip: '확정 수단이 있는가',
    v: { accor: [3, 'SNU 바우처 2~12장, 예약 시 확정'], ihg: [2, 'Milestone 확정 스위트(20·40·70박, 전화 확정)'], marriott: [2, 'NUA 5~10장, 5일 전부터 확정 시도'], hilton: [1, '"가능 시" · CUR은 Reserve/120박만'] } },
  { id: 'checkout', label: '레이트 체크아웃', tip: '보장인가 "가능 시"인가',
    v: { accor: [1, '14시 가능 시'], ihg: [2, '14시 가능 시 · Ambassador 16시 보장'], marriott: [3, 'Platinum 16시 보장 (리조트 제외)'], hilton: [1, '가능 시 · Reserve만 16시 보장'] } },
  { id: 'freenight', label: '무료박', tip: '한국 거주자가 받을 수 있는 숙박권',
    v: { accor: [3, 'Explorer Stay Plus 2장: 2박 중 1박 무료 (APAC)'], ihg: [2, 'Ambassador 주말 2박 중 1박 무료 (IC만)'], marriott: [1, '카드 FNA는 미국 카드만 · 75박 Choice Benefit'], hilton: [2, '롯데 카드 주말권 1~2매'] } },
  { id: 'points', label: '포인트 가치·사용', tip: '1포인트 가치와 쓰기 쉬운 정도',
    v: { accor: [3, '고정 ₩30/p, 어느 호텔이든 현금처럼'], ihg: [2, '0.5~0.6¢ (≈₩7~8/p) · 세일 때 0.5¢(≈₩7)에 사서 바로 쓰기'], marriott: [2, '0.7~0.8¢ (≈₩10~11/p) · 다이내믹, 5박 4박값'], hilton: [2, '0.4~0.5¢ (≈₩6~7/p) · 5th Night Free로 보충'] } },
  { id: 'expiry', label: '포인트 만료', tip: '관리 부담',
    v: { accor: [1, '12개월 무 적립 시 전액 소멸'], ihg: [3, 'Silver 이상 무기한'], marriott: [2, '24개월 무활동'], hilton: [2, '24개월 무활동'] } },
  { id: 'card', label: '한국 발급 카드', tip: '카드로 얻는 티어',
    v: { accor: [2, 'ALL 우리카드 Infinite: Gold + Accor Plus 포함'], ihg: [0, '없음'], marriott: [2, '신한 더 베스트: Gold'], hilton: [3, '롯데 힐튼 아멕스: Gold, 실적 시 Diamond'] } },
  { id: 'miles', label: '항공 마일 전환', tip: '포인트 → 항공사 마일',
    v: { accor: [3, '대한항공·KrisFlyer·아시아마일 등 2:1 (아시아나 미제휴)'], ihg: [1, '5:1 · 가치 최악'], marriott: [2, '3:1 + 6만P당 5천 보너스 · 대한항공 불가, KrisFlyer·아시아마일 가능'], hilton: [0, '10:1 수준 · 사실상 비추'] } },
  { id: 'reach', label: '상위 티어 난이도', tip: '카드·유료 멤버십으로 지름길이 있는가',
    v: { accor: [2, 'Explorer 30박 보너스 + 실제 30박'], ihg: [3, 'Ambassador $225(≈₩32만)면 즉시 Platinum'], marriott: [1, '실제 50박 필요'], hilton: [3, '카드로 Gold 즉시, 상태 매치로 Diamond'] } },
  { id: 'sea', label: '동남아 호텔', tip: '태국·베트남·싱가포르·홍콩 선택지',
    v: { accor: [3, '매우 많음 (Sofitel·Pullman·Novotel 등 229곳)'], ihg: [2, 'IC·Kimpton·Six Senses 중심'], marriott: [3, '매우 많음, 라운지 충실'], hilton: [2, 'Conrad·Hilton 주요 도시'] } },
  { id: 'japan', label: '일본 호텔', tip: '일본 여행 선택지',
    v: { accor: [1, '적음 (도쿄·오사카·교토·후쿠오카 정도)'], ihg: [3, '많음 (IC·ANA 계열·Kimpton·Indigo)'], marriott: [3, '많음'], hilton: [2, '보통'] } },
];
const TIERS = {
  accor: [['Silver', '2,000 SP 또는 10박', '+24%', '웰컴드링크, 레이트체크아웃(가능 시)'], ['Gold', '7,000 SP 또는 30박', '+48%', '1단계 업그레이드, 3일 전 객실 보장'], ['Platinum', '14,000 SP 또는 60박', '+76%', '라운지, APAC 매일 조식, SNU, 48h 보장'], ['Diamond', '26,000 SP (박수 불가)', '+100%', 'Fairmont Gold, 전 세계 주말 조식, Gold 선물']],
  ihg: [['Silver', '10박', '+20%', '포인트 무기한'], ['Gold', '20박 / 40k EQP', '+40%', 'Milestone 시작'], ['Platinum', '40박 / 60k EQP', '+60%', '업그레이드(가능 시), 72h 보장'], ['Diamond', '70박 / 120k EQP', '+100%', '조식 2인(웰컴어메니티), 전용 상담']],
  marriott: [['Silver', '10박', '+10%', '늦은 체크아웃(가능 시)'], ['Gold', '25박', '+25%', '업그레이드(가능 시), 14시'], ['Platinum', '50박', '+50%', '라운지/조식, 16시 보장, Choice Benefit'], ['Titanium', '75박', '+75%', '+48h 보장, Choice 2개']],
  hilton: [['Silver', '10박 / 4회 / $2,500(≈₩350만)', '+20%', '5th Night Free'], ['Gold', '25박 / 15회 / $6,000(≈₩840만)', '+80%', '조식 2인(미국 외), 이그제큐티브층'], ['Diamond', '50박 / 25회 / $11,500(≈₩1,600만)', '+100%', '라운지, 스위트까지 업그레이드, 48h 보장'], ['Diamond Reserve', '80박 또는 40회+$18k(≈₩2,500만)', '+120%', 'CUR, 16시 보장, Premium Club']],
};
// ---------- 내 스타일 진단 ----------
const QUIZ = [
  { id: 'regions', q: '주로 어디로 여행하세요? (여러 개 가능)', multi: true, opts: [['sea', '동남아 (태국·베트남·싱가포르·홍콩)'], ['japan', '일본'], ['korea', '국내 호캉스'], ['west', '유럽·미주']] },
  { id: 'nights', q: '1년에 호텔에서 몇 박쯤 하세요?', opts: [['lt10', '10박 미만'], ['n10', '10~29박'], ['n30', '30~59박'], ['n60', '60박 이상']] },
  { id: 'wants', q: '가장 중요한 혜택은? (최대 2개)', multi: true, max: 2, opts: [['breakfast', '무료 조식'], ['lounge', '클럽 라운지'], ['suite', '스위트 업그레이드'], ['checkout', '늦은 체크아웃'], ['freenight', '무료박 (2박·5박 중 1박)'], ['points', '포인트 가치']] },
  { id: 'scene', q: '자연파세요, 도시파세요?', opts: [['nature', '자연파 — 바다·산·리조트'], ['urban', '도시파 — 시내 한복판'], ['both', '반반']] },
  { id: 'pace', q: '휴양파세요, 여행파세요?', opts: [['relax', '휴양파 — 한 호텔에 오래, 호텔에서 쉬기'], ['explore', '여행파 — 여러 도시, 짧게 자주 옮기기'], ['both', '반반']] },
  { id: 'style', q: '어떤 호텔을 선호하세요?', opts: [['lux', '럭셔리 리조트·호텔'], ['city', '도심 프리미엄 호텔'], ['value', '실속 있는 체인 호텔']] },
  { id: 'card', q: '연회비 있는 호텔 제휴카드를 만들 의향이 있나요?', opts: [['yes', '예'], ['no', '아니오']] },
  { id: 'paid', q: '유료 멤버십(연 $225~255 ≈ ₩32~36만)에 가입할 의향이 있나요?', opts: [['yes', '예'], ['no', '아니오']] },
  { id: 'miles', q: '호텔 포인트를 항공사 마일로 바꾸는 게 중요한가요?', opts: [['yes', '예'], ['no', '아니오']] },
];
function recommend(ans) {
  const score = Object.fromEntries(CHAINS.map(c => [c, 0])); const why = Object.fromEntries(CHAINS.map(c => [c, []]));
  const crit = (id) => CRITERIA.find(c => c.id === id);
  const add = (chain, pts, reason) => { score[chain] += pts; if (reason && pts > 0) why[chain].push(reason); };
  const addCrit = (id, w) => { const c = crit(id); for (const ch of CHAINS) { const [s, t] = c.v[ch]; add(ch, s * w, s >= 2 && w >= 2 ? `${c.label}: ${t}` : null); } };
  const regions = ans.regions || [];
  if (regions.includes('sea')) addCrit('sea', 2);
  if (regions.includes('japan')) addCrit('japan', 2);
  if (regions.includes('korea')) { add('marriott', 3, '국내 호텔 수 많음 (JW·그랜드·코트야드 등)'); add('accor', 2, '국내: 페어몬트·소피텔·앰배서더 계열'); add('ihg', 2, '국내: 인터컨 코엑스·파르나스·홀리데이인'); add('hilton', 2, '국내: 콘래드·힐튼 부산·그랜드 힐튼'); }
  if (regions.includes('west')) { add('marriott', 3, '유럽·미주 선택지 최다'); add('hilton', 3, '유럽·미주 선택지 많음'); add('ihg', 2, null); add('accor', 1, null); }
  for (const w of ans.wants || []) addCrit(w, 3);
  // 숙박 수: 적을수록 "지름길"(카드·유료)이 있는 체인이 유리, 많을수록 실적형(Marriott)도 가능
  const n = ans.nights;
  if (n === 'lt10' || n === 'n10') { addCrit('reach', 2); add('marriott', -3, null); }
  if (n === 'n30') { add('accor', 3, 'Explorer 30박 보너스로 Platinum 사정권'); add('ihg', 2, null); }
  if (n === 'n60') { add('marriott', 4, '50박이면 Platinum 직행, 라운지·16시 체크아웃'); add('accor', 3, '60박 → SNU 2장 재지급 조건 충족'); add('hilton', 2, null); }
  if (ans.card === 'yes') addCrit('card', 2); else { add('hilton', -2, null); add('marriott', -1, null); }
  if (ans.paid === 'yes') { add('accor', 3, 'Explorer: Stay Plus 2장 + 다이닝 30% + 30박 보너스'); add('ihg', 3, 'Ambassador: 즉시 Platinum + IC 주말 무료박'); } else { add('accor', -1, null); add('ihg', -2, null); }
  if (ans.miles === 'yes') addCrit('miles', 2);
  if (ans.scene === 'nature' || ans.scene === 'both') { const w = ans.scene === 'both' ? 1 : 2; add('accor', 2 * w, '소피텔·풀만·뫼벤픽 비치 리조트 많음 (푸켓·다낭·후아힌)'); add('ihg', 2 * w, '식스센스·인터컨 리조트 (사무이·다낭·푸꾸옥)'); add('marriott', 2 * w, 'JW·쉐라톤·르메르디앙 리조트 (푸켓·다낭)'); add('hilton', 1 * w, '콘래드 코사무이·힐튼 다낭'); }
  if (ans.scene === 'urban' || ans.scene === 'both') { const w = ans.scene === 'both' ? 1 : 2; add('marriott', 2 * w, '방콕·호치민·홍콩 도심 라운지 호텔 충실'); add('ihg', 2 * w, '인터컨·킴튼·인디고 도심 호텔'); add('accor', 1 * w, null); add('hilton', 1 * w, null); }
  if (ans.pace === 'relax' || ans.pace === 'both') { const w = ans.pace === 'both' ? 1 : 2; add('accor', 2 * w, 'Stay Plus: 2박 중 1박 무료 — 오래 머물수록 이득'); add('hilton', 2 * w, '5th Night Free: 5박째 무료'); add('marriott', 1 * w, '포인트 5박 4박값'); add('ihg', 1 * w, null); }
  if (ans.pace === 'explore' || ans.pace === 'both') { const w = ans.pace === 'both' ? 1 : 2; add('accor', 2 * w, '노보텔·머큐어·이비스까지 어느 도시에나 있음'); add('marriott', 2 * w, '도시마다 선택지 많음, 코트야드·포포인츠로 박수 쌓기 쉬움'); add('ihg', 2 * w, '홀리데이인 익스프레스로 박수·포인트 효율'); add('hilton', 1 * w, null); }
  if (ans.style === 'lux') { add('accor', 2, '소피텔·페어몬트·래플스에서 SNU 가치 큼'); add('ihg', 2, '인터컨·식스센스·킴튼'); add('marriott', 2, '리츠·세인트레지스·JW'); add('hilton', 1, null); }
  if (ans.style === 'city') { add('marriott', 2, '도심 프리미엄 라운지 충실'); add('accor', 1, null); add('ihg', 1, null); add('hilton', 1, null); }
  if (ans.style === 'value') { add('accor', 2, '노보텔·머큐어·이비스에서 포인트 결제 효율'); add('ihg', 2, '홀리데이인 익스프레스 포인트룸 저렴'); add('hilton', 2, '햄튼·힐튼가든인 전원 무료 조식'); add('marriott', 1, null); }
  const ranked = CHAINS.map(c => ({ chain: c, name: NAME[c], score: score[c], why: [...new Set(why[c])].slice(0, 4), tier: TARGET_TIER[c], path: PATH[c] })).sort((a, b) => b.score - a.score);
  const max = ranked[0].score || 1; for (const r of ranked) r.pct = Math.max(0, Math.round(r.score / max * 100));
  return ranked;
}
return { CHAINS, NAME, CRITERIA, TIERS, TARGET_TIER, PATH, QUIZ, recommend };
})();
