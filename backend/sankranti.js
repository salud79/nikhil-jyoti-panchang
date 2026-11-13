// backend/sankranti.js — 2026 के निरयण सूर्य राशि-प्रवेश।
const SOURCE = 'Swiss Ephemeris 2.10.03 (Moshier), Lahiri, geocentric';
const SIGNS = [
  'मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या',
  'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुम्भ', 'मीन'
];

// हर पंक्ति में राशि संख्या और UTC में सीमा पार करने का समय है।
const INGRESS_2026 = [
  [10, '2026-01-14T09:37:19.792Z'],
  [11, '2026-02-12T22:38:58.948Z'],
  [12, '2026-03-14T19:33:04.476Z'],
  [1, '2026-04-14T04:02:39.549Z'],
  [2, '2026-05-15T00:52:01.781Z'],
  [3, '2026-06-15T07:23:00.637Z'],
  [4, '2026-07-16T18:09:22.963Z'],
  [5, '2026-08-17T02:28:45.762Z'],
  [6, '2026-09-17T02:22:57.432Z'],
  [7, '2026-10-17T14:21:42.180Z'],
  [8, '2026-11-16T14:13:12.918Z'],
  [9, '2026-12-16T04:55:02.687Z'],
];

// वर्ष भारतीय समय की तारीख पर आधारित है।
export function getSankrantiTimes(year) {
  if (year !== 2026) {
    throw new RangeError('संक्रांति संदर्भ केवल वर्ष 2026 के लिए उपलब्ध है।');
  }

  return INGRESS_2026.map(([rashiNumber, utcInstant]) => {
    const roundedUtcMs = Math.round(Date.parse(utcInstant) / 1000) * 1000;
    const ist = new Date(roundedUtcMs + 330 * 60000).toISOString();
    return {
      rashiNumber,
      rashi: SIGNS[rashiNumber - 1],
      longitude: (rashiNumber - 1) * 30,
      utcInstant,
      dateIST: ist.slice(0, 10),
      timeIST: ist.slice(11, 19),
      source: SOURCE
    };
  });
}
