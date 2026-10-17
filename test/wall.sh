ab(){ agent-browser "$@"; }
st(){ ab eval "(()=>{const p=__chassis.translation(),r=__chassis.rotation();const a=Math.atan2(p.z-260, 11-p.y)*57.3;return [__S.t.toFixed(2),'y',p.y.toFixed(2),'z',p.z.toFixed(1),'v',(__S.speed*3.6).toFixed(0),'wd',__S.wheelsDown,'arcdeg',a.toFixed(0),'g',__S.g.toFixed(1),document.getElementById('toast').textContent].join(' ')})()"; }
ab open http://localhost:5179/?autoplay >/dev/null; sleep 3
ab eval "__chassis.setTranslation({x:0,y:0.05,z:244},true);__once.add('KeyF');__once.add('KeyF');__keys.add('KeyW');1" >/dev/null; sleep 0.5; ab eval "__keys.delete('KeyW');1" >/dev/null; ab eval "setTimeout(()=>__keys.add('KeyW'),700);1" >/dev/null
for i in 1 2 3 4 5 6 7 8 9 10; do sleep 0.35; st; [ $i = 6 ] && ab screenshot shots/wall1.png >/dev/null; done
