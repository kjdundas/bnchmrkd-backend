// ═══════════════════════════════════════════════════════════════════════
// VALUE FLYWHEEL — landing hero figure. One animated loop that says what
// bnchmrkd does for athletes, coaches and parents: measure what matters,
// understand where you stand vs global standards, improve with experts or
// your coach. Pure CSS animation (transforms/opacity) — no deps.
// ═══════════════════════════════════════════════════════════════════════
import { Activity, Crosshair, Dumbbell, Footprints, ClipboardList, HeartHandshake } from 'lucide-react'

export default function ValueFlywheel() {
  return (
    <section className="vf-wrap">
      <style>{CSS}</style>

      <div className="vf-head">
        <p className="vf-eyebrow">For athletes, coaches &amp; parents</p>
        <h2 className="vf-title">One athlete. <span>The whole picture.</span></h2>
        <p className="vf-sub">
          Measure what matters for your sport, see exactly where you stand against global
          age- and sex-graded standards, then improve with a plan — from our expert agents
          or your own coach.
        </p>
      </div>

      <div className="vf-stage">
        <div className="vf-halo" aria-hidden="true" />
        <div className="vf-fly" aria-hidden="true">
          <div className="vf-sweep" />
          <div className="vf-ring" />
          <div className="vf-ring vf-ring2" />
          <span className="vf-ping" />
          <span className="vf-ping vf-ping2" />
          <span className="vf-ping vf-ping3" />
          <div className="vf-core" />
          <div className="vf-orbit"><span className="vf-comet" /></div>
          <div className="vf-orbit vf-orbit-b"><span className="vf-comet vf-comet-b" /></div>

          <div className="vf-node vf-n1">
            <span className="vf-ico" style={{ background: 'rgba(56,189,248,0.14)', color: '#38bdf8', boxShadow: '0 0 22px rgba(56,189,248,0.25)' }}><Activity size={20} /></span>
            <span className="vf-nl">Measure</span>
            <span className="vf-ns">what matters in your sport</span>
          </div>
          <div className="vf-node vf-n2">
            <span className="vf-ico" style={{ background: 'rgba(251,146,60,0.16)', color: '#fb923c', boxShadow: '0 0 22px rgba(249,115,22,0.3)' }}><Crosshair size={20} /></span>
            <span className="vf-nl">Understand</span>
            <span className="vf-ns">vs world age &amp; sex standards</span>
          </div>
          <div className="vf-node vf-n3">
            <span className="vf-ico" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', boxShadow: '0 0 22px rgba(52,211,153,0.25)' }}><Dumbbell size={20} /></span>
            <span className="vf-nl">Improve</span>
            <span className="vf-ns">expert agents or your coach</span>
          </div>
        </div>
      </div>

      <div className="vf-personas">
        <div className="vf-p">
          <span className="vf-pic" style={{ color: '#38bdf8', background: 'rgba(56,189,248,0.1)' }}><Footprints size={20} /></span>
          <div>
            <div className="vf-pn">Athletes</div>
            <div className="vf-psub">Learn and develop for your sport — with the metrics and plan that move you forward.</div>
          </div>
        </div>
        <div className="vf-p">
          <span className="vf-pic" style={{ color: '#fb923c', background: 'rgba(249,115,22,0.1)' }}><ClipboardList size={20} /></span>
          <div>
            <div className="vf-pn">Coaches</div>
            <div className="vf-psub">Track, manage, program and prompt — your whole squad in one place.</div>
          </div>
        </div>
        <div className="vf-p">
          <span className="vf-pic" style={{ color: '#34d399', background: 'rgba(52,211,153,0.1)' }}><HeartHandshake size={20} /></span>
          <div>
            <div className="vf-pn">Parents</div>
            <div className="vf-psub">Trust experts in long-term athletic development watching over their progress.</div>
          </div>
        </div>
      </div>
    </section>
  )
}

