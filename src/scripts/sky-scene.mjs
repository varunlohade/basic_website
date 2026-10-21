/* Sky to sea: one camera descends through a dot-drawn world behind the page.
   World units: 1 = one viewport height. y grows downward.
   ?p=0..1 sets scroll progress, ?t=seconds sets animation time (deterministic). */
import { buildAnchors, makeCamera, depthLabel } from './sky-camera.mjs';

// ---------- params ----------
var qs = new URLSearchParams(location.search);
var hasP = qs.has('p'),
  hasT = qs.has('t');
var FROZEN = hasP || hasT;
var P_FIX = hasP ? Math.min(1, Math.max(0, parseFloat(qs.get('p')) || 0)) : 0;
var T_FIX = hasT ? parseFloat(qs.get('t')) || 0 : 0;
var REDUCED =
  window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- palette (27 colours) ----------
var HEX = {
  ink: '#1b1e27',
  night0: '#161c38',
  night1: '#1f2c58',
  night2: '#2c4683',
  dusk0: '#2a2150',
  dusk1: '#4a2c63',
  plum: '#7b3762',
  rose: '#c0546a',
  ember: '#ea7238',
  amber: '#f7a940',
  sun: '#ffd88a',
  cream: '#fff3da',
  mist0: '#3b3552',
  mist1: '#62577a',
  win: '#ffbe55',
  cyan: '#7fd8ea',
  red: '#ff5442',
  deep0: '#0a2531',
  deep1: '#0f3c4c',
  sea: '#16636f',
  teal: '#2c9c97',
  aqua: '#8ee8d9',
  foam: '#e3fff8',
  kelp: '#8fb043',
  coral: '#ff7a59',
  pink: '#f088cc',
  violet: '#a87ce8',
  yellow: '#f4d04a',
};
var NAMES = Object.keys(HEX);
var C = {};
NAMES.forEach(function (n, i) {
  C[n] = i;
});
var NC = NAMES.length;
var LV = 8; // brightness levels
var STYLES = [];
NAMES.forEach(function (n) {
  var h = HEX[n],
    r = parseInt(h.substr(1, 2), 16),
    g = parseInt(h.substr(3, 2), 16),
    b = parseInt(h.substr(5, 2), 16);
  for (var l = 0; l < LV; l++) {
    var a = 0.32 + 0.68 * (l / (LV - 1));
    STYLES.push('rgba(' + r + ',' + g + ',' + b + ',' + a.toFixed(3) + ')');
  }
});

var SKYR = [C.night0, C.dusk0, C.dusk1, C.plum, C.rose, C.ember];
var CLOUDR = [
  C.dusk0,
  C.dusk1,
  C.plum,
  C.rose,
  C.ember,
  C.amber,
  C.sun,
  C.cream,
];
var MISTR = [C.night1, C.mist0, C.dusk1, C.mist1, C.plum];
var NIGHTR = [C.night0, C.night1, C.night2];
var WATR = [C.deep0, C.deep1, C.sea, C.teal];
var CORALS = [C.coral, C.pink, C.violet, C.yellow, C.coral, C.pink];

// ---------- world layout ----------
var HZ = 0.66; // cloud-sea horizon
var C_NEAR = 1.22; // cloud plain gives way to fog
var C_BASE = 1.86; // underside of the cloud deck
var GROUND = 2.5; // waterline under the city
var FLOOR = 3.74; // reef floor
var CY_TOP = 0.5,
  CY_BOT = 3.42;

// ---------- noise ----------
function hash2(x, y) {
  var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  var xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi;
  var u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  var a = hash2(xi, yi),
    b = hash2(xi + 1, yi),
    c = hash2(xi, yi + 1),
    d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) {
  return (
    (0.5 * vnoise(x, y) +
      0.25 * vnoise(x * 2.03 + 17.1, y * 2.03 + 5.3) +
      0.125 * vnoise(x * 4.07 + 3.7, y * 4.07 + 11.9)) /
    0.875
  );
}
function sstep(a, b, x) {
  var t = (x - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}
function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  function (v) {
    return (v + 0.5) / 16;
  },
);
function ramp(arr, g, thr) {
  g = clamp01(g);
  var f = g * (arr.length - 1),
    i = Math.floor(f);
  if (i >= arr.length - 1) return arr[arr.length - 1];
  return f - i > thr ? arr[i + 1] : arr[i];
}

