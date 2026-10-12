var MGPreview = (function () {
    var cards = [], detail = null, current = null, parameters = null;
    var started = performance.now(), all = false, last = 0, frame = 0, observer = null;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function rounded(ctx, x, y, w, h, radius) {
        var r = Math.min(radius, w / 2, h / 2);
        ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
    }
    function block(ctx, x, y, w, h, color) { ctx.fillStyle=color;rounded(ctx,x,y,w,h,3);ctx.fill(); }
    function drawTool(ctx, id, t, params) {
        var u = Math.min(1, Math.max(0, t / 1.3)), e = 1-Math.pow(1-u,3), i, x, y;
        ctx.lineWidth=1.3;
        if(id.indexOf('composition-')===0){
            ctx.strokeStyle='#b8a0db';ctx.strokeRect(22,22,62,48);
            if(id==='composition-markers'){ctx.beginPath();ctx.moveTo(20,80);ctx.lineTo(101,80);ctx.stroke();for(i=0;i<3;i++){ctx.fillStyle='#c9adee';ctx.beginPath();ctx.moveTo(35+i*21,35+e*40);ctx.lineTo(39+i*21,29+e*40);ctx.lineTo(43+i*21,35+e*40);ctx.closePath();ctx.fill();}}
            else if(id==='composition-detach'){ctx.fillStyle='#28232f';ctx.fillRect(28+e*14,29+e*10,62,48);ctx.strokeRect(28+e*14,29+e*10,62,48);for(i=0;i<3;i++)block(ctx,38+e*14,39+e*10+i*9,35,5,'#b69bdc');}
            else{for(i=0;i<3;i++)block(ctx,30+e*18,31+i*(10+e*5),43,6,['#d0b4f3','#ad92d3','#81699f'][i]);}
            return;
        }
        if (id.indexOf('stagger') === 0 || id.indexOf('align') === 0) {
            ctx.strokeStyle='#756482';ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(29,21);ctx.lineTo(29,79);ctx.stroke();ctx.setLineDash([]);
            var gap=Math.min(15,(params.frames||0)*10/3),order=[0,1,2],seed=params.seed,j,temp;
            if(id==='stagger-random'){for(i=2;i>0;i--){seed=(seed*1664525+1013904223)%4294967296;j=Math.floor(seed/4294967296*(i+1));temp=order[i];order[i]=order[j];order[j]=temp;}}
            for(i=0;i<3;i++) {
                var target = id === 'align-in' ? 0 : id === 'align-sequence' ? i*22 : id === 'stagger-reverse' ? (2-i)*gap : id === 'stagger-random' ? order.indexOf(i)*gap : i*gap;
                var origin = id.indexOf('align')===0 ? [12,0,19][i] : 0;
                x=29+origin+(target-origin)*e;y=29+i*17;
                block(ctx,x,y,id==='align-sequence'?22:35,8,['#c5aff0','#a892d3','#82719f'][i]);
            }
            return;
        }
        if(id.indexOf('parent')===0) {
            ctx.strokeStyle='#7b6a98';ctx.beginPath();
            for(i=0;i<3;i++){ x=34+i*27;ctx.moveTo(id==='parent-each'?x:61,35);ctx.lineTo(x,35+e*27); }ctx.stroke();
            if(id==='parent-group'){ ctx.strokeStyle='#bda1e7';ctx.strokeRect(54,23,14,14); }
            for(i=0;i<3;i++){x=28+i*27;if(id==='parent-each'){ctx.strokeStyle='#bda1e7';ctx.strokeRect(x,23,12,12);}block(ctx,x,62,13,13,['#c7b0f1','#ad94d5','#8c77ae'][i]);}return;
        }
        var cycle = t / 1.2, progress = cycle % 1;
        if(id.indexOf('pingpong')!==-1){progress=1-Math.abs(cycle%2-1);}
        ctx.strokeStyle='#5c506d';ctx.beginPath();ctx.moveTo(25,51);ctx.lineTo(97,51);ctx.stroke();
        for(i=0;i<3;i++){x=29+i*31;ctx.fillStyle='#756585';ctx.save();ctx.translate(x,51);ctx.rotate(Math.PI/4);ctx.fillRect(-3,-3,6,6);ctx.restore();}
        if(id==='layerloop-cycle'||id==='layerloop-pingpong'){for(i=0;i<3;i++){ctx.strokeStyle=id==='layerloop-pingpong'&&i===1?'#bda1e7':'#82718f';ctx.strokeRect(26+i*26,37,20,28);}if(id==='layerloop-pingpong'){ctx.beginPath();ctx.moveTo(36,31);ctx.lineTo(82,31);ctx.moveTo(36,31);ctx.lineTo(43,26);ctx.moveTo(36,31);ctx.lineTo(43,36);ctx.moveTo(82,31);ctx.lineTo(75,26);ctx.moveTo(82,31);ctx.lineTo(75,36);ctx.stroke();}}
        x=29+progress*62;y=id==='keyloop-offset'?53-progress*24:51;
        ctx.fillStyle='#c6abf6';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#7c6a91';ctx.beginPath();ctx.arc(61,51,30,.25*Math.PI,.78*Math.PI);ctx.stroke();
    }
    function draw(canvas, preset, params, elapsed, moving) {
        if(!canvas || !preset){return;}
        var ratio=Math.min(window.devicePixelRatio||1,2), w=Math.round(canvas.clientWidth*ratio), h=Math.round(canvas.clientHeight*ratio);
        if(!w||!h){return;}
        if(canvas.width!==w){canvas.width=w;}if(canvas.height!==h){canvas.height=h;}
        var ctx=canvas.getContext('2d'), scale=Math.min(w/122,h/100);
        ctx.clearRect(0,0,w,h);ctx.save();ctx.translate((w-122*scale)/2,(h-100*scale)/2);ctx.scale(scale,scale);
        if(preset.type==='tools'){drawTool(ctx,preset.id,moving?elapsed%2.7:1.1,params);ctx.restore();return;}
        var p = Object.assign({},params), duration = preset.category==='loop' ? p.period : p.duration;
        var time = moving ? elapsed % (Math.max(.3,duration)+.85) - .2 : (preset.category==='out'?0:duration*.65);
        if(preset.category==='loop'){time=moving?elapsed:p.period*.15;}
        p.distance = Math.min(45,p.distance/4);
        if(preset.id==='loop-float'||preset.id==='feedback-bounce'||preset.id==='feedback-shake'){p.amount=Math.min(35,p.amount/2.8);}
        if(preset.template){p.__ref={duration:preset.template.duration,seed:preset.template.seed,holdEnd:!!preset.template.holdEnd,loop:!!preset.template.loop,channels:preset.template.channels};}
        var pose=mgPose(preset.id,time,p);
        if(preset.template){pose.x/=20;pose.y/=20;}
        ctx.strokeStyle='#6c5d7b';ctx.globalAlpha=.4;ctx.setLineDash([2,3]);ctx.strokeRect(45,32,32,32);ctx.setLineDash([]);
        ctx.globalAlpha=Math.max(0,Math.min(1,pose.opacity));ctx.translate(61+pose.x,48+pose.y);ctx.rotate(pose.rotation*Math.PI/180);ctx.scale(pose.scaleX===undefined?pose.scale:pose.scaleX,pose.scaleY===undefined?pose.scale:pose.scaleY);
        if(preset.user&&preset.template&&preset.template.effects&&preset.template.effects.length){ctx.shadowColor='#c6a9ff';ctx.shadowBlur=moving?5+7*(.5+.5*Math.sin(elapsed*5)):7;}
        var gradient=ctx.createLinearGradient(-18,-18,18,18);gradient.addColorStop(0,'#d2baff');gradient.addColorStop(1,'#9775c6');
        ctx.fillStyle=gradient;rounded(ctx,-18,-18,36,36,8);ctx.fill();
        ctx.fillStyle='#efe3ff';rounded(ctx,-10,-7,14,3,1.5);ctx.fill();ctx.globalAlpha*=.65;rounded(ctx,-10,0,20,3,1.5);ctx.fill();rounded(ctx,-10,7,11,3,1.5);ctx.fill();
        ctx.restore();
    }
    function schedule() {
        if(!frame&&!document.hidden){frame=requestAnimationFrame(tick);}
    }
    function tick(now) {
        frame=0;
        if(document.hidden){return;}
        if(now-last<33){schedule();return;}last=now;
        var t=(now-started)/1000;
        var movingAny=false;
        cards.forEach(function(c){
            var moving=c.visible!==false&&!reduced&&(all||c.hover||c.preset.id===(current&&current.id));
            if(moving || c.dirty){draw(c.canvas,c.preset,c.preset.id===(current&&current.id)?parameters:MGCatalog.defaults(c.preset.id),t,moving);c.dirty=false;}
            movingAny=movingAny||moving;
        });
        if(detail&&current){draw(detail,current,parameters,t,!reduced);movingAny=movingAny||!reduced;}
        if(movingAny){schedule();}
    }
    document.addEventListener('visibilitychange',function(){if(!document.hidden){cards.forEach(function(c){c.dirty=true;});schedule();}});
    return {
        mount: function(root){
            if(observer){observer.disconnect();observer=null;}cards=[];
            if(typeof IntersectionObserver==='function'){observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){var c=entry.target.__mgPreview;if(c){c.visible=entry.isIntersecting;c.dirty=true;}});schedule();},{root:null,rootMargin:'40px'});}
            root.querySelectorAll('.preset-card[data-id]').forEach(function(el){var preset=MGCatalog.find(el.dataset.id);if(!preset){return;}var c={canvas:el.querySelector('canvas'),preset:preset,hover:false,dirty:true,visible:true};el.__mgPreview=c;el.addEventListener('mouseenter',function(){c.hover=true;schedule();});el.addEventListener('mouseleave',function(){c.hover=false;c.dirty=true;schedule();});el.addEventListener('focus',function(){c.hover=true;schedule();});el.addEventListener('blur',function(){c.hover=false;c.dirty=true;schedule();});cards.push(c);if(observer){observer.observe(el);}});schedule();
        },
        select: function(preset,p){current=preset;parameters=p;detail=document.getElementById('detail-canvas');started=performance.now();cards.forEach(function(c){c.dirty=true;});schedule();},
        update: function(p){parameters=p;cards.forEach(function(c){c.dirty=true;});schedule();},
        replay: function(){started=performance.now();schedule();},
        autoplay: function(value){all=value;cards.forEach(function(c){c.dirty=true;});schedule();}
    };
}());
