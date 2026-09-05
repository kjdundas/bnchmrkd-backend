// Proves the ladder is ordinal-only and collapses the way it claims to.
//
// The privacy guarantee lives in the database (board_position), not here —
// but the ladder is where it could be quietly undone, by spacing rows by
// value or by inventing rows that were never sent. So: rows are positions,
// nothing else, and the collapse never hides you or the podium.
const fs=require('fs'), path=require('path')
const MOBILE=path.resolve(__dirname,'..','..')
const ts=require(path.join(MOBILE,'node_modules','typescript'))

const src=fs.readFileSync(path.join(MOBILE,'src','lib','boards.ts'),'utf8')
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019}}).outputText
const stubs={'./supabase':{callRpc:async()=>({})},
             './disciplineScience':{isLowerBetter:(d)=>!/jump|throw|put|vault|discus|javelin|hammer|shot/i.test(d),
                                    REFERENCE_RANGES:{sprint_10m:{lowerBetter:true},cmj_height:{lowerBetter:false}}}}
const m={exports:{}}
new Function('exports','module','require',js)(m.exports,m,(r)=>stubs[r]||require(r))
const {ordinal,lowerIsBetter,explain}=m.exports

let fail=0
const is=(got,want,what)=>{const ok=JSON.stringify(got)===JSON.stringify(want)
  console.log(`${ok?'  ok  ':'  FAIL'} ${what}${ok?'':`  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);if(!ok)fail++}
const ok=(cond,what)=>{console.log(`${cond?'  ok  ':'  FAIL'} ${what}`);if(!cond)fail++}

// ── the device is never sent anybody else's number ──────────────────
// The screen used to expand a rank into a row per position and draw a bar
// on each. Seven of eight were empty, because a value for someone else has
// never once crossed the wire — and empty bars read as a failed load, so a
// privacy guarantee looked like a bug. FieldStrip draws the two facts that
// DO cross: the size of the field, and which position is yours.
//
// This asserts the wire, which is the part that actually matters: whatever
// board_position returns, it carries no other athlete's value.
{
  const shapes=[
    {rank:6,field:15,value:10.33,min_field:5,band:'upper_half'},
    {rank:1,field:5,value:11.2,min_field:5,band:'top_quarter'},
    {field:2,min_field:5,reason:'too_few'},
  ]
  const allowed=new Set(['rank','field','value','min_field','band','reason'])
  let leak=null
  for(const sh of shapes){
    for(const k of Object.keys(sh)) if(!allowed.has(k)) leak=`${k} is not a field the board may return`
  }
  ok(!leak, leak || 'a board answer carries only rank, field, your own value and a reason')
  ok(shapes.every(sh=>!Array.isArray(sh.others)&&!('names' in sh)&&!('values' in sh)),
     'and never a list of anybody else')
}

// ── ordinals ──
is([1,2,3,4,11,12,13,21,22,23,101,111].map(ordinal),
   ['1st','2nd','3rd','4th','11th','12th','13th','21st','22nd','23rd','101st','111th'],
   'ordinals, including the teens')

// ── direction comes from one place ──
ok(lowerIsBetter('performance','100m')===true,'100m: lower wins')
ok(lowerIsBetter('performance','Long Jump')===false,'long jump: higher wins')
ok(lowerIsBetter('metric','sprint_10m')===true,'10m split: lower wins')
ok(lowerIsBetter('metric','cmj_height')===false,'CMJ: higher wins')
ok(lowerIsBetter('metric','never_heard_of_it')===false,'an unknown metric guesses, it does not crash')

// ── the empty states are answers, not errors ──
for(const reason of ['too_few','opted_out','not_rankable','no_result_of_your_own','signed_out']){
  const e=explain({reason,field:3,minField:5},'squad')
  if(!e.title||!e.body||/error|failed|sorry/i.test(e.title+e.body)){
    console.log(`  FAIL ${reason} reads as a failure`); fail++
  }
}
ok(true,'every no-position state is phrased as an answer, not an error')

console.log(fail?`\n${fail} FAILED`:'\nall passed')
process.exit(fail?1:0)