// ---------- canvas + grid ----------
var cv = document.getElementById('sky');
var ctx = cv ? cv.getContext('2d') : null;
var W, H, DPR, CELL, COLS, ROWS, N, A, CW;
var ci, vv, mask;
function setup() {
  W = window.innerWidth;
  H = window.innerHeight;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  CELL = W < 600 ? 5 : 6;
  COLS = Math.ceil(W / CELL);
  ROWS = Math.ceil(H / CELL);
  N = COLS * ROWS;
  A = W / H / 2; // half width in world units
  CW = CELL / H; // one cell in world units
  cv.width = Math.round(W * DPR);
  cv.height = Math.round(H * DPR);
  ci = new Uint8Array(N);
  vv = new Float32Array(N);
  mask = new Float32Array(N);
  layoutWorld();
}

// ---------- city ----------
var SX, SY, SR, DTX, BX0, BX1, TW1, TW2, MASTX;
var BW = 0.034,
  BW2 = 0.023;
function layoutWorld() {
  SX = A * 0.42;
  SY = HZ - 0.012;
  SR = A < 0.4 ? 0.05 : 0.072;
  DTX = A < 0.4 ? 0.04 : -A * 0.24;
  BX1 = A < 0.4 ? -A * 0.25 : -A * 0.52;
  BX0 = -A - 0.06;
  TW1 = BX0 + (BX1 - BX0) * 0.3;
  TW2 = BX1 - (BX1 - BX0) * 0.12;
  MASTX = DTX + 0.11;
}
function envelope(wx) {
  var e =
    0.32 + 0.68 * Math.exp(-Math.pow((wx - DTX) / Math.max(0.2, A * 0.3), 2));
  return e * sstep(BX1 - 0.02, BX1 + 0.08, wx);
}
// near building height at wx (0 = none). writes building id into _bid.
var _bid = 0,
  _blx = 0;
function nearHeight(wx) {
  var f = (wx + 50) / BW,
    k = Math.floor(f),
    lx = f - k;
  var merge = hash2(k, 3) < 0.33;
  var kk = merge ? k - 1 : k;
  if (!merge && lx < 0.16) return 0;
  var h = hash2(kk, 7);
  var ht = (0.04 + 0.33 * Math.pow(h, 1.8)) * envelope(wx);
  if (hash2(kk, 11) > 0.8) ht += 0.1 * envelope(wx);
  _bid = kk;
  _blx = merge ? (lx + 1) / 2 : (lx - 0.16) / 0.84;
  return ht;
}
function farHeight(wx) {
  var f = (wx + 50.37) / BW2,
    k = Math.floor(f),
    lx = f - k;
  if (lx < 0.12) return 0;
  var h = hash2(k, 21);
  return (0.1 + 0.38 * Math.pow(h, 1.5)) * (0.35 + 0.75 * envelope(wx)) + 0.03;
}
// returns light colour index (or -1) for city lights at world (wx, wy); used by reflections
function cityLight(wx, wy, t) {
  var up = GROUND - wy;
  if (up < 0) return -1;
  if (up < CW * 1.5) {
    // promenade lamps
    var gx = Math.floor(wx / CW);
    return gx % 4 === 0 ? C.win : -1;
  }
  var nh = nearHeight(wx);
  if (nh > 0 && up < nh) {
    var gx2 = Math.floor(wx / CW),
      gy2 = Math.floor(up / CW);
    if ((gx2 & 1) === 0 && gy2 % 3 !== 0 && up < nh - CW * 1.5) {
      var hh = hash2(gx2 * 7 + _bid, gy2 + 101);
      if (hh > 0.42) return hh > 0.93 ? C.cyan : hh > 0.8 ? C.cream : C.win;
    }
  }
  return -1;
}

// ---------- base pass: one cell ----------
var oc = 0,
  ov = 0;
