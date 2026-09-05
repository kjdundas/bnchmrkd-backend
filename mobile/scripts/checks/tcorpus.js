// The corpus client is mostly a thin wrapper, and the thin parts are where
// a projection quietly starts lying. Three things are worth pinning:
// n must survive to the caller, a failed call must be an empty answer
// rather than a crash, and the confidence thresholds must not drift.
const fs=require('fs'), path=require('path')
const MOBILE=path.resolve(__dirname,'..','..')
const ts=require(path.join(MOBILE,'node_modules','typescript'))

const src=fs.readFileSync(path.join(MOBILE,'src','lib','corpus.ts'),'utf8')
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText

let lastArgs=null, reply=null, throwNext=false
const stub={'./supabase':{callRpc:async(fn,args)=>{lastArgs={fn,args}; if(throwNext) throw new Error('network'); return reply}}}
const m={exports:{}}
new Function('exports','module','require',js)(m.exports,m,(r)=>stub[r]||require(r))
const {similarAthletes,trajectoryBand,coverage,confidenceAt,CONFIDENCE_COPY,PROJECTION_DISCLAIMER,bandWidth}=m.exports

let fail=0
const ok=(c,w)=>{console.log(`${c?'  ok  ':'  FAIL'} ${w}`); if(!c)fail++}
const is=(g,w,what)=>ok(JSON.stringify(g)===JSON.stringify(w), `${what}${JSON.stringify(g)===JSON.stringify(w)?'':`  got ${JSON.stringify(g)}`}`)

;(async () => {
  // ── n survives ──
  reply=[{season_age:16,discipline_id:'100m',discipline:'100m',n:164,p25:'11.94',p50:'12.15',p75:'12.36'},
         {season_age:17,discipline_id:'100m',discipline:'100m',n:219,p25:'11.85',p50:'12.07',p75:'12.26'}]
  let b=await trajectoryBand({discipline:'100m',sex:'F',age:16,mark:12.10})
  is(b.map(x=>x.n),[164,219],'the sample size reaches the caller')
  is(b.map(x=>x.p50),[12.15,12.07],'numeric strings from postgres become numbers')
  ok(b[0].discipline==='100m','each point says which specification it is measured on')

  // ── the implement change is visible, not silent ──
  reply=[{season_age:16,discipline_id:'110m_hurdles_91_4cm',discipline:'110m Hurdles (91.4cm)',n:10,p25:'14.98',p50:'15.22',p75:'15.34'},
         {season_age:25,discipline_id:'110m_hurdles',discipline:'110m Hurdles',n:4,p25:'13.04',p50:'13.32',p75:'13.58'}]
  b=await trajectoryBand({discipline:'110m Hurdles',sex:'M',age:15,mark:15.5})
  ok(b[0].discipline!==b[1].discipline,'a band that crosses implements says so on each point')

  // ── a failure is an answer, not a crash ──
  throwNext=true
  is(await trajectoryBand({discipline:'100m',sex:'F',age:16,mark:12.1}),[],'a failed band call returns []')
  is(await similarAthletes({discipline:'100m',sex:'F',age:16,mark:12.1}),[],'a failed similar call returns []')
  is(await coverage('100m','F'),null,'a failed coverage call returns null')
  throwNext=false

  // ── nonsense in, nothing out, and no request made ──
  lastArgs=null
  is(await trajectoryBand({discipline:'',sex:'F',age:16,mark:12.1}),[],'no discipline: no band')
  is(await similarAthletes({discipline:'100m',sex:'F',age:NaN,mark:12.1}),[],'no age: no similar athletes')
  ok(lastArgs===null,'and neither one made a network call')

  // ── confidence thresholds ──
  const band=(n)=>[{age:16,discipline:'100m',disciplineId:'100m',n,p25:1,p50:2,p75:3}]
  is(confidenceAt(band(2),16),'none','2 athletes: nothing to draw')
  is(confidenceAt(band(4),16),'none','4 athletes: still nothing')
  is(confidenceAt(band(5),16),'indicative','5 athletes: a hint')
  is(confidenceAt(band(19),16),'indicative','19: still a hint')
  is(confidenceAt(band(20),16),'fair','20: fair')
  is(confidenceAt(band(59),16),'fair','59: fair')
  is(confidenceAt(band(60),16),'strong','60: strong')
  is(confidenceAt([],16),'none','an empty band is never confident')
  is(confidenceAt(band(500),25),'none','confidence is read at the ATHLETE age, not the best age anywhere')

  ok(Object.keys(CONFIDENCE_COPY).length===4 &&
     Object.values(CONFIDENCE_COPY).every(v=>typeof v==='string'&&v.length>10),
     'every confidence level has copy to show')
  ok(/not what you will do/i.test(PROJECTION_DISCLAIMER),'the disclaimer says the projection is not a forecast')
  ok(bandWidth({p25:11.9,p75:12.4})>0.49,'band width is the spread, sign-independent')

  // ── similar athletes keep the senior career ──
  reply=[{athlete:'Yemisi Ogunleye',nationality:'Germany',at_your_age:'13.22',
          best_same_event:'17.31',senior_event:'Shot Put',senior_best:'20.37',
          age_at_senior_best:27,years_still_competing:12}]
  const sa=await similarAthletes({discipline:'Shot Put',sex:'F',age:15.4,mark:13.2})
  ok(sa[0].seniorBest===20.37 && sa[0].ageAtSeniorBest===27,
     'the senior career survives the implement change')
  ok(sa[0].bestSameEvent===17.31,'and the same-implement best is kept separately')

  console.log(fail?`\n${fail} FAILED`:'\nall passed')
  process.exit(fail?1:0)
})()
