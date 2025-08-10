
/* RNG Spinner Game - Channel Glass (Dark) - v1
   Multi-page with localStorage save
*/

const GAME_KEY = "rng_channel_glass_v1";

const DefaultState = () => ({
  player: {
    coins: 200,
    tickets: 0,
    pityEpic: 0, // 0..1
    pityMythic: 0, // 0..1
    streak: 0,
    reduceMotion: false,
    volume: 0.7,
  },
  inventory: {
    slots: 72, // 9x8
    items: [] // {id, name, rarity:'C|U|R|E|M', count, locked, fav, bannerId}
  },
  banners: {
    active: "default",
    all: [
      { id: "default", name: "Standard Pool", rates: {C:0.62,U:0.24,R:0.10,E:0.035,M:0.005}, featured: [] },
      { id: "neon", name: "Neon Artifacts", rates: {C:0.55,U:0.26,R:0.13,E:0.05,M:0.01}, featured: ["Prism Core","Flux Crown"] },
    ]
  },
  codex: {
    discovered: {} // name: true
  },
  stats: {
    spins: 0, epics: 0, mythics: 0
  },
  lastDaily: null
});

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return DefaultState();
    const parsed = JSON.parse(raw);
    // gentle migrations
    if (!parsed.inventory?.slots) parsed.inventory.slots = 72;
    if (!parsed.player?.volume && parsed.player?.volume !== 0) parsed.player.volume = 0.7;
    return parsed;
  } catch (e) {
    console.warn("State load failed, resetting.", e);
    return DefaultState();
  }
}

function saveState() {
  localStorage.setItem(GAME_KEY, JSON.stringify(state));
}

function resetState(confirmReset=true) {
  if (confirmReset && !confirm("Reset all progress?")) return;
  state = DefaultState();
  saveState();
  toast("Save reset.", "warn");
  setTimeout(()=>location.reload(), 300);
}

/* Utility */
function byId(id){ return document.getElementById(id); }
function el(tag, attrs={}, ...children){
  const n = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of children) n.append(c);
  return n;
}
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

/* Toasts */
function toast(msg, tone="") {
  let wrap = document.querySelector(".toast");
  if (!wrap) {
    wrap = el("div",{class:"toast"});
    document.body.append(wrap);
  }
  const t = el("div",{class:"t"}, msg);
  if (tone==="warn") t.style.borderColor = "var(--warn)";
  if (tone==="good") t.style.borderColor = "var(--good)";
  wrap.append(t);
  setTimeout(()=>{ t.remove(); }, 2600);
}

/* SFX (pure WebAudio, no external libs) */
const SFX = (()=>{
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  let master = ctx.createGain(); master.gain.value = state.player.volume; master.connect(ctx.destination);
  function blip(freq=600, dur=0.06){
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur+0.01);
  }
  function sweep(start=220, end=880, dur=0.25){
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type="triangle";
    o.frequency.setValueAtTime(start, ctx.currentTime);
    o.frequency.linearRampToValueAtTime(end, ctx.currentTime+dur);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur+0.02);
  }
  function setVolume(v){ master.gain.value = clamp(v,0,1); }
  return { blip, sweep, setVolume };
})();

/* VFX - tiny confetti */
function confettiBurst(x, y, n=60) {
  const frag = document.createDocumentFragment();
  for (let i=0;i<n;i++){
    const p = el("div");
    const s = 4 + Math.random()*6;
    p.style.position="fixed";
    p.style.left = (x + (Math.random()-0.5)*120) + "px";
    p.style.top = (y + (Math.random()-0.5)*60) + "px";
    p.style.width = s+"px";
    p.style.height = (s*0.6)+"px";
    p.style.background = `hsl(${Math.random()*360}, 90%, 65%)`;
    p.style.borderRadius = "2px";
    p.style.pointerEvents = "none";
    p.style.zIndex = 9999;
    const rot = (Math.random()*720-360);
    const dx = (Math.random()-0.5)*2;
    const dy = (Math.random()*-2-1);
    let life = 0;
    function tick(){
      life += 1;
      p.style.transform = `translate(${dx*life*2}px, ${dy*life*2}px) rotate(${rot+life*4}deg)`;
      p.style.opacity = String(1 - life/60);
      if (life<60 && !state.player.reduceMotion) requestAnimationFrame(tick);
      else p.remove();
    }
    requestAnimationFrame(tick);
    frag.append(p);
  }
  document.body.append(frag);
}