function sample(wx, wy, ix, iy, t, thr) {
  oc = C.ink;
  ov = 0.05;

  // ------- above the clouds -------
  var rip =
    0.006 * Math.sin(wx * 9 + t * 0.25) + 0.004 * Math.sin(wx * 23 - t * 0.4);
  var hz = HZ + rip;
  if (wy < hz) {
    var g = clamp01(wy / HZ);
    oc = ramp(SKYR, Math.pow(g, 1.35), thr);
    ov = 0.07 + 0.34 * Math.pow(g, 2.6);
    // cirrus streaks
    var n = fbm(wx * 1.3 + t * 0.012, wy * 16);
    var st = sstep(0.56, 0.76, n) * sstep(0.2, 0.7, g);
    if (st > 0.05) {
      ov += 0.32 * st * g;
      if (st > thr) oc = ramp(SKYR, Math.min(1, Math.pow(g, 1.7) + 0.25), thr);
    }
    // stars (world-locked)
    if (g < 0.62) {
      var sh = hash2(Math.floor(wx / CW) + 9000, Math.floor(wy / CW) + 300);
      if (sh > 0.9935) {
        var tw = 0.5 + 0.5 * Math.sin(t * 1.6 + sh * 977);
        oc = sh > 0.998 ? C.cyan : C.cream;
        ov = (0.25 + 0.5 * tw) * (1 - g * 0.8);
      }
    }
    // sun
    var dx = wx - SX,
      dy = wy - SY,
      d = Math.sqrt(dx * dx + dy * dy);
    if (d < SR) {
      oc = d < SR * 0.62 ? C.cream : C.sun;
      ov = 1;
      if (dy > -SR * 0.15) {
        // bands of cloud across the lower disc
        var band = Math.sin(
          (dy + 0.004 * Math.sin(wx * 60 + t)) * 300 + t * 0.6,
        );
        if (band > 0.55) {
          oc = C.amber;
          ov = 0.55;
        }
      }
    } else if (d < SR * 3.4) {
      var k = Math.pow(1 - (d - SR) / (SR * 2.4), 2);
      if (k > 0) {
        ov += 0.5 * k;
        if (k > 0.55 - thr * 0.3) oc = k > 0.75 ? C.amber : C.ember;
      }
    }
    return;
  }

  // ------- cloud sea plain (perspective) -------
  if (wy < C_NEAR + 0.1) {
    var q = wy - HZ;
    var z = 1 / (q * 6 + 0.06);
    var u = wx * z * 4.2,
      w = z * 3.2 - t * 0.09;
    var dn = fbm(u, w),
      dn2 = fbm(u, w + 0.22);
    var ridge = dn - dn2; // >0: the top edge of a billow, facing the sun
    var hzg = Math.exp(-q * 8);
    var path =
      Math.exp(-Math.pow((wx - SX) / (0.03 + q * 0.32), 2)) *
      Math.exp(-q * 3.2);
    var side = 0.55 + 0.45 * Math.exp(-Math.pow((wx - SX) / (A * 0.9), 2)); // brighter toward the sun
    var rim = sstep(0.008, 0.045, ridge) * sstep(0.42, 0.56, dn);
    var body = sstep(0.42, 0.62, dn);
    var e =
      0.12 + 0.3 * body + 0.35 * rim + 0.4 * hzg + 0.5 * path * (0.3 + rim);
    var val =
      0.07 +
      0.2 * body * side +
      0.55 * rim * side * (0.5 + path) +
      0.25 * hzg * dn +
      0.35 * path * body;
    var near = sstep(0.12, 0.56, q);
    val *= 1 - 0.38 * near;
    oc = ramp(CLOUDR, e * side * (1 - 0.3 * near), thr);
    ov = val;
    // dissolve into the fog below
    var mix = sstep(C_NEAR - 0.16, C_NEAR + 0.1, wy);
    if (mix > thr) fog(wx, wy, t, thr);
    return;
  }

  // ------- inside the cloud + its underside -------
  if (wy < C_BASE + 0.16) {
    fog(wx, wy, t, thr);
    return;
  }

  // ------- night sky + city -------
  if (wy < GROUND) {
    night(wx, wy, t, thr);
    city(wx, wy, t, thr);
    return;
  }

  // ------- under the water -------
  water(wx, wy, t, thr);
}

function fog(wx, wy, t, thr) {
  var k = clamp01((wy - C_NEAR) / (C_BASE - C_NEAR));
  var f = fbm(wx * 2.4 + t * 0.018, wy * 2.6 - t * 0.008);
  var f2 = fbm(wx * 6 - t * 0.02, wy * 7);
  var dens = f * 0.75 + f2 * 0.25;
  // underside: thin out into wisps
  var cut = sstep(C_BASE - 0.22, C_BASE + 0.2, wy) * 0.9;
  if (dens < cut * 0.95 + 0.02) {
    night(wx, wy, t, thr);
    return;
  }
  var edge = clamp01((dens - cut * 0.95) * 6);
  oc = ramp(MISTR, (1 - k) * 0.55 + dens * 0.45, thr);
  ov = (0.16 + 0.46 * dens * (1 - k * 0.35)) * (0.45 + 0.55 * edge);
  if (edge > 0.2 && edge < 0.55 && cut > 0.05) {
    oc = thr < 0.5 ? C.rose : C.plum;
    ov += 0.12;
  }
  // warm rim from the city below on the underside
}

function night(wx, wy, t, thr) {
  var g = clamp01((wy - C_BASE + 0.25) / (GROUND - C_BASE + 0.25));
  oc = ramp(NIGHTR, g, thr);
  ov = 0.08 + 0.17 * g * g;
  var haze = sstep(0.5, 1, g);
  if (haze > 0) {
    ov += 0.2 * haze;
    if (haze * 0.7 > thr) oc = haze > 0.75 && thr < 0.35 ? C.rose : C.plum;
  }
}