const CSS = `
.vf-wrap{max-width:1000px;margin:0 auto;padding:8px 20px 12px;text-align:center;font-family:'Inter','Helvetica Neue',sans-serif}
.vf-eyebrow{margin:0 0 10px;font-size:12px;letter-spacing:2.5px;text-transform:uppercase;color:#fb923c;font-weight:600}
.vf-title{margin:0;font-size:clamp(28px,5vw,46px);font-weight:800;letter-spacing:-.5px;color:#f8fafc;line-height:1.05}
.vf-title span{background:linear-gradient(135deg,#f97316,#fb923c,#fbbf24);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.vf-sub{margin:16px auto 0;max-width:620px;font-size:clamp(14px,1.7vw,17px);line-height:1.6;color:#94a3b8}

.vf-stage{position:relative;height:420px;display:flex;align-items:center;justify-content:center;margin:8px 0 4px}
.vf-halo{position:absolute;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(249,115,22,0.18) 0%,rgba(249,115,22,0.05) 40%,transparent 66%);filter:blur(18px);animation:vf-breathe 6s ease-in-out infinite}
.vf-fly{position:relative;width:360px;height:360px;animation:vf-float 9s ease-in-out infinite}

.vf-sweep{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,rgba(249,115,22,0) 0%,rgba(251,191,36,0.22) 9%,rgba(249,115,22,0) 20%);-webkit-mask:radial-gradient(circle,transparent 56%,#000 58%,#000 80%,transparent 82%);mask:radial-gradient(circle,transparent 56%,#000 58%,#000 80%,transparent 82%);animation:vf-spin 7s linear infinite}
.vf-ring{position:absolute;inset:40px;border-radius:50%;border:1.5px dashed rgba(249,115,22,0.28);animation:vf-spin 26s linear infinite}
.vf-ring2{inset:18px;border-style:solid;border-color:rgba(255,255,255,0.05);animation-duration:40s;animation-direction:reverse}

.vf-core{position:absolute;left:50%;top:50%;width:104px;height:104px;margin:-52px 0 0 -52px;border-radius:50%;background:radial-gradient(circle at 38% 30%,#ffe2b8,#fb923c 44%,#b1370a 82%);box-shadow:0 0 46px 8px rgba(249,115,22,0.5),inset 0 0 22px rgba(255,255,255,0.25);animation:vf-breathe 3.6s ease-in-out infinite}
.vf-ping{position:absolute;left:50%;top:50%;width:104px;height:104px;margin:-52px 0 0 -52px;border-radius:50%;border:1.5px solid rgba(249,115,22,0.5);animation:vf-ping 3.6s ease-out infinite}
.vf-ping2{animation-delay:1.2s}
.vf-ping3{animation-delay:2.4s}

.vf-orbit{position:absolute;left:50%;top:50%;width:0;height:0;animation:vf-spin 5.5s linear infinite}
.vf-orbit-b{animation-duration:8s;animation-direction:reverse}
.vf-comet{position:absolute;left:-8px;top:-8px;width:16px;height:16px;border-radius:50%;background:radial-gradient(circle,#fff7e6,#fbbf24 60%,rgba(251,191,36,0) 72%);box-shadow:0 0 20px 6px rgba(251,191,36,0.8);transform:translateY(-140px)}
.vf-comet-b{width:10px;height:10px;left:-5px;top:-5px;background:radial-gradient(circle,#ffe9c2,#fb923c 60%,rgba(249,115,22,0) 74%);box-shadow:0 0 16px 4px rgba(249,115,22,0.6);transform:translateY(-140px)}

.vf-node{position:absolute;left:50%;top:50%;width:128px;margin:-34px 0 0 -64px;display:flex;flex-direction:column;align-items:center;text-align:center;animation:vf-nodepulse 3.6s ease-in-out infinite}
.vf-n1{transform:translateY(-150px)}
.vf-n2{transform:translate(-130px,78px);animation-delay:1.2s}
.vf-n3{transform:translate(130px,78px);animation-delay:2.4s}
.vf-ico{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:7px;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.08)}
.vf-nl{font-size:14px;font-weight:700;color:#e7ecf3}
.vf-ns{font-size:11.5px;color:#94a3b8;line-height:1.3;margin-top:1px}

.vf-personas{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:880px;margin:18px auto 0}
.vf-p{display:flex;align-items:flex-start;gap:11px;text-align:left;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06)}
.vf-pic{width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.vf-pn{font-size:14px;font-weight:700;color:#f1f5f9;margin-bottom:2px}
.vf-psub{font-size:12.5px;line-height:1.45;color:#94a3b8}

@keyframes vf-spin{to{transform:rotate(360deg)}}
@keyframes vf-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes vf-breathe{0%,100%{transform:scale(1);opacity:.92}50%{transform:scale(1.06);opacity:1}}
@keyframes vf-ping{0%{transform:scale(.62);opacity:.65}100%{transform:scale(2.9);opacity:0}}
.vf-n1{--vt:translateY(-150px)}.vf-n2{--vt:translate(-130px,78px)}.vf-n3{--vt:translate(130px,78px)}
@keyframes vf-nodepulse{0%,100%{opacity:.66;transform:var(--vt) scale(1)}45%{opacity:1;transform:var(--vt) scale(1.04)}}

@media (max-width:760px){
  .vf-stage{height:340px}
  .vf-fly{transform:scale(.82)}
  .vf-personas{grid-template-columns:1fr;max-width:420px}
}
@media (prefers-reduced-motion:reduce){
  .vf-sweep,.vf-ring,.vf-orbit,.vf-ping,.vf-core,.vf-halo,.vf-fly,.vf-node{animation:none!important}
}
`
