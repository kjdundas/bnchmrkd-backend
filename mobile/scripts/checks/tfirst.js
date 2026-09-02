// Proves the Get started card stands down for a step the page already offers,
// and that it still shows one that no other control covers.
const fs=require('fs'), path=require('path')
// Self-locating so it runs from anywhere:  node scripts/checks/tfirst.js
const MOBILE=path.resolve(__dirname,'..','..')
const ts=require(path.join(MOBILE,'node_modules','typescript'))
const src=fs.readFileSync(path.join(MOBILE,'src','lib','firstRun.ts'),'utf8')
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText
const m={exports:{}}; new Function('exports','module','require',js)(m.exports,m,require)
const {athleteSteps,nextStep,shouldShowSetup,progress}=m.exports

let fail=0
const is=(got,want,what)=>{ const ok=JSON.stringify(got)===JSON.stringify(want)
  console.log(`${ok?'  ok  ':'  FAIL'} ${what}${ok?'':`  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`); if(!ok)fail++ }

// An athlete with an event and a result, but no check-in and no coach.
const s=athleteSteps({hasEvent:true,hasResult:true,hasCheckin:false,hasCoach:false})

is(nextStep(s)?.id,'checkin','with nothing offered, the check-in is next')
is(nextStep(s,['checkin'])?.id,'coach','Home offers the check-in, so the card moves to the coach step')
is(shouldShowSetup(s,false,['checkin']),true,'card still shows — the coach step is not offered anywhere')

// Now the only thing left is the one Home already has a row for.
const t=athleteSteps({hasEvent:true,hasResult:true,hasCheckin:false,hasCoach:true})
is(nextStep(t,['checkin']),null,'nothing left the card can add')
is(shouldShowSetup(t,false,['checkin']),false,'so the card disappears rather than duplicating the row')
is(shouldShowSetup(t,false,[]),true,'and would still show if Home had no check-in row')

// The step is skipped for the CARD, not for the person.
is(progress(t),{done:3,total:4},'the outstanding check-in still counts in progress')

// The load-bearing step is never skipped away.
const u=athleteSteps({hasEvent:false,hasResult:false,hasCheckin:false,hasCoach:false})
is(nextStep(u,['checkin','result','coach'])?.id,'event','the event step survives every exclusion')
is(shouldShowSetup(u,true,['checkin']),true,'and shows even when the card was dismissed')

console.log(fail?`\n${fail} FAILED`:'\nall passed')
process.exit(fail?1:0)