function city(wx, wy, t, thr) {
  var up = GROUND - wy;
  // promenade
  if (up < CW * 1.5) {
    var gx = Math.floor(wx / CW);
    if (gx % 4 === 0) {
      oc = C.win;
      ov = 0.95;
    } else {
      oc = C.night2;
      ov = 0.2;
    }
    return;
  }
  // bridge
  if (wx > BX0 && wx < BX1 + 0.02) {
    var deckY = GROUND - 0.045,
      topY = GROUND - 0.23;
    var gxb = Math.floor(wx / CW);
    if (Math.abs(wy - deckY) < CW * 0.7) {
      oc = gxb % 3 === 0 ? C.win : C.night2;
      ov = gxb % 3 === 0 ? 0.85 : 0.35;
      return;
    }
    if (wy > deckY && wy < GROUND - CW * 1.5) {
      // piers
      if (Math.abs(wx - TW1) < CW * 1.2 || Math.abs(wx - TW2) < CW * 1.2) {
        oc = C.night2;
        ov = 0.22;
        return;
      }
    }
    // towers
    for (var ti = 0; ti < 2; ti++) {
      var tx = ti ? TW2 : TW1;
      if (Math.abs(wx - tx) < CW * 1.1 && wy > topY && wy < deckY) {
        oc = C.night2;
        ov = 0.42;
        if (wy < topY + CW * 1.5) {
          oc = C.red;
          ov = Math.sin(t * 2.4 + ti) > 0.2 ? 0.95 : 0.35;
        }
        return;
      }
    }
    // cables
    var cy;
    var mid = (TW1 + TW2) / 2,
      half = (TW2 - TW1) / 2;
    if (wx >= TW1 && wx <= TW2) {
      var s = (wx - mid) / half;
      cy = deckY - 0.012 - (deckY - 0.012 - topY) * s * s;
    } else if (wx < TW1) {
      var s2 = (TW1 - wx) / (TW1 - BX0);
      cy = topY + (deckY - topY) * Math.pow(s2, 0.75);
    } else {
      var s3 = (wx - TW2) / (BX1 + 0.02 - TW2);
      cy = topY + (deckY - topY) * Math.pow(Math.min(1, s3), 0.75);
    }
    if (Math.abs(wy - cy) < CW * 0.65) {
      var lamp = gxb % 4 === 0;
      oc = lamp ? C.cream : C.cyan;
      ov = lamp ? 0.9 : 0.5;
      return;
    }
    if (wy > cy && wy < deckY && gxb % 3 === 0) {
      oc = C.cyan;
      ov = 0.16;
      return;
    }
  }
  // radio mast
  if (Math.abs(wx - MASTX) < CW * 0.55) {
    var mh = 0.5 * Math.max(0.6, envelope(MASTX));
    if (up < mh) {
      if (up > mh - CW * 1.5) {
        oc = C.red;
        ov = Math.sin(t * 3.1) > 0 ? 1 : 0.3;
      } else {
        oc = C.night2;
        ov = 0.3;
        if (Math.floor(up / CW) % 9 === 0) {
          oc = C.red;
          ov = 0.6;
        }
      }
      return;
    }
  }
  var nh = nearHeight(wx);
  if (nh > 0 && up < nh) {
    var bid = _bid,
      blx = _blx;
    var gx2 = Math.floor(wx / CW),
      gy2 = Math.floor(up / CW);
    oc = C.night0;
    ov = 0.1;
    if (up > nh - CW * 1.2) {
      oc = C.night2;
      ov = 0.28;
    } // roof edge catches haze
    if (
      (gx2 & 1) === 0 &&
      gy2 % 3 !== 0 &&
      up < nh - CW * 1.5 &&
      blx > 0.05 &&
      blx < 0.95
    ) {
      var hh = hash2(gx2 * 7 + bid, gy2 + 101);
      var on = hh > 0.42;
      if (hh > 0.4 && hh < 0.47) on = Math.floor(t * 0.35 + hh * 40) % 2 === 0;
      if (on) {
        oc = hh > 0.93 ? C.cyan : hh > 0.8 ? C.cream : C.win;
        ov = 0.55 + 0.4 * hash2(gx2, gy2 + 7);
      } else {
        oc = C.night1;
        ov = 0.12;
      }
    }
    // beacon on tall roofs
    if (nh > 0.22 && up > nh - CW * 1.2 && blx > 0.4 && blx < 0.6) {
      oc = C.red;
      ov = Math.sin(t * 2 + bid) > 0.3 ? 0.95 : 0.3;
    }
    return;
  }
  var fh = farHeight(wx);
  if (fh > 0 && up < fh) {
    var gx3 = Math.floor(wx / CW),
      gy3 = Math.floor(up / CW);
    oc = C.night1;
    ov = 0.14;
    if ((gx3 & 1) === 1 && (gy3 & 1) === 0 && hash2(gx3 * 3, gy3 + 55) > 0.72) {
      oc = hash2(gx3, gy3) > 0.5 ? C.cyan : C.win;
      ov = 0.32;
    }
  }
}

