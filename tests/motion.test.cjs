const test = require('node:test');
const assert = require('node:assert/strict');
const pose = require('../extension/js/motion.js');
const catalog = require('../extension/js/catalog.js');
function close(actual, expected, tolerance=.0001) { assert.ok(Math.abs(actual-expected)<=tolerance, `${actual} != ${expected}`); }
function params(id) { const preset=catalog.find(id), p=catalog.defaults(id); if(preset.template)p.__ref={duration:preset.template.duration,seed:preset.template.seed,holdEnd:!!preset.template.holdEnd,loop:!!preset.template.loop,channels:preset.template.channels}; return p; }
test('catalog contains every agreed UI category',()=>{
  assert.deepEqual(['in','loop','out','feedback'],catalog.categories.filter(c=>c.panel==='ui').map(c=>c.id));
  assert.equal(catalog.presets.filter(p=>p.type==='ui').length,80);
});
test('entrance settles and exit reaches hidden state',()=>{
  for (const preset of catalog.presets.filter(p=>p.category==='in')) {
    const p=params(preset.id), v=pose(preset.id,p.duration+1,p);close(v.x,0);close(v.y,0);close(v.scale,1);close(v.scaleX,1);close(v.scaleY,1);close(v.rotation,0);close(v.opacity,1);
  }
  for (const id of ['out-fade','out-slide','out-scale','out-elastic','out-rotate']) {
    const p=catalog.defaults(id), v=pose(id,p.duration+1,p);assert.equal(v.opacity,0);
  }
});
test('updated right blur reproduces the latest reference key poses',()=>{
  const p=params('in-right-smear'), d=p.duration;
  let v=pose('in-right-smear',0,p);close(v.x,0);close(v.y,1208);close(v.scaleX,1);close(v.scaleY,1.81);close(v.opacity,1);
  v=pose('in-right-smear',d*(.13333333333333/p.__ref.duration),p);close(v.x,0,.01);close(v.y,0,.01);close(v.scaleX,1,.01);close(v.scaleY,1,.01);
  v=pose('in-right-smear',d,p);close(v.x,0);close(v.y,0);close(v.scaleX,1);close(v.scaleY,1);close(v.opacity,1);
});
test('all 60 imported presets reproduce every non-wiggle reference key pose',()=>{
  const references=catalog.presets.filter(p=>p.template); assert.equal(references.length,60);
  for(const preset of references){
    const p=params(preset.id), channels=preset.template.channels;
    for(const [channel,curve] of Object.entries(channels)){
      if(curve.wiggle)continue;
      for(const key of curve.keys){
        const v=pose(preset.id,p.duration*(key.t/preset.template.duration),p);
        if(channel==='position'){close(v.x,key.v[0],.02);close(v.y,key.v[1],.02);}
        else if(channel==='scale'){close(v.scaleX,key.v[0],.02);close(v.scaleY,key.v[1],.02);}
        else if(channel==='rotation')close(v.rotation,key.v,.02);
        else if(channel==='opacity')close(v.opacity,key.v,.02);
      }
    }
  }
});
test('exit reference presets start neutral and hold their final source pose',()=>{
  for(const preset of catalog.presets.filter(p=>p.category==='out'&&p.template)){
    const p=params(preset.id), atStart=pose(preset.id,0,p), atEnd=pose(preset.id,p.duration,p), after=pose(preset.id,p.duration+1,p);
    close(atStart.x,0,.02);close(atStart.y,0,.02);close(atStart.scaleX,1,.02);close(atStart.scaleY,1,.02);close(atStart.rotation,0,.02);close(atStart.opacity,1,.02);
    close(after.x,atEnd.x,.02);close(after.y,atEnd.y,.02);close(after.scaleX,atEnd.scaleX,.02);close(after.scaleY,atEnd.scaleY,.02);close(after.rotation,atEnd.rotation,.02);close(after.opacity,atEnd.opacity,.02);
  }
});
test('loop poses repeat at their period',()=>{
  for (const id of ['loop-breathe','loop-float','loop-sway','loop-blink']) {
    const p=catalog.defaults(id), a=pose(id,.371,p), b=pose(id,.371+p.period,p);
    close(a.x,b.x);close(a.y,b.y);close(a.scale,b.scale);close(a.rotation,b.rotation);close(a.opacity,b.opacity);
  }
});
test('feedback returns exactly to base state',()=>{
  for (const id of ['feedback-press','feedback-rebound','feedback-shake','feedback-bounce','feedback-pop']) {
    const p=catalog.defaults(id), v=pose(id,p.duration+.01,p);close(v.x,0);close(v.y,0);close(v.scale,1);close(v.rotation,0);close(v.opacity,1);
  }
});
test('preview directions move on the expected axis',()=>{
  const p=catalog.defaults('in-slide');p.direction=1;let v=pose('in-slide',0,p);assert.ok(v.x<0);close(v.y,0);
  p.direction=4;v=pose('in-slide',0,p);assert.ok(v.y>0);close(v.x,0);
});
test('registered user curves retime and loop through the shared evaluator',()=>{
  const user={id:'user-motion-123456',category:'loop',name:'User loop',en:'USER',desc:'',fields:['period'],defaults:{period:2,duration:1},type:'ui',version:1,user:true,template:{duration:1,seed:1,loop:true,channels:{position:{keys:[{t:0,v:[-100,0],mode:'l'},{t:1,v:[0,0],mode:'l'}]}}}};
  catalog.registerUser([user]);
  try { const p=params(user.id), a=pose(user.id,.5,p), b=pose(user.id,2.5,p); close(a.x,-75); close(b.x,-75); close(a.y,0); }
  finally { catalog.registerUser([]); }
});