/* Items - abstract artifacts */
const ITEM_POOL = [
  { name:"Glass Chip", rarity:"C" },
  { name:"Frost Bit", rarity:"C" },
  { name:"Ion Pebble", rarity:"C" },
  { name:"Pulse Shard", rarity:"U" },
  { name:"Quanta Leaf", rarity:"U" },
  { name:"Phase Gem", rarity:"R" },
  { name:"Echo Prism", rarity:"R" },
  { name:"Aether Coil", rarity:"E" },
  { name:"Nova Sigil", rarity:"E" },
  { name:"Flux Crown", rarity:"M" },
  { name:"Prism Core", rarity:"M" },
];

function poolForBanner(bannerId){
  // For demo, same pool but banners "feature" specific names which show a tag
  return ITEM_POOL;
}

/* Rarity helpers */
const RarityMeta = {
  C: { name:"Common",  color:"var(--rare-c)"},
  U: { name:"Uncommon",color:"var(--rare-u)"},
  R: { name:"Rare",    color:"var(--rare-r)"},
  E: { name:"Epic",    color:"var(--rare-e)"},
  M: { name:"Mythic",  color:"var(--rare-m)"},
};

function pickRarity(rates) {
  const pE = rates.E + state.player.pityEpic*0.02;   // pity adds up to +2% at max
  const pM = rates.M + state.player.pityMythic*0.01; // pity adds up to +1% at max
  const total = rates.C + rates.U + rates.R + pE + pM;
  let r = Math.random()*total;
  for (const k of ["M","E","R","U","C"]) { // reverse order so higher tiers get first slice
    const p = (k==="E") ? pE : (k==="M" ? pM : rates[k]);
    if (r < p) return k;
    r -= p;
  }
  return "C";
}

function weightedPick(arr, rarity) {
  const candidates = arr.filter(x=>x.rarity===rarity);
  return candidates[Math.floor(Math.random()*candidates.length)];
}

/* Spin */
function spinOnce(btnCenter) {
  const banner = state.banners.all.find(b=>b.id===state.banners.active) || state.banners.all[0];
  const pool = poolForBanner(banner.id);
  const rar = pickRarity(banner.rates);
  const item = weightedPick(pool, rar);

  // pity handling
  if (rar==="E") state.player.pityEpic = 0;
  else state.player.pityEpic = clamp(state.player.pityEpic + 0.02, 0, 1);
  if (rar==="M") state.player.pityMythic = 0;
  else state.player.pityMythic = clamp(state.player.pityMythic + 0.02, 0, 1);

  state.stats.spins++;
  if (rar==="E") state.stats.epics++;
  if (rar==="M") state.stats.mythics++;

  // streak bonus coins
  state.player.streak++;
  state.player.coins += 2 + Math.floor(state.player.streak/5);

  addToInventory(item.name, rar, banner.id);

  // VFX/SFX
  SFX.sweep(260, 820, rar==="M"?0.5:0.32);
  if (btnCenter) confettiBurst(btnCenter.x, btnCenter.y, rar==="M"?120:60);
  toast(`You pulled <b>${item.name}</b> <span class="small">(${RarityMeta[rar].name})</span>`, rar==="M"?"good":(rar==="E"?"":""));

  saveState();
  updateHUD();
}

function addToInventory(name, rarity, bannerId){
  const existing = state.inventory.items.find(i=>i.name===name);
  if (existing) { existing.count += 1; return; }
  const id = "itm_"+Math.random().toString(36).slice(2,9);
  state.inventory.items.push({ id, name, rarity, count:1, locked:false, fav:false, bannerId });
  state.codex.discovered[name] = true;
}