function water(wx, wy, t, thr) {
  var q = wy - GROUND;
  // surface line
  var wave =
    0.004 * Math.sin(wx * 31 + t * 1.4) + 0.003 * Math.sin(wx * 77 - t * 2.1);
  if (q < CW * 1.2 + wave) {
    oc = C.aqua;
    ov = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(wx * 140 + t * 3));
    return;
  }
  var e = Math.exp(-q * 1.25);
  oc = ramp(WATR, e * 0.95, thr);
  ov = 0.05 + 0.16 * e;
  // light shafts slanting down from the surface
  var s = wx + q * 0.28;
  var sh =
    vnoise(s * 15 + t * 0.07, 3.3) * 0.6 + vnoise(s * 37 - t * 0.05, 8.1) * 0.4;
  sh = sstep(0.6, 0.86, sh) * Math.exp(-q * 0.85) * sstep(0, 0.06, q);
  if (sh > 0.02) {
    ov += 0.42 * sh;
    if (sh > thr * 0.8) oc = sh > 0.45 ? C.aqua : C.teal;
  }
  // caustic shimmer near the surface
  if (q < 0.32) {
    var c1 =
      Math.sin(wx * 48 + Math.sin(wy * 33 + t * 0.9) * 2.2 + t * 0.4) *
      Math.sin(wy * 52 - t * 0.7 + Math.sin(wx * 21) * 1.5);
    if (c1 > 0.82) {
      ov += 0.25 * Math.exp(-q * 7);
      oc = C.aqua;
    }
  }
  // city lights leaking through the surface
  if (q < 0.1) {
    var gy = Math.floor(q / CW);
    if (gy % 2 === 0) {
      var lx = wx + 0.005 * Math.sin(q * 260 - t * 3.2 + wx * 9);
      var lc = cityLight(lx, GROUND - q * 1.25, t);
      if (lc >= 0) {
        oc = lc;
        ov = Math.max(ov, 0.7 * (1 - q / 0.1));
      }
    }
  }
  // marine snow
  var ms = hash2(Math.floor(wx / CW) + 77, Math.floor((wy + t * 0.006) / CW));
  if (ms > 0.9955) {
    oc = C.foam;
    ov = 0.28;
  }
  // reef floor
  var fy =
    FLOOR -
    0.02 -
    0.11 * fbm(wx * 3.2, 1.7) -
    0.05 * Math.exp(-Math.pow((wx - A * 0.55) / 0.12, 2));
  if (wy > fy) {
    var dep = wy - fy;
    var tex = fbm(wx * 16, wy * 16);
    oc = tex > 0.5 ? C.sea : C.deep1;
    ov = 0.14 + 0.22 * tex;
    if (dep < CW * 1.5) {
      oc = C.teal;
      ov = 0.35;
    }
    var cl = fbm(wx * 9 + 3, wy * 9 + 1);
    if (dep < 0.07 && cl > 0.56) {
      var kind =
        CORALS[
          Math.floor(
            hash2(Math.floor(wx * 9 + 3), Math.floor(wy * 9 + 1)) *
              CORALS.length,
          )
        ];
      var bump = Math.sin(wx * 260 + Math.sin(wy * 220) * 3) > -0.2;
      oc = kind;
      ov = bump ? 0.6 + 0.35 * (cl - 0.56) * 2.2 : 0.3;
    }
    return;
  }
}

