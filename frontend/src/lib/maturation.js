// ═══════════════════════════════════════════════════════════════════════
// MATURATION — Mirwald et al. (2002) maturity-offset estimate
// Years from peak height velocity (PHV) from anthropometrics.
//
// ⚠️  THIS IS AN ESTIMATE, NOT A MEASUREMENT.
//   - Standard error ≈ ±0.5 yr (0.592 boys, 0.569 girls).
//   - Derived on White European youth; regresses toward the mean and loses
//     accuracy at the maturity extremes and at older ages.
//   - Always present WITH its uncertainty band; never as precise biological
//     truth. Use status (pre/circa/post-PHV) to inform training, not to label.
//
// Inputs: sex ('M'|'F'), decimal age (yr), standing height (cm),
//         sitting height (cm), body mass (kg).
// ═══════════════════════════════════════════════════════════════════════

export function decimalAge(dob, at = new Date()) {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d)) return null
  return (at.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000)
}

export function maturityOffsetMirwald({ sex, ageYears, heightCm, sittingHeightCm, weightKg }) {
  const age = Number(ageYears)
  const H = Number(heightCm)
  const SH = Number(sittingHeightCm)
  const W = Number(weightKg)
  if (![age, H, SH, W].every(Number.isFinite)) return null
  if (SH <= 0 || H <= 0 || W <= 0 || SH >= H) return null   // sitting height must be < standing height

  const legLength = H - SH
  const whRatio = (W / H) * 100
  const isFemale = String(sex || '').toUpperCase().startsWith('F')

  let offset, se
  if (isFemale) {
    offset = -9.376
      + 0.0001882 * (legLength * SH)
      + 0.0022 * (age * legLength)
      + 0.005841 * (age * SH)
      - 0.002658 * (age * W)
      + 0.07693 * whRatio
    se = 0.569
  } else {
    offset = -9.236
      + 0.0002708 * (legLength * SH)
      - 0.001663 * (age * legLength)
      + 0.007216 * (age * SH)
      + 0.02292 * whRatio
    se = 0.592
  }

  const ageAtPHV = age - offset
  let status
  if (offset < -1) status = 'pre-PHV'
  else if (offset > 1) status = 'post-PHV'
  else status = 'circa-PHV'

  return {
    offset: Math.round(offset * 100) / 100,      // years from PHV (negative = before PHV)
    age_at_phv: Math.round(ageAtPHV * 100) / 100,
    status,                                       // 'pre-PHV' | 'circa-PHV' | 'post-PHV'
    std_error_years: se,                          // ± standard error
    method: 'Mirwald 2002 (estimate, ±~0.5yr)',
  }
}

// Convenience: compute maturity from a profile-shaped object, or null if data
// is incomplete (graceful degradation — guidance falls back to age-based).
export function maturityFromProfile({ sex, dob, heightCm, sittingHeightCm, weightKg }) {
  const ageYears = decimalAge(dob)
  if (ageYears == null) return null
  return maturityOffsetMirwald({ sex, ageYears, heightCm, sittingHeightCm, weightKg })
}
