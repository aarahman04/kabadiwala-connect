import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
//#region src/data/models.ts
const MATERIAL_CATEGORIES = [
	"CRT",
	"LCD_PANEL",
	"PCB",
	"CABLE",
	"BATTERY",
	"MOTOR_MAGNET",
	"MIXED_PLASTIC"
];
//#endregion
//#region src/data/seedData.ts
const DAY = 864e5;
const SEED_CITY = "Nagpur";
function seedRecyclers() {
	return [
		{
			recyclerId: "rc-01",
			name: "GreenLoop E-Recyclers",
			location: {
				lat: 21.106,
				lng: 78.978,
				address: "Plot 14, MIDC Hingna, Nagpur"
			},
			materialsAccepted: [
				"PCB",
				"CABLE",
				"BATTERY",
				"LCD_PANEL",
				"MOTOR_MAGNET"
			],
			authorizationStatus: "authorized",
			authorizationId: "MPCB-EW-DEMO-0141",
			contact: "+91 90000 00101",
			offeredRates: {
				PCB: 150,
				CABLE: 215,
				BATTERY: 58,
				LCD_PANEL: 19,
				MOTOR_MAGNET: 40
			},
			pickupAvailable: true,
			serviceArea: "Hingna, Wadi, Pratap Nagar"
		},
		{
			recyclerId: "rc-02",
			name: "Vidarbha E-Waste Solutions",
			location: {
				lat: 20.942,
				lng: 79.004,
				address: "D-22, Butibori MIDC, Nagpur"
			},
			materialsAccepted: [
				"CRT",
				"LCD_PANEL",
				"PCB",
				"CABLE",
				"BATTERY",
				"MOTOR_MAGNET",
				"MIXED_PLASTIC"
			],
			authorizationStatus: "authorized",
			authorizationId: "MPCB-EW-DEMO-0087",
			contact: "+91 90000 00102",
			offeredRates: {
				CRT: 10,
				LCD_PANEL: 20,
				PCB: 160,
				CABLE: 225,
				BATTERY: 60,
				MOTOR_MAGNET: 42,
				MIXED_PLASTIC: 15
			},
			pickupAvailable: true,
			serviceArea: "All Nagpur district"
		},
		{
			recyclerId: "rc-03",
			name: "Orange City Metal Recovery",
			location: {
				lat: 21.172,
				lng: 79.133,
				address: "Near Kalamna Market, Nagpur"
			},
			materialsAccepted: [
				"CABLE",
				"MOTOR_MAGNET",
				"PCB"
			],
			authorizationStatus: "authorized",
			authorizationId: "MPCB-EW-DEMO-0203",
			contact: "+91 90000 00103",
			offeredRates: {
				CABLE: 230,
				MOTOR_MAGNET: 45,
				PCB: 140
			},
			pickupAvailable: false,
			serviceArea: "Kalamna, Pardi, Wardhaman Nagar"
		},
		{
			recyclerId: "rc-04",
			name: "Sitabuldi Electronics Scrap Hub",
			location: {
				lat: 21.143,
				lng: 79.083,
				address: "Modi No. 3, Sitabuldi, Nagpur"
			},
			materialsAccepted: [
				"CRT",
				"LCD_PANEL",
				"PCB",
				"CABLE",
				"MIXED_PLASTIC"
			],
			authorizationStatus: "authorized",
			authorizationId: "MPCB-EW-DEMO-0319",
			contact: "+91 90000 00104",
			offeredRates: {
				CRT: 8,
				LCD_PANEL: 17,
				PCB: 135,
				CABLE: 205,
				MIXED_PLASTIC: 13
			},
			pickupAvailable: false,
			serviceArea: "Sitabuldi, Dharampeth, Sadar"
		},
		{
			recyclerId: "rc-05",
			name: "Wadi Battery Recyclers",
			location: {
				lat: 21.155,
				lng: 79.02,
				address: "Amravati Road, Wadi, Nagpur"
			},
			materialsAccepted: ["BATTERY", "CABLE"],
			authorizationStatus: "authorized",
			authorizationId: "MPCB-EW-DEMO-0277",
			contact: "+91 90000 00105",
			offeredRates: {
				BATTERY: 62,
				CABLE: 200
			},
			pickupAvailable: true,
			serviceArea: "Wadi, Hingna, Dabha"
		},
		{
			recyclerId: "rc-06",
			name: "Itwari Kabad Traders",
			location: {
				lat: 21.156,
				lng: 79.113,
				address: "Itwari, Nagpur"
			},
			materialsAccepted: [
				"PCB",
				"CABLE",
				"CRT"
			],
			authorizationStatus: "pending",
			contact: "+91 90000 00106",
			offeredRates: {
				PCB: 170,
				CABLE: 240,
				CRT: 12
			},
			pickupAvailable: true,
			serviceArea: "Itwari, Gandhibagh"
		},
		{
			recyclerId: "rc-07",
			name: "Kamptee Road Scrap Yard",
			location: {
				lat: 21.19,
				lng: 79.1,
				address: "Kamptee Road, Nagpur"
			},
			materialsAccepted: [
				"CRT",
				"PCB",
				"CABLE",
				"BATTERY",
				"MIXED_PLASTIC"
			],
			authorizationStatus: "unauthorized",
			contact: "+91 90000 00107",
			offeredRates: {
				CRT: 14,
				PCB: 180,
				CABLE: 250,
				BATTERY: 70,
				MIXED_PLASTIC: 18
			},
			pickupAvailable: true,
			serviceArea: "Kamptee Road, Indora"
		},
		{
			recyclerId: "rc-08",
			name: "Kapsi Plastic & E-Scrap",
			location: {
				lat: 21.125,
				lng: 79.18,
				address: "Bhandara Road, Kapsi, Nagpur"
			},
			materialsAccepted: [
				"MIXED_PLASTIC",
				"CRT",
				"LCD_PANEL"
			],
			authorizationStatus: "authorized",
			authorizationId: "MPCB-EW-DEMO-0352",
			contact: "+91 90000 00108",
			offeredRates: {
				MIXED_PLASTIC: 16,
				CRT: 11,
				LCD_PANEL: 21
			},
			pickupAvailable: true,
			serviceArea: "Kapsi, Pardi, Bhandara Road"
		},
		{
			recyclerId: "rc-09",
			name: "Manewada Scrap Mart",
			location: {
				lat: 21.11,
				lng: 79.112,
				address: "Manewada Square, Nagpur"
			},
			materialsAccepted: [
				"PCB",
				"CABLE",
				"BATTERY"
			],
			authorizationStatus: "authorized",
			authorizationId: "MPCB-EW-DEMO-0398",
			contact: "+91 90000 00109",
			offeredRates: {
				PCB: 60,
				CABLE: 95,
				BATTERY: 50
			},
			pickupAvailable: true,
			serviceArea: "Manewada, Besa, Hudkeshwar"
		},
		{
			recyclerId: "rc-10",
			name: "Pardi E-Recycle Centre",
			location: {
				lat: 21.16,
				lng: 79.145,
				address: "Pardi Naka, Nagpur"
			},
			materialsAccepted: [
				"LCD_PANEL",
				"PCB",
				"BATTERY"
			],
			authorizationStatus: "pending",
			contact: "+91 90000 00110",
			offeredRates: {
				LCD_PANEL: 22,
				PCB: 155,
				BATTERY: 64
			},
			pickupAvailable: false,
			serviceArea: "Pardi, Kalamna"
		}
	];
}
const PRICE_PROFILES = {
	CRT: {
		base: 9,
		driftPct: 0,
		low: 6,
		high: 12
	},
	LCD_PANEL: {
		base: 18.5,
		driftPct: -3,
		low: 12,
		high: 24
	},
	PCB: {
		base: 142,
		driftPct: 4,
		low: 110,
		high: 180
	},
	CABLE: {
		base: 200,
		driftPct: 8,
		low: 170,
		high: 250
	},
	BATTERY: {
		base: 54,
		driftPct: 2,
		low: 40,
		high: 70
	},
	MOTOR_MAGNET: {
		base: 38,
		driftPct: 0,
		low: 28,
		high: 48
	},
	MIXED_PLASTIC: {
		base: 14.2,
		driftPct: -2,
		low: 10,
		high: 18
	}
};
const SAMPLE_DAYS_AGO = [
	60,
	45,
	30,
	15,
	1
];
/** Deterministic wobble so the demo looks the same every time. */
function jitter(seed) {
	const x = Math.sin(seed * 12.9898) * 43758.5453;
	return (x - Math.floor(x) - .5) * .03;
}
function seedPrices(now = Date.now()) {
	const rows = [];
	Object.keys(PRICE_PROFILES).forEach((category, ci) => {
		const p = PRICE_PROFILES[category];
		SAMPLE_DAYS_AGO.forEach((daysAgo, si) => {
			const progress = si / (SAMPLE_DAYS_AGO.length - 1);
			const isLast = si === SAMPLE_DAYS_AGO.length - 1;
			const trend = p.base * (1 + p.driftPct / 100 * progress);
			const price = isLast ? trend : trend * (1 + jitter(ci * 10 + si));
			rows.push({
				category,
				location: SEED_CITY,
				date: now - daysAgo * DAY,
				buyingPrice: Math.round(price * 100) / 100,
				unit: "kg",
				marketRangeLow: p.low,
				marketRangeHigh: p.high
			});
		});
	});
	for (const [recyclerId, category, quotedPrice] of [
		[
			"rc-02",
			"PCB",
			160
		],
		[
			"rc-03",
			"CABLE",
			230
		],
		[
			"rc-09",
			"PCB",
			60
		]
	]) {
		const p = PRICE_PROFILES[category];
		rows.push({
			category,
			location: SEED_CITY,
			date: now - 3 * DAY,
			buyingPrice: quotedPrice,
			quotedPrice,
			unit: "kg",
			recyclerId,
			marketRangeLow: p.low,
			marketRangeHigh: p.high
		});
	}
	return rows;
}
//#endregion
//#region src/logic/anomaly.ts
/** Deviation beyond the market band (as a fraction of the band edge) that triggers a warning. */
const ANOMALY_THRESHOLD = .4;
/**
* Flags a quote that sits more than 40% below the market low or above the
* market high. Rule-based today; this is the hook where a learned model of
* fair price per category/area/season would plug in.
*/
function detectPriceAnomaly(quoted, marketRangeLow, marketRangeHigh, threshold = ANOMALY_THRESHOLD) {
	if (quoted < marketRangeLow && marketRangeLow > 0) {
		const deviation = (marketRangeLow - quoted) / marketRangeLow;
		return {
			flagged: deviation > threshold,
			direction: "below",
			deviationPct: Math.round(deviation * 100)
		};
	}
	if (quoted > marketRangeHigh && marketRangeHigh > 0) {
		const deviation = (quoted - marketRangeHigh) / marketRangeHigh;
		return {
			flagged: deviation > threshold,
			direction: "above",
			deviationPct: Math.round(deviation * 100)
		};
	}
	return {
		flagged: false,
		direction: "within",
		deviationPct: 0
	};
}
//#endregion
//#region src/logic/hashing.ts
/** Canonical, order-fixed serialization — both sides must hash the exact same string. */
function handoverHashInput(f) {
	return [
		f.lotId,
		f.weight.toFixed(2),
		f.timestamp,
		f.location.lat.toFixed(6),
		f.location.lng.toFixed(6),
		f.collectorId,
		f.recyclerId
	].join("|");
}
async function sha256Hex(input) {
	const bytes = new TextEncoder().encode(input);
	const subtle = globalThis.crypto?.subtle;
	if (subtle) {
		const digest = await subtle.digest("SHA-256", bytes);
		return toHex(new Uint8Array(digest));
	}
	return toHex(sha256Fallback(bytes));
}
async function computeHandoverHash(f) {
	return sha256Hex(handoverHashInput(f));
}
/** Short code for reading aloud / typing on a feature phone: KC- + first 6 hex chars. */
function referenceFromHash(hash) {
	return "KC-" + hash.slice(0, 6).toUpperCase();
}
async function verifyHandover(f, expected) {
	const hash = await computeHandoverHash(f);
	return hash === expected.handoverHash && referenceFromHash(hash) === expected.handoverReference;
}
function toHex(bytes) {
	let out = "";
	for (const b of bytes) out += b.toString(16).padStart(2, "0");
	return out;
}
const K = new Uint32Array([
	1116352408,
	1899447441,
	3049323471,
	3921009573,
	961987163,
	1508970993,
	2453635748,
	2870763221,
	3624381080,
	310598401,
	607225278,
	1426881987,
	1925078388,
	2162078206,
	2614888103,
	3248222580,
	3835390401,
	4022224774,
	264347078,
	604807628,
	770255983,
	1249150122,
	1555081692,
	1996064986,
	2554220882,
	2821834349,
	2952996808,
	3210313671,
	3336571891,
	3584528711,
	113926993,
	338241895,
	666307205,
	773529912,
	1294757372,
	1396182291,
	1695183700,
	1986661051,
	2177026350,
	2456956037,
	2730485921,
	2820302411,
	3259730800,
	3345764771,
	3516065817,
	3600352804,
	4094571909,
	275423344,
	430227734,
	506948616,
	659060556,
	883997877,
	958139571,
	1322822218,
	1537002063,
	1747873779,
	1955562222,
	2024104815,
	2227730452,
	2361852424,
	2428436474,
	2756734187,
	3204031479,
	3329325298
]);
function sha256Fallback(message) {
	const H = new Uint32Array([
		1779033703,
		3144134277,
		1013904242,
		2773480762,
		1359893119,
		2600822924,
		528734635,
		1541459225
	]);
	const bitLen = message.length * 8;
	const padded = new Uint8Array(Math.ceil((message.length + 9) / 64) * 64);
	padded.set(message);
	padded[message.length] = 128;
	const view = new DataView(padded.buffer);
	view.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
	view.setUint32(padded.length - 4, bitLen >>> 0);
	const W = /* @__PURE__ */ new Uint32Array(64);
	const rotr = (x, n) => x >>> n | x << 32 - n;
	for (let offset = 0; offset < padded.length; offset += 64) {
		for (let i = 0; i < 16; i++) W[i] = view.getUint32(offset + i * 4);
		for (let i = 16; i < 64; i++) {
			const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ W[i - 15] >>> 3;
			const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ W[i - 2] >>> 10;
			W[i] = W[i - 16] + s0 + W[i - 7] + s1 >>> 0;
		}
		let [a, b, c, d, e, f, g, h] = H;
		for (let i = 0; i < 64; i++) {
			const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
			const ch = e & f ^ ~e & g;
			const t1 = h + S1 + ch + K[i] + W[i] >>> 0;
			const t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + (a & b ^ a & c ^ b & c) >>> 0;
			h = g;
			g = f;
			f = e;
			e = d + t1 >>> 0;
			d = c;
			c = b;
			b = a;
			a = t1 + t2 >>> 0;
		}
		H[0] += a;
		H[1] += b;
		H[2] += c;
		H[3] += d;
		H[4] += e;
		H[5] += f;
		H[6] += g;
		H[7] += h;
	}
	const out = /* @__PURE__ */ new Uint8Array(32);
	const outView = new DataView(out.buffer);
	H.forEach((word, i) => outView.setUint32(i * 4, word));
	return out;
}
//#endregion
//#region src/logic/valuation.ts
/** Market entries within this window of the latest one are averaged into the board price. */
const BOARD_WINDOW_MS = 12096e5;
/** Market-wide observations only (recycler quotes are excluded from the board). */
function marketEntries(prices, category) {
	return prices.filter((p) => p.category === category && !p.recyclerId).sort((a, b) => a.date - b.date);
}
function priceTrend(prices, category) {
	return marketEntries(prices, category).map((p) => ({
		date: p.date,
		price: p.buyingPrice
	}));
}
function trendChangePct(points) {
	if (points.length < 2 || points[0].price === 0) return 0;
	const first = points[0].price;
	return (points[points.length - 1].price - first) / first * 100;
}
function priceBoardRow(prices, category) {
	const entries = marketEntries(prices, category);
	if (entries.length === 0) return void 0;
	const latest = entries[entries.length - 1];
	const recent = entries.filter((e) => latest.date - e.date <= BOARD_WINDOW_MS);
	const avg = recent.reduce((sum, e) => sum + e.buyingPrice, 0) / recent.length;
	return {
		category,
		pricePerUnit: Math.round(avg * 100) / 100,
		unit: latest.unit,
		marketRangeLow: latest.marketRangeLow,
		marketRangeHigh: latest.marketRangeHigh,
		asOf: latest.date,
		changePct: trendChangePct(priceTrend(prices, category))
	};
}
//#endregion
//#region src/services/serverCore.ts
function initialServerState(now = Date.now()) {
	return {
		recyclers: seedRecyclers(),
		prices: seedPrices(now),
		lots: {},
		transactions: {},
		traceability: {},
		confirmations: {},
		flags: {},
		audit: []
	};
}
/** Older persisted states predate some collections. */
function normalizeState(s) {
	return {
		...initialServerState(),
		...s,
		flags: s.flags ?? {},
		audit: s.audit ?? []
	};
}
/** A request the server refuses (bad data). Distinct from being offline. */
var ValidationError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "ValidationError";
	}
};
const QUOTE_DEVIATION_THRESHOLD = .4;
const MAX_WEIGHT_KG = 5e3;
const REF_PATTERN = /^KC-[0-9A-F]{6}$/;
function check(condition, message) {
	if (!condition) throw new ValidationError(message);
}
function isCategory(c) {
	return MATERIAL_CATEGORIES.includes(c);
}
/** Validate and apply one client write. Mutates `s`. */
async function applyOp(s, op, now = Date.now()) {
	switch (op.kind) {
		case "upsertLot": {
			const lot = op.lot;
			check(typeof lot.lotId === "string" && lot.lotId, "lotId required");
			check(isCategory(lot.category), "unknown material category");
			check(lot.approxWeightKg > 0 && lot.approxWeightKg <= MAX_WEIGHT_KG, "weight out of range");
			check(lot.estimatedValue >= 0, "estimatedValue must be ≥ 0");
			s.lots[lot.lotId] = {
				...lot,
				status: s.lots[lot.lotId]?.status === "paid" ? "paid" : lot.status
			};
			audit(s, op.kind, lot.lotId, now);
			break;
		}
		case "upsertTransaction": {
			const tx = op.transaction;
			check(tx.transactionId && tx.lotId, "transactionId and lotId required");
			check(tx.quotedPrice >= 0, "quotedPrice must be ≥ 0");
			const recycler = s.recyclers.find((r) => r.recyclerId === tx.recyclerId);
			check(recycler, `unknown recycler ${tx.recyclerId}`);
			check(recycler.authorizationStatus === "authorized", "recycler is not authorized");
			const existing = s.transactions[tx.transactionId];
			s.transactions[tx.transactionId] = existing?.transactionStatus === "confirmed" ? {
				...tx,
				transactionStatus: "confirmed",
				finalPrice: existing.finalPrice,
				paymentStatus: existing.paymentStatus !== "pending" ? existing.paymentStatus : tx.paymentStatus
			} : tx;
			audit(s, op.kind, tx.transactionId, now);
			break;
		}
		case "upsertTraceability": {
			const r = op.record;
			check(REF_PATTERN.test(r.handoverReference), "bad handover reference");
			check(!r.photoThumbnails || r.photoThumbnails.length <= 4 && r.photoThumbnails.every((t) => typeof t === "string" && t.startsWith("data:image/") && t.length < 6e4), "photo thumbnails must be ≤4 small data:image URLs");
			check(await verifyHandover({
				lotId: r.lotId,
				weight: r.weight,
				timestamp: r.timestamp,
				location: r.location,
				collectorId: r.collectorId,
				recyclerId: r.recyclerId
			}, r), "handover hash does not match record");
			const prev = s.traceability[r.handoverReference];
			s.traceability[r.handoverReference] = prev?.status === "confirmed" ? {
				...r,
				status: "confirmed",
				recyclerConfirmation: prev.recyclerConfirmation
			} : r;
			audit(s, op.kind, r.handoverReference, now);
			const pending = s.confirmations[r.handoverReference];
			if (pending) confirm(s, pending, now);
			break;
		}
		case "confirmHandover": {
			const c = op.confirmation;
			check(REF_PATTERN.test(c.handoverReference), "bad handover reference");
			check(c.finalPrice == null || c.finalPrice >= 0, "finalPrice must be ≥ 0");
			s.confirmations[c.handoverReference] = c;
			audit(s, op.kind, c.handoverReference, now);
			confirm(s, c, now);
			break;
		}
		case "markPaid": {
			const tx = s.transactions[op.transactionId];
			check(tx, `unknown transaction ${op.transactionId}`);
			if (tx.paymentStatus === "pending") tx.paymentStatus = op.paymentStatus;
			tx.finalPrice ??= tx.quotedPrice;
			audit(s, op.kind, op.transactionId, now);
			break;
		}
		case "updateRecyclerRates": {
			const recycler = s.recyclers.find((r) => r.recyclerId === op.recyclerId);
			check(recycler, `unknown recycler ${op.recyclerId}`);
			for (const [key, rate] of Object.entries(op.offeredRates)) {
				check(isCategory(key), `unknown category ${key}`);
				const category = key;
				check(typeof rate === "number" && rate > 0 && rate < 1e5, "rate out of range");
				recycler.offeredRates[category] = rate;
				if (!recycler.materialsAccepted.includes(category)) recycler.materialsAccepted.push(category);
				const band = priceBoardRow(s.prices, category);
				s.prices.push({
					category,
					location: SEED_CITY,
					date: op.at,
					buyingPrice: rate,
					quotedPrice: rate,
					unit: "kg",
					recyclerId: recycler.recyclerId,
					marketRangeLow: band?.marketRangeLow ?? rate,
					marketRangeHigh: band?.marketRangeHigh ?? rate
				});
			}
			audit(s, op.kind, op.recyclerId, now);
			break;
		}
	}
}
function audit(s, kind, ref, at) {
	s.audit.push({
		at,
		kind,
		ref
	});
}
function confirm(s, c, now) {
	const record = s.traceability[c.handoverReference];
	if (!record) return;
	record.status = "confirmed";
	record.recyclerConfirmation ??= {
		confirmedAt: c.confirmedAt,
		confirmedBy: c.confirmedBy
	};
	const tx = s.transactions[record.transactionId];
	if (!tx) return;
	tx.transactionStatus = "confirmed";
	tx.finalPrice = c.finalPrice ?? tx.finalPrice ?? tx.quotedPrice;
	if (tx.paymentStatus === "pending") tx.paymentStatus = c.paymentStatus;
	const category = s.lots[record.lotId]?.category;
	if (!category || !(record.weight > 0)) return;
	const perKg = tx.finalPrice / record.weight;
	const band = priceBoardRow(s.prices, category);
	s.prices.push({
		category,
		location: SEED_CITY,
		date: c.confirmedAt,
		buyingPrice: Math.round(perKg * 100) / 100,
		quotedPrice: Math.round(tx.quotedPrice / record.weight * 100) / 100,
		unit: "kg",
		recyclerId: tx.recyclerId,
		marketRangeLow: band?.marketRangeLow ?? perKg,
		marketRangeHigh: band?.marketRangeHigh ?? perKg
	});
	const flag = transactionAnomaly(tx, record.weight, band?.marketRangeLow, band?.marketRangeHigh);
	if (flag) s.flags[tx.transactionId] = {
		...flag,
		at: now
	};
}
/** Abnormal final value: far outside the market band, or far from what was quoted. */
function transactionAnomaly(tx, weightKg, marketLow, marketHigh) {
	const final = tx.finalPrice ?? tx.quotedPrice;
	if (marketLow != null && marketHigh != null && weightKg > 0) {
		const a = detectPriceAnomaly(final / weightKg, marketLow, marketHigh);
		if (a.flagged) return {
			transactionId: tx.transactionId,
			reason: a.direction === "below" ? "below_market" : "above_market",
			deviationPct: a.deviationPct
		};
	}
	if (tx.quotedPrice > 0) {
		const dev = Math.abs(final - tx.quotedPrice) / tx.quotedPrice;
		if (dev > QUOTE_DEVIATION_THRESHOLD) return {
			transactionId: tx.transactionId,
			reason: "far_from_quote",
			deviationPct: Math.round(dev * 100)
		};
	}
	return null;
}
/** Confirmations for this collector's handovers. */
function updatesFor(s, collectorId) {
	return Object.values(s.traceability).filter((r) => r.collectorId === collectorId && r.status === "confirmed").map((r) => {
		const tx = s.transactions[r.transactionId];
		const confirmation = s.confirmations[r.handoverReference] ?? {
			handoverReference: r.handoverReference,
			confirmedAt: r.recyclerConfirmation?.confirmedAt ?? Date.now(),
			confirmedBy: r.recyclerConfirmation?.confirmedBy ?? "recycler",
			finalPrice: tx?.finalPrice,
			paymentStatus: tx?.paymentStatus ?? "pending"
		};
		return {
			transactionId: r.transactionId,
			lotId: r.lotId,
			confirmation
		};
	});
}
function handoverByReference(s, reference) {
	const record = s.traceability[reference];
	if (!record) return null;
	return {
		record,
		transaction: s.transactions[record.transactionId],
		lot: s.lots[record.lotId],
		flag: s.flags[record.transactionId]
	};
}
/** All handovers going to one recycler — the recycler-side worklist. */
function handoversForRecycler(s, recyclerId) {
	return Object.values(s.traceability).filter((r) => r.recyclerId === recyclerId).sort((a, b) => b.timestamp - a.timestamp).map((r) => handoverByReference(s, r.handoverReference));
}
//#endregion
//#region backend/src/app.ts
const MAX_BODY_BYTES = 262144;
function createApp({ store, corsOrigin = "*", adminToken }) {
	let state = null;
	let queue = Promise.resolve();
	const exclusive = (fn) => {
		const run = queue.then(fn, fn);
		queue = run.catch(() => {});
		return run;
	};
	const current = async () => state ??= await store.load();
	return async function handle(req, res) {
		res.setHeader("Access-Control-Allow-Origin", corsOrigin);
		res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
		if (req.method === "OPTIONS") return send(res, 204);
		const url = new URL(req.url ?? "/", "http://localhost");
		const path = url.pathname.replace(/\/+$/, "") || "/";
		try {
			if (req.method === "GET" && (path === "/" || path === "/api/health")) {
				const s = await current();
				return json(res, 200, {
					ok: true,
					store: store.kind,
					counts: {
						recyclers: s.recyclers.length,
						prices: s.prices.length,
						lots: Object.keys(s.lots).length,
						transactions: Object.keys(s.transactions).length,
						handovers: Object.keys(s.traceability).length,
						flags: Object.keys(s.flags).length
					}
				});
			}
			if (req.method === "GET" && path === "/api/recyclers") return json(res, 200, (await current()).recyclers);
			if (req.method === "GET" && path === "/api/prices") return json(res, 200, (await current()).prices);
			if (req.method === "POST" && path === "/api/ops") {
				const body = await readJson(req);
				if (!body?.op || typeof body.op !== "object" || !("kind" in body.op)) return json(res, 400, { error: "body must be { op }" });
				await exclusive(async () => {
					const s = await current();
					const draft = structuredClone(s);
					await applyOp(draft, body.op);
					await store.save(draft);
					state = draft;
				});
				return json(res, 200, { ok: true });
			}
			if (req.method === "GET" && path === "/api/updates") {
				const collectorId = url.searchParams.get("collectorId");
				if (!collectorId) return json(res, 400, { error: "collectorId required" });
				return json(res, 200, updatesFor(await current(), collectorId));
			}
			let m = path.match(/^\/api\/handovers\/(KC-[0-9A-Fa-f]{6})$/);
			if (req.method === "GET" && m) return json(res, 200, { handover: handoverByReference(await current(), m[1].toUpperCase()) });
			m = path.match(/^\/api\/recyclers\/([\w-]+)\/handovers$/);
			if (req.method === "GET" && m) return json(res, 200, { handovers: handoversForRecycler(await current(), m[1]) });
			m = path.match(/^\/api\/export\/(\w+)\.(json|csv)$/);
			if (req.method === "GET" && m) {
				const rows = exportDataset(await current(), m[1]);
				if (!rows) return json(res, 404, {
					error: `unknown dataset ${m[1]}`,
					datasets: DATASETS
				});
				if (m[2] === "json") return json(res, 200, rows);
				res.writeHead(200, {
					"content-type": "text/csv; charset=utf-8",
					"content-disposition": `attachment; filename="${m[1]}.csv"`
				});
				res.end(toCsv(rows));
				return;
			}
			if (req.method === "POST" && path === "/api/admin/reset") {
				if (!adminToken || req.headers.authorization !== `Bearer ${adminToken}`) return json(res, 403, { error: "forbidden" });
				await exclusive(async () => {
					const fresh = initialServerState();
					await (store.reset ? store.reset(fresh) : store.save(fresh));
					state = fresh;
				});
				return json(res, 200, { ok: true });
			}
			return json(res, 404, { error: "not found" });
		} catch (err) {
			if (err instanceof ValidationError || err instanceof SyntaxError || err instanceof BodyTooLarge) return json(res, err instanceof BodyTooLarge ? 413 : 400, { error: err.message });
			console.error(err);
			return json(res, 500, { error: "internal error" });
		}
	};
}
const DATASETS = [
	"materials",
	"prices",
	"recyclers",
	"transactions",
	"traceability",
	"collectors",
	"flags",
	"audit"
];
const pseudonym = (id) => "C-" + createHash("sha256").update("kc-export|" + id).digest("hex").slice(0, 10);
function exportDataset(s, name) {
	const lots = Object.values(s.lots);
	const txs = Object.values(s.transactions);
	const records = Object.values(s.traceability);
	switch (name) {
		case "materials": return lots.map((l) => ({
			lotId: l.lotId,
			collector: pseudonym(l.collectorId),
			category: l.category,
			subCategory: l.subCategory,
			description: l.description,
			condition: l.condition,
			sourceType: l.sourceType,
			approxWeightKg: l.approxWeightKg,
			estimatedValue: l.estimatedValue,
			status: l.status,
			createdAt: iso(l.createdAt),
			lat: l.location?.lat,
			lng: l.location?.lng
		}));
		case "prices": return s.prices.map((p) => ({
			category: p.category,
			subCategory: p.subCategory,
			location: p.location,
			date: iso(p.date),
			buyingPrice: p.buyingPrice,
			quotedPrice: p.quotedPrice,
			unit: p.unit,
			recyclerId: p.recyclerId,
			marketRangeLow: p.marketRangeLow,
			marketRangeHigh: p.marketRangeHigh
		}));
		case "recyclers": return s.recyclers.map((r) => ({
			recyclerId: r.recyclerId,
			name: r.name,
			address: r.location.address,
			lat: r.location.lat,
			lng: r.location.lng,
			materialsAccepted: r.materialsAccepted.join(" "),
			authorizationStatus: r.authorizationStatus,
			authorizationId: r.authorizationId,
			contact: r.contact,
			offeredRates: Object.entries(r.offeredRates).map(([c, v]) => `${c}:${v}`).join(" "),
			pickupAvailable: r.pickupAvailable,
			serviceArea: r.serviceArea
		}));
		case "transactions": return txs.map((t) => {
			const lot = s.lots[t.lotId];
			return {
				transactionId: t.transactionId,
				lotId: t.lotId,
				collector: pseudonym(t.collectorId),
				category: lot?.category,
				weightKg: lot?.approxWeightKg,
				quotedPrice: t.quotedPrice,
				finalPrice: t.finalPrice,
				recyclerId: t.recyclerId,
				collectionLat: t.collectionLocation.lat,
				collectionLng: t.collectionLocation.lng,
				handoverLat: t.handoverLocation?.lat,
				handoverLng: t.handoverLocation?.lng,
				dateTime: iso(t.dateTime),
				paymentStatus: t.paymentStatus,
				transactionStatus: t.transactionStatus,
				anomaly: s.flags[t.transactionId]?.reason
			};
		});
		case "traceability": return records.map((r) => ({
			lotId: r.lotId,
			handoverReference: r.handoverReference,
			handoverHash: r.handoverHash,
			weight: r.weight,
			timestamp: iso(r.timestamp),
			lat: r.location.lat,
			lng: r.location.lng,
			locationApproximate: r.locationApproximate ?? false,
			recyclerId: r.recyclerId,
			transactionId: r.transactionId,
			status: r.status,
			confirmedBy: r.recyclerConfirmation?.confirmedBy,
			confirmedAt: iso(r.recyclerConfirmation?.confirmedAt),
			transactionStatus: s.transactions[r.transactionId]?.transactionStatus
		}));
		case "collectors": {
			const byCollector = /* @__PURE__ */ new Map();
			for (const l of lots) {
				const row = byCollector.get(l.collectorId) ?? {
					collector: pseudonym(l.collectorId),
					lots: 0,
					transactions: 0,
					earningsSettled: 0,
					duesPending: 0
				};
				row.lots = row.lots + 1;
				byCollector.set(l.collectorId, row);
			}
			for (const t of txs) {
				const row = byCollector.get(t.collectorId);
				if (!row) continue;
				row.transactions = row.transactions + 1;
				const amount = t.finalPrice ?? t.quotedPrice;
				if (t.paymentStatus !== "pending") row.earningsSettled = row.earningsSettled + amount;
				else if (t.transactionStatus !== "pending") row.duesPending = row.duesPending + amount;
			}
			return [...byCollector.values()];
		}
		case "flags": return Object.values(s.flags).map((f) => ({
			...f,
			at: iso(f.at)
		}));
		case "audit": return s.audit.map((a) => ({
			...a,
			at: iso(a.at)
		}));
		default: return null;
	}
}
const iso = (ms) => ms == null ? void 0 : new Date(ms).toISOString();
function toCsv(rows) {
	if (rows.length === 0) return "";
	const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
	const cell = (v) => {
		if (v == null) return "";
		const str = String(v);
		return /[",\n]/.test(str) ? `"${str.replace(/"/g, "\"\"")}"` : str;
	};
	return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
}
var BodyTooLarge = class extends Error {
	constructor() {
		super("request body too large");
	}
};
async function readJson(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.length;
		if (size > MAX_BODY_BYTES) throw new BodyTooLarge();
		chunks.push(chunk);
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8") || "null");
}
function json(res, status, body) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(body));
}
function send(res, status) {
	res.writeHead(status);
	res.end();
}
/** What the server applies on boot. */
const SCHEMA_SQL = [
	{
		file: "01_users.sql",
		title: "Users / profiles (Supabase Auth)",
		supabaseOnly: true,
		sql: `
-- User profiles for Supabase Auth (e.g. Google sign-in).
-- One row per signed-in person; the role decides which side of the app they
-- see. Kept minimal on purpose (problem statement: avoid unnecessary personal
-- information) — no phone, no address, no name required.
create table if not exists public.kc_profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  role               text not null default 'collector' check (role in ('collector', 'recycler', 'admin')),
  preferred_language text not null default 'hi' check (preferred_language in ('en', 'hi', 'mr')),
  operating_location text,
  collector_id       text unique,  -- the app's device-generated collector ID, once linked
  recycler_id        text,         -- kc_recyclers.recycler_id when role = 'recycler'
  recycler_verified  boolean not null default false,  -- set by an admin, never by the user
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.kc_profiles enable row level security;

-- A signed-in user can read and edit only their own row, and can only pick
-- collector/recycler for themselves (admin is granted from the dashboard).
drop policy if exists "kc_profiles: read own" on public.kc_profiles;
create policy "kc_profiles: read own" on public.kc_profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "kc_profiles: update own" on public.kc_profiles;
create policy "kc_profiles: update own" on public.kc_profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id and role in ('collector', 'recycler'));

-- Users may change only these columns; recycler_verified stays admin-only.
revoke update on public.kc_profiles from authenticated;
grant update (role, preferred_language, operating_location, collector_id, recycler_id)
  on public.kc_profiles to authenticated;

-- Create the profile automatically when someone signs up.
create or replace function public.kc_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.kc_profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists kc_on_auth_user_created on auth.users;
create trigger kc_on_auth_user_created
  after insert on auth.users
  for each row execute function public.kc_handle_new_user();

create or replace function public.kc_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists kc_profiles_touch on public.kc_profiles;
create trigger kc_profiles_touch
  before update on public.kc_profiles
  for each row execute function public.kc_touch_updated_at();
`
	},
	{
		file: "02_helpers.sql",
		title: "Helper functions",
		sql: `
-- Epoch milliseconds (as the app stores time) -> timestamptz. IMMUTABLE so it
-- can be used in generated columns.
create or replace function kc_ms(v jsonb) returns timestamptz
language sql immutable as $fn$ select to_timestamp((v #>> '{}')::double precision / 1000) $fn$;
`
	},
	{
		file: "03_recyclers.sql",
		title: "Recycler / aggregator dataset",
		sql: `
-- Recycler / aggregator dataset
create table if not exists kc_recyclers (
  recycler_id          text primary key,
  data                 jsonb not null,
  name                 text    generated always as (data->>'name') stored,
  authorization_status text    generated always as (data->>'authorizationStatus') stored,
  authorization_id     text    generated always as (data->>'authorizationId') stored,
  address              text    generated always as (data#>>'{location,address}') stored,
  lat                  double precision generated always as ((data#>>'{location,lat}')::double precision) stored,
  lng                  double precision generated always as ((data#>>'{location,lng}')::double precision) stored,
  pickup_available     boolean generated always as ((data->>'pickupAvailable')::boolean) stored,
  service_area         text    generated always as (data->>'serviceArea') stored,
  contact              text    generated always as (data->>'contact') stored,
  updated_at           timestamptz not null default now()
);
`
	},
	{
		file: "04_prices.sql",
		title: "Price dataset",
		sql: `
-- Price dataset (market observations + recycler quotes + completed sales)
create table if not exists kc_prices (
  price_key        text primary key,            -- md5 of the row; rows are append-only
  data             jsonb not null,
  category         text    generated always as (data->>'category') stored,
  sub_category     text    generated always as (data->>'subCategory') stored,
  location         text    generated always as (data->>'location') stored,
  observed_at      timestamptz generated always as (kc_ms(data->'date')) stored,
  buying_price     numeric generated always as ((data->>'buyingPrice')::numeric) stored,
  quoted_price     numeric generated always as ((data->>'quotedPrice')::numeric) stored,
  unit             text    generated always as (data->>'unit') stored,
  recycler_id      text    generated always as (data->>'recyclerId') stored,
  market_range_low  numeric generated always as ((data->>'marketRangeLow')::numeric) stored,
  market_range_high numeric generated always as ((data->>'marketRangeHigh')::numeric) stored
);
create index if not exists kc_prices_category_time on kc_prices (category, observed_at);
`
	},
	{
		file: "05_materials.sql",
		title: "Material dataset (lots)",
		sql: `
-- Material dataset (one row per collected lot)
create table if not exists kc_lots (
  lot_id          text primary key,
  data            jsonb not null,
  collector_id    text    generated always as (data->>'collectorId') stored,
  category        text    generated always as (data->>'category') stored,
  sub_category    text    generated always as (data->>'subCategory') stored,
  description     text    generated always as (data->>'description') stored,
  condition       text    generated always as (data->>'condition') stored,
  source_type     text    generated always as (data->>'sourceType') stored,
  weight_kg       numeric generated always as ((data->>'approxWeightKg')::numeric) stored,
  estimated_value numeric generated always as ((data->>'estimatedValue')::numeric) stored,
  status          text    generated always as (data->>'status') stored,
  created_at      timestamptz generated always as (kc_ms(data->'createdAt')) stored,
  lat             double precision generated always as ((data#>>'{location,lat}')::double precision) stored,
  lng             double precision generated always as ((data#>>'{location,lng}')::double precision) stored,
  updated_at      timestamptz not null default now()
);
create index if not exists kc_lots_collector on kc_lots (collector_id);
`
	},
	{
		file: "06_transactions.sql",
		title: "Transaction dataset",
		sql: `
-- Transaction dataset
create table if not exists kc_transactions (
  transaction_id     text primary key,
  data               jsonb not null,
  lot_id             text    generated always as (data->>'lotId') stored,
  collector_id       text    generated always as (data->>'collectorId') stored,
  recycler_id        text    generated always as (data->>'recyclerId') stored,
  quoted_price       numeric generated always as ((data->>'quotedPrice')::numeric) stored,
  final_price        numeric generated always as ((data->>'finalPrice')::numeric) stored,
  payment_status     text    generated always as (data->>'paymentStatus') stored,
  transaction_status text    generated always as (data->>'transactionStatus') stored,
  occurred_at        timestamptz generated always as (kc_ms(data->'dateTime')) stored,
  collection_lat     double precision generated always as ((data#>>'{collectionLocation,lat}')::double precision) stored,
  collection_lng     double precision generated always as ((data#>>'{collectionLocation,lng}')::double precision) stored,
  handover_lat       double precision generated always as ((data#>>'{handoverLocation,lat}')::double precision) stored,
  handover_lng       double precision generated always as ((data#>>'{handoverLocation,lng}')::double precision) stored,
  updated_at         timestamptz not null default now()
);
create index if not exists kc_transactions_collector on kc_transactions (collector_id);
create index if not exists kc_transactions_recycler on kc_transactions (recycler_id);
`
	},
	{
		file: "07_traceability.sql",
		title: "Traceability dataset + recycler confirmations",
		sql: `
-- Traceability dataset (verifiable handover records)
create table if not exists kc_traceability (
  handover_reference   text primary key,         -- KC-XXXXXX
  data                 jsonb not null,           -- includes photoThumbnails (small data URLs)
  lot_id               text    generated always as (data->>'lotId') stored,
  transaction_id       text    generated always as (data->>'transactionId') stored,
  collector_id         text    generated always as (data->>'collectorId') stored,
  recycler_id          text    generated always as (data->>'recyclerId') stored,
  handover_hash        text    generated always as (data->>'handoverHash') stored,
  weight_kg            numeric generated always as ((data->>'weight')::numeric) stored,
  recorded_at          timestamptz generated always as (kc_ms(data->'timestamp')) stored,
  lat                  double precision generated always as ((data#>>'{location,lat}')::double precision) stored,
  lng                  double precision generated always as ((data#>>'{location,lng}')::double precision) stored,
  location_approximate boolean generated always as (coalesce((data->>'locationApproximate')::boolean, false)) stored,
  status               text    generated always as (data->>'status') stored,
  confirmed_by         text    generated always as (data#>>'{recyclerConfirmation,confirmedBy}') stored,
  confirmed_at         timestamptz generated always as (kc_ms(data#>'{recyclerConfirmation,confirmedAt}')) stored,
  updated_at           timestamptz not null default now()
);

-- Recycler confirmations (may arrive before the handover record syncs)
create table if not exists kc_confirmations (
  handover_reference text primary key,
  data               jsonb not null,
  confirmed_by       text    generated always as (data->>'confirmedBy') stored,
  confirmed_at       timestamptz generated always as (kc_ms(data->'confirmedAt')) stored,
  final_price        numeric generated always as ((data->>'finalPrice')::numeric) stored,
  payment_status     text    generated always as (data->>'paymentStatus') stored
);
`
	},
	{
		file: "08_flags_audit.sql",
		title: "Anomaly flags + audit trail",
		sql: `
-- Abnormal transaction flags (anomaly detection output)
create table if not exists kc_flags (
  transaction_id text primary key,
  data           jsonb not null,
  reason         text    generated always as (data->>'reason') stored,
  deviation_pct  numeric generated always as ((data->>'deviationPct')::numeric) stored,
  flagged_at     timestamptz generated always as (kc_ms(data->'at')) stored
);

-- Audit trail of every accepted write
create table if not exists kc_audit (
  seq  bigint primary key,
  data jsonb not null,
  kind text generated always as (data->>'kind') stored,
  ref  text generated always as (data->>'ref') stored,
  at   timestamptz generated always as (kc_ms(data->'at')) stored
);
`
	},
	{
		file: "09_collectors.sql",
		title: "Collector dataset (view)",
		sql: `
-- Collector dataset: minimal by design (pseudonymous device ID, no name/phone).
create or replace view kc_collectors as
select l.collector_id,
       count(distinct l.lot_id)                                                   as lots,
       count(distinct t.transaction_id)                                           as transactions,
       coalesce(sum(coalesce(t.final_price, t.quoted_price))
                filter (where t.payment_status <> 'pending'), 0)                  as earnings_settled,
       coalesce(sum(coalesce(t.final_price, t.quoted_price))
                filter (where t.payment_status = 'pending'
                          and t.transaction_status <> 'pending'), 0)              as dues_pending,
       min(l.created_at)                                                          as first_seen,
       max(l.created_at)                                                          as last_seen
from kc_lots l
left join kc_transactions t on t.lot_id = l.lot_id
group by l.collector_id;
`
	},
	{
		file: "10_security.sql",
		title: "Row Level Security",
		sql: `
-- Supabase exposes the public schema over its REST API. Row Level Security
-- with no policies blocks that path entirely; the app server connects as the
-- database owner and is unaffected.
alter table kc_recyclers     enable row level security;
alter table kc_prices        enable row level security;
alter table kc_lots          enable row level security;
alter table kc_transactions  enable row level security;
alter table kc_traceability  enable row level security;
alter table kc_confirmations enable row level security;
alter table kc_flags         enable row level security;
alter table kc_audit         enable row level security;
`
	}
].filter((s) => !s.supabaseOnly).map((s) => s.sql).join("\n");
/** Tables in load/save order, with the key each app record is stored under. */
const TABLES = {
	recyclers: "kc_recyclers",
	prices: "kc_prices",
	lots: "kc_lots",
	transactions: "kc_transactions",
	traceability: "kc_traceability",
	confirmations: "kc_confirmations",
	flags: "kc_flags",
	audit: "kc_audit"
};
//#endregion
//#region backend/src/store.ts
/**
* Persistence for the server state. The state is small (a demo-scale dataset),
* so it's held in memory and written through after every accepted change:
*  - DATABASE_URL set → Postgres (Supabase or Railway): one kc_* table per
*    dataset, see schema.ts / database/schema.sql
*  - DATA_FILE set    → JSON file (local dev / a mounted volume)
*  - neither          → memory only (tests)
*/
var MemoryStore = class {
	kind = "memory";
	state = null;
	async load() {
		return this.state ??= initialServerState();
	}
	async save(state) {
		this.state = state;
	}
};
var FileStore = class {
	path;
	kind = "file";
	constructor(path) {
		this.path = path;
	}
	async load() {
		try {
			return normalizeState(JSON.parse(await readFile(this.path, "utf8")));
		} catch {
			const fresh = initialServerState();
			await this.save(fresh);
			return fresh;
		}
	}
	async save(state) {
		await mkdir(dirname(this.path), { recursive: true });
		const tmp = this.path + ".tmp";
		await writeFile(tmp, JSON.stringify(state));
		await rename(tmp, this.path);
	}
};
var PostgresStore = class {
	url;
	kind = "postgres";
	pool = null;
	constructor(url) {
		this.url = url;
	}
	async db() {
		if (this.pool) return this.pool;
		const { default: pg } = await import("pg");
		this.pool = new pg.Pool(pgConfig(this.url));
		await this.pool.query(SCHEMA_SQL);
		return this.pool;
	}
	async load() {
		const db = await this.db();
		const rows = async (table, order) => (await db.query(`select data from ${table} order by ${order}`)).rows.map((r) => r.data);
		const recyclers = await rows(TABLES.recyclers, "recycler_id");
		if (recyclers.length === 0) {
			const fresh = initialServerState();
			await this.save(fresh);
			return fresh;
		}
		const byKey = (list, key) => Object.fromEntries(list.map((x) => [key(x), x]));
		return normalizeState({
			recyclers,
			prices: await rows(TABLES.prices, "observed_at, price_key"),
			lots: byKey(await rows(TABLES.lots, "lot_id"), (l) => l.lotId),
			transactions: byKey(await rows(TABLES.transactions, "transaction_id"), (t) => t.transactionId),
			traceability: byKey(await rows(TABLES.traceability, "handover_reference"), (r) => r.handoverReference),
			confirmations: byKey(await rows(TABLES.confirmations, "handover_reference"), (c) => c.handoverReference),
			flags: byKey(await rows(TABLES.flags, "transaction_id"), (f) => f.transactionId),
			audit: await rows(TABLES.audit, "seq")
		});
	}
	/**
	* Upserts every record (the demo dataset is small). Rows only ever grow or
	* change in place, so there is nothing to delete except on reset().
	*/
	async save(state) {
		const client = await (await this.db()).connect();
		const upsert = (table, keyCol, keyExpr, list, touch = true) => client.query(`insert into ${table} (${keyCol}, data)
         select ${keyExpr}, e from jsonb_array_elements($1::jsonb) with ordinality as t(e, ord)
         on conflict (${keyCol}) do update set data = excluded.data${touch ? ", updated_at = now()" : ""}
         where ${table}.data is distinct from excluded.data`, [JSON.stringify(list)]);
		const appendOnly = (table, keyCol, keyExpr, list) => client.query(`insert into ${table} (${keyCol}, data)
         select ${keyExpr}, e from jsonb_array_elements($1::jsonb) with ordinality as t(e, ord)
         on conflict (${keyCol}) do nothing`, [JSON.stringify(list)]);
		try {
			await client.query("begin");
			await upsert(TABLES.recyclers, "recycler_id", "e->>'recyclerId'", state.recyclers);
			await appendOnly(TABLES.prices, "price_key", "md5(e::text)", state.prices);
			await upsert(TABLES.lots, "lot_id", "e->>'lotId'", Object.values(state.lots));
			await upsert(TABLES.transactions, "transaction_id", "e->>'transactionId'", Object.values(state.transactions));
			await upsert(TABLES.traceability, "handover_reference", "e->>'handoverReference'", Object.values(state.traceability));
			await upsert(TABLES.confirmations, "handover_reference", "e->>'handoverReference'", Object.values(state.confirmations), false);
			await upsert(TABLES.flags, "transaction_id", "e->>'transactionId'", Object.values(state.flags), false);
			await appendOnly(TABLES.audit, "seq", "ord", state.audit);
			await client.query("commit");
		} catch (err) {
			await client.query("rollback").catch(() => {});
			throw err;
		} finally {
			client.release();
		}
	}
	async reset(state) {
		await (await this.db()).query(`truncate ${Object.values(TABLES).join(", ")}`);
		await this.save(state);
	}
};
/**
* Connection settings.
*  - Railway Postgres: use the private DATABASE_URL (*.railway.internal) — no TLS.
*  - Supabase (or any external Postgres): DATABASE_SSL=require. Supabase signs
*    its certificates with its own root CA, so also set DATABASE_CA to the PEM
*    from Dashboard -> Database -> SSL Configuration. Verification stays on.
*/
function pgConfig(url) {
	if (process.env.DATABASE_SSL !== "require") return {
		connectionString: url,
		ssl: false,
		max: 5
	};
	const u = new URL(url);
	u.searchParams.delete("sslmode");
	const ca = process.env.DATABASE_CA?.replace(/\\n/g, "\n");
	return {
		connectionString: u.toString(),
		ssl: {
			rejectUnauthorized: true,
			...ca ? { ca } : {}
		},
		max: 5
	};
}
function storeFromEnv(env = process.env) {
	if (env.DATABASE_URL) return new PostgresStore(env.DATABASE_URL);
	if (env.DATA_FILE) return new FileStore(env.DATA_FILE);
	return new MemoryStore();
}
//#endregion
//#region backend/src/index.ts
const store = storeFromEnv();
const port = Number(process.env.PORT ?? 8787);
const app = createApp({
	store,
	corsOrigin: process.env.CORS_ORIGIN ?? "*",
	adminToken: process.env.ADMIN_TOKEN
});
createServer((req, res) => void app(req, res)).listen(port, () => {
	console.log(`Kabadiwala Connect API on :${port} (store: ${store.kind})`);
});
//#endregion
export {};