// ---------- sprites ----------
function put(wx, wy, c, v, cy) {
  var ix = Math.floor((wx + A) / CW),
    iy = Math.floor((wy - cy + 0.5) / CW);
  if (ix < 0 || iy < 0 || ix >= COLS || iy >= ROWS) return;
  var i = iy * COLS + ix;
  if (v >= vv[i] * 0.8) {
    ci[i] = c;
    vv[i] = v;
  }
}
function sprites(t, cy) {
  var top = cy - 0.5,
    bot = cy + 0.5;

  // a plane crossing under the cloud deck
  var py = C_BASE + 0.16;
  if (py > top && py < bot) {
    var span = 2 * A + 0.4;
    var px = -A - 0.2 + ((t * 0.018) % span);
    put(px, py, Math.floor(t * 1.5) % 2 ? C.red : C.cream, 0.95, cy);
    put(px - CW * 2, py, C.cream, 0.4, cy);
  }

  if (bot < GROUND) return;

  // kelp
  for (var k = 0; k < 14; k++) {
    var kx = -A + (k + 0.3 + 0.5 * hash2(k, 41)) * ((2 * A) / 14);
    var base = FLOOR - 0.04 - 0.11 * fbm(kx * 3.2, 1.7);
    var kh = 0.18 + 0.32 * hash2(k, 43);
    if (base - kh > bot || base < top) continue;
    var steps = Math.floor(kh / CW);
    for (var s = 0; s < steps; s++) {
      var f = s / steps;
      var sway =
        0.03 * Math.sin(t * 0.55 + k * 1.7 + f * 3.2) * Math.pow(f, 1.2);
      var x = kx + sway,
        y = base - s * CW;
      put(x, y, C.kelp, 0.5 + 0.25 * f, cy);
      put(x + CW, y, C.kelp, 0.32 + 0.2 * f, cy);
      if (s % 4 === 2 && s > 2) {
        var side = s % 8 === 2 ? 1 : -1;
        put(x + side * CW, y - CW * 0.5, C.kelp, 0.45, cy);
        put(x + side * CW * 2, y - CW * 1.2, C.yellow, 0.4, cy);
      }
    }
  }

  // fish school: a turning ring
  var scx = A * (0.3 + 0.18 * Math.sin(t * 0.09)),
    scy = GROUND + 0.93 + 0.05 * Math.sin(t * 0.15);
  for (var i = 0; i < 90; i++) {
    var h1 = hash2(i, 61),
      h2 = hash2(i, 67);
    var ang = t * (0.42 + 0.12 * h1) + i * 2.39996;
    var r = 0.05 + 0.13 * Math.sqrt(h2);
    var fx = scx + Math.cos(ang) * r * 1.7;
    var fy = scy + Math.sin(ang) * r * 0.5 + 0.015 * Math.sin(t * 0.8 + i);
    if (fy < top - 0.05 || fy > bot + 0.05) continue;
    var dir = -Math.sin(ang) >= 0 ? 1 : -1;
    var lit = 0.55 + 0.45 * Math.max(0, Math.sin(ang * 2 + t)); // flashes as they turn
    put(fx, fy, lit > 0.85 ? C.foam : C.cyan, lit, cy);
    put(fx - dir * CW, fy, C.cyan, lit * 0.6, cy);
    put(fx - dir * CW * 2, fy, C.teal, 0.35, cy);
  }

  // small orange fish over the reef
  var rcx = A * 0.55,
    rcy = FLOOR - 0.2;
  for (var j = 0; j < 16; j++) {
    var a2 = t * 0.6 + j * 1.3;
    var fx2 = rcx + 0.09 * Math.sin(a2 * 0.7 + j) + 0.03 * Math.cos(a2 * 1.3);
    var fy2 = rcy + 0.05 * Math.sin(a2 * 0.5 + j * 2.1);
    var d2 = Math.cos(a2 * 0.7 + j) >= 0 ? 1 : -1;
    put(fx2, fy2, j % 3 ? C.amber : C.coral, 0.85, cy);
    put(fx2 - d2 * CW, fy2, C.ember, 0.5, cy);
  }

  // jellyfish
  var J = [
    [A * 0.62, GROUND + 0.32, 1.25, 0.0, C.pink],
    [-A * 0.62, GROUND + 0.62, 0.8, 1.9, C.violet],
    [A * 0.05, GROUND + 0.86, 0.95, 3.1, C.pink],
  ];
  for (var m = 0; m < J.length; m++) {
    var jx = J[m][0] + 0.02 * Math.sin(t * 0.21 + m),
      jy = J[m][1] + 0.025 * Math.sin(t * 0.33 + m * 2),
      sc = J[m][2];
    if (jy + 0.3 * sc < top || jy - 0.06 * sc > bot) continue;
    var pulse = Math.sin(t * 1.9 + J[m][3]);
    var rx = 0.05 * sc * (1 + 0.09 * pulse),
      ry = 0.042 * sc * (1 - 0.07 * pulse);
    var col = J[m][4];
    for (var yy = -ry; yy <= ry * 0.18; yy += CW) {
      for (var xx = -rx; xx <= rx; xx += CW) {
        var ee = (xx / rx) * (xx / rx) + (yy / ry) * (yy / ry);
        if (ee > 1) continue;
        var rimv = ee > 0.62 || yy > ry * 0.05;
        var rib = Math.abs(Math.sin(Math.atan2(yy, xx) * 4)) > 0.92;
        put(
          jx + xx,
          jy + yy,
          rimv ? col : rib ? C.cream : C.violet,
          rimv ? 0.95 : rib ? 0.6 : 0.34 + 0.25 * (1 - ee),
          cy,
        );
      }
    }
    var len = 0.2 * sc;
    for (var tn = 0; tn < 7; tn++) {
      var tx0 = (tn / 6 - 0.5) * rx * 1.7;
      var oral = tn === 2 || tn === 4;
      for (var sy = 0; sy < len * (oral ? 0.75 : 1); sy += CW) {
        var ff = sy / len;
        var wob = (0.012 + 0.015 * ff) * Math.sin(t * 1.4 + sy * 38 + tn * 1.3);
        put(
          jx + tx0 + wob,
          jy + ry * 0.18 + sy,
          oral ? col : C.violet,
          (oral ? 0.75 : 0.5) * (1 - ff * 0.8),
          cy,
        );
        if (oral)
          put(
            jx + tx0 + wob + CW,
            jy + ry * 0.18 + sy,
            col,
            0.45 * (1 - ff),
            cy,
          );
      }
    }
  }

  // bubbles from the reef
  for (var b = 0; b < 10; b++) {
    var bx = -A + (b + 0.5) * ((2 * A) / 10) + 0.03 * hash2(b, 91);
    var per = 1.1;
    var by = FLOOR - 0.08 - ((t * 0.045 + hash2(b, 93) * per) % per);
    put(bx + 0.006 * Math.sin(t * 2 + by * 40), by, C.foam, 0.55, cy);
  }
}

