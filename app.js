(() => {
'use strict';
const DAY = 86400000, KEY = 'schoolClock.v1';
const PRESETS = (window.PRESET_SCHEDULES || []).map(s => ({ ...s, preset: true }));
if (!PRESETS.length) PRESETS.push({ id: 'empty', name: '（日課なし）', preset: true, items: [] });

let S = { offset: 0, sel: PRESETS[0].id, custom: [], mode: 's', once: null };
try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r) Object.assign(S, r); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ offset: S.offset, sel: S.sel, custom: S.custom })); } catch (e) {} };

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const z = n => String(n).padStart(2, '0');
const toMs = t => { const a = String(t).split(':').map(Number); return ((a[0] || 0) * 3600 + (a[1] || 0) * 60 + (a[2] || 0)) * 1000; };
const clockFmt = ms => `${z(Math.floor(ms / 3600000))}:${z(Math.floor(ms / 60000) % 60)}:${z(Math.floor(ms / 1000) % 60)}.${z(Math.floor(ms % 1000 / 10))}`;
const remFmt = ms => `${z(Math.floor(ms / 60000))}:${z(Math.floor(ms / 1000) % 60)}.${z(Math.floor(ms % 1000 / 10))}`;
const shortTime = t => t.length > 5 && t.slice(6) !== '00' ? t : t.slice(0, 5);
const all = () => PRESETS.concat(S.custom);
const cur = () => all().find(x => x.id === S.sel) || PRESETS[0];

/* ズレ調整 */
const setOff = v => { S.offset = Math.round(Number(v) || 0); $('off').value = S.offset; save(); };
document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => setOff(S.offset + Number(b.dataset.d)));
$('off').onchange = e => setOff(e.target.value);
$('offReset').onclick = () => setOff(0);

/* 日課の選択・一覧 */
let lis = [], items = [], ctx = null;
function buildSel() {
  const opt = a => a.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
  $('sel').innerHTML = `<optgroup label="初期設定">${opt(PRESETS)}</optgroup>` + (S.custom.length ? `<optgroup label="マイ日課">${opt(S.custom)}</optgroup>` : '');
  S.sel = cur().id; $('sel').value = S.sel;
  $('bDel').style.display = cur().preset ? 'none' : '';
}
function buildList() {
  items = cur().items.map(i => ({ label: i.label, time: i.time, ms: toMs(i.time) })).sort((a, b) => a.ms - b.ms);
  $('list').innerHTML = items.map(i => `<li><span>${esc(i.label)}</span><span class="mono">${esc(shortTime(i.time))}</span></li>`).join('');
  lis = [...$('list').children];
}
$('sel').onchange = e => { S.sel = e.target.value; save(); buildSel(); buildList(); };

/* エディタ */
let editId = null;
const rowHTML = (l = '', t = '08:00') => `<div class="erow"><input type="text" class="rl" placeholder="名前（例：1限目）" value="${esc(l)}"><input type="time" class="rt" step="1" value="${esc(t.length === 5 ? t + ':00' : t)}"><button type="button" class="danger">削除</button></div>`;
function openEditor(c, id) {
  editId = id; $('eName').value = c ? c.name : '';
  $('eRows').innerHTML = (c ? c.items : [{ label: '1限目', time: '08:50' }]).map(i => rowHTML(i.label, i.time)).join('');
  $('editor').classList.remove('hide'); $('eName').focus();
}
$('eRows').onclick = e => { if (e.target.classList.contains('danger')) e.target.parentElement.remove(); };
$('eAdd').onclick = () => $('eRows').insertAdjacentHTML('beforeend', rowHTML());
$('eCancel').onclick = () => $('editor').classList.add('hide');
$('bNew').onclick = () => openEditor(null, null);
$('bEdit').onclick = () => { const c = cur(); c.preset ? openEditor({ name: c.name + '（コピー）', items: c.items }, null) : openEditor(c, c.id); };
$('bDel').onclick = () => {
  const c = cur(); if (c.preset || !confirm(`「${c.name}」を削除しますか？`)) return;
  S.custom = S.custom.filter(x => x.id !== c.id); S.sel = PRESETS[0].id; save(); buildSel(); buildList();
};
$('eSave').onclick = () => {
  const name = $('eName').value.trim() || '無題の日課';
  const its = [...$('eRows').children].map(r => ({ label: r.querySelector('.rl').value.trim() || 'チャイム', time: r.querySelector('.rt').value })).filter(i => i.time);
  if (!its.length) { alert('時刻を1つ以上入力してください'); return; }
  its.sort((a, b) => toMs(a.time) - toMs(b.time));
  if (editId) { const c = S.custom.find(x => x.id === editId); c.name = name; c.items = its; }
  else { editId = 'u-' + Date.now(); S.custom.push({ id: editId, name, items: its }); }
  S.sel = editId; save(); buildSel(); buildList(); $('editor').classList.add('hide');
};

/* タブ・単発タイマー */
function setMode(m) {
  S.mode = m;
  $('paneS').classList.toggle('hide', m !== 's'); $('paneO').classList.toggle('hide', m !== 'o');
  $('tabS').classList.toggle('on', m === 's'); $('tabO').classList.toggle('on', m === 'o');
}
$('tabS').onclick = () => setMode('s'); $('tabO').onclick = () => setMode('o');
$('oGo').onclick = () => { S.once = { label: $('oLabel').value.trim() || '指定時刻', ms: toMs($('oTime').value || '00:00:00') }; };

/* 残り時間の全画面表示（非対応の端末は画面いっぱいの表示に切り替え） */
const hero = $('hero'), fsBtn = $('fsBtn');
const isFs = () => document.fullscreenElement === hero || hero.classList.contains('fs');
const syncFs = () => { fsBtn.textContent = isFs() ? '閉じる' : '全画面'; };
async function toggleFs() {
  if (isFs()) {
    hero.classList.remove('fs');
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch (e) {} }
  } else if (hero.requestFullscreen) {
    try { await hero.requestFullscreen(); } catch (e) { hero.classList.add('fs'); }
  } else hero.classList.add('fs');
  syncFs();
}
fsBtn.onclick = toggleFs;
document.addEventListener('fullscreenchange', syncFs);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && hero.classList.contains('fs')) toggleFs(); });

/* メインループ */
function tick() {
  const real = Date.now();
  const tokyo = (real + 9 * 3600000) % DAY;
  const now = ((real + 9 * 3600000 + S.offset * 1000) % DAY + DAY) % DAY;
  $('clk').textContent = clockFmt(now); $('tky').textContent = clockFmt(tokyo);

  let label, rem = null, key = null;
  if (S.mode === 's') {
    const idx = items.findIndex(i => i.ms > now);
    lis.forEach((li, i) => { li.className = idx === -1 || i < idx ? 'past' : i === idx ? 'next' : ''; });
    if (idx >= 0) { label = items[idx].label + 'まであと'; rem = items[idx].ms - now; key = idx; }
    else label = items.length ? '本日のチャイムは終了しました' : '日課が空です';
  } else if (!S.once) label = '時刻を設定して「開始」を押してください';
  else if (S.once.ms > now) { label = S.once.label + 'まであと'; rem = S.once.ms - now; key = S.once.ms; }
  else label = S.once.label + 'の時刻です';

  $('cLabel').textContent = label;
  $('cTime').textContent = rem === null ? '--:--.--' : remFmt(rem);
  requestAnimationFrame(tick);
}

$('off').value = S.offset;
buildSel(); buildList(); setMode('s');
requestAnimationFrame(tick);
})();