/* Spend / costs */
const COST = { spin: 10, ticketSpin: 1 };

function canSpin() { return state.player.coins >= COST.spin || state.player.tickets >= COST.ticketSpin; }
function doSpin(btnEl) {
  if (!canSpin()) { toast("Not enough coins or tickets.", "warn"); return; }
  const rect = btnEl.getBoundingClientRect();
  const center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
  if (state.player.tickets >= COST.ticketSpin) state.player.tickets -= COST.ticketSpin;
  else state.player.coins -= COST.spin;
  spinOnce(center);
}

/* HUD updates on pages */
function updateHUD() {
  const coins = document.querySelectorAll("[data-coins]");
  coins.forEach(n=>n.textContent = state.player.coins);
  const tickets = document.querySelectorAll("[data-tickets]");
  tickets.forEach(n=>n.textContent = state.player.tickets);
  const pityE = document.querySelectorAll("[data-pity-epic]");
  pityE.forEach(n=>n.style.width = (state.player.pityEpic*100)+"%");
  const pityM = document.querySelectorAll("[data-pity-mythic]");
  pityM.forEach(n=>n.style.width = (state.player.pityMythic*100)+"%");
  const streak = document.querySelectorAll("[data-streak]");
  streak.forEach(n=>n.textContent = state.player.streak);
}

/* Inventory UI */
function rarityClass(r){ return r==="M"?"rM":(r==="E"?"rE":(r==="R"?"rR":(r==="U"?"rU":"rC"))); }

function renderInventory(rootId="invGrid") {
  const root = byId(rootId);
  if (!root) return;
  root.innerHTML = "";
  const slots = state.inventory.slots;
  const items = state.inventory.items.slice().sort((a,b)=>{
    // favorites first, then rarity, then name
    const fav = (b.fav?1:0) - (a.fav?1:0);
    if (fav) return fav;
    const order = "MERSU".indexOf(b.rarity) - "MERSU".indexOf(a.rarity); // small trick; custom order below
    if (order) return order;
    return a.name.localeCompare(b.name);
  });
  // fill grid
  let idx=0;
  for (let i=0;i<slots;i++){
    const cell = el("div",{class:"slot"});
    if (items[idx]) {
      const it = items[idx];
      const ic = el("div", {class:"icon "+rarityClass(it.rarity), draggable:"true"});
      ic.style.background = `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25), rgba(255,255,255,0.06) 60%), linear-gradient(180deg, ${RarityMeta[it.rarity].color}, transparent)`;
      const cnt = el("div",{class:"count"}, "x"+it.count);
      cell.append(ic, cnt);
      cell.dataset.itemId = it.id;
      // drag
      ic.addEventListener("dragstart", (e)=>{
        e.dataTransfer.setData("text/plain", it.id);
      });
      cell.addEventListener("dragover", (e)=> e.preventDefault());
      cell.addEventListener("drop", (e)=>{
        e.preventDefault();
        const fromId = e.dataTransfer.getData("text/plain");
        if (!fromId || fromId===it.id) return;
        // if same item name -> fuse attempt
        const from = state.inventory.items.find(x=>x.id===fromId);
        if (!from) return;
        if (from.name===it.name) {
          // Fuse rule: need 3 total to convert 3->1 shard; shards tracked as "Shard [rarity]"
          const total = from.count + it.count;
          if (total >= 3) {
            const toUse = 3;
            from.count -= Math.min(from.count, toUse);
            const remain = toUse - Math.min(from.count+toUse, toUse); // simplified
            it.count -= Math.max(0, remain);
            if (from.count <= 0) state.inventory.items = state.inventory.items.filter(x=>x.id!==from.id);
            if (it.count <= 0) state.inventory.items = state.inventory.items.filter(x=>x.id!==it.id);
            addShard(it.rarity);
            toast(`Fused 3 ${it.name} → +1 ${RarityMeta[it.rarity].name} Shard`, "good");
            saveState(); renderInventory();
            return;
          } else {
            toast("Need 3 duplicates to fuse.", "warn");
            return;
          }
        } else {
          // swap positions by swapping ids in ordering (simple: swap names/counts)
          const tmp = { ...from };
          from.name = it.name; from.rarity = it.rarity; from.count = it.count; from.bannerId = it.bannerId;
          it.name = tmp.name; it.rarity = tmp.rarity; it.count = tmp.count; it.bannerId = tmp.bannerId;
          saveState(); renderInventory();
        }
      });
      // context menu
      cell.addEventListener("contextmenu", (e)=>{
        e.preventDefault();
        openCtx(e.clientX, e.clientY, it);
      });
    }
    root.append(cell);
    if (items[idx]) idx++;
  }
}