// ---------- calm zones under free text ----------
// Rects are cached in document coordinates, so a frame never reads layout.
var calmEls = [];
var calmRects = [];
var range = document.createRange();
var frozenShift = 0;
function collect() {
  calmEls = Array.prototype.slice.call(
    document.querySelectorAll('[data-calm]'),
  );
}
function stampRect(left, top, right, bottom, pad, rmp) {
  var x0 = left - pad - rmp,
    x1 = right + pad + rmp,
    y0 = top - pad - rmp,
    y1 = bottom + pad + rmp;
  if (x1 < 0 || y1 < 0 || x0 > W || y0 > H) return;
  var c0 = Math.max(0, Math.floor(x0 / CELL)),
    c1 = Math.min(COLS - 1, Math.ceil(x1 / CELL));
  var r0 = Math.max(0, Math.floor(y0 / CELL)),
    r1 = Math.min(ROWS - 1, Math.ceil(y1 / CELL));
  for (var iy = r0; iy <= r1; iy++) {
    var py = (iy + 0.5) * CELL;
    var dy = Math.max(top - pad - py, 0, py - bottom - pad);
    for (var ix = c0; ix <= c1; ix++) {
      var px = (ix + 0.5) * CELL;
      var dx = Math.max(left - pad - px, 0, px - right - pad);
      var m = sstep(0, rmp, Math.sqrt(dx * dx + dy * dy));
      var i = iy * COLS + ix;
      if (m < mask[i]) mask[i] = m;
    }
  }
}
function buildMask(scrollY) {
  mask.fill(1);
  for (var k = 0; k < calmRects.length; k++) {
    var r = calmRects[k];
    stampRect(r[0], r[1] - scrollY, r[2], r[3] - scrollY, 10, 90);
  }
}

// ---------- camera: scroll -> depth ----------
var pageEl = document.getElementById('page');
var camera = function () {
  return CY_TOP;
};
var docH = 0;
function docTop(el, off) {
  return el.getBoundingClientRect().top + off;
}
function measure() {
  var off = window.scrollY + frozenShift;
  calmRects = [];
  for (var e = 0; e < calmEls.length; e++) {
    range.selectNodeContents(calmEls[e]);
    var rs = range.getClientRects();
    for (var j = 0; j < rs.length; j++)
      calmRects.push([
        rs[j].left,
        rs[j].top + off,
        rs[j].right,
        rs[j].bottom + off,
      ]);
  }
  docH = pageEl.offsetHeight;
  var maxY = Math.max(1, docH - H);
  var hero = document.querySelector('.hero'),
    work = document.getElementById('work'),
    now = document.querySelector('.now-section');
  var wTop = docTop(work, off),
    wEnd = wTop + work.offsetHeight,
    nTop = docTop(now, off);
  camera = makeCamera(
    buildAnchors(
      [
        [0, CY_TOP],
        [hero.offsetHeight * 0.3, CY_TOP + 0.1],
        [wTop - H * 0.05, W < 600 ? 2.22 : 2.1],
        [wEnd - H * 1.05, W < 600 ? 2.46 : 2.34],
        [nTop - H * 0.5, 2.62],
        [maxY, CY_BOT],
      ],
      maxY,
    ),
  );
}

