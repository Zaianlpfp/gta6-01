// shops.js — Solmar Bay (gta6-01 v4 r14)
// Toko + respray + safehouse. Semua transaksi cek SB.state.cash dulu.
// Ditulis FRESH dari game/API.md §14. Cooldown safehouse memakai
// SB.state.simTime (satu-satunya jam sim); tanpa acak atau jam bawaan JS.
import { SB } from './engine.js';

// Palet warna respray (seeded via SB.rng() saat respray tanpa warna dipilih).
const RESPRAY_COLORS = ['#ff5da2', '#22d3ee', '#facc15', '#a78bfa', '#34d399', '#f97316', '#e2e8f0'];
const SAFEHOUSE_COOLDOWN = 60; // detik sim antar heal gratis

SB.shops = {
  // Katalog toko (ikon $ di minimap).
  items: [
    { id: 'armor', name: 'Body Armor', cost: 200, desc: '+50 armor' },
    { id: 'snack', name: 'Snack + Soda', cost: 25, desc: '+20 health' },
    { id: 'respray', name: 'Respray Mobil', cost: 150, desc: 'Warna baru mobil hero' },
  ],
  _lastSafehouseHeal: -1000, // simTime heal safehouse terakhir

  // Beli item toko. Return { ok, msg }.
  buy(itemId) {
    const item = SB.shops.items.find((i) => i.id === itemId);
    if (!item) return { ok: false, msg: 'Item tidak dikenal.' };
    if (itemId === 'respray') return SB.shops.respray(undefined, item.cost);
    if (SB.state.cash < item.cost) {
      return { ok: false, msg: 'Uang tidak cukup: butuh $' + item.cost + '.' };
    }
    SB.state.cash -= item.cost;
    if (itemId === 'armor') SB.state.armor = Math.min(100, SB.state.armor + 50);
    if (itemId === 'snack') SB.state.health = Math.min(100, SB.state.health + 20);
    if (SB.hud && SB.hud.refreshAll) SB.hud.refreshAll();
    return { ok: true, msg: item.name + ' dibeli (-$' + item.cost + ').' };
  },

  // Ganti warna mobil hero. color opsional (hex); bila kosong, pilih dari
  // palet lewat SB.rng(). cost default $150. Return { ok, msg, color }.
  respray(color, cost) {
    const price = cost === undefined ? 150 : cost;
    if (SB.state.cash < price) {
      return { ok: false, msg: 'Uang tidak cukup: respray butuh $' + price + '.' };
    }
    const picked = color || SB.pick(RESPRAY_COLORS);
    SB.state.cash -= price;
    if (SB.state.vehicle) SB.state.vehicle.color = picked;
    if (SB.vehicles && SB.vehicles.heroCar && SB.vehicles.heroCar.mesh) {
      SB.vehicles.heroCar.mesh.traverse((o) => {
        if (o.isMesh && o.userData && o.userData.body) o.material.color.set(picked);
      });
    }
    if (SB.hud && SB.hud.refreshAll) SB.hud.refreshAll();
    return { ok: true, msg: 'Mobil dicat ulang ' + picked + ' (-$' + price + ').', color: picked };
  },

  // Masuk safehouse: simpan game + heal gratis (sekali per 60 dtk sim).
  // Return { ok, msg }.
  enterSafehouse() {
    const now = SB.state.simTime;
    const since = now - SB.shops._lastSafehouseHeal;
    if (since < SAFEHOUSE_COOLDOWN) {
      const wait = Math.ceil(SAFEHOUSE_COOLDOWN - since);
      return { ok: false, msg: 'Safehouse baru bisa heal lagi dalam ' + wait + ' detik.' };
    }
    SB.shops._lastSafehouseHeal = now;
    SB.state.health = 100;
    if (SB.save) SB.save.save();
    if (SB.hud && SB.hud.refreshAll) SB.hud.refreshAll();
    return { ok: true, msg: 'Safehouse: health penuh + progres tersimpan.' };
  },
};

export { SB };
