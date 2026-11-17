
'use strict';
async function loadModel(){
  const status=document.querySelector('#loader');
  function progress(message){status.replaceChildren();const title=document.createElement('strong');title.textContent='六闷大桥 · V2.0';status.append(title,document.createTextNode(message));}
  progress('正在下载模型…');
  const response=await fetch('model.ba533b88d393.json.gz');
  if(!response.ok)throw new Error('模型下载失败（HTTP '+response.status+'）');
  const total=Number(response.headers.get('Content-Length')),reader=response.body.getReader(),chunks=[];
  let received=0;
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    chunks.push(value);received+=value.length;
    progress('正在下载模型 '+(total?Math.min(100,Math.round(received/total*100))+'%':(received/1000000).toFixed(2)+' MB'));
  }
  progress('正在解析模型…');
  const blob=new Blob(chunks);
  const first=new Uint8Array(await blob.slice(0,2).arrayBuffer());
  let text;
  if(first[0]===31&&first[1]===139){
    if(!('DecompressionStream' in window))throw new Error('请使用新版 Chrome、Edge、Firefox 或 Safari 浏览器');
    text=await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }else text=await blob.text();
  const model=JSON.parse(text);
  if(model.objects.length!==1497)throw new Error('模型版本校验失败，请刷新重试');
  return model;
}
(async()=>{

'use strict';
const data=await loadModel(), objects=data.objects, byId=new Map(objects.map(o=>[o.id,o])), canvas=document.getElementById('canvas');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.localClippingEnabled=true;renderer.setClearColor(0xe9eef1);renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(42,1,.05,10000);camera.up.set(0,0,1);scene.add(new THREE.HemisphereLight(0xffffff,0x70838d,2.1));const light=new THREE.DirectionalLight(0xffffff,2.6);light.position.set(200,400,650);scene.add(light);const light2=new THREE.DirectionalLight(0xc4e4ef,.7);light2.position.set(-300,-200,150);scene.add(light2);
const meshes=new Map(), groupNodes=[], leafNodes=new Map(), allbox=new THREE.Box3(), target=new THREE.Vector3();let distance=760,theta=1.02,phi=1.02,selected=null,needsRender=true,deckHidden=false,drainHidden=false,cutActive=false;const clip=new THREE.Plane(new THREE.Vector3(0,0,-1),140);
let completed=0;
const materialCache=new Map();
for(const o of objects){
if(completed%60===0){
 document.querySelector('#loader').lastChild.textContent='正在建立构件 '+completed+' / '+objects.length;
 await new Promise(resolve=>setTimeout(resolve,0));
}
completed++;
const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(o.vertices.flat(),3));g.setIndex(o.faces.flat());g.computeVertexNormals();g.computeBoundingBox();const materialKey=o.color+(o.kind==='支座'?'metal':'concrete');
if(!materialCache.has(materialKey))materialCache.set(materialKey,new THREE.MeshStandardMaterial({color:o.color,roughness:.85,metalness:o.kind==='支座'?.25:0,flatShading:true,side:THREE.DoubleSide}));
const material=materialCache.get(materialKey);const m=new THREE.Mesh(g,material);m.userData.id=o.id;scene.add(m);meshes.set(o.id,m);allbox.union(g.boundingBox)}
const initialTarget=allbox.getCenter(new THREE.Vector3());target.copy(initialTarget);const axes=new THREE.AxesHelper(18);axes.position.copy(allbox.min).add(new THREE.Vector3(-15,-15,0));scene.add(axes);
function render(){if(needsRender){const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();camera.position.set(target.x+distance*Math.sin(theta)*Math.cos(phi),target.y+distance*Math.sin(theta)*Math.sin(phi),target.z+distance*Math.cos(theta));camera.lookAt(target);renderer.render(scene,camera);needsRender=false}requestAnimationFrame(render)}new ResizeObserver(()=>needsRender=true).observe(canvas);
function fit(box=allbox){target.copy(box.getCenter(new THREE.Vector3()));const s=box.getSize(new THREE.Vector3());distance=Math.max(s.x,s.y,s.z)*1.45/Math.min(1,canvas.clientWidth/canvas.clientHeight);distance=Math.max(8,distance);needsRender=true}fit();render();
function el(tag,attrs={},text=''){const e=document.createElement(tag);Object.assign(e,attrs);e.textContent=text;return e}
const hierarchy=new Map();for(const o of objects){const keys=[data.project.sides[o.side].name,o.module,o.group];let m=hierarchy;for(let i=0;i<keys.length;i++){const key=keys[i];if(!m.has(key))m.set(key,i===2?[]:new Map());m=m.get(key)}m.push(o)}
function idsOf(node){return Array.isArray(node)?node.map(o=>o.id):[...node.values()].flatMap(idsOf)}
function updateChecks(){for(const overlay of highlights.children)overlay.visible=meshes.get(overlay.userData.target).visible;for(const {cb,ids} of groupNodes){const n=ids.filter(id=>meshes.get(id).visible).length;cb.checked=n===ids.length;cb.indeterminate=n>0&&n<ids.length}for(const [id,row]of leafNodes)row.querySelector('input').checked=meshes.get(id).visible;needsRender=true;document.getElementById('count').textContent=`${objects.length} 个模型对象 · ${[...meshes.values()].filter(m=>m.visible).length} 个可见`}
function setVisible(ids,value){for(const id of ids)meshes.get(id).visible=value;updateChecks()}
function buildBranch(label,node,depth=0){const ids=idsOf(node), details=el('details',{className:'branch'+(depth===0?' root':'')});details.open=depth<2;const summary=el('summary'),cb=el('input',{type:'checkbox',checked:true});cb.onclick=e=>e.stopPropagation();cb.onchange=()=>setVisible(ids,cb.checked);const groupLabel=el('span',{},label);groupLabel.onclick=()=>selectGroup(label,ids,summary);summary.append(cb,groupLabel,el('span',{className:'branch-count'},String(ids.length)));details.append(summary);groupNodes.push({cb,ids,details,label});
 if(node instanceof Map){for(const [k,v]of node)details.append(buildBranch(k,v,depth+1))}else for(const o of node){const row=el('div',{className:'leaf',title:o.name+' / '+o.id});row.dataset.id=o.id;const lc=el('input',{type:'checkbox',checked:true});lc.onclick=e=>e.stopPropagation();lc.onchange=()=>setVisible([o.id],lc.checked);row.append(lc,el('span',{className:'dot'+(o.evidence==='schematic'?' pending':'')}),el('span',{className:'leaf-label'},o.name));row.onclick=()=>focus(o.id);row.ondblclick=()=>focus(o.id);details.append(row);leafNodes.set(o.id,row)}return details}
document.getElementById('tree').append(buildBranch('六闷大桥',hierarchy));
const labels={direct:'原图明确',derived:'依据图纸推导',schematic:'原则表达 · 待核验',unresolved:'缺失或冲突'};
// A second pass draws the selected shape over occluding deck and foundation elements.
const highlightMaterial=new THREE.MeshBasicMaterial({color:0xff6b00,depthTest:false,depthWrite:false,transparent:true,opacity:.82,side:THREE.DoubleSide});
const highlights=new THREE.Group();scene.add(highlights);
const emptyInfo=document.getElementById('object-info').innerHTML;
function clearSelection(){
 highlights.clear();
 document.querySelectorAll('#tree .selected').forEach(row=>row.classList.remove('selected'));
 selected=null;
 document.getElementById('object-info').innerHTML=emptyInfo;
 document.getElementById('object-title').textContent='构件信息';
 document.getElementById('selection-label').textContent='六闷大桥 / 上下行整桥';
 needsRender=true;
}
function highlight(id){
 const mesh=meshes.get(id),overlay=new THREE.Mesh(mesh.geometry,highlightMaterial);
 overlay.renderOrder=100;overlay.userData.target=id;overlay.visible=mesh.visible;
 highlights.add(overlay);needsRender=true;
}
function selectGroup(label,ids,summary){
 clearSelection();summary.classList.add('selected');ids.forEach(highlight);
 document.getElementById('selection-label').textContent=label;
 document.getElementById('object-title').textContent=label;
 document.getElementById('object-info').replaceChildren(el('p',{},ids.length+' 个模型对象 · 已高亮组内可见构件'));
}
function select(id){
 clearSelection();selected=id;const o=byId.get(id);meshes.get(id).visible=true;
 highlight(id);const row=leafNodes.get(id);row.classList.add('selected');
 if(row.hidden){
  const search=document.getElementById('search');
  search.value='';search.dispatchEvent(new Event('input'));
 }
 for(let parent=row.parentElement;parent&&parent!==document.getElementById('tree');parent=parent.parentElement)
  if(parent.tagName==='DETAILS')parent.open=true;
 row.scrollIntoView({block:'nearest'});
 updateChecks();
 const box=document.getElementById('object-info');box.replaceChildren(el('div',{className:'id'},id),el('div',{className:'tag'},labels[o.evidence]));
 function fields(title,values){
  box.append(el('h3',{},title));const dl=el('dl');
  for(const [key,value] of Object.entries(values)){
   const unit=title==='尺寸信息'&&typeof value==='number'?(key==='桩长'?' m':' mm'):'';
   dl.append(el('dt',{},key),el('dd',{},value==null?'待核验':String(value)+unit));
  }box.append(dl);
 }
 for(const [title,values] of Object.entries(o.standard)) fields(title,values);
 fields('图纸与核验',{'表号':o.table,'图纸来源':o.source,'状态':o.asset_status,'待核说明':o.note||'现状待核验','管养资产编码':'待核验','几何体积（m³）':o.mesh_volume_m3,'工程量使用':o.quantity_use,...o.extra});
 const actions=el('div',{className:'info-actions'});for(const [text,fn]of [['定位',()=>focus(id)],['隔离查看',()=>{setVisible(objects.map(o=>o.id),false);focus(id)}],['隐藏',()=>setVisible([id],false)]]){const b=el('button',{},text);b.onclick=fn;actions.append(b)}box.append(actions);document.getElementById('object-title').textContent=o.kind;document.getElementById('selection-label').textContent=o.name;needsRender=true;
}
function focus(id){select(id);fit(meshes.get(id).geometry.boundingBox)}
document.getElementById('search').oninput=e=>{const q=e.target.value.trim().toLowerCase();for(const [id,row]of leafNodes){const o=byId.get(id);row.hidden=!JSON.stringify([o.name,o.id,o.kind,o.module,o.group,o.material,o.standard.标识信息.标识码,data.project.sides[o.side].name]).toLowerCase().includes(q);row.style.display=row.hidden?'none':''}for(const {details,ids}of groupNodes){details.style.display=ids.some(id=>!leafNodes.get(id).hidden)?'':'none';if(q)details.open=true}};
document.getElementById('expand').onclick=()=>groupNodes.forEach(n=>n.details.open=true);document.getElementById('collapse').onclick=()=>groupNodes.forEach((n,i)=>n.details.open=i===0);document.getElementById('show-all').onclick=()=>{setVisible(objects.map(o=>o.id),true);deckHidden=drainHidden=false;document.getElementById('deck').classList.remove('active');document.getElementById('drain').classList.remove('active')};document.getElementById('fit').onclick=()=>{theta=1.02;phi=1.02;fit()};document.getElementById('top').onclick=()=>{theta=.001;phi=Math.PI/2;fit()};document.getElementById('side').onclick=()=>{theta=Math.PI/2;phi=.25;fit()};
function kindToggle(id,types,key){const b=document.getElementById(id);b.onclick=()=>{const state=key==='deck'?(deckHidden=!deckHidden):(drainHidden=!drainHidden);setVisible(objects.filter(o=>types.includes(o.kind)).map(o=>o.id),!state);b.classList.toggle('active',state)}}kindToggle('deck',['桥面铺装','沥青铺装'],'deck');kindToggle('drain',['排水管'],'drain');
function applyClip(){clip.constant=Number(document.getElementById('cut-range').value)-data.project.origin_ENH[2];document.getElementById('cut-value').textContent=document.getElementById('cut-range').value;for(const m of meshes.values())m.material.clippingPlanes=cutActive?[clip]:[];needsRender=true}document.getElementById('cut').onclick=()=>{cutActive=!cutActive;document.getElementById('cut').classList.toggle('active',cutActive);document.getElementById('cut-panel').style.display=cutActive?'block':'none';applyClip()};document.getElementById('cut-range').oninput=applyClip;
function dialog(title,content){document.getElementById('dialog-content').replaceChildren(el('h2',{},title),...content);document.getElementById('dialog').showModal()}document.getElementById('issues').onclick=()=>dialog('待核验与模型边界',data.project.issues.map(i=>{const a=el('article');a.append(el('strong',{},i.id+' / '+i.topic),el('p',{},i.detail));return a}));document.getElementById('help').onclick=()=>dialog('模型使用说明',[el('p',{},'结构树：勾选控制整幅、系统、部位或单个构件显隐；单击构件全名可定位并高亮；单击分组名称高亮该组可见构件。搜索支持名称、技术ID、墩号、系统和材料。'),el('p',{},'三维操作：左键拖动旋转，滚轮缩放，右键或Shift拖动平移。直接点击模型可选择构件；双击可定位；单击三维视图空白处取消选择。隐藏铺装可检查梁体，水平剖切可查看空腔；剖切显示不生成封口。'),el('p',{},'定位：局部坐标为E/N/H减原点(412000,2678000,450)m，投影EPSG:4546，1985国家高程。HTML、IFC及Blender共用技术ID。'),el('p',{},'本页面通过 HTTPS 加载 V2.0 模型，可在结构树内搜索和选择构件。管养平台业务、真实病害/评级/维修记录未提供，不生成虚构业务数据。'),el('p',{},'图纸代号：main=04-3桐木至金秀施设第四册第三分册桥梁涵洞.pdf；general1=04-6桐木至金秀施设公路桥涵通用图（一）.pdf；pier_revision=2023.4.23设计提供用于墩身施工的主桥桥墩修订图。页码均为原PDF物理页码。'),el('p',{},'需使用支持WebGL2的现代桌面Chrome或Edge浏览器。接收平台IFC兼容性与现状仍待核验。')]);
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let drag=null,moved=false;canvas.oncontextmenu=e=>e.preventDefault();canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,b:e.button};moved=false;canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4)moved=true;if(drag.b===2||e.shiftKey){const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);target.addScaledVector(right,-dx*distance*.0012).addScaledVector(up,dy*distance*.0012)}else{phi-=dx*.006;theta=Math.max(.002,Math.min(Math.PI-.002,theta-dy*.006))}drag.x=e.clientX;drag.y=e.clientY;needsRender=true};
function hit(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects([...meshes.values()].filter(m=>m.visible)).find(h=>!cutActive||clip.distanceToPoint(h.point)>=0)}canvas.onpointercancel=()=>{drag=null};canvas.onpointerup=e=>{if(drag&&!moved&&e.button===0&&!e.shiftKey){const h=hit(e);if(h)select(h.object.userData.id);else clearSelection()}drag=null};canvas.ondblclick=e=>{const h=hit(e);if(h)focus(h.object.userData.id)};canvas.onwheel=e=>{e.preventDefault();distance=Math.max(.5,Math.min(5000,distance*Math.exp(e.deltaY*.001)));needsRender=true};
updateChecks();document.getElementById('loader').remove();window.__viewer={objects,meshes,byId,select,focus,fit,setVisible,renderer,scene,camera,get selected(){return selected},get cutActive(){return cutActive},ready:true};

})().catch(error=>{
  console.error(error);
  const loader=document.querySelector('#loader');
  if(loader){
    loader.replaceChildren();
    const title=document.createElement('strong');title.textContent='模型加载未完成';
    const message=document.createElement('p');message.textContent=error.message;
    const retry=document.createElement('button');retry.textContent='重新加载';retry.onclick=()=>location.reload();
    loader.append(title,message,retry);
  }
});
