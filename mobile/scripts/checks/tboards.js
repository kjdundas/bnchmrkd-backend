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
const {ladderRows,ordinal,lowerIsBetter,explain,LADDER_FULL_UPTO}=m.exports

let fail=0
const is=(got,want,what)=>{const ok=JSON.stringify(got)===JSON.stringify(want)
  console.log(`${ok?'  ok  ':'  FAIL'} ${what}${ok?'':`  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);if(!ok)fail++}
const ok=(cond,what)=>{console.log(`${cond?'  ok  ':'  FAIL'} ${what}`);if(!cond)fail++}

const pos=(rows)=>rows.filter(r=>r.kind==='pos').map(r=>r.pos)

// ── every row is an ordinal and nothing else ──
const r=ladderRows(4,11)
ok(r.every(x=>x.kind==='gap'||(Object.keys(x).sort().join()==='kind,me,pos'
   && typeof x.pos==='number' && typeof x.me==='boolean')),
   'a row carries a position and whether it is you — no value, ever')

// ── small fields show in full ──
is(pos(ladderRows(3,5)),[1,2,3,4,5],'a five-person board shows all five')
is(pos(ladderRows(1,LADDER_FULL_UPTO)),[1,2,3,4,5,6,7,8],'eight is still shown in full')
ok(ladderRows(3,5).every(x=>x.kind==='pos'),'and needs no gap markers')

// ── long fields collapse, but never past you or the podium ──
for (const field of [9,11,20,57,300]) {
  for (const rank of [1,2,3,4,5,Math.floor(field/2),field-1,field]) {
    const rows=ladderRows(rank,field), p=pos(rows)
    if(!p.includes(rank)) { console.log(`  FAIL rank ${rank}/${field} lost itself`); fail++; break }
    if(!p.includes(1))    { console.log(`  FAIL rank ${rank}/${field} lost 1st`); fail++; break }
    if(!p.includes(field)){ console.log(`  FAIL rank ${rank}/${field} lost last`); fail++; break }
    if(new Set(p).size!==p.length){ console.log(`  FAIL rank ${rank}/${field} duplicated a row`); fail++; break }
    if(p.slice().sort((a,b)=>a-b).join()!==p.join()){ console.log(`  FAIL rank ${rank}/${field} out of order`); fail++; break }
    if(p.some(x=>x<1||x>field)){ console.log(`  FAIL rank ${rank}/${field} invented a position`); fail++; break }
  }
}
ok(true,'across 5 field sizes x 8 positions: you, 1st and last always survive the collapse')

// ── a gap marker never stands in for a single row ──
let bad=null
for(let field=9;field<=40;field++) for(let rank=1;rank<=field;rank++){
  const rows=ladderRows(rank,field)
  for(let i=1;i<rows.length-1;i++){
    if(rows[i].kind==='gap'){
      const a=rows[i-1].pos, b=rows[i+1].pos
      if(b-a<=2) bad=`${rank}/${field} hid one row behind a gap`
    }
  }
}
ok(!bad, bad || 'a gap marker always stands for two or more hidden rows')

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