function addShard(rarity){
  const shardName = `${RarityMeta[rarity].name} Shard`;
  addToInventory(shardName, rarity, "shard");
}

function craftFromShards(rarity){
  // Need 5 shards of rarity to pick any item of that rarity in current banner
  const shards = state.inventory.items.find(i=>i.name===`${RarityMeta[rarity].name} Shard`);
  if (!shards || shards.count < 5) { toast("Need 5 shards.", "warn"); return; }
  shards.count -= 5;
  if (shards.count<=0) state.inventory.items = state.inventory.items.filter(i=>i!==shards);
  // grant chosen item (random of that rarity from active banner)
  const banner = state.banners.all.find(b=>b.id===state.banners.active) || state.banners.all[0];
  const pool = poolForBanner(banner.id).filter(x=>x.rarity===rarity);
  const chosen = pool[Math.floor(Math.random()*pool.length)];
  addToInventory(chosen.name, rarity, banner.id);
  toast(`Crafted ${chosen.name} (${RarityMeta[rarity].name})`, "good");
  saveState(); renderInventory();
}

/* Context menu */
let ctxEl;
function openCtx(x,y,item){
  closeCtx();
  ctxEl = el("div",{class:"ctx"});
  const btns = [
    ["Favorite", ()=>{ item.fav=!item.fav; saveState(); renderInventory(); }],
    ["Lock", ()=>{ item.locked=!item.locked; saveState(); renderInventory(); }],
    ["Trash 1", ()=>{ if (item.locked) return toast("Locked item.", "warn"); item.count--; if(item.count<=0) state.inventory.items=state.inventory.items.filter(i=>i!==item); saveState(); renderInventory(); }],
  ];
  for (const [label, fn] of btns) ctxEl.append(el("button",{onclick:fn}, label));
  document.body.append(ctxEl);
  ctxEl.style.display="block";
  ctxEl.style.left = x+"px";
  ctxEl.style.top = y+"px";
  document.addEventListener("click", closeCtx, { once: true });
}
function closeCtx(){ if (ctxEl){ ctxEl.remove(); ctxEl=null; }}

/* Daily bonus */
function claimDaily(){
  const today = new Date().toDateString();
  if (state.lastDaily === today) { toast("Already claimed today.", "warn"); return; }
  state.player.coins += 50;
  state.player.tickets += 1;
  state.lastDaily = today;
  toast("Daily claimed: +50 coins, +1 ticket", "good");
  saveState(); updateHUD();
}

/* Export/Import */
function exportSave(){
  const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "rng_save.json"; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 500);
}
function importSave(file){
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      state = data; saveState(); toast("Import OK. Reloading...", "good"); setTimeout(()=>location.reload(), 400);
    } catch (e) {
      toast("Invalid save file.", "warn");
    }
  };
  reader.readAsText(file);
}

/* Banners */
function setBanner(id){
  state.banners.active = id;
  saveState();
  document.querySelectorAll(".banner-card").forEach(c=>c.classList.toggle("active", c.dataset.id===id));
}

/* On pages */
function initCommon(){
  updateHUD();
  // reduce-motion toggle wiring if present
  const rm = document.querySelector("#reduceMotion");
  if (rm) {
    rm.checked = !!state.player.reduceMotion;
    rm.addEventListener("change", ()=>{ state.player.reduceMotion = rm.checked; saveState(); });
  }
}
document.addEventListener("DOMContentLoaded", initCommon);
