/* Deterministic risk engine — mirrors tra-webapp/client/src/lib/risk.ts.
   Isomorphic: attaches to window (webviews) and module.exports (Node tests).
   Risk = Likelihood x Impact (5x5), banded Low/Medium/High/Critical. */
(function (g) {
  "use strict";
  var DEFAULT_BANDS = [
    { name: "Low", min: 1, max: 5, color: "#2e7d32" },
    { name: "Medium", min: 6, max: 11, color: "#f9a825" },
    { name: "High", min: 12, max: 19, color: "#ef6c00" },
    { name: "Critical", min: 20, max: 25, color: "#c62828" },
  ];
  function bandsOf(scheme) {
    return scheme && scheme.matrix && scheme.matrix.bands && scheme.matrix.bands.length ? scheme.matrix.bands : DEFAULT_BANDS;
  }
  function band(score, scheme) {
    var bands = bandsOf(scheme);
    return bands.find(function (b) { return score >= b.min && score <= b.max; }) || bands[0];
  }

  /* Residual [likelihood, impact] across all countermeasure links.
     Pick the SINGLE most-protective control (lowest residual product). Never combine the best
     likelihood from one control with the best impact from another (Mauw & Oostdijk 2005;
     ISO/IEC 27005 residual semantics) — that yields a residual no single control achieves. */
  function residual(threat, cms) {
    var links = [];
    (cms || []).forEach(function (c) {
      (c.addresses || []).forEach(function (a) { if (a.threat === threat.id) links.push(a); });
    });
    if (!links.length) return [threat.likelihood, threat.impact];
    var best = [threat.likelihood, threat.impact];
    var bestScore = Infinity;
    links.forEach(function (a) {
      var rl = a.residualLikelihood == null ? threat.likelihood : a.residualLikelihood;
      var ri = a.residualImpact == null ? threat.impact : a.residualImpact;
      var s = (rl || 0) * (ri || 0);
      if (s < bestScore) { bestScore = s; best = [rl, ri]; }
    });
    return best;
  }

  function riskOf(threat, cms, scheme) {
    var initial = (threat.likelihood || 0) * (threat.impact || 0);
    var r = residual(threat, cms);
    var res = (r[0] || 0) * (r[1] || 0);
    return {
      initial: initial,
      initialBand: band(initial, scheme),
      residual: res,
      residualBand: band(res, scheme),
      residualLikelihood: r[0],
      residualImpact: r[1],
    };
  }

  /* Bug Bar: impact is the worst plausible dimension (max of C/I/A/Safety). */
  function deriveImpact(d) {
    if (!d) return null;
    var vals = [d.confidentiality, d.integrity, d.availability, d.safety].filter(function (x) { return typeof x === "number"; });
    return vals.length ? Math.max.apply(null, vals) : null;
  }

  /* Likelihood = geometric mean of Exposure x Exploitability, remapped to the 1-5 axis
     (P11 interview finding: a single coarse likelihood is insufficient). */
  function deriveLikelihood(f) {
    if (!f) return null;
    var has = typeof f.exposure === "number" || typeof f.exploitability === "number";
    if (!has) return null;
    var e = typeof f.exposure === "number" ? f.exposure : 3;
    var x = typeof f.exploitability === "number" ? f.exploitability : 3;
    return Math.min(5, Math.max(1, Math.round(Math.sqrt(e * x))));
  }

  function bandClass(name) { return String(name || "").toLowerCase(); }

  var api = { DEFAULT_BANDS: DEFAULT_BANDS, bandsOf: bandsOf, band: band, residual: residual, riskOf: riskOf, deriveImpact: deriveImpact, deriveLikelihood: deriveLikelihood, bandClass: bandClass };
  g.RiskModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
