// ═══════════════════════════════════════════════════════════════════
// pdfExport.js — One-page PDF report generator for Quick Analysis
// Uses jsPDF to produce a clean, printable A4 page on white background
// with bnchmrkd branding in the top-left corner.
// ═══════════════════════════════════════════════════════════════════
import { jsPDF } from 'jspdf';
import { getAgeGroup, isTimeDiscipline } from './performanceLevels';
import { getTier, TIER_NAMES, buildMatrix, AGE_GROUPS } from './performanceTiers';
import { isLowerBetter } from './disciplineScience';

// ── Brand colours (dark variants for print) ──────────────────────
const ORANGE = '#ea580c';
const DARK   = '#1e293b';
const MID    = '#64748b';
const LIGHT  = '#94a3b8';
const LINE   = '#e2e8f0';

// ── Orange tier opacities for matrix cells (print-friendly) ──────
const TIER_PRINT_BG = {
  1: '#fef3e2', 2: '#fde9c8', 3: '#fddcab',
  4: '#fcc984', 5: '#fbb460', 6: '#fa9f3e', 7: '#f97316',
};

// ── Helpers ──────────────────────────────────────────────────────
const isTime = (disc) => isLowerBetter(disc);

function formatPB(val, discipline) {
  if (discipline === 'Marathon') {
    const h = Math.floor(val / 3600);
    const m = Math.floor((val % 3600) / 60);
    const s = Math.round(val % 60);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  if (['800m', '1500m', '3000m', '5000m', '10000m', '3000m Steeplechase'].some(d => discipline.includes(d)) && val >= 60) {
    const m = Math.floor(val / 60);
    const s = (val % 60).toFixed(2);
    return `${m}:${parseFloat(s) < 10 ? '0' : ''}${s}`;
  }
  return Number(val).toFixed(2);
}

function formatThreshold(value, discipline) {
  if (value == null) return '—';
  if (!isTimeDiscipline(discipline)) return `${value.toFixed(2)}`;
  if (discipline === 'Marathon' || value >= 3600) {
    const hrs = Math.floor(value / 3600);
    const mins = Math.floor((value - hrs * 3600) / 60);
    const secs = Math.round(value - hrs * 3600 - mins * 60);
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  if (['800m', '1500m', '3000m', '5000m', '10000m'].includes(discipline)) {
    const mins = Math.floor(value / 60);
    const secs = (value - mins * 60).toFixed(1).padStart(4, '0');
    return `${mins}:${secs}`;
  }
  return `${value.toFixed(2)}`;
}

function tierColor(tier) {
  const colors = {
    1: '#92400e', 2: '#a8520f', 3: '#b45309',
    4: '#c2410c', 5: '#dc2626', 6: '#ea580c', 7: '#f97316',
  };
  return colors[tier] || MID;
}

// ── Text-based logo ──────────────────────────────────────────────
function drawLogo(doc, x, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(DARK);
  doc.text('bnchmrkd', x, y);
  doc.setTextColor(ORANGE);
  doc.text('.', x + doc.getTextWidth('bnchmrkd'), y);
}

// ── Rounded rect helper ──────────────────────────────────────────
function roundedRect(doc, x, y, w, h, r, fillColor, borderColor) {
  if (fillColor) {
    doc.setFillColor(fillColor);
    doc.roundedRect(x, y, w, h, r, r, 'F');
  }
  if (borderColor) {
    doc.setDrawColor(borderColor);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, r, r, 'S');
  }
}

// ── Main export function ─────────────────────────────────────────
export function exportQuickAnalysisPDF(analysisResults, options = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = 210; // page width mm
  const ph = 297; // page height mm
  const mx = 15;  // margin x
  const mw = pw - 2 * mx; // content width
  let y = 15; // cursor

  // ── White background (default) ──
  doc.setFillColor('#ffffff');
  doc.rect(0, 0, pw, ph, 'F');

  // ── Header: logo + date ──
  drawLogo(doc, mx, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(LIGHT);
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(dateStr, pw - mx, y + 5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Quick Analysis Report', pw - mx, y + 9, { align: 'right' });

  y += 14;

  // ── Thin orange divider ──
  doc.setDrawColor(ORANGE);
  doc.setLineWidth(0.6);
  doc.line(mx, y, pw - mx, y);
  y += 6;

  // ── Athlete info banner ──
  const name = analysisResults.name && analysisResults.name !== 'Quick Analysis' ? analysisResults.name : null;
  const pb = parseFloat(analysisResults.personalBest);
  const discipline = analysisResults.discipline;
  const gender = analysisResults.gender;
  const age = analysisResults.age;
  const ageGroup = getAgeGroup(age);
  const pbFormatted = formatPB(pb, discipline);
  const unit = isTime(discipline) ? 's' : 'm';

  if (name) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(DARK);
    doc.text(name, mx, y + 6);
    y += 10;
  }

  // PB big number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(ORANGE);
  doc.text(pbFormatted + (isTime(discipline) && !discipline.includes('Marathon') && !['800m', '1500m', '3000m', '5000m', '10000m'].some(d => discipline.includes(d) && pb >= 60) ? 's' : ''), mx, y + 10);

  // Discipline / Gender / Age beside PB
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MID);
  const infoLine = `${discipline}  ·  ${gender}  ·  Age ${age}  ·  ${ageGroup}`;
  doc.text(infoLine, mx, y + 17);

  if (analysisResults.implementWeight && !analysisResults.isSeniorWeight) {
    doc.setFontSize(8);
    doc.setTextColor('#7c3aed');
    const weightStr = analysisResults.implementWeight >= 1
      ? `${analysisResults.implementWeight}kg implement (Youth)`
      : `${Math.round(analysisResults.implementWeight * 1000)}g implement (Youth)`;
    doc.text(weightStr, mx, y + 22);
    y += 4;
  }

  y += 24;

  // ── 4-card snapshot grid ──
  const tierInfo = getTier(discipline, gender, ageGroup, pb);
  const currentTier = tierInfo?.tier || 0;
  const maxTier = tierInfo?.maxTier || (ageGroup === 'Senior' ? 7 : 6);
  const pct = Math.min(99, Math.max(1, analysisResults.percentileAtCurrentAge || 50));
  const topPct = Math.max(1, 100 - pct);
  const atMax = tierInfo && currentTier >= maxTier;
  const nextGap = tierInfo && tierInfo.gap != null
    ? `+${Math.abs(tierInfo.gap).toFixed(2)}${unit}`
    : null;

  const stds = analysisResults.standards || [];
  const cleared = stds.filter(s => s.met);

  const cardW = (mw - 6) / 4; // 4 cards with 2mm gaps
  const cardH = 28;
  const cardY = y;
  const cardGap = 2;

  const cards = [
    {
      title: `TIER · ${ageGroup}`,
      value: currentTier > 0 ? `T${currentTier}` : '—',
      sub: currentTier > 0 ? TIER_NAMES[currentTier] : 'Below Emerging',
      detail: `${currentTier} of ${maxTier}`,
      color: tierColor(currentTier),
    },
    {
      title: 'PEER RANK',
      value: `Top ${topPct}%`,
      sub: `of ${ageGroup} peers`,
      detail: `P${pct} at age ${age}`,
      color: pct >= 90 ? '#059669' : pct >= 75 ? '#2563eb' : pct >= 50 ? '#d97706' : MID,
    },
    {
      title: 'NEXT TIER',
      value: atMax ? 'Apex' : (nextGap || '—'),
      sub: atMax ? 'Top tier reached' : (tierInfo?.nextTier ? `to T${tierInfo.nextTier} · ${TIER_NAMES[tierInfo.nextTier]}` : ''),
      detail: atMax ? '' : (tierInfo?.nextCut ? `threshold ${tierInfo.nextCut.toFixed(2)}${unit}` : ''),
      color: atMax ? ORANGE : (tierInfo?.nextTier ? tierColor(tierInfo.nextTier) : MID),
    },
    {
      title: 'MILESTONES',
      value: stds.length > 0 ? `${cleared.length}/${stds.length}` : '—',
      sub: cleared.length > 0 ? `${cleared.length} standard${cleared.length > 1 ? 's' : ''} cleared` : 'None cleared',
      detail: '',
      color: cleared.length > 0 ? '#059669' : MID,
    },
  ];

  cards.forEach((card, i) => {
    const cx = mx + i * (cardW + cardGap);
    roundedRect(doc, cx, cardY, cardW, cardH, 2, '#f8fafc', LINE);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(LIGHT);
    doc.text(card.title, cx + 3, cardY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(DARK);
    doc.text(card.value, cx + 3, cardY + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(card.color);
    doc.text(card.sub, cx + 3, cardY + 18);

    if (card.detail) {
      doc.setFontSize(6);
      doc.setTextColor(LIGHT);
      doc.text(card.detail, cx + 3, cardY + 23);
    }
  });

  y = cardY + cardH + 6;

  // ══════════════════════════════════════════════════════════════════
  // COMPETITION BENCHMARKS — stacked row bars per competition
  // ══════════════════════════════════════════════════════════════════
  const compData = analysisResults.competitionStandards;
  if (compData && compData.competitions && compData.competitions.length > 0) {
    const lowerBetter = isTime(discipline);
    const allComps = compData.competitions;

    // Select competitions: age-matched first, then top aspirational senior
    const ageMatched = allComps.filter(c => {
      const cAg = (c.ageGroup || '').toLowerCase();
      const athleteAg = ageGroup.toLowerCase();
      if (cAg === athleteAg) return true;
      if (age < 20 && (cAg === 'u18' || cAg === 'u20')) return true;
      if (age < 17 && cAg === 'u17') return true;
      return false;
    });
    const seniorAspi = allComps.filter(c => {
      const cAg = (c.ageGroup || '').toLowerCase();
      return cAg === 'senior' && (c.tier === 'world' || c.tier === 'regional');
    }).slice(0, 2);

    const seen = new Set();
    const selected = [];
    [...ageMatched, ...seniorAspi].forEach(c => {
      if (!seen.has(c.id) && selected.length < 5) {
        seen.add(c.id);
        selected.push(c);
      }
    });

    if (selected.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(DARK);
      doc.text('Competition Benchmarks', mx, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(LIGHT);
      doc.text(`Your PB (${pbFormatted}) vs key competition standards`, mx, y + 9);
      y += 13;

      // ── Determine shared scale across all competitions ──
      // Collect every mark + PB + WR to build a common range
      const allVals = [pb];
      if (compData.wr && compData.wr.mark != null) allVals.push(compData.wr.mark);
      selected.forEach(c => {
        if (c.gold != null) allVals.push(c.gold);
        if (c.bronze != null) allVals.push(c.bronze);
        const q = c.qual || c.p8;
        if (q != null) allVals.push(q);
      });
      const vMin = Math.min(...allVals);
      const vMax = Math.max(...allVals);
      const vSpan = vMax - vMin || 1;
      const pad = vSpan * 0.08;
      const rMin = vMin - pad;
      const rMax = vMax + pad;
      const rSpan = rMax - rMin;

      // Shared bar geometry
      const labelColW = 38;  // left column for comp name
      const gapColW = 28;    // right column for gap text
      const barLeft = mx + labelColW;
      const barRight = pw - mx - gapColW;
      const barW = barRight - barLeft;
      const rowH = 10;
      const barH = 4;

      // Map value → x position (better = right)
      const toX = (val) => {
        const norm = lowerBetter
          ? (rMax - val) / rSpan   // time: lower = better = right
          : (val - rMin) / rSpan;  // field: higher = better = right
        return barLeft + Math.max(0, Math.min(1, norm)) * barW;
      };

      // ── Draw each competition row ──
      selected.forEach((comp, idx) => {
        const rowY = y + idx * rowH;

        // Alternating background
        if (idx % 2 === 0) {
          doc.setFillColor('#f8fafc');
          doc.rect(mx, rowY, mw, rowH, 'F');
        }

        // Competition label (left)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(DARK);
        const shortLabel = comp.label.replace('Championships', 'Champs');
        doc.text(shortLabel, mx + 2, rowY + rowH / 2 + 1.5);

        // Tier tag
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(4);
        doc.setTextColor(LIGHT);
        const tierTag = comp.tier === 'world' ? 'World' : comp.tier === 'regional' ? 'Regional' : 'Dev';
        doc.text(tierTag, mx + 2, rowY + rowH / 2 + 4.5);

        // ── Inline bar track ──
        const trackY = rowY + (rowH - barH) / 2;
        doc.setFillColor('#e2e8f0');
        doc.roundedRect(barLeft, trackY, barW, barH, 1.5, 1.5, 'F');

        // Bronze → Gold filled zone (the "standard range")
        if (comp.gold != null && comp.bronze != null) {
          const gx = toX(comp.gold);
          const bx = toX(comp.bronze);
          const zoneLeft = Math.min(gx, bx);
          const zoneW = Math.abs(gx - bx);
          doc.setFillColor('#fde68a'); // warm yellow
          doc.roundedRect(zoneLeft, trackY + 0.5, zoneW, barH - 1, 1, 1, 'F');
        }

        // Qual / entry mark (small grey tick)
        const qualVal = comp.qual || comp.p8;
        if (qualVal != null) {
          const qx = toX(qualVal);
          doc.setDrawColor('#9ca3af');
          doc.setLineWidth(0.4);
          doc.line(qx, trackY, qx, trackY + barH);
        }

        // Bronze mark (dark tick)
        if (comp.bronze != null) {
          const bx = toX(comp.bronze);
          doc.setDrawColor('#92400e');
          doc.setLineWidth(0.6);
          doc.line(bx, trackY - 0.5, bx, trackY + barH + 0.5);
        }

        // Gold mark (gold tick)
        if (comp.gold != null) {
          const gx = toX(comp.gold);
          doc.setDrawColor('#d97706');
          doc.setLineWidth(0.8);
          doc.line(gx, trackY - 1, gx, trackY + barH + 1);
        }

        // PB marker (orange diamond on the track)
        const pbX = toX(pb);
        doc.setFillColor(ORANGE);
        const d = 2; // diamond half-size
        const cy = trackY + barH / 2;
        // Draw diamond as two triangles
        doc.triangle(pbX, cy - d, pbX + d, cy, pbX, cy + d, 'F');
        doc.triangle(pbX, cy - d, pbX - d, cy, pbX, cy + d, 'F');

        // ── Gap to gold (right column) ──
        if (comp.gold != null) {
          const gap = lowerBetter ? (pb - comp.gold) : (comp.gold - pb);
          const met = lowerBetter ? (pb <= comp.gold) : (pb >= comp.gold);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6);
          if (met) {
            doc.setTextColor('#059669');
            doc.text('Cleared', barRight + 4, rowY + rowH / 2 + 0.5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(4.5);
            doc.text('gold standard', barRight + 4, rowY + rowH / 2 + 3.5);
          } else {
            doc.setTextColor('#dc2626');
            const absGap = Math.abs(gap);
            doc.text(formatThreshold(absGap, discipline) + ' away', barRight + 4, rowY + rowH / 2 + 0.5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(4.5);
            doc.setTextColor(MID);
            doc.text('from gold', barRight + 4, rowY + rowH / 2 + 3.5);
          }
        }
      });

      y += selected.length * rowH + 2;

      // ── Legend row ──
      const legY = y;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.5);

      // PB diamond
      doc.setFillColor(ORANGE);
      const ld = 1.2;
      doc.triangle(mx + 2, legY - ld, mx + 2 + ld, legY, mx + 2, legY + ld, 'F');
      doc.triangle(mx + 2, legY - ld, mx + 2 - ld, legY, mx + 2, legY + ld, 'F');
      doc.setTextColor(MID);
      doc.text('Your PB', mx + 5, legY + 1);

      // Gold tick
      doc.setDrawColor('#d97706');
      doc.setLineWidth(0.8);
      doc.line(mx + 22, legY - 1.5, mx + 22, legY + 1.5);
      doc.text('Gold', mx + 24, legY + 1);

      // Bronze tick
      doc.setDrawColor('#92400e');
      doc.setLineWidth(0.6);
      doc.line(mx + 35, legY - 1.5, mx + 35, legY + 1.5);
      doc.text('Bronze', mx + 37, legY + 1);

      // Yellow zone
      doc.setFillColor('#fde68a');
      doc.roundedRect(mx + 51, legY - 1.5, 5, 3, 0.5, 0.5, 'F');
      doc.text('Medal zone', mx + 58, legY + 1);

      // Qual tick
      doc.setDrawColor('#9ca3af');
      doc.setLineWidth(0.4);
      doc.line(mx + 78, legY - 1.5, mx + 78, legY + 1.5);
      doc.text('Qual / Entry', mx + 80, legY + 1);

      y += 6;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // PERFORMANCE MATRIX — age group × tier grid with threshold values
  // ══════════════════════════════════════════════════════════════════
  const matrix = buildMatrix(discipline, gender);
  if (matrix && matrix.rows) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(DARK);
    doc.text('Performance Matrix', mx, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(LIGHT);
    doc.text(`${discipline} · ${gender} — Tier thresholds by age group`, mx, y + 9);
    y += 12;

    // Always show 7 columns (T7 = World Class is Senior-only, blank for juniors)
    const numTiers = 7;
    const rowH = 7;
    const labelW = 16;
    const cellW = (mw - labelW) / numTiers;

    // Header row: T1 T2 ... T7
    doc.setFillColor('#f1f5f9');
    doc.rect(mx, y, mw, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(MID);
    doc.text('Age', mx + 2, y + 4.5);
    for (let t = 0; t < numTiers; t++) {
      const tx = mx + labelW + t * cellW;
      doc.text(`T${t + 1}`, tx + cellW / 2, y + 4.5, { align: 'center' });
    }
    y += rowH;

    // Data rows
    matrix.rows.forEach((row) => {
      const isCurrentRow = row.ageGroup === ageGroup;
      const cuts = row.cuts || [];

      // Row background
      if (isCurrentRow) {
        doc.setFillColor('#fff7ed'); // light orange highlight
      } else {
        doc.setFillColor('#ffffff');
      }
      doc.rect(mx, y, mw, rowH, 'F');

      // Row border
      doc.setDrawColor('#f1f5f9');
      doc.setLineWidth(0.2);
      doc.line(mx, y + rowH, mx + mw, y + rowH);

      // Age group label
      doc.setFont('helvetica', isCurrentRow ? 'bold' : 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(isCurrentRow ? ORANGE : DARK);
      doc.text(row.ageGroup, mx + 2, y + 4.5);

      // Tier cells
      for (let t = 0; t < numTiers; t++) {
        const tx = mx + labelW + t * cellW;
        const val = cuts[t];

        // Cell background — orange wash for filled tiers
        if (val != null) {
          doc.setFillColor(TIER_PRINT_BG[t + 1] || '#fef3e2');
          doc.rect(tx + 0.3, y + 0.3, cellW - 0.6, rowH - 0.6, 'F');
        }

        // Highlight the athlete's current cell
        const isCurrent = isCurrentRow && currentTier === t + 1;
        if (isCurrent) {
          doc.setDrawColor(ORANGE);
          doc.setLineWidth(0.6);
          doc.rect(tx + 0.2, y + 0.2, cellW - 0.4, rowH - 0.4, 'S');
        }

        // Value text
        doc.setFont('helvetica', isCurrent ? 'bold' : 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(isCurrent ? ORANGE : (val != null ? DARK : '#cbd5e1'));
        const display = val != null ? formatThreshold(val, discipline) : '—';
        doc.text(display, tx + cellW / 2, y + 4.5, { align: 'center' });
      }

      y += rowH;
    });

    // Tier name labels below the matrix
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(LIGHT);
    const tierLabels = ['Emerging', 'Developing', 'National', 'Qualifier', 'Finalist', 'Medalist', 'World Class'];
    for (let t = 0; t < numTiers; t++) {
      const tx = mx + labelW + t * cellW;
      doc.text(tierLabels[t], tx + cellW / 2, y + 3.5, { align: 'center' });
    }
    y += 7;
  }

  // ══════════════════════════════════════════════════════════════════
  // IMPROVEMENT SCENARIOS — projected times at different annual rates
  // ══════════════════════════════════════════════════════════════════
  const scenarios = analysisResults.improvementScenarios;
  if (scenarios && scenarios.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(DARK);
    doc.text('Improvement Scenarios', mx, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(LIGHT);
    const projLabel = isTime(discipline) ? 'Projected times' : 'Projected distances';
    doc.text(`${projLabel} from ${formatPB(pb, discipline)} at different annual rates`, mx, y + 9);
    y += 12;

    // Get the age columns from the first row
    const ageKeys = scenarios[0] ? Object.keys(scenarios[0].times) : [];
    // Limit columns to fit the page (max ~8 age columns)
    const maxAgeCols = Math.min(ageKeys.length, 8);
    const shownAgeKeys = ageKeys.slice(0, maxAgeCols);

    const rowH = 6.5;
    const rateColW = 14;
    const ageColW = (mw - rateColW) / maxAgeCols;

    // Finalist / MQT thresholds for color coding
    const finalistThreshold = analysisResults.thresholds?.finalist;
    const mqt = analysisResults.championshipData?.mqt;
    const isField = !isTime(discipline);

    // Header row
    doc.setFillColor('#f1f5f9');
    doc.rect(mx, y, mw, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(MID);
    doc.text('Rate', mx + 2, y + 4.2);
    shownAgeKeys.forEach((ageKey, i) => {
      const ax = mx + rateColW + i * ageColW;
      const isCurrAge = parseInt(ageKey) === age;
      doc.setTextColor(isCurrAge ? ORANGE : MID);
      doc.text(`Age ${ageKey}`, ax + ageColW / 2, y + 4.2, { align: 'center' });
    });
    y += rowH;

    // Data rows
    scenarios.forEach((row, idx) => {
      // Check remaining space — stop if near footer
      if (y > 268) return;

      const isBaseRate = idx === 0;
      if (isBaseRate) {
        doc.setFillColor('#fff7ed');
      } else if (idx % 2 === 0) {
        doc.setFillColor('#fafafa');
      } else {
        doc.setFillColor('#ffffff');
      }
      doc.rect(mx, y, mw, rowH, 'F');

      // Border
      doc.setDrawColor('#f1f5f9');
      doc.setLineWidth(0.15);
      doc.line(mx, y + rowH, mx + mw, y + rowH);

      // Rate label
      doc.setFont('helvetica', isBaseRate ? 'bold' : 'normal');
      doc.setFontSize(6);
      doc.setTextColor(isBaseRate ? ORANGE : MID);
      doc.text(row.rate, mx + 2, y + 4.2);

      // Time values
      shownAgeKeys.forEach((ageKey, i) => {
        const ax = mx + rateColW + i * ageColW;
        const time = row.times[ageKey];
        const isCurrAge = parseInt(ageKey) === age;

        // Color coding
        const meetsFinalist = finalistThreshold != null && (isField ? time >= finalistThreshold : time <= finalistThreshold);
        const meetsMQT = mqt != null && (isField ? time >= mqt : time <= mqt);

        if (meetsFinalist) {
          doc.setTextColor('#059669');
          doc.setFont('helvetica', 'bold');
        } else if (meetsMQT) {
          doc.setTextColor('#2563eb');
          doc.setFont('helvetica', 'bold');
        } else if (isCurrAge) {
          doc.setTextColor(ORANGE);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setTextColor(DARK);
          doc.setFont('helvetica', 'normal');
        }

        doc.setFontSize(5.5);
        doc.text(formatPB(time, discipline), ax + ageColW / 2, y + 4.2, { align: 'center' });
      });

      y += rowH;
    });

    // Legend
    y += 1;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor('#059669');
    doc.text('Green = Finalist threshold', mx + 2, y + 3);
    doc.setTextColor('#2563eb');
    doc.text('Blue = Olympic MQT', mx + 42, y + 3);
    y += 5;
  }

  // ── Footer ──
  const fy = ph - 12;
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  doc.line(mx, fy - 2, pw - mx, fy - 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(LIGHT);
  doc.text('Generated by bnchmrkd. — bnchmrkd.com', mx, fy + 2);
  doc.text('This report is for informational purposes only.', mx, fy + 5.5);

  doc.setTextColor(ORANGE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('bnchmrkd.', pw - mx, fy + 2, { align: 'right' });

  // ── Save ──
  const filename = name
    ? `bnchmrkd_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${discipline}_report.pdf`
    : `bnchmrkd_${discipline}_${gender}_${age}_report.pdf`;
  doc.save(filename);
}