// ---------- gauge ----------
var gaugeEl = document.getElementById('gauge'),
  scaleEl = document.querySelector('.gauge-scale');
var gaugeTxt = '',
  gaugePos = '';
function gauge(cy) {
  var txt = depthLabel(cy, GROUND);
  if (txt !== gaugeTxt) {
    gaugeEl.textContent = txt;
    gaugeTxt = txt;
  }
  var pos = '0 ' + (-(cy * 180) % 8).toFixed(1) + 'px';
  if (pos !== gaugePos) {
    scaleEl.style.backgroundPosition = pos;
    gaugePos = pos;
  }
}

// ---------- render ----------
var buckets = [];
for (var bi = 0; bi < NC * LV; bi++) buckets.push([]);
function render(t, scrollY) {
  var cy = camera(scrollY);
  for (var iy = 0; iy < ROWS; iy++) {
    var wy = cy - 0.5 + (iy + 0.5) * CW;
    for (var ix = 0; ix < COLS; ix++) {
      var wx = -A + (ix + 0.5) * CW;
      sample(wx, wy, ix, iy, t, BAYER[(iy & 3) * 4 + (ix & 3)]);
      var i = iy * COLS + ix;
      ci[i] = oc;
      vv[i] = ov;
    }
  }
  sprites(t, cy);
  buildMask(scrollY);
  for (var b = 0; b < buckets.length; b++) buckets[b].length = 0;
  for (var k = 0; k < N; k++) {
    var cap = 0.07 + 0.93 * mask[k];
    var v = vv[k] < cap ? vv[k] : cap;
    if (v < 0.035) continue;
    if (v > 1) v = 1;
    var lv = Math.min(LV - 1, Math.floor(v * LV));
    buckets[ci[k] * LV + lv].push(k);
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#0a0b0e';
  ctx.fillRect(0, 0, W, H);
  for (b = 0; b < buckets.length; b++) {
    var arr = buckets[b];
    if (!arr.length) continue;
    var lvl = b % LV;
    var sz = CELL * (0.26 + 0.6 * ((lvl + 0.5) / LV));
    if (lvl === LV - 1) sz = CELL * 0.9;
    var off = (CELL - sz) / 2;
    ctx.fillStyle = STYLES[b];
    for (var a = 0; a < arr.length; a++) {
      var idx = arr[a];
      ctx.fillRect(
        (idx % COLS) * CELL + off,
        ((idx / COLS) | 0) * CELL + off,
        sz,
        sz,
      );
    }
  }
  gauge(cy);
}

// ---------- boot ----------
var FRAME_MS = 1000 / 30;
function scrollPos() {
  if (FROZEN) return P_FIX * Math.max(0, docH - H);
  return window.scrollY;
}
function freeze() {
  document.documentElement.classList.add('frozen');
  pageEl.style.transform = 'translateY(0px)';
  frozenShift = 0;
  measure();
  frozenShift = scrollPos();
  pageEl.style.transform = 'translateY(' + (-frozenShift).toFixed(1) + 'px)';
  render(T_FIX, frozenShift);
}

function start() {
  setup();
  collect();
  if (FROZEN) {
    freeze();
    window.addEventListener('load', freeze);
    return;
  }
  measure();

  if (REDUCED) {
    // One still frame; redraw only once scrolling settles, never animate.
    var settle = 0;
    var still = function () {
      render(0, scrollPos());
    };
    still();
    window.addEventListener(
      'scroll',
      function () {
        clearTimeout(settle);
        settle = setTimeout(still, 180);
      },
      { passive: true },
    );
    window.addEventListener('resize', function () {
      setup();
      measure();
      still();
    });
    window.addEventListener('load', function () {
      measure();
      still();
    });
    new ResizeObserver(function () {
      measure();
      still();
    }).observe(pageEl);
    return;
  }

  var t0 = performance.now(),
    raf = 0,
    lastDraw = -Infinity;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - lastDraw < FRAME_MS - 1) return;
    lastDraw = now;
    render(Math.floor(((now - t0) / 1000) * 30) / 30, scrollPos());
  }
  function play() {
    if (!raf) {
      lastDraw = -Infinity;
      raf = requestAnimationFrame(frame);
    }
  }
  function pause() {
    cancelAnimationFrame(raf);
    raf = 0;
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pause();
    else play();
  });
  window.addEventListener('resize', function () {
    setup();
    measure();
  });
  window.addEventListener('load', measure);
  new ResizeObserver(measure).observe(pageEl);
  if (!document.hidden) play();
}

if (cv && pageEl) start();
