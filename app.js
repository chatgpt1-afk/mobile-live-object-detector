"use strict";

const video = document.querySelector("#camera");
let productPhotoBlob = null;
let currentProductPhotoBlob = null;
const productPhotoInput = document.querySelector('#productPhotoInput');
const productPhotoCamera = document.querySelector('#productPhotoCamera');
const productPhotoPreview = document.querySelector('#productPhotoPreview');
document.querySelector('#takeProductPhoto').addEventListener('click',()=>productPhotoCamera.click());
document.querySelector('#uploadProductPhoto').addEventListener('click',()=>productPhotoInput.click());
async function setProductPhoto(event){
  const file=event.target.files?.[0];if(!file)return;
  if(!file.type.startsWith('image/')){barcodeMessage.textContent='Please choose an image.';return;}
  try {
    const bitmap=await createImageBitmap(file);
    const canvas=document.createElement('canvas');const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
    canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
    productPhotoBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));
    productPhotoPreview.src=URL.createObjectURL(productPhotoBlob);productPhotoPreview.hidden=false;document.querySelector('#photoEditControls').hidden=false;closeCrop();
    barcodeMessage.textContent='Item photo ready. Enter barcode and Continue.';
  }catch(error){barcodeMessage.textContent='Cannot read item photo: '+error.message;}
  event.target.value='';
}
let productPhotoCanvas=null, cropRect=null, cropStart=null;
const cropStage=document.querySelector('#cropPhotoStage'),cropCanvas=document.querySelector('#cropPhotoCanvas');
const cropCtx=cropCanvas.getContext('2d');
async function updateProductPhotoFromCanvas(canvas){
 productPhotoBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
 productPhotoPreview.src=URL.createObjectURL(productPhotoBlob);productPhotoPreview.hidden=false;
 document.querySelector('#photoEditControls').hidden=false;
}
async function rotateProductPhoto(clockwise){
 if(!productPhotoBlob)return;
 const bmp=await createImageBitmap(productPhotoBlob),c=document.createElement('canvas');
 c.width=bmp.height;c.height=bmp.width;
 const ctx=c.getContext('2d');ctx.translate(c.width/2,c.height/2);ctx.rotate(clockwise?Math.PI/2:-Math.PI/2);ctx.drawImage(bmp,-bmp.width/2,-bmp.height/2);bmp.close?.();
 await updateProductPhotoFromCanvas(c);
}
document.querySelector('#rotatePhotoLeft').addEventListener('click',()=>rotateProductPhoto(false));
document.querySelector('#rotatePhotoRight').addEventListener('click',()=>rotateProductPhoto(true));
// Crop uses the same eight resize handles and drag-to-move behavior as Manual Item Frame.
let cropGesture=null;
function cropHandles(r){
 const x=r.x,y=r.y,w=r.w,h=r.h;
 return [{name:'nw',x,y},{name:'n',x:x+w/2,y},{name:'ne',x:x+w,y},{name:'e',x:x+w,y:y+h/2},{name:'se',x:x+w,y:y+h},{name:'s',x:x+w/2,y:y+h},{name:'sw',x,y:y+h},{name:'w',x,y:y+h/2}];
}
function drawCrop(){
 if(!productPhotoCanvas)return;
 cropCtx.clearRect(0,0,cropCanvas.width,cropCanvas.height);
 cropCtx.drawImage(productPhotoCanvas,0,0);
 if(!cropRect)return;
 const r=cropRect;
 cropCtx.fillStyle='rgba(0,0,0,.35)';
 cropCtx.fillRect(0,0,cropCanvas.width,r.y);
 cropCtx.fillRect(0,r.y+r.h,cropCanvas.width,cropCanvas.height-r.y-r.h);
 cropCtx.fillRect(0,r.y,r.x,r.h);
 cropCtx.fillRect(r.x+r.w,r.y,cropCanvas.width-r.x-r.w,r.h);
 cropCtx.strokeStyle='#54e38e';cropCtx.lineWidth=Math.max(3,cropCanvas.width/300);
 cropCtx.strokeRect(r.x,r.y,r.w,r.h);
 const size=Math.max(14,cropCanvas.width/40);
 cropCtx.fillStyle='#fff';cropCtx.strokeStyle='#0a7d43';cropCtx.lineWidth=Math.max(2,cropCanvas.width/500);
 for(const h of cropHandles(r)){
  cropCtx.fillRect(h.x-size/2,h.y-size/2,size,size);
  cropCtx.strokeRect(h.x-size/2,h.y-size/2,size,size);
 }
}
document.querySelector('#cropProductPhoto').addEventListener('click',async()=>{
 if(!productPhotoBlob)return;
 const bmp=await createImageBitmap(productPhotoBlob);
 productPhotoCanvas=document.createElement('canvas');productPhotoCanvas.width=bmp.width;productPhotoCanvas.height=bmp.height;
 productPhotoCanvas.getContext('2d').drawImage(bmp,0,0);bmp.close?.();
 cropCanvas.width=productPhotoCanvas.width;cropCanvas.height=productPhotoCanvas.height;
 const margin=.1;cropRect={x:cropCanvas.width*margin,y:cropCanvas.height*margin,w:cropCanvas.width*(1-2*margin),h:cropCanvas.height*(1-2*margin)};
 cropStage.hidden=false;document.querySelector('#cropPhotoActions').hidden=false;
 document.querySelector('#applyProductCrop').hidden=false;document.querySelector('#cancelProductCrop').hidden=false;
 drawCrop();
});
function cropPoint(e){const r=cropCanvas.getBoundingClientRect();return{x:(e.clientX-r.left)*cropCanvas.width/r.width,y:(e.clientY-r.top)*cropCanvas.height/r.height};}
cropCanvas.addEventListener('pointerdown',e=>{
 if(!cropRect)return;
 e.preventDefault();const pt=cropPoint(e),r=cropRect;
 const bounds=cropCanvas.getBoundingClientRect(),tol=26*cropCanvas.width/bounds.width;
 const handle=cropHandles(r).find(h=>Math.hypot(pt.x-h.x,pt.y-h.y)<=tol);
 const inside=pt.x>=r.x&&pt.x<=r.x+r.w&&pt.y>=r.y&&pt.y<=r.y+r.h;
 if(!handle&&!inside)return;
 cropGesture={id:e.pointerId,type:handle?.name||'move',start:pt,rect:{...r}};
 cropCanvas.setPointerCapture(e.pointerId);
});
cropCanvas.addEventListener('pointermove',e=>{
 if(!cropGesture||cropGesture.id!==e.pointerId)return;
 e.preventDefault();const pt=cropPoint(e),g=cropGesture,dx=pt.x-g.start.x,dy=pt.y-g.start.y;
 const W=cropCanvas.width,H=cropCanvas.height,min=Math.max(8,Math.min(W,H)*.025);
 let l=g.rect.x,t=g.rect.y,r=l+g.rect.w,b=t+g.rect.h;
 if(g.type==='move'){
  l=Math.max(0,Math.min(W-g.rect.w,l+dx));t=Math.max(0,Math.min(H-g.rect.h,t+dy));
  r=l+g.rect.w;b=t+g.rect.h;
 }else{
  if(g.type.includes('w'))l=Math.max(0,Math.min(r-min,l+dx));
  if(g.type.includes('e'))r=Math.min(W,Math.max(l+min,r+dx));
  if(g.type.includes('n'))t=Math.max(0,Math.min(b-min,t+dy));
  if(g.type.includes('s'))b=Math.min(H,Math.max(t+min,b+dy));
 }
 cropRect={x:l,y:t,w:r-l,h:b-t};drawCrop();
});
function endCropGesture(e){if(cropGesture?.id!==e.pointerId)return;cropGesture=null;if(cropCanvas.hasPointerCapture(e.pointerId))cropCanvas.releasePointerCapture(e.pointerId);}
cropCanvas.addEventListener('pointerup',endCropGesture);
cropCanvas.addEventListener('pointercancel',endCropGesture);
function closeCrop(){cropGesture=null;cropStage.hidden=true;document.querySelector('#cropPhotoActions').hidden=true;document.querySelector('#applyProductCrop').hidden=true;document.querySelector('#cancelProductCrop').hidden=true;}
document.querySelector('#cancelProductCrop').addEventListener('click',closeCrop);
document.querySelector('#applyProductCrop').addEventListener('click',async()=>{if(!cropRect||cropRect.w<5||cropRect.h<5)return;const c=document.createElement('canvas');c.width=Math.round(cropRect.w);c.height=Math.round(cropRect.h);c.getContext('2d').drawImage(productPhotoCanvas,cropRect.x,cropRect.y,cropRect.w,cropRect.h,0,0,c.width,c.height);await updateProductPhotoFromCanvas(c);closeCrop();});
productPhotoInput.addEventListener('change',setProductPhoto);
productPhotoCamera.addEventListener('change',setProductPhoto);
// Lightweight local background removal: estimate the backdrop from the image border.
// Works best for a plain, contrasting backdrop; does not use external services.
document.querySelector('#removeProductBackground').addEventListener('click',async()=>{
 if(!productPhotoBlob)return;
 const button=document.querySelector('#removeProductBackground');button.disabled=true;
 try{
  const bitmap=await createImageBitmap(productPhotoBlob);
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close?.();
  const {width:w,height:h}=canvas,image=ctx.getImageData(0,0,w,h),d=image.data;
  const corners=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]];
  const bg=[0,1,2].map(k=>corners.reduce((sum,[x,y])=>sum+d[(y*w+x)*4+k],0)/4);
  const diff=(i)=>Math.hypot(d[i]-bg[0],d[i+1]-bg[1],d[i+2]-bg[2]);
  const visited=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
  const enqueue=(x,y)=>{if(x<0||x>=w||y<0||y>=h)return;const n=y*w+x;if(visited[n]||diff(n*4)>65)return;visited[n]=1;queue[tail++]=n;};
  for(let x=0;x<w;x++){enqueue(x,0);enqueue(x,h-1);}
  for(let y=0;y<h;y++){enqueue(0,y);enqueue(w-1,y);}
  while(head<tail){const n=queue[head++],x=n%w,y=(n/w)|0;enqueue(x-1,y);enqueue(x+1,y);enqueue(x,y-1);enqueue(x,y+1);}
  for(let n=0;n<visited.length;n++)if(visited[n])d[n*4+3]=0;
  ctx.putImageData(image,0,0);
  productPhotoBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!productPhotoBlob)throw Error('Unable to save photo');
  if(productPhotoPreview.src.startsWith('blob:'))URL.revokeObjectURL(productPhotoPreview.src);
  productPhotoPreview.src=URL.createObjectURL(productPhotoBlob);
  barcodeMessage.textContent='Background removed. Check the edges before continuing; use Upload to replace if needed.';
 }catch(error){barcodeMessage.textContent='Background removal failed: '+error.message;}
 finally{button.disabled=false;}
});

const itemPlacement = document.querySelector('#itemPlacement');
const shotView = document.querySelector('#shotView');
const shotIndicator = document.querySelector('#shotIndicator');
const dualStatus = document.querySelector('#dualStatus');
const combinedDimensions = document.querySelector('#combinedDimensions');
const saveDualItem = document.querySelector('#saveDualItem');
const newItemButton = document.querySelector('#newItemButton');
let dualRecordSaved = false;
let nextItemTimer = null;
let dualRecordSaving = false;
let activeShot = 0;
let dualShots = [null, null];
let dualPlacement = 'upright';
const viewAxes = {
  upright: {front:['length','height'],side:['width','height'],top:['length','width']},
  horizontal: {front:['length','width'],side:['height','width'],top:['length','height']}
};
function currentShotView(){return activeShot===0?'front':shotView.value;}
function dualDimensions(){
  const dims = {length:[],width:[],height:[]};
  for (const shot of dualShots) {
    if(!shot || shot.view==='blank')continue;
    const axes=viewAxes[dualPlacement][shot.view];
    dims[axes[0]].push(shot.horizontalCm);
    dims[axes[1]].push(shot.verticalCm);
  }
  return Object.fromEntries(Object.entries(dims).map(([k,v])=>[k,v.length?Math.max(...v):null]));
}
function refreshDual(){
  shotIndicator.textContent=`Image ${activeShot+1} / 2`;
  shotView.value=activeShot===0?'front':(dualShots[1]?.view || (shotView.value==='front' ? 'side' : shotView.value));
  [...shotView.options].forEach(o=>o.disabled=activeShot===0?o.value!=='front':o.value==='front');
  shotView.disabled=activeShot===0;
  itemPlacement.disabled=!!dualShots[0] || !!dualShots[1];
  document.querySelectorAll(".placement-example").forEach(el=>{el.disabled=itemPlacement.disabled;el.setAttribute("aria-pressed",String(el.dataset.placement===itemPlacement.value));});
  const d=dualDimensions();
  combinedDimensions.textContent=`Length ${d.length?.toFixed(2)??'—'} · Width ${d.width?.toFixed(2)??'—'} · Height ${d.height?.toFixed(2)??'—'} cm`;
  saveDualItem.disabled=dualRecordSaved || dualRecordSaving || !dualShots[0] || (!dualShots[1] && shotView.value!=='blank');
  saveDualItem.textContent=dualRecordSaved?'Saved':(dualRecordSaving?'Saving...':'Save Both Images');
  if(dualRecordSaved){dualStatus.textContent='Saved successfully. Use New Item above the camera to start another product.';return;}
  dualStatus.textContent=dualShots[activeShot]?`Image ${activeShot+1} confirmed (${dualShots[activeShot].view}). You can retake it.`:`Image ${activeShot+1}: ${activeShot===1&&shotView.value==='blank'?'No second image required; dimensions will remain incomplete.':'Capture, adjust frame, then confirm.'}`;
}
const manualMeasurement = document.querySelector('#manualMeasurement');
const editHorizontalCm = document.querySelector('#editHorizontalCm');
const editVerticalCm = document.querySelector('#editVerticalCm');
function showMeasurementInputs(shot) {
  manualMeasurement.hidden = !shot;
  if (!shot) return;
  editHorizontalCm.value = shot.horizontalCm.toFixed(2);
  editVerticalCm.value = shot.verticalCm.toFixed(2);
}
const resultFrameOverlay=document.querySelector('#resultFrameOverlay');
let resultDrag=null;
function syncResultOverlay(){
  const shot=dualShots[activeShot];
  if(!shot || capturedPreview.hidden || !frameEditorStage.hidden || dualRecordSaved){resultFrameOverlay.hidden=true;return;}
  const rect=capturedPreview.getBoundingClientRect();
  if(!rect.width || !rect.height){resultFrameOverlay.hidden=true;return;}
  const scale=Math.min(rect.width/shot.canvas.width,rect.height/shot.canvas.height);
  const w=shot.canvas.width*scale,h=shot.canvas.height*scale;
  resultFrameOverlay.hidden=false;
  resultFrameOverlay.style.left=`${(rect.width-w)/2}px`;
  resultFrameOverlay.style.top=`${(rect.height-h)/2}px`;
  resultFrameOverlay.style.width=`${w}px`;
  resultFrameOverlay.style.height=`${h}px`;
  resultFrameOverlay.width=shot.canvas.width;resultFrameOverlay.height=shot.canvas.height;
  const ctx=resultFrameOverlay.getContext('2d');const f=shot.frame;
  ctx.lineWidth=Math.max(4,shot.canvas.width/250);ctx.strokeStyle='#36e37e';
  ctx.strokeRect(f.x,f.y,f.width,f.height);
  if(shot.marker){ctx.strokeStyle='#00baff';ctx.strokeRect(shot.marker.x,shot.marker.y,shot.marker.width,shot.marker.height);}
  if(!dualRecordSaving){ctx.fillStyle='#36e37e';ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(2,shot.canvas.width/650);
    for(const [x,y] of [[f.x,f.y],[f.x+f.width,f.y],[f.x,f.y+f.height],[f.x+f.width,f.y+f.height]]){
      const r=Math.max(8,shot.canvas.width/130);ctx.fillRect(x-r,y-r,r*2,r*2);ctx.strokeRect(x-r,y-r,r*2,r*2);
    }
  }
}
function resultPoint(event){const r=resultFrameOverlay.getBoundingClientRect();return {x:(event.clientX-r.left)*resultFrameOverlay.width/r.width,y:(event.clientY-r.top)*resultFrameOverlay.height/r.height};}
resultFrameOverlay.addEventListener('pointerdown',event=>{
  const shot=dualShots[activeShot];if(!shot || dualRecordSaved || dualRecordSaving)return;
  const pt=resultPoint(event),f=shot.frame,t=Math.max(22,shot.canvas.width/45);
  const corners=[['nw',f.x,f.y],['ne',f.x+f.width,f.y],['sw',f.x,f.y+f.height],['se',f.x+f.width,f.y+f.height]];
  let hit=corners.find(([,x,y])=>Math.hypot(x-pt.x,y-pt.y)<=t)?.[0];
  if(!hit && pt.x>=f.x && pt.x<=f.x+f.width && pt.y>=f.y && pt.y<=f.y+f.height)hit='move';
  if(!hit)return;
  resultDrag={hit,start:pt,frame:{...f},shot};resultFrameOverlay.setPointerCapture(event.pointerId);event.preventDefault();
});
resultFrameOverlay.addEventListener('pointermove',event=>{
  if(!resultDrag || dualRecordSaved)return;
  const {hit,start,frame:f,shot}=resultDrag,pt=resultPoint(event),dx=pt.x-start.x,dy=pt.y-start.y;
  const W=shot.canvas.width,H=shot.canvas.height,min=Math.max(4,W/500);
  let l=f.x,r=f.x+f.width,t=f.y,b=f.y+f.height;
  if(hit==='move') {const x=Math.max(0,Math.min(W-f.width,f.x+dx)),y=Math.max(0,Math.min(H-f.height,f.y+dy));l=x;r=x+f.width;t=y;b=y+f.height;}
  else {if(hit.includes('w'))l=Math.max(0,Math.min(r-min,l+dx));if(hit.includes('e'))r=Math.min(W,Math.max(l+min,r+dx));if(hit.includes('n'))t=Math.max(0,Math.min(b-min,t+dy));if(hit.includes('s'))b=Math.min(H,Math.max(t+min,b+dy));}
  shot.frame={x:l,y:t,width:r-l,height:b-t};
  const px=((shot.marker.width+shot.marker.height)/2)/markerSizeCm;
  shot.horizontalCm=Number((shot.frame.width/px).toFixed(2));shot.verticalCm=Number((shot.frame.height/px).toFixed(2));
  editHorizontalCm.value=shot.horizontalCm.toFixed(2);editVerticalCm.value=shot.verticalCm.toFixed(2);
  commitMeasurementFrame(shot);event.preventDefault();
});
for(const type of ['pointerup','pointercancel'])resultFrameOverlay.addEventListener(type,event=>{if(resultDrag){resultDrag=null;if(resultFrameOverlay.hasPointerCapture(event.pointerId))resultFrameOverlay.releasePointerCapture(event.pointerId);}});
window.addEventListener('resize',syncResultOverlay);
// Keep the reference marker fixed: edited dimensions change the item rectangle, not the scale.
let measurementRenderToken = 0;
function renderManualMeasurement(shot) {
  const canvas=document.createElement('canvas');canvas.width=shot.canvas.width;canvas.height=shot.canvas.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(shot.canvas,0,0);
  const lw=Math.max(6,canvas.width/220);ctx.lineWidth=lw;
  ctx.strokeStyle='#36e37e';ctx.strokeRect(shot.frame.x,shot.frame.y,shot.frame.width,shot.frame.height);
  if(shot.marker){ctx.strokeStyle='#00baff';ctx.strokeRect(shot.marker.x,shot.marker.y,shot.marker.width,shot.marker.height);}
  const font=Math.max(30,canvas.width/32);ctx.font=`700 ${font}px system-ui`;
  const lines=[`Barcode: ${shot.barcode}`,`Horizontal: ${shot.horizontalCm.toFixed(2)} cm`,`Vertical: ${shot.verticalCm.toFixed(2)} cm`];
  const pad=font*.45,w=Math.max(...lines.map(t=>ctx.measureText(t).width))+pad*2,bh=font*3.65;
  const x=Math.max(0,Math.min(canvas.width-w,shot.frame.x)),y=Math.max(0,Math.min(canvas.height-bh,shot.frame.y-bh-lw));
  ctx.fillStyle='rgba(0,0,0,.78)';ctx.fillRect(x,y,w,bh);ctx.fillStyle='#fff';
  lines.forEach((line,i)=>ctx.fillText(line,x+pad,y+font*(1.05+i*1.1)));
  return canvas;
}
function applyManualMeasurement() {
  const shot = dualShots[activeShot];
  if (!shot || dualRecordSaved || dualRecordSaving || !shot.marker) return;
  const h = Number(editHorizontalCm.value), v = Number(editVerticalCm.value);
  if (!editHorizontalCm.value || !editVerticalCm.value || !Number.isFinite(h) || !Number.isFinite(v) || h<=0 || v<=0 || h>10000 || v>10000) return;
  const pxPerCm=((shot.marker.width+shot.marker.height)/2)/markerSizeCm;
  const width=h*pxPerCm,height=v*pxPerCm;
  if(width>shot.canvas.width || height>shot.canvas.height){
    dualStatus.textContent='The requested frame exceeds the photo. Reduce the measurement.';
    return;
  }
  const centerX=shot.frame.x+shot.frame.width/2,centerY=shot.frame.y+shot.frame.height/2;
  shot.frame={x:Math.max(0,Math.min(shot.canvas.width-width,centerX-width/2)),y:Math.max(0,Math.min(shot.canvas.height-height,centerY-height/2)),width,height};
  shot.horizontalCm=Number(h.toFixed(2));shot.verticalCm=Number(v.toFixed(2));
  commitMeasurementFrame(shot);
}
function commitMeasurementFrame(shot){
  if(currentMeasurement){currentMeasurement.horizontalCm=shot.horizontalCm;currentMeasurement.verticalCm=shot.verticalCm;}
  editableFrame={...shot.frame};
  horizontalSize.textContent=`${shot.horizontalCm.toFixed(2)} cm`;
  verticalSize.textContent=`${shot.verticalCm.toFixed(2)} cm`;
  analysisReason.textContent='Manually adjusted measurement and frame';
  const canvas=renderManualMeasurement(shot);
  capturedPreview.src=canvas.toDataURL('image/jpeg',.88);
  syncResultOverlay();
  const token=++measurementRenderToken,shotIndex=activeShot;
  clearTimeout(applyManualMeasurement.timer);
  applyManualMeasurement.timer=setTimeout(async()=>{
    const blob=await canvasToBlob(canvas,.94);
    if(token!==measurementRenderToken || dualShots[shotIndex]!==shot)return;
    if(shot.previewUrl)URL.revokeObjectURL(shot.previewUrl);
    shot.previewUrl=URL.createObjectURL(blob);
    if(activeShot===shotIndex)capturedPreview.src=shot.previewUrl;
    // The saved item crop must match the resized result frame.
    const crop=document.createElement('canvas');crop.width=Math.max(1,Math.round(shot.frame.width));crop.height=Math.max(1,Math.round(shot.frame.height));
    crop.getContext('2d').drawImage(shot.canvas,shot.frame.x,shot.frame.y,shot.frame.width,shot.frame.height,0,0,crop.width,crop.height);
    shot.blob=await canvasToBlob(crop,.94);
    if(activeShot===shotIndex)currentItemImageBlob=shot.blob;
    syncResultOverlay();
  },180);
  refreshDual();
}
editHorizontalCm.addEventListener('input',applyManualMeasurement);
editVerticalCm.addEventListener('input',applyManualMeasurement);

function showShot(index){
  if(index<0||index>1)return;
  activeShot=index;
  const shot=dualShots[index];
  if(shot){
    capturedFullCanvas=shot.canvas;
    capturedMarker=shot.marker;
    editableFrame={...shot.frame};
    systemFrame={...shot.frame};
    currentMeasurement={...shot};
    currentItemImageBlob=shot.blob;
    capturedPreview.hidden=false;
    capturedPreview.src=shot.previewUrl;
    frameEditorStage.hidden=true;
    captureResult.hidden=false;
    horizontalSize.textContent=`${shot.horizontalCm.toFixed(2)} cm`;
    verticalSize.textContent=`${shot.verticalCm.toFixed(2)} cm`;
    analysisStatus.textContent='MEASURED';
    showMeasurementInputs(shot);
    requestAnimationFrame(syncResultOverlay);
  }else{
    captureResult.hidden=true;
    currentMeasurement=null;
    capturedPreview.hidden=true;
    showMeasurementInputs(null);
    resultFrameOverlay.hidden=true;
  }
  refreshDual();
}
function resetDual(){
  clearTimeout(nextItemTimer);
  nextItemTimer = null;
  for(const shot of dualShots)if(shot?.previewUrl)URL.revokeObjectURL(shot.previewUrl);
  dualShots=[null,null];activeShot=0;dualPlacement=itemPlacement.value;dualRecordSaved=false;dualRecordSaving=false;
  shotView.value='front';refreshDual();
}
function updatePlacementExamples(){document.querySelectorAll('.placement-example').forEach(el=>{const selected=el.dataset.placement===itemPlacement.value;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));});}
document.querySelectorAll('.placement-example').forEach(el=>el.addEventListener('click',()=>{if(itemPlacement.disabled)return;itemPlacement.value=el.dataset.placement;itemPlacement.dispatchEvent(new Event('change'));}));
itemPlacement.addEventListener('change',()=>{dualPlacement=itemPlacement.value;refreshDual();updatePlacementExamples();});
updatePlacementExamples();
shotView.addEventListener('change',()=>{if(activeShot===1&&dualShots[1]){dualShots[1].view=shotView.value;}refreshDual();});
document.querySelector('#previousShot').addEventListener('click',()=>showShot(0));
document.querySelector('#nextShot').addEventListener('click',()=>showShot(1));
let swipeStart=null;
document.querySelector('#captureResult').addEventListener('touchstart',e=>{if(manualFrameEnabled || markerPicking || e.target.closest('#frameEditorStage')){swipeStart=null;return;}swipeStart={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
document.querySelector('#captureResult').addEventListener('touchend',e=>{if(!swipeStart || manualFrameEnabled || markerPicking)return;const dx=e.changedTouches[0].clientX-swipeStart.x,dy=e.changedTouches[0].clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)>90&&Math.abs(dx)>Math.abs(dy)*1.5)showShot(dx<0?1:0);},{passive:true});
async function saveDualRecord(){
  if(dualRecordSaved || dualRecordSaving)return;
  const dims=dualDimensions();
  if(!dualShots[0])return;
  if(!dualShots[1]&&shotView.value!=='blank')return;
  if(!currentProductPhotoBlob){dualStatus.textContent='Item photo required. Return to barcode step.';return;}
  // Finish pending preview and crop updates before persisting.
  if(applyManualMeasurement.timer){clearTimeout(applyManualMeasurement.timer);applyManualMeasurement.timer=null;for(const shot of dualShots){if(!shot)continue;const crop=document.createElement("canvas");crop.width=Math.max(1,Math.round(shot.frame.width));crop.height=Math.max(1,Math.round(shot.frame.height));crop.getContext("2d").drawImage(shot.canvas,shot.frame.x,shot.frame.y,shot.frame.width,shot.frame.height,0,0,crop.width,crop.height);shot.blob=await canvasToBlob(crop,.94);}}
  dualRecordSaving=true;refreshDual();
  const productPhotoId=crypto.randomUUID?crypto.randomUUID():`photo-${Date.now()}`;
  await saveItemImage(productPhotoId,`${currentBarcode}_product.jpg`,currentProductPhotoBlob);
  const record={productPhotoId,barcode:currentBarcode,placement:dualPlacement,lengthCm:dims.length,widthCm:dims.width,heightCm:dims.height,status:Object.values(dims).some(v=>v===null)?'Review Required':'Complete',measuredAt:new Date().toISOString(),shots:[]};
  for(let i=0;i<2;i++){
    const shot=dualShots[i];if(!shot)continue;
    const id=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${i}`;
    const shotFilename=`${currentBarcode}_${dualPlacement}_${shot.view}_image${i+1}.jpg`;
    await saveItemImage(id,shotFilename,shot.blob);
    record.shots.push({view:shot.view,placement:dualPlacement,horizontalCm:shot.horizontalCm,verticalCm:shot.verticalCm,imageId:id,imageFilename:shotFilename,frameType:shot.frameType});
  }
  measurementRecords.push(record);
  localStorage.setItem('object-measurement-records-v1',JSON.stringify(measurementRecords));
  updateHistoryCount();
  currentMeasurement={...dualShots[activeShot],saved:true};
  dualRecordSaved=true;dualRecordSaving=false;refreshDual();
  if(record.status!=='Complete')dualStatus.textContent='Saved (Review Required: missing dimension).';
  // Show Saved briefly, then reuse the existing New Item workflow.
  nextItemTimer = setTimeout(() => {
    nextItemTimer = null;
    resetDual();
    prepareForNextBarcode();
  }, 900);
}
saveDualItem.addEventListener('click',()=>saveDualRecord().catch(e=>{dualRecordSaving=false;refreshDual();dualStatus.textContent=`Save failed: ${e.message}`;}));
// A single New Item action works before and after saving.
newItemButton.addEventListener('click', () => {
  clearTimeout(nextItemTimer);
  nextItemTimer = null;
  if (dualRecordSaving) return;
  if (!dualRecordSaved && (dualShots.some(Boolean) || currentMeasurement)) {
    if (!confirm('Current unsaved measurements will be discarded. Start a new item?')) return;
  }
  resetDual();
  prepareForNextBarcode();
});

const overlay = document.querySelector("#overlay");
const overlayCtx = overlay.getContext("2d");
const workCanvas = document.querySelector("#processingCanvas");
const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
const startButton = document.querySelector("#startButton");
const calibrateButton = document.querySelector("#calibrateButton");
const detectButton = document.querySelector("#detectButton");
const captureButton = document.querySelector("#captureButton");
const captureResult = document.querySelector("#captureResult");
const closeResultButton = document.querySelector("#closeResultButton");
const capturedPreview = document.querySelector("#capturedPreview");
const pixelSize = document.querySelector("#pixelSize");
const imageSize = document.querySelector("#imageSize");
const frameCoverage = document.querySelector("#frameCoverage");
const horizontalSize = document.querySelector("#horizontalSize");
const verticalSize = document.querySelector("#verticalSize");
const referenceScale = document.querySelector("#referenceScale");
const analysisStatus = document.querySelector("#analysisStatus");
const analysisReason = document.querySelector("#analysisReason");
const homePage = document.querySelector("#homePage");
const measurementPage = document.querySelector("#measurementPage");
const startMeasurementButton = document.querySelector("#startMeasurementButton");
const homeHistoryButton = document.querySelector("#homeHistoryButton");
const homeHistoryCount = document.querySelector("#homeHistoryCount");
const homeButton = document.querySelector("#homeButton");
const frameEditorStage = document.querySelector("#frameEditorStage");
const frameEditor = document.querySelector("#frameEditor");
const frameEditorCtx = frameEditor.getContext("2d");
const editorHint = document.querySelector("#editorHint");
const useSystemFrameButton = document.querySelector("#useSystemFrame");
const manualFrameButton = document.querySelector("#manualFrame");
const undoFrameButton = document.querySelector("#undoFrame");
const redoFrameButton = document.querySelector("#redoFrame");
const resetFrameButton = document.querySelector("#resetFrame");
const confirmFrameButton = document.querySelector("#confirmFrame");


const barcodeDialog = document.querySelector("#barcodeDialog");
const barcodeForm = document.querySelector("#barcodeForm");
const barcodeInput = document.querySelector("#barcodeInput");
const barcodeMessage = document.querySelector("#barcodeMessage");
const barcodeVideo = document.querySelector("#barcodeVideo");
const scanBarcodeButton = document.querySelector("#scanBarcodeButton");
const stopBarcodeScanButton = document.querySelector("#stopBarcodeScanButton");
const saveRecordDialog = document.querySelector("#saveRecordDialog");
const saveRecordSummary = document.querySelector("#saveRecordSummary");
const saveRecordButton = document.querySelector("#saveRecordButton");
const skipSaveButton = document.querySelector("#skipSaveButton");
const cancelNextItemButton = document.querySelector("#cancelNextItemButton");
const duplicateBarcodeDialog = document.querySelector("#duplicateBarcodeDialog");
const duplicateBarcodeMessage = document.querySelector("#duplicateBarcodeMessage");
const replaceDuplicateButton = document.querySelector("#replaceDuplicateButton");
const keepDuplicateButton = document.querySelector("#keepDuplicateButton");
const cancelDuplicateButton = document.querySelector("#cancelDuplicateButton");
const historyButton = document.querySelector("#historyButton");
const historyCount = document.querySelector("#historyCount");
const historyDialog = document.querySelector("#historyDialog");
const closeHistoryButton = document.querySelector("#closeHistoryButton");
const historyTableBody = document.querySelector("#historyTableBody");
const emptyHistory = document.querySelector("#emptyHistory");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const exportImagesButton = document.querySelector("#exportImagesButton");
const exportHistoryButton = document.querySelector("#exportHistoryButton");
const exportNotice = document.querySelector("#exportNotice");
const exportNoticeTitle = document.querySelector("#exportNoticeTitle");
const exportNoticeFilename = document.querySelector("#exportNoticeFilename");
const exportFileLink = document.querySelector("#exportFileLink");
const thresholdInput = document.querySelector("#threshold");
const minAreaInput = document.querySelector("#minArea");
const thresholdValue = document.querySelector("#thresholdValue");
const areaValue = document.querySelector("#areaValue");
const cameraState = document.querySelector("#cameraState");
const detectionStatus = document.querySelector("#detectionStatus");
const confidenceText = document.querySelector("#confidence");
const fpsText = document.querySelector("#fps");
const markerStatus = document.querySelector("#markerStatus");
const liveMessage = document.querySelector("#liveMessage");
const emptyState = document.querySelector("#emptyState");


const referenceSizeSelect = document.querySelector('#referenceSize');
const referenceDownload = document.querySelector('#referenceDownload');
const placementHint = document.querySelector('#placementHint');
const tapFocusIndicator = document.querySelector('#tapFocusIndicator');
const MARKER_ON_ITEM = true;
let markerPicking = false;
let markerPoints = [];
let markerGesture = null;
let editableMarker = null;
const manualMarkerButton = document.querySelector('#manualMarkerButton');
manualMarkerButton.textContent = 'Manual Marker (Adjust Blue Frame)';
manualMarkerButton.addEventListener('click', () => {
  if (!capturedFullCanvas) return;
  markerPicking = true;
  frameGesture=null;
  manualFrameEnabled = false;
  markerPoints = [];
  const w = frameEditor.width, h = frameEditor.height;
  editableMarker = capturedMarker ? { ...capturedMarker } : {
    x: w * .35, y: h * .35, width: w * .3, height: h * .3
  };
  editorHint.textContent = 'Drag the BLUE frame onto the printed marker. Drag its corners or edges to resize. Tap Confirm Frame & Measure when ready.';
  renderFrameEditor();
});
function markerHit(point) {
  if (!editableMarker) return null;
  const rect = frameEditor.getBoundingClientRect();
  const tolerance = 32 * frameEditor.width / Math.max(rect.width, 1);
  const handle = frameHandles(editableMarker).find(h => Math.hypot(point.x-h.x, point.y-h.y) <= tolerance);
  if (handle) return handle.name;
  return point.x >= editableMarker.x && point.x <= editableMarker.x + editableMarker.width &&
    point.y >= editableMarker.y && point.y <= editableMarker.y + editableMarker.height ? 'move' : null;
}
frameEditor.addEventListener('pointerdown', event => {
  if (!markerPicking || editorTouches.size > 1 || editorViewGesture) return;
  event.stopImmediatePropagation();
  const point = editorPoint(event);
  const type = markerHit(point);
  if (!type) return;
  frameEditor.setPointerCapture(event.pointerId);
  markerGesture = { type, start: point, frame: { ...editableMarker } };
}, {capture:true});
frameEditor.addEventListener('pointermove', event => {
  if (!markerPicking || !markerGesture || editorTouches.size > 1 || editorViewGesture) return;
  event.stopImmediatePropagation();
  const point = editorPoint(event), start = markerGesture.frame;
  const dx = point.x-markerGesture.start.x, dy = point.y-markerGesture.start.y;
  let l=start.x,t=start.y,r=start.x+start.width,b=start.y+start.height;
  const type=markerGesture.type;
  if(type==='move'){l+=dx;r+=dx;t+=dy;b+=dy;}
  else {
    if(type.includes('w'))l+=dx;
    if(type.includes('e'))r+=dx;
    if(type.includes('n'))t+=dy;
    if(type.includes('s'))b+=dy;
  }
  const min=Math.max(12,Math.min(frameEditor.width,frameEditor.height)*.012);
  if(r-l<min){if(type.includes('w'))l=r-min;else r=l+min;}
  if(b-t<min){if(type.includes('n'))t=b-min;else b=t+min;}
  if(type==='move'){
    const w=r-l,h=b-t;
    l=Math.max(0,Math.min(frameEditor.width-w,l));
    t=Math.max(0,Math.min(frameEditor.height-h,t));r=l+w;b=t+h;
  }
  l=Math.max(0,l);t=Math.max(0,t);r=Math.min(frameEditor.width,r);b=Math.min(frameEditor.height,b);
  editableMarker={x:l,y:t,width:r-l,height:b-t};
  renderFrameEditor();
}, {capture:true});
function finishMarkerGesture(event) {
  if (!markerPicking || !markerGesture) return;
  event.stopImmediatePropagation();
  if(frameEditor.hasPointerCapture(event.pointerId))frameEditor.releasePointerCapture(event.pointerId);
  markerGesture=null;
}
frameEditor.addEventListener('pointerup',finishMarkerGesture,{capture:true});
frameEditor.addEventListener('pointercancel',finishMarkerGesture,{capture:true});
function commitEditableMarker(){
  if(!markerPicking || !editableMarker)return;
  const m=editableMarker;
  if(m.width<12 || m.height<12 || Math.max(m.width,m.height)/Math.min(m.width,m.height)>1.6){
    editorHint.textContent='Marker frame is too narrow or distorted. Adjust the BLUE frame to the printed square.';
    return false;
  }
  capturedMarker={...m,manual:true};
  markerPicking=false;
  markerStatus.textContent='Manual calibration';
  referenceScale.textContent=`${(((m.width+m.height)/2)/markerSizeCm).toFixed(2)} px/cm`;
  editorHint.textContent='Blue marker frame calibrated. You can adjust the item frame or confirm measurement.';
  renderFrameEditor();
  return true;
}

let markerSizeCm = 5;
referenceSizeSelect.addEventListener('change', () => {
  markerSizeCm = Number(referenceSizeSelect.value);
  referenceDownload.href = `reference/${markerSizeCm}cm_reference_marker.pdf`;
  liveMarker = null; capturedMarker = null;
  markerStatus.textContent = 'Recheck marker after size change';
  if (capturedFullCanvas) {
    const ctx = capturedFullCanvas.getContext('2d', {willReadFrequently:true});
    const image = ctx.getImageData(0,0,capturedFullCanvas.width,capturedFullCanvas.height);
    capturedMarker = detectReferenceMarker(image.data,image.width,image.height);
    referenceScale.textContent = capturedMarker ? `${(((capturedMarker.width+capturedMarker.height)/2)/markerSizeCm).toFixed(2)} px/cm` : '—';
  }
});
placementHint.textContent = MARKER_ON_ITEM
  ? 'Version A: place marker flat on item top; marker may overlap item frame. Measure the same top plane.'
  : 'Version B: place marker beside the item, facing the camera, at the same depth as the measured face.';
video.addEventListener('pointerdown', async event => {
  if (!running || !stream) return;
  const rect = video.getBoundingClientRect();
  tapFocusIndicator.hidden = false;
  tapFocusIndicator.style.left = `${event.clientX - rect.left + video.offsetLeft}px`;
  tapFocusIndicator.style.top = `${event.clientY - rect.top + video.offsetTop}px`;
  const track = stream.getVideoTracks()[0];
  try {
    const caps = track.getCapabilities?.() || {};
    if (caps.focusMode?.includes('single-shot')) await track.applyConstraints({advanced:[{focusMode:'single-shot',pointsOfInterest:[{x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height}]}]});
    else if (caps.focusMode?.includes('continuous')) await track.applyConstraints({advanced:[{focusMode:'continuous'}]});
  } catch (error) { /* Browser may not support focus controls; auto-focus remains active. */ }
  setTimeout(() => { tapFocusIndicator.hidden = true; }, 900);
});

const PROCESS_WIDTH = 320;
const PROCESS_INTERVAL_MS = 80;
const SMOOTHING = 0.32;

let stream = null;
let running = false;
let lastProcessed = 0;
let previousTick = performance.now();
let backgroundFrame = null;
let smoothedBox = null;
let missingFrames = 0;
let stableFrames = 0;
let previousDetectionBox = null;
let lastValidBox = null;
let captureUrl = null;
let capturedFilename = "object-capture.jpg";
let detectionActive = false;
let liveMarker = null;
let markerMissingFrames = 0;
let capturedFullCanvas = null;
let capturedMarker = null;
let systemFrame = null;
let editableFrame = null;
let frameHistory = [];
let frameHistoryIndex = -1;
let manualFrameEnabled = false;
let frameGesture = null;
let currentBarcode = "";
let currentMeasurement = null;
let currentItemImageBlob = null;
let pendingRecordAction = null;
let activeExportUrl = null;
let barcodeStream = null;
let barcodeScanRunning = false;
let pendingBarcode = "";
let measurementRecords = loadMeasurementRecords();

thresholdInput.addEventListener("input", () => {
  thresholdValue.value = thresholdInput.value;
});
minAreaInput.addEventListener("input", () => {
  areaValue.value = `${(Number(minAreaInput.value) / 10).toFixed(1)}%`;
});

startButton.addEventListener("click", async () => {
  if (running) {
    stopCamera();
    return;
  }
  await startCamera();
});

calibrateButton.addEventListener("click", async () => {
  if (!running || video.readyState < 2) return;
  calibrateButton.disabled = true;
  detectButton.disabled = true;
  captureButton.disabled = false;
  detectionActive = false;
  calibrateButton.textContent = "Saving Background…";
  detectionStatus.textContent = "Capturing empty background";
  liveMessage.textContent = "Keep the scene empty and hold the phone still";
  backgroundFrame = await captureAveragedBackground(10);
  smoothedBox = null;
  stableFrames = 0;
  previousDetectionBox = null;
  lastValidBox = null;
  liveMarker = null;
  markerMissingFrames = 0;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  detectionStatus.textContent = "Empty background saved";
  liveMessage.textContent = "Place the item and marker, then tap Detect Object";
  markerStatus.textContent = "Waiting for Detect Object";
  calibrateButton.textContent = "Set Empty Background Again";
  calibrateButton.disabled = false;
  detectButton.disabled = false;
});

detectButton.addEventListener("click", () => {
  if (currentMeasurement) {
    if (currentMeasurement.saved) prepareForNextBarcode();
    else requestRecordDecision("detect");
    return;
  }
  beginDetection();
});

function beginDetection() {
  if (!running || !backgroundFrame) return;
  detectionActive = true;
  smoothedBox = null;
  stableFrames = 0;
  previousDetectionBox = null;
  lastValidBox = null;
  liveMarker = null;
  markerMissingFrames = 0;
  captureButton.disabled = false;
  detectButton.textContent = "Detecting…";
  detectionStatus.textContent = "Looking for item and marker";
  liveMessage.textContent = "Green frame = item; cyan frame = reference marker";
}

captureButton.addEventListener("click", () => {
  captureCurrentObject().catch(error => {
    console.error("Capture failed:", error);
    captureButton.disabled = !running;
    captureButton.setAttribute("aria-label", "Capture object");
    captureButton.title = "Capture object";
    liveMessage.textContent = `Capture failed: ${error.message || error}. Please retry.`;
  });
});
closeResultButton.addEventListener("click", () => { captureResult.hidden = true; });
useSystemFrameButton.addEventListener("click", useDetectedFrame);
manualFrameButton.addEventListener("click", enableManualFrame);
undoFrameButton.addEventListener("click", undoFrameEdit);
redoFrameButton.addEventListener("click", redoFrameEdit);
resetFrameButton.addEventListener("click", resetFrameEdit);
confirmFrameButton.addEventListener("click", confirmFrameAndMeasure);
frameEditor.addEventListener("pointerdown", beginFrameEdit);
frameEditor.addEventListener("pointermove", moveFrameEdit);
frameEditor.addEventListener("pointerup", endFrameEdit);
frameEditor.addEventListener("pointercancel", endFrameEdit);
barcodeForm.addEventListener("submit", acceptBarcode);
startMeasurementButton.addEventListener("click", openBarcodeDialog);
homeHistoryButton.addEventListener("click", openHistory);
homeButton.addEventListener("click", () => requestRecordDecision("home"));
scanBarcodeButton.addEventListener("click", startBarcodeScan);
stopBarcodeScanButton.addEventListener("click", stopBarcodeScan);


saveRecordButton.addEventListener("click", () => finishRecordDecision(true));
skipSaveButton.addEventListener("click", () => finishRecordDecision(false));
cancelNextItemButton.addEventListener("click", () => { pendingRecordAction = null; saveRecordDialog.close(); });
historyButton.addEventListener("click", () => requestHistory());
closeHistoryButton.addEventListener("click", () => historyDialog.close());
document.querySelector('#historyView').addEventListener('change',e=>showHistoryTable(e.target.value));
document.querySelector('#selectAllHistory').addEventListener('change',e=>{document.querySelectorAll('.history-select').forEach(c=>c.checked=e.target.checked);updateSelectedHistory();});
document.querySelector('#deleteSelectedHistory').addEventListener('click',deleteSelectedHistory);
exportHistoryButton.addEventListener("click", exportMeasurementHistory);
exportImagesButton.addEventListener("click", exportItemImages);
replaceDuplicateButton.addEventListener("click", () => resolveDuplicateBarcode("replace"));
keepDuplicateButton.addEventListener("click", () => resolveDuplicateBarcode("duplicate"));
cancelDuplicateButton.addEventListener("click", () => resolveDuplicateBarcode("cancel"));

updateHistoryCount();

barcodeDialog.addEventListener("cancel", event => { event.preventDefault(); closeIdentification(); });
document.querySelector("#closeBarcodeDialog").addEventListener("click", closeIdentification);
function closeIdentification() {
  stopBarcodeScan();
  if (barcodeDialog.open) barcodeDialog.close();
  productPhotoBlob = null;
  productPhotoPreview.hidden = true;
  productPhotoPreview.removeAttribute("src");
  showHome();
}

function openBarcodeDialog() {
  stopBarcodeScan();
  barcodeInput.value = "";
  productPhotoBlob=null;
  productPhotoPreview.hidden=true;
  productPhotoPreview.removeAttribute('src');
  barcodeMessage.textContent = "Key in the barcode or scan it using the phone camera.";
  if (!barcodeDialog.open) barcodeDialog.showModal();
  setTimeout(() => barcodeInput.focus(), 80);
}

function acceptBarcode(event) {
  event.preventDefault();
  const value = barcodeInput.value.trim();
  if (!value) {
    barcodeMessage.textContent = "Barcode is required before measuring the product.";
    return;
  }
  if(!productPhotoBlob){barcodeMessage.textContent='Capture or upload an Item Photo before continuing.';return;}
  const duplicateCount = measurementRecords.filter(record => record.barcode === value).length;
  if (duplicateCount) {
    pendingBarcode = value;
    duplicateBarcodeMessage.textContent = `${value} already has ${duplicateCount} saved record${duplicateCount === 1 ? "" : "s"}. Replace removes the old record(s); Keep Duplicate adds another.`;
    barcodeDialog.close();
    duplicateBarcodeDialog.showModal();
    return;
  }
  useBarcode(value);
}

function useBarcode(value) {
  resetDual();
  currentBarcode = value;
  currentProductPhotoBlob=productPhotoBlob;
  currentMeasurement = null;
  currentItemImageBlob = null;
  stopBarcodeScan();
  if (barcodeDialog.open) barcodeDialog.close();
  homePage.hidden = true;
  measurementPage.hidden = false;
  captureResult.hidden = true;
  smoothedBox = null;
  lastValidBox = null;
  detectionActive = false;
  if (running && backgroundFrame) {
    detectButton.disabled = false;
    detectionStatus.textContent = "Ready for next item";
    liveMessage.textContent = `Barcode ${currentBarcode}: place the product and marker, then tap Detect Object`;
  } else {
    detectionStatus.textContent = "Barcode ready";
    liveMessage.textContent = `Barcode ${currentBarcode}: tap Open Camera to begin`;
  }
}

async function resolveDuplicateBarcode(action) {
  duplicateBarcodeDialog.close();
  if (action === "cancel") {
    pendingBarcode = "";
    openBarcodeDialog();
    return;
  }
  if (action === "replace") {
    const removed = measurementRecords.filter(record => record.barcode === pendingBarcode);
    await Promise.allSettled(removed.flatMap(record => [record.imageId,...(record.shots||[]).map(s=>s.imageId)].filter(Boolean)).map(deleteItemImage));
    measurementRecords = measurementRecords.filter(record => record.barcode !== pendingBarcode);
    localStorage.setItem("object-measurement-records-v1", JSON.stringify(measurementRecords));
    updateHistoryCount();
  }
  const value = pendingBarcode;
  pendingBarcode = "";
  useBarcode(value);
}

function showHome() {
  stopCamera();
  captureResult.hidden = true;
  measurementPage.hidden = true;
  homePage.hidden = false;
}

// Validate retail GTIN check digits before accepting a scan. Other symbologies
// are accepted only after repeated identical readings and user confirmation.
function validRetailBarcode(value, format) {
  const lengths = {ean_13:13,ean_8:8,upc_a:12,upc_e:8,itf:0};
  if (!(format in lengths) || format === 'itf') return true;
  if (!/^\d+$/.test(value) || value.length !== lengths[format]) return false;
  // UPC-E is compressed and needs expansion to check its digit.
  if (format === 'upc_e') return true;
  let sum = 0;
  for (let i=value.length-2, weight=3;i>=0;i--,weight=weight===3?1:3) sum+=Number(value[i])*weight;
  return (10-sum%10)%10 === Number(value.at(-1));
}

async function startBarcodeScan() {
  if (!("BarcodeDetector" in window)) {
    barcodeMessage.textContent = "Barcode scanning is not supported by this browser. Please key in the barcode.";
    return;
  }
  try {
    const formats = await BarcodeDetector.getSupportedFormats();
    const preferred = ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf'].filter(f=>formats.includes(f));
    const detector = preferred.length ? new BarcodeDetector({formats:preferred}) : new BarcodeDetector();
    if (running && stream) barcodeVideo.srcObject = stream;
    else {
      barcodeStream = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"}}});
      barcodeVideo.srcObject = barcodeStream;
    }
    await barcodeVideo.play();
    barcodeVideo.hidden = false;
    scanBarcodeButton.hidden = true;
    stopBarcodeScanButton.hidden = false;
    barcodeScanRunning = true;
    barcodeMessage.textContent = "Hold the barcode steady until the same number is detected 3 times.";
    let previous = '', matches = 0;
    const scan = async () => {
      if (!barcodeScanRunning) return;
      try {
        const results = await detector.detect(barcodeVideo);
        // Never arbitrarily take results[0] when multiple different codes appear.
        const candidates = [...new Map(results.filter(r=>validRetailBarcode(r.rawValue,r.format)).map(r=>[r.format+':'+r.rawValue,r])).values()];
        if (candidates.length === 1) {
          const candidate = candidates[0];
          const key = candidate.format+':'+candidate.rawValue;
          matches = key === previous ? matches+1 : 1;
          previous = key;
          if (matches >= 3) {
            barcodeInput.value = candidate.rawValue; // text, preserve leading zeros
            barcodeMessage.textContent = `Detected ${candidate.format}: ${candidate.rawValue}. Check the printed barcode number before Continue; edit it if needed.`;
            stopBarcodeScan();
            return;
          }
        } else { previous = ''; matches = 0; }
      } catch (_) { previous = ''; matches = 0; }
      if (barcodeScanRunning) requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  } catch (error) {
    stopBarcodeScan();
    barcodeMessage.textContent = `Unable to scan barcode: ${error?.message || "camera unavailable"}. Please key it in.`;
  }
}

function stopBarcodeScan() {
  barcodeScanRunning = false;
  if (barcodeStream) barcodeStream.getTracks().forEach(track => track.stop());
  barcodeStream = null;
  barcodeVideo.pause();
  barcodeVideo.srcObject = null;
  barcodeVideo.hidden = true;
  scanBarcodeButton.hidden = false;
  stopBarcodeScanButton.hidden = true;
}

const AUTO_REFRESH_MS = 10000;
let autoRefreshTimer = null;
let calibrationBusy = false;
async function refreshCameraAnalysis() {
  if (!running || calibrationBusy || video.readyState < 2) return;
  // Preserve the background while a product is in view: otherwise a timed
  // refresh would learn the product as background and hide it.
  if (backgroundFrame && lastValidBox) { beginDetection(); return; }
  calibrationBusy = true;
  try {
    const newBackground = await captureAveragedBackground(6);
    if (!running) return;
    backgroundFrame = newBackground;
    beginDetection();
    detectionStatus.textContent = 'Automatic detection active';
  } catch (error) {
    console.warn('Automatic background refresh failed', error);
  } finally { calibrationBusy = false; }
}
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraError("Camera requires HTTPS or localhost.");
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    video.srcObject = stream;
    await video.play();
    running = true;
    backgroundFrame = null;
    smoothedBox = null;
    emptyState.hidden = true;
    cameraState.textContent = "Camera live";
    cameraState.className = "pill live";
    startButton.textContent = "Close Camera";
    calibrateButton.disabled = false;
    detectButton.disabled = true;
    captureButton.disabled = false;
    resizeCanvases();
    detectionActive = false;
    detectionStatus.textContent = "Empty background required";
    markerStatus.textContent = "Waiting for background";
    liveMessage.textContent = "Automatic background and object detection. For best results, start with an empty surface.";
    await refreshCameraAnalysis();
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(refreshCameraAnalysis, AUTO_REFRESH_MS);
    requestAnimationFrame(processLoop);
  } catch (error) {
    const reason = error?.name === "NotAllowedError"
      ? "Camera permission was denied. Allow camera access and try again."
      : `Unable to start camera: ${error?.message || "unknown error"}`;
    showCameraError(reason);
  }
}

function stopCamera() {
  clearInterval(autoRefreshTimer); autoRefreshTimer = null;
  running = false;
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
  backgroundFrame = null;
  smoothedBox = null;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  emptyState.hidden = false;
  cameraState.textContent = "Camera off";
  cameraState.className = "pill idle";
  startButton.textContent = "Open Camera";
  calibrateButton.disabled = true;
  calibrateButton.textContent = "Set Empty Background";
  detectButton.disabled = true;
  captureButton.disabled = true;
  detectionStatus.textContent = "Waiting for camera";
  confidenceText.textContent = "—";
  fpsText.textContent = "—";
  markerStatus.textContent = "Checked after Capture";
  detectionActive = false;
  liveMarker = null;
  markerMissingFrames = 0;
}

function showCameraError(message) {
  detectionStatus.textContent = "Camera unavailable";
  liveMessage.textContent = message;
  cameraState.textContent = "Camera error";
  cameraState.className = "pill idle";
}

function resizeCanvases() {
  const sourceW = video.videoWidth || 1280;
  const sourceH = video.videoHeight || 720;
  workCanvas.width = PROCESS_WIDTH;
  workCanvas.height = Math.round(PROCESS_WIDTH * sourceH / sourceW);
  overlay.width = sourceW;
  overlay.height = sourceH;
}

function drawWorkFrame() {
  workCtx.drawImage(video, 0, 0, workCanvas.width, workCanvas.height);
}

async function captureAveragedBackground(frameCount) {
  const total = workCanvas.width * workCanvas.height * 4;
  const sums = new Uint32Array(total);
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    drawWorkFrame();
    const data = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height).data;
    for (let i = 0; i < total; i++) sums[i] += data[i];
    await new Promise(resolve => setTimeout(resolve, 55));
  }
  const averaged = new Uint8ClampedArray(total);
  for (let i = 0; i < total; i++) averaged[i] = Math.round(sums[i] / frameCount);
  return averaged;
}

function processLoop(now) {
  if (!running) return;
  if (now - lastProcessed >= PROCESS_INTERVAL_MS && video.readyState >= 2) {
    lastProcessed = now;
    processFrame();
    const elapsed = Math.max(1, now - previousTick);
    fpsText.textContent = `${Math.round(1000 / elapsed)} FPS`;
    previousTick = now;
  }
  requestAnimationFrame(processLoop);
}

function processFrame() {
  drawWorkFrame();
  const frame = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);
  const width = frame.width;
  const height = frame.height;
  const threshold = Number(thresholdInput.value);
  if (!backgroundFrame) {
    drawOverlay(null, null);
    detectionStatus.textContent = "Calibration required";
    confidenceText.textContent = "—";
    markerStatus.textContent = "Waiting for background";
    captureButton.disabled = false;
    return;
  }

  if (!detectionActive) {
    drawOverlay(null, null);
    markerStatus.textContent = "Waiting for Detect Object";
    captureButton.disabled = false;
    return;
  }

  const alignment = estimateBackgroundOffset(frame.data, backgroundFrame, width, height, 6);
  const detectedMarker = detectReferenceMarker(frame.data, width, height);
  if (detectedMarker) {
    liveMarker = { ...detectedMarker };
    markerMissingFrames = 0;
  } else {
    markerMissingFrames += 1;
    if (markerMissingFrames > 10) liveMarker = null;
  }
  markerStatus.textContent = liveMarker ? "Detected" : "Not detected";
  const mask = maskFromSavedBackground(
    frame.data, backgroundFrame, width, height, threshold, alignment.dx, alignment.dy
  );
  if (liveMarker && !MARKER_ON_ITEM) {
    const margin = Math.max(4, Math.round(Math.max(liveMarker.width, liveMarker.height) * 0.25));
    clearMaskRegion(mask, width, height, liveMarker, margin);
  }

  closeSmallGaps(mask, width, height, 1);
  majorityFilter(mask, width, height, 1);
  const minimumPixels = width * height * Number(minAreaInput.value) / 1000;
  const candidate = largestCentralComponent(mask, width, height, minimumPixels);

  if (!candidate) {
    missingFrames += 1;
    if (missingFrames > 4) smoothedBox = null;
    stableFrames = 0;
    previousDetectionBox = null;
    lastValidBox = null;
    captureButton.disabled = false;
    drawOverlay(null, liveMarker);
    detectionStatus.textContent = "No clear object";
    confidenceText.textContent = "—";
    liveMessage.textContent = "Live item frame not found — you may still Capture for photo analysis";
    return;
  }

  missingFrames = 0;
  const expanded = expandBox(candidate, width, height, 0.025);
  smoothedBox = smoothBox(smoothedBox, expanded, SMOOTHING);
  const confidence = calculateConfidence(candidate, width, height);
  const overlap = previousDetectionBox ? boxIoU(previousDetectionBox, smoothedBox) : 0;
  stableFrames = overlap > 0.72 ? Math.min(20, stableFrames + 1) : 0;
  previousDetectionBox = { ...smoothedBox };
  lastValidBox = { ...smoothedBox };
  captureButton.disabled = false;
  drawOverlay(smoothedBox, liveMarker);
  detectionStatus.textContent = "Item framed";
  confidenceText.textContent = `${Math.round(confidence * 100)}%`;
  liveMessage.textContent = candidate.touchesEdge
    ? "Move back: part of the item may be outside the picture"
    : stableFrames < 3 ? "Hold steady — preparing Capture" : "Item ready — make sure the marker is also visible, then Capture";

}

function boxIoU(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

// Multiple exposure passes. Candidates must still match the printed marker pattern.
function detectReferenceMarker(data, width, height) {
  let best = null;
  for (const threshold of [75, 105, 135, 165, 195]) {
    const mask = new Uint8Array(width * height);
    for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
      mask[p] = (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]) < threshold ? 1 : 0;
    }
    const visited = new Uint8Array(mask.length), queue = new Int32Array(mask.length);
    for (let start = 0; start < mask.length; start++) {
      if (!mask[start] || visited[start]) continue;
      let head=0, tail=0, area=0, minX=width, minY=height, maxX=0, maxY=0;
      queue[tail++]=start; visited[start]=1;
      while(head<tail) {
        const index=queue[head++], x=index%width, y=Math.floor(index/width);
        area++; minX=Math.min(minX,x); maxX=Math.max(maxX,x);
        minY=Math.min(minY,y); maxY=Math.max(maxY,y);
        for(const next of [index-1,index+1,index-width,index+width]) {
          if(next<0 || next>=mask.length || visited[next] || !mask[next]) continue;
          if(Math.abs(next%width-x)>1) continue;
          visited[next]=1; queue[tail++]=next;
        }
      }
      const boxW=maxX-minX+1, boxH=maxY-minY+1;
      const aspect=boxW/Math.max(1,boxH), fill=area/Math.max(1,boxW*boxH);
      if(boxW<14 || boxH<14 || aspect<0.65 || aspect>1.55 || fill<0.08 || fill>0.90) continue;
      const box={x:minX,y:minY,width:boxW,height:boxH};
      const pattern=markerPatternScore(data,width,height,box);
      if(pattern<0.78) continue;
      const score=pattern*1000 + Math.min(area,10000)/100 - Math.abs(1-aspect)*150;
      if(!best || score>best.score) best={...box,area,score};
    }
  }
  return best;
}
function markerPatternScore(data,width,height,box) {
  const gray=(nx,ny)=>{
    const x=Math.max(0,Math.min(width-1,Math.round(box.x+nx*(box.width-1))));
    const y=Math.max(0,Math.min(height-1,Math.round(box.y+ny*(box.height-1))));
    const i=(y*width+x)*4;
    return .299*data[i]+.587*data[i+1]+.114*data[i+2];
  };
  const dark=[[.5,.04],[.5,.96],[.04,.5],[.96,.5],[.30,.30],[.70,.30],[.30,.70],[.50,.50]];
  let best = 0;
  for (let turn=0;turn<4;turn++) {
    const rotate=([x,y])=>turn===0?[x,y]:turn===1?[1-y,x]:turn===2?[1-x,1-y]:[y,1-x];
    const values=dark.map(pt=>{const [x,y]=rotate(pt);return gray(x,y);});
    const [lx,ly]=rotate([.70,.70]);
    const light=gray(lx,ly);
    const darkMedian=[...values].sort((a,b)=>a-b)[3];
    const limit=(light+darkMedian)/2;
    if(light-darkMedian<35) continue;
    const good=values.filter(v=>v<limit).length;
    best=Math.max(best,(good+(light>limit?1:0))/9);
  }
  return best;
}

function clearMaskRegion(mask, width, height, box, margin) {
  const left = Math.max(0, box.x - margin), top = Math.max(0, box.y - margin);
  const right = Math.min(width, box.x + box.width + margin), bottom = Math.min(height, box.y + box.height + margin);
  for (let y = top; y < bottom; y++) mask.fill(0, y * width + left, y * width + right);
}

async function captureCurrentObject(sourceCanvas = null) {
  if (!sourceCanvas && (!running || video.readyState < 2)) return;
  captureButton.disabled = true;
  currentMeasurement = null;
  currentItemImageBlob = null;
  captureButton.setAttribute("aria-label", "Capturing");
  captureButton.title = "Capturing";
  const full = document.createElement("canvas");
  full.width = sourceCanvas ? sourceCanvas.width : video.videoWidth;
  full.height = sourceCanvas ? sourceCanvas.height : video.videoHeight;
  const fullCtx = full.getContext("2d", { willReadFrequently: true });
  fullCtx.drawImage(sourceCanvas || video, 0, 0, full.width, full.height);

  const fullFrame = fullCtx.getImageData(0, 0, full.width, full.height);
  markerPicking=false; markerPoints=[]; editableMarker=null; markerGesture=null;
  capturedMarker = detectReferenceMarker(fullFrame.data, full.width, full.height);
  if (!sourceCanvas && !capturedMarker && liveMarker) {
    const liveScaleX = full.width / workCanvas.width;
    const liveScaleY = full.height / workCanvas.height;
    capturedMarker = {
      x: liveMarker.x * liveScaleX,
      y: liveMarker.y * liveScaleY,
      width: liveMarker.width * liveScaleX,
      height: liveMarker.height * liveScaleY
    };
  }
  const analysisCanvas = document.createElement("canvas");
  analysisCanvas.width = workCanvas.width;
  analysisCanvas.height = workCanvas.height;
  const analysisCtx = analysisCanvas.getContext("2d", { willReadFrequently: true });
  analysisCtx.drawImage(full, 0, 0, analysisCanvas.width, analysisCanvas.height);
  const smallFrame = analysisCtx.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
  let capturedMask = null;
  if (backgroundFrame && !sourceCanvas) {
    const alignment = estimateBackgroundOffset(
      smallFrame.data, backgroundFrame, analysisCanvas.width, analysisCanvas.height, 6
    );
    capturedMask = maskFromSavedBackground(
      smallFrame.data, backgroundFrame, analysisCanvas.width, analysisCanvas.height,
      Number(thresholdInput.value), alignment.dx, alignment.dy
    );
  }
  if (capturedMask && capturedMarker && !MARKER_ON_ITEM) {
    const markerOnAnalysis = {
      x: capturedMarker.x * analysisCanvas.width / full.width,
      y: capturedMarker.y * analysisCanvas.height / full.height,
      width: capturedMarker.width * analysisCanvas.width / full.width,
      height: capturedMarker.height * analysisCanvas.height / full.height
    };
    const markerPaperMargin = Math.max(5, Math.round(Math.max(markerOnAnalysis.width, markerOnAnalysis.height) * 0.25));
    clearMaskRegion(
      capturedMask, analysisCanvas.width, analysisCanvas.height, markerOnAnalysis, markerPaperMargin
    );
  }
  if (capturedMask) {
    closeSmallGaps(capturedMask, analysisCanvas.width, analysisCanvas.height, 1);
    majorityFilter(capturedMask, analysisCanvas.width, analysisCanvas.height, 1);
  }
  const minimumPixels = analysisCanvas.width * analysisCanvas.height * Number(minAreaInput.value) / 1000;
  const capturedItem = capturedMask ? largestCentralComponent(
    capturedMask, analysisCanvas.width, analysisCanvas.height, minimumPixels
  ) : null;

  const sx = full.width / analysisCanvas.width;
  const sy = full.height / analysisCanvas.height;
  const detectedFrame = capturedItem
    ? expandBox(capturedItem, analysisCanvas.width, analysisCanvas.height, 0.02)
    : (!sourceCanvas && lastValidBox) || {
      x: analysisCanvas.width * 0.2, y: analysisCanvas.height * 0.2,
      width: analysisCanvas.width * 0.6, height: analysisCanvas.height * 0.6
    };
  systemFrame = normaliseFrame({
    x: detectedFrame.x * sx, y: detectedFrame.y * sy,
    width: detectedFrame.width * sx, height: detectedFrame.height * sy
  }, full.width, full.height);
  editableFrame = { ...systemFrame };
  capturedFullCanvas = full;
  frameEditor.width = full.width;
  frameEditor.height = full.height;
  resetEditorView();
  frameHistory = [{ ...editableFrame }];
  frameHistoryIndex = 0;
  manualFrameEnabled = false;
  frameEditorStage.hidden = false;
  capturedPreview.hidden = true;
  useSystemFrameButton.classList.add("active");
  manualFrameButton.classList.remove("active");
  updateFrameHistoryButtons();
  renderFrameEditor();

  if (capturedMarker || (editableMarker && markerPicking)) {
    const m=markerPicking && editableMarker ? editableMarker : capturedMarker;
    frameEditorCtx.strokeStyle='#00baff';
    frameEditorCtx.lineWidth=Math.max(4,frameEditor.width/260);
    frameEditorCtx.strokeRect(m.x,m.y,m.width,m.height);
    const size=Math.max(18,frameEditor.width/42);
    frameEditorCtx.fillStyle='#ffffff';
    frameEditorCtx.strokeStyle='#0087d9';
    for(const h of (markerPicking ? frameHandles(m) : [])){
      frameEditorCtx.fillRect(h.x-size/2,h.y-size/2,size,size);
      frameEditorCtx.strokeRect(h.x-size/2,h.y-size/2,size,size);
    }
  }
  if (markerPoints.length) {
    frameEditorCtx.fillStyle='#00e5ff'; frameEditorCtx.strokeStyle='#00e5ff';
    frameEditorCtx.lineWidth=Math.max(3,frameEditor.width/300);
    frameEditorCtx.beginPath();
    markerPoints.forEach((pt,i)=>{ if(i===0)frameEditorCtx.moveTo(pt.x,pt.y);else frameEditorCtx.lineTo(pt.x,pt.y); });
    frameEditorCtx.stroke();
    for (const pt of markerPoints) { frameEditorCtx.beginPath(); frameEditorCtx.arc(pt.x,pt.y,Math.max(6,frameEditor.width/140),0,Math.PI*2);frameEditorCtx.fill(); }
  }
  pixelSize.textContent = `${Math.round(editableFrame.width)} × ${Math.round(editableFrame.height)} px`;
  imageSize.textContent = `${full.width} × ${full.height}`;
  frameCoverage.textContent = `${((editableFrame.width * editableFrame.height) / (full.width * full.height) * 100).toFixed(1)}%`;
  markerStatus.textContent = capturedMarker ? "Detected" : "Not detected";
  analysisStatus.textContent = "FRAME REVIEW";
  analysisReason.textContent = sourceCanvas ? "Uploaded photo — adjust the item frame and marker as needed" : (capturedItem ? "Review the suggested frame" : "System frame unavailable — adjust the manual frame");
  horizontalSize.textContent = "Pending frame confirmation";
  verticalSize.textContent = "Pending frame confirmation";
  referenceScale.textContent = capturedMarker
    ? `${(((capturedMarker.width + capturedMarker.height) / 2) / markerSizeCm).toFixed(2)} px/cm`
    : "—";
  captureResult.hidden = false;
  captureResult.scrollIntoView({ behavior: "smooth", block: "start" });
  captureButton.setAttribute("aria-label", "Capture object");
  captureButton.title = "Capture object";
  captureButton.disabled = false;
}

function normaliseFrame(frame, width, height) {
  const minimum = Math.max(24, Math.min(width, height) * 0.04);
  const x = Math.max(0, Math.min(width - minimum, frame.x));
  const y = Math.max(0, Math.min(height - minimum, frame.y));
  return {
    x,
    y,
    width: Math.max(minimum, Math.min(width - x, frame.width)),
    height: Math.max(minimum, Math.min(height - y, frame.height))
  };
}

function useDetectedFrame() {
  if (markerPicking && !commitEditableMarker()) return;
  if (!systemFrame) return;
  editableFrame = { ...systemFrame };
  manualFrameEnabled = false;
  useSystemFrameButton.classList.add("active");
  manualFrameButton.classList.remove("active");
  editorHint.textContent = "System frame selected. Confirm it, or choose Manual Frame to adjust.";
  pushFrameHistory();
  renderFrameEditor();
}

function enableManualFrame() {
  if (markerPicking && !commitEditableMarker()) return;
  if (!editableFrame) return;
  markerPicking=false; markerGesture=null;
  manualFrameEnabled = true;
  manualFrameButton.classList.add("active");
  useSystemFrameButton.classList.remove("active");
  editorHint.textContent = "Drag inside the frame to move it. Drag any square handle to resize.";
  renderFrameEditor();
}

function resetFrameEdit() {
  if (markerPicking && !commitEditableMarker()) return;
  if (!systemFrame) return;
  editableFrame = { ...systemFrame };
  markerPicking=false; markerGesture=null;
  manualFrameEnabled = true;
  manualFrameButton.classList.add("active");
  useSystemFrameButton.classList.remove("active");
  pushFrameHistory();
  renderFrameEditor();
}

function pushFrameHistory() {
  if (!editableFrame) return;
  const current = frameHistory[frameHistoryIndex];
  if (current && ["x", "y", "width", "height"].every(key => Math.abs(current[key] - editableFrame[key]) < 0.5)) return;
  frameHistory = frameHistory.slice(0, frameHistoryIndex + 1);
  frameHistory.push({ ...editableFrame });
  frameHistoryIndex = frameHistory.length - 1;
  updateFrameHistoryButtons();
}

function undoFrameEdit() {
  if (frameHistoryIndex <= 0) return;
  frameHistoryIndex--;
  editableFrame = { ...frameHistory[frameHistoryIndex] };
  updateFrameHistoryButtons();
  renderFrameEditor();
}

function redoFrameEdit() {
  if (frameHistoryIndex >= frameHistory.length - 1) return;
  frameHistoryIndex++;
  editableFrame = { ...frameHistory[frameHistoryIndex] };
  updateFrameHistoryButtons();
  renderFrameEditor();
}

function updateFrameHistoryButtons() {
  undoFrameButton.disabled = frameHistoryIndex <= 0;
  redoFrameButton.disabled = frameHistoryIndex < 0 || frameHistoryIndex >= frameHistory.length - 1;
}

function editorPoint(event) {
  const rect = frameEditor.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * frameEditor.width / rect.width,
    y: (event.clientY - rect.top) * frameEditor.height / rect.height
  };
}

function frameHandles(frame) {
  const x1 = frame.x, x2 = frame.x + frame.width / 2, x3 = frame.x + frame.width;
  const y1 = frame.y, y2 = frame.y + frame.height / 2, y3 = frame.y + frame.height;
  return [
    { name: "nw", x: x1, y: y1 }, { name: "n", x: x2, y: y1 }, { name: "ne", x: x3, y: y1 },
    { name: "e", x: x3, y: y2 }, { name: "se", x: x3, y: y3 }, { name: "s", x: x2, y: y3 },
    { name: "sw", x: x1, y: y3 }, { name: "w", x: x1, y: y2 }
  ];
}

function beginFrameEdit(event) {
  if (!manualFrameEnabled || !editableFrame || editorTouches.size > 1 || editorViewGesture) return;
  const point = editorPoint(event);
  const rect = frameEditor.getBoundingClientRect();
  const tolerance = 32 * frameEditor.width / rect.width;
  const handle = frameHandles(editableFrame).find(item => Math.hypot(point.x - item.x, point.y - item.y) <= tolerance);
  const inside = point.x >= editableFrame.x && point.x <= editableFrame.x + editableFrame.width &&
    point.y >= editableFrame.y && point.y <= editableFrame.y + editableFrame.height;
  if (!handle && !inside) return;
  frameEditor.setPointerCapture(event.pointerId);
  frameGesture = { type: handle?.name || "move", start: point, frame: { ...editableFrame } };
}

function moveFrameEdit(event) {
  if (!frameGesture || !editableFrame || editorTouches.size > 1 || editorViewGesture) return;
  const point = editorPoint(event);
  const dx = point.x - frameGesture.start.x;
  const dy = point.y - frameGesture.start.y;
  const start = frameGesture.frame;
  let left = start.x, top = start.y, right = start.x + start.width, bottom = start.y + start.height;
  if (frameGesture.type === "move") {
    left += dx; right += dx; top += dy; bottom += dy;
  } else {
    if (frameGesture.type.includes("w")) left += dx;
    if (frameGesture.type.includes("e")) right += dx;
    if (frameGesture.type.includes("n")) top += dy;
    if (frameGesture.type.includes("s")) bottom += dy;
  }
  const minimum = Math.max(24, Math.min(frameEditor.width, frameEditor.height) * 0.04);
  if (right - left < minimum) frameGesture.type.includes("w") ? left = right - minimum : right = left + minimum;
  if (bottom - top < minimum) frameGesture.type.includes("n") ? top = bottom - minimum : bottom = top + minimum;
  if (frameGesture.type === "move") {
    const width = right - left, height = bottom - top;
    left = Math.max(0, Math.min(frameEditor.width - width, left));
    top = Math.max(0, Math.min(frameEditor.height - height, top));
    right = left + width; bottom = top + height;
  }
  left = Math.max(0, left); top = Math.max(0, top);
  right = Math.min(frameEditor.width, right); bottom = Math.min(frameEditor.height, bottom);
  editableFrame = { x: left, y: top, width: right - left, height: bottom - top };
  renderFrameEditor();
}

function endFrameEdit(event) {
  if (!frameGesture) return;
  if (frameEditor.hasPointerCapture(event.pointerId)) frameEditor.releasePointerCapture(event.pointerId);
  frameGesture = null;
  pushFrameHistory();
}

function renderFrameEditor() {
  if (!capturedFullCanvas || !editableFrame) return;
  frameEditorCtx.clearRect(0, 0, frameEditor.width, frameEditor.height);
  frameEditorCtx.drawImage(capturedFullCanvas, 0, 0);
  const lineWidth = Math.max(4, frameEditor.width / 300);
  frameEditorCtx.strokeStyle = "#54e38e";
  frameEditorCtx.lineWidth = lineWidth;
  frameEditorCtx.strokeRect(editableFrame.x, editableFrame.y, editableFrame.width, editableFrame.height);
  if (manualFrameEnabled) {
    const size = Math.max(24, frameEditor.width / 28);
    frameEditorCtx.fillStyle = "#ffffff";
    frameEditorCtx.strokeStyle = "#0a7d43";
    frameEditorCtx.lineWidth = Math.max(2, lineWidth / 2);
    for (const handle of frameHandles(editableFrame)) {
      frameEditorCtx.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
      frameEditorCtx.strokeRect(handle.x - size / 2, handle.y - size / 2, size, size);
    }
  }
  if (capturedMarker || (editableMarker && markerPicking)) {
    const m=markerPicking && editableMarker ? editableMarker : capturedMarker;
    frameEditorCtx.strokeStyle='#00baff';
    frameEditorCtx.lineWidth=Math.max(4,frameEditor.width/260);
    frameEditorCtx.strokeRect(m.x,m.y,m.width,m.height);
    const size=Math.max(18,frameEditor.width/42);
    frameEditorCtx.fillStyle='#ffffff';
    frameEditorCtx.strokeStyle='#0087d9';
    for(const h of (markerPicking ? frameHandles(m) : [])){
      frameEditorCtx.fillRect(h.x-size/2,h.y-size/2,size,size);
      frameEditorCtx.strokeRect(h.x-size/2,h.y-size/2,size,size);
    }
  }
  if (markerPoints.length) {
    frameEditorCtx.fillStyle='#00e5ff'; frameEditorCtx.strokeStyle='#00e5ff';
    frameEditorCtx.lineWidth=Math.max(3,frameEditor.width/300);
    frameEditorCtx.beginPath();
    markerPoints.forEach((pt,i)=>{ if(i===0)frameEditorCtx.moveTo(pt.x,pt.y);else frameEditorCtx.lineTo(pt.x,pt.y); });
    frameEditorCtx.stroke();
    for (const pt of markerPoints) { frameEditorCtx.beginPath(); frameEditorCtx.arc(pt.x,pt.y,Math.max(6,frameEditor.width/140),0,Math.PI*2);frameEditorCtx.fill(); }
  }
  pixelSize.textContent = `${Math.round(editableFrame.width)} × ${Math.round(editableFrame.height)} px`;
  frameCoverage.textContent = `${((editableFrame.width * editableFrame.height) / (frameEditor.width * frameEditor.height) * 100).toFixed(1)}%`;
}

async function confirmFrameAndMeasure() {
  if(markerPicking && !commitEditableMarker())return;
  if (!capturedFullCanvas || !editableFrame) return;
  if (!capturedMarker) {
    analysisStatus.textContent = "REVIEW REQUIRED";
    analysisReason.textContent = "Selected reference marker was not detected; measurement was not guessed";
    return;
  }
  const pixelsPerCm = ((capturedMarker.width + capturedMarker.height) / 2) / markerSizeCm;
  const horizontalCm = editableFrame.width / pixelsPerCm;
  const verticalCm = editableFrame.height / pixelsPerCm;
  const date = new Date().toISOString().slice(0, 10);
  const safeBarcode = currentBarcode.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 48) || "unknown";
  const itemCanvas = document.createElement("canvas");
  itemCanvas.width = Math.max(1, Math.round(editableFrame.width));
  itemCanvas.height = Math.max(1, Math.round(editableFrame.height));
  itemCanvas.getContext("2d").drawImage(
    capturedFullCanvas,
    editableFrame.x, editableFrame.y, editableFrame.width, editableFrame.height,
    0, 0, itemCanvas.width, itemCanvas.height
  );
  currentItemImageBlob = await canvasToBlob(itemCanvas, 0.94);
  const measurementFilename = `${safeBarcode}_${dualPlacement}_${currentShotView()}_H-${horizontalCm.toFixed(2)}cm_V-${verticalCm.toFixed(2)}cm_${date}.jpg`;
  const itemImageFilename = measurementFilename;
  const output = document.createElement("canvas");
  output.width = capturedFullCanvas.width;
  output.height = capturedFullCanvas.height;
  const ctx = output.getContext("2d");
  ctx.drawImage(capturedFullCanvas, 0, 0);
  const lineWidth = Math.max(6, output.width / 220);
  ctx.strokeStyle = "#36e37e";
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(editableFrame.x, editableFrame.y, editableFrame.width, editableFrame.height);
  // Show the exact reference frame used for this measurement, not a fresh detection.
  ctx.strokeStyle = "#00baff";
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(capturedMarker.x, capturedMarker.y, capturedMarker.width, capturedMarker.height);
  const fontSize = Math.max(30, output.width / 32);
  ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
  const lines = [
    `Barcode: ${currentBarcode}`,
    `Horizontal: ${horizontalCm.toFixed(2)} cm`,
    `Vertical: ${verticalCm.toFixed(2)} cm`
  ];
  const padding = fontSize * 0.45;
  const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
  const labelHeight = fontSize * 3.65;
  const labelX = Math.max(0, Math.min(output.width - textWidth - padding * 2, editableFrame.x));
  const preferredY = editableFrame.y - labelHeight - lineWidth;
  const labelY = preferredY >= 0 ? preferredY : Math.min(output.height - labelHeight, editableFrame.y + editableFrame.height + lineWidth);
  ctx.fillStyle = "rgba(0, 0, 0, .78)";
  ctx.fillRect(labelX, labelY, textWidth + padding * 2, labelHeight);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(lines[0], labelX + padding, labelY + fontSize * 1.05);
  ctx.fillText(lines[1], labelX + padding, labelY + fontSize * 2.15);
  ctx.fillText(lines[2], labelX + padding, labelY + fontSize * 3.25);

  const capturedBlob = await canvasToBlob(output, 0.94);
  if (captureUrl) URL.revokeObjectURL(captureUrl);
  captureUrl = URL.createObjectURL(capturedBlob);
  capturedFilename = measurementFilename;
  capturedPreview.src = captureUrl;
  capturedPreview.hidden = false;
  frameEditorStage.hidden = true;
  horizontalSize.textContent = `${horizontalCm.toFixed(2)} cm`;
  verticalSize.textContent = `${verticalCm.toFixed(2)} cm`;
  referenceScale.textContent = `${pixelsPerCm.toFixed(2)} px/cm`;
  analysisStatus.textContent = "MEASURED";
  analysisReason.textContent = manualFrameEnabled ? "Manual frame confirmed" : "System frame confirmed";
  currentMeasurement = {
    barcode: currentBarcode,
    horizontalCm: Number(horizontalCm.toFixed(2)),
    verticalCm: Number(verticalCm.toFixed(2)),
    frameType: manualFrameEnabled ? "Manual" : "System",
    measuredAt: new Date().toISOString(),
    imageFilename: capturedFilename,
    itemImageFilename,
    saved: false
  };
  if(dualShots[activeShot]?.previewUrl)URL.revokeObjectURL(dualShots[activeShot].previewUrl);
  dualShots[activeShot]={...currentMeasurement,view:currentShotView(),placement:dualPlacement,canvas:capturedFullCanvas,marker:capturedMarker,frame:{...editableFrame},blob:currentItemImageBlob,previewUrl:URL.createObjectURL(capturedBlob)};
  showMeasurementInputs(dualShots[activeShot]);
  refreshDual();
  requestAnimationFrame(syncResultOverlay);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function requestRecordDecision(action) {
  if(dualShots.some(Boolean) && !currentMeasurement?.saved){dualStatus.textContent="Save Item (both images) before leaving, or retake the images.";return;}
  if (!currentMeasurement) {
    if (action === "history") openHistory();
    else if (action === "home") showHome();
    else prepareForNextBarcode();
    return;
  }
  if (currentMeasurement.saved) {
    if (action === "history") openHistory();
    else if (action === "home") showHome();
    else prepareForNextBarcode();
    return;
  }
  pendingRecordAction = action;
  saveRecordSummary.textContent = `${currentMeasurement.barcode} — Horizontal ${currentMeasurement.horizontalCm.toFixed(2)} cm × Vertical ${currentMeasurement.verticalCm.toFixed(2)} cm`;
  saveRecordDialog.showModal();
}

function requestHistory() {
  requestRecordDecision("history");
}

async function saveCurrentRecordWithoutLeaving() {
  await persistCurrentMeasurement();
}

async function finishRecordDecision(shouldSave) {
  if (shouldSave) await persistCurrentMeasurement();
  const action = pendingRecordAction;
  pendingRecordAction = null;
  saveRecordDialog.close();
  if (action === "history") {
    openHistory();
    return;
  }
  if (action === "home") {
    showHome();
    return;
  }
  prepareForNextBarcode();
}

async function persistCurrentMeasurement() {
  if (!currentMeasurement || currentMeasurement.saved) return;
  const imageId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let imageSaved = false;
  if (currentItemImageBlob) {
    try {
      await saveItemImage(imageId, currentMeasurement.itemImageFilename, currentItemImageBlob);
      imageSaved = true;
    } catch (_) {
      imageSaved = false;
    }
  }
  currentMeasurement.imageId = imageSaved ? imageId : "";
  currentMeasurement.saved = true;
  measurementRecords.push({ ...currentMeasurement });
  localStorage.setItem("object-measurement-records-v1", JSON.stringify(measurementRecords));
  updateHistoryCount();
  analysisReason.textContent = imageSaved
    ? "Measurement and item-only image saved to History"
    : "Measurement saved; item image storage was unavailable";
}

function prepareForNextBarcode() {
  currentMeasurement = null;
  currentItemImageBlob = null;
  currentBarcode = "";
  captureResult.hidden = true;
  detectionActive = false;
  smoothedBox = null;
  lastValidBox = null;
  liveMarker = null;
  markerMissingFrames = 0;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  captureButton.disabled = !running;
  if (running && backgroundFrame) {
    detectionStatus.textContent = "Waiting for next barcode";
    liveMessage.textContent = "Remove the current product, then enter the next barcode";
  }
  openBarcodeDialog();
}

function loadMeasurementRecords() {
  try {
    const value = JSON.parse(localStorage.getItem("object-measurement-records-v1") || "[]");
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

function updateHistoryCount() {
  historyCount.textContent = String(measurementRecords.length);
  homeHistoryCount.textContent = String(measurementRecords.length);
}

function openHistory() {
  document.querySelector('#historyChoice').hidden = false;
  document.querySelector('#historyRecords').hidden = true;
  historyDialog.showModal();
}
function showHistoryTable(mode) {
  document.querySelector('#historyView').value = mode;
  document.querySelector('#historyChoice').hidden = true;
  document.querySelector('#historyRecords').hidden = false;
  document.querySelector('#historyCurrentTitle').textContent = mode === 'details' ? 'Image Details' : 'Item Dimensions';
  renderHistory();
}
document.querySelector('#showImageDetails').addEventListener('click', () => showHistoryTable('details'));
document.querySelector('#showItemDimensions').addEventListener('click', () => showHistoryTable('dimensions'));
document.querySelector('#historyBack').addEventListener('click', openHistory);


function historyImageCell(row,id,alt){
 const cell=document.createElement('td');row.appendChild(cell);if(!id){cell.textContent='—';return;}
 cell.textContent='Loading…';getItemImage(id).then(stored=>{if(!cell.isConnected)return;if(!stored?.blob){cell.textContent='Unavailable';return;}const url=URL.createObjectURL(stored.blob),img=document.createElement('img');img.className='history-thumb';img.src=url;img.alt=alt;img.onclick=()=>window.open(url,'_blank');cell.replaceChildren(img);});
}
function historyCell(row,value){const c=document.createElement('td');c.textContent=value??'—';row.appendChild(c);}
function renderHistory(){
 const mode=document.querySelector('#historyView').value,head=document.querySelector('#historyTableHead');historyTableBody.replaceChildren();head.replaceChildren();
 const headings=mode==='details'?['✓','No.','Image','Barcode','Placement','View','Horizontal (cm)','Vertical (cm)','Frame','Measured At']:['✓','No.','Item','Barcode','Placement','Length (cm)','Width (cm)','Height (cm)','Measured At'];
 const tr=document.createElement('tr');head.appendChild(tr);headings.forEach(v=>{const th=document.createElement('th');th.textContent=v;tr.appendChild(th);});
 let n=0;
 measurementRecords.forEach((record,index)=>{
  const entries=mode==='details'?(record.shots?.length?record.shots:[{imageId:record.imageId,view:'Unknown',horizontalCm:record.horizontalCm,verticalCm:record.verticalCm,frameType:record.frameType}]):[null];
  entries.forEach(shot=>{
   const row=document.createElement('tr'),select=document.createElement('input');select.type='checkbox';select.className='history-select';select.dataset.index=index;select.addEventListener('change',updateSelectedHistory);const selectTd=document.createElement('td');selectTd.appendChild(select);row.appendChild(selectTd);historyCell(row,++n);
   historyImageCell(row,mode==='details'?shot.imageId:(record.productPhotoId||record.imageId),record.barcode);
   if(mode==='details') [record.barcode,record.placement||'Legacy',shot.view,shot.horizontalCm?.toFixed?.(2),shot.verticalCm?.toFixed?.(2),shot.frameType,formatRecordDate(record.measuredAt)].forEach(v=>historyCell(row,v));
   else [record.barcode,record.placement||'Legacy',record.lengthCm?.toFixed?.(2),record.widthCm?.toFixed?.(2),record.heightCm?.toFixed?.(2),formatRecordDate(record.measuredAt)].forEach(v=>historyCell(row,v));
   historyTableBody.appendChild(row);
  });
 });
 emptyHistory.hidden=measurementRecords.length>0;exportHistoryButton.disabled=!measurementRecords.length;exportImagesButton.disabled=!measurementRecords.length;document.querySelector('#selectAllHistory').checked=false;updateSelectedHistory();
}
function updateSelectedHistory(){const selected=[...document.querySelectorAll('.history-select')].filter(c=>c.checked);document.querySelector('#deleteSelectedHistory').disabled=!selected.length;const all=[...document.querySelectorAll('.history-select')];document.querySelector('#selectAllHistory').checked=!!all.length&&all.every(c=>c.checked);}
function formatRecordDate(value){const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value||'');const pad=x=>String(x).padStart(2,'0');return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;}
async function deleteSelectedHistory(){
 const indices=new Set([...document.querySelectorAll('.history-select:checked')].map(c=>Number(c.dataset.index)));if(!indices.size)return;
 if(!window.confirm(`Delete ${indices.size} selected item record(s)?`))return;
 if(!window.confirm('Second confirmation: permanently delete selected records and their saved images? This cannot be undone.'))return;
 const removed=measurementRecords.filter((_,i)=>indices.has(i));measurementRecords=measurementRecords.filter((_,i)=>!indices.has(i));
 localStorage.setItem('object-measurement-records-v1',JSON.stringify(measurementRecords));
 const retainedIds=new Set(measurementRecords.flatMap(r=>[r.productPhotoId,r.imageId,...(r.shots||[]).map(s=>s.imageId)].filter(Boolean)));
 for(const r of removed){for(const id of [r.productPhotoId,r.imageId,...(r.shots||[]).map(s=>s.imageId)].filter(Boolean)){if(!retainedIds.has(id))await deleteItemImage(id);}}
 updateHistoryCount();renderHistory();
}

async function exportMeasurementHistory() {
  if (!measurementRecords.length) return;
  const blob = await buildMeasurementWorkbook(measurementRecords);
  const filename = `object-measurement-history-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await shareGeneratedFile(blob, filename, "Measurement Excel");
}

async function exportItemImages() {
  const allImages = await getAllItemImages();
  const referenced=new Set(measurementRecords.flatMap(r=>[r.productPhotoId,r.imageId,...(r.shots||[]).map(s=>s.imageId)].filter(Boolean)));
  const imageRecords=allImages.filter(image=>referenced.has(image.id));
  if (!imageRecords.length) return;
  const files = {};
  const usedNames = new Set();
  for (const image of imageRecords) {
    let name = image.filename || `${image.id}.jpg`;
    const dot = name.lastIndexOf(".");
    const base = dot >= 0 ? name.slice(0, dot) : name;
    const extension = dot >= 0 ? name.slice(dot) : ".jpg";
    let counter = 2;
    while (usedNames.has(name)) name = `${base}_${counter++}${extension}`;
    usedNames.add(name);
    files[`images/${name}`] = new Uint8Array(await image.blob.arrayBuffer());
  }
  const blob = new Blob([createStoredZip(files)], { type: "application/zip" });
  const filename = `item-images-${new Date().toISOString().slice(0, 10)}.zip`;
  await shareGeneratedFile(blob, filename, "Item image folder");
}

async function shareGeneratedFile(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      exportNotice.hidden = true;
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  if (activeExportUrl) URL.revokeObjectURL(activeExportUrl);
  activeExportUrl = URL.createObjectURL(blob);
  exportNoticeTitle.textContent = "Share is unavailable in this browser";
  exportNoticeFilename.textContent = `Download ${filename}, then share it from your Files app.`;
  exportFileLink.href = activeExportUrl;
  exportFileLink.download = filename;
  exportFileLink.hidden = false;
  exportNotice.hidden = false;
}

function openImageDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("object-measurement-images", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("images")) request.result.createObjectStore("images", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveItemImage(id, filename, blob) {
  const database = await openImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("images", "readwrite");
    transaction.objectStore("images").put({ id, filename, blob });
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

async function getItemImage(id) {
  const database = await openImageDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction("images", "readonly").objectStore("images").get(id);
    request.onsuccess = () => { database.close(); resolve(request.result || null); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

async function getAllItemImages() {
  const database = await openImageDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction("images", "readonly").objectStore("images").getAll();
    request.onsuccess = () => { database.close(); resolve(request.result || []); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

async function deleteItemImage(id) {
  const database = await openImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("images", "readwrite");
    transaction.objectStore("images").delete(id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

async function clearItemImages() {
  const database = await openImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("images", "readwrite");
    transaction.objectStore("images").clear();
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

async function buildMeasurementWorkbook(records){
 const details=[['No.','Image','Barcode','Placement','View','Horizontal(cm)','Vertical(cm)','Frame','Measured At']];
 const summary=[['No.','Item','Barcode','Placement','Length(cm)','Width(cm)','Height(cm)','Measured At']];
 const detailPhotos=[],itemPhotos=[];let detailNo=0;
 for(let i=0;i<records.length;i++){
  const r=records[i];summary.push([i+1,'',r.barcode,r.placement||'Legacy',r.lengthCm??'',r.widthCm??'',r.heightCm??'',formatRecordDate(r.measuredAt)]);
  if(r.productPhotoId){const stored=await getItemImage(r.productPhotoId);if(stored?.blob)itemPhotos.push({row:i+1,bytes:new Uint8Array(await stored.blob.arrayBuffer()),ext:stored.blob.type==='image/png'?'png':'jpeg'});}
  const shots=r.shots?.length?r.shots:[{imageId:r.imageId,view:'Unknown',horizontalCm:r.horizontalCm,verticalCm:r.verticalCm,frameType:r.frameType}];
  for(const shot of shots){detailNo++;details.push([detailNo,'',r.barcode,r.placement||'Legacy',shot.view||'Unknown',shot.horizontalCm??'',shot.verticalCm??'',shot.frameType||'',formatRecordDate(r.measuredAt)]);if(shot.imageId){const stored=await getItemImage(shot.imageId);if(stored?.blob)detailPhotos.push({row:detailNo,bytes:new Uint8Array(await stored.blob.arrayBuffer()),ext:stored.blob.type==='image/png'?'png':'jpeg'});}}
 }
 const xmlEscape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 function sheet(rows,photos){const body=rows.map((row,i)=>`<row r="${i+1}"${i?' ht="82" customHeight="1"':''}>`+row.map((v,j)=>{const ref=excelColumnName(j+1)+(i+1);return typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(v??'')}</t></is></c>`;}).join('')+'</row>').join('');return `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><cols><col min="2" max="2" width="20" customWidth="1"/></cols><sheetData>${body}</sheetData><autoFilter ref="A1:${excelColumnName(rows[0].length)}${rows.length}"/>${photos.length?'<drawing r:id="rId1"/>':''}</worksheet>`;}
 const types='http://schemas.openxmlformats.org/package/2006/content-types',rels='http://schemas.openxmlformats.org/package/2006/relationships';
 const files={
 '[Content_Types].xml':`<?xml version="1.0"?><Types xmlns="${types}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>${detailPhotos.length?'<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>':''}${itemPhotos.length?'<Override PartName="/xl/drawings/drawing2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>':''}</Types>`,
 '_rels/.rels':`<?xml version="1.0"?><Relationships xmlns="${rels}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
 'xl/workbook.xml':'<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Image Details" sheetId="1" r:id="rId1"/><sheet name="Item Dimensions" sheetId="2" r:id="rId2"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels':`<?xml version="1.0"?><Relationships xmlns="${rels}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`,
 'xl/worksheets/sheet1.xml':sheet(details,detailPhotos),'xl/worksheets/sheet2.xml':sheet(summary,itemPhotos)
 };
 function addPhotos(photos,num){if(!photos.length)return;files[`xl/worksheets/_rels/sheet${num}.xml.rels`]=`<?xml version="1.0"?><Relationships xmlns="${rels}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${num}.xml"/></Relationships>`;files[`xl/drawings/_rels/drawing${num}.xml.rels`]=`<?xml version="1.0"?><Relationships xmlns="${rels}">`+photos.map((p,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/photo${num}_${i+1}.${p.ext}"/>`).join('')+'</Relationships>';files[`xl/drawings/drawing${num}.xml`]='<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+photos.map((p,i)=>`<xdr:oneCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${p.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="1100000" cy="950000"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i+1}" name="Photo ${i+1}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i+1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`).join('')+'</xdr:wsDr>';photos.forEach((p,i)=>files[`xl/media/photo${num}_${i+1}.${p.ext}`]=p.bytes);}
 addPhotos(detailPhotos,1);addPhotos(itemPhotos,2);
 return new Blob([createStoredZip(files)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

function excelColumnName(number) {
  let name = "";
  while (number > 0) {
    number--;
    name = String.fromCharCode(65 + number % 26) + name;
    number = Math.floor(number / 26);
  }
  return name;
}

function xmlEscape(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function createStoredZip(fileMap) {
  const encoder = new TextEncoder();
  const entries = [];
  let offset = 0;
  const localParts = [];
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const [name, content] of Object.entries(fileMap)) {
    const nameBytes = encoder.encode(name);
    const data = content instanceof Uint8Array ? content : encoder.encode(content);
    const crc = crc32(data);
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0, true);
    view.setUint16(8, 0, true); view.setUint16(10, dosTime, true); view.setUint16(12, dosDate, true);
    view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true); view.setUint16(28, 0, true); header.set(nameBytes, 30);
    localParts.push(header, data);
    entries.push({ nameBytes, crc, size: data.length, offset });
    offset += header.length + data.length;
  }
  const centralParts = [];
  let centralSize = 0;
  for (const entry of entries) {
    const header = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true);
    view.setUint16(8, 0, true); view.setUint16(10, 0, true); view.setUint16(12, dosTime, true); view.setUint16(14, dosDate, true);
    view.setUint32(16, entry.crc, true); view.setUint32(20, entry.size, true); view.setUint32(24, entry.size, true);
    view.setUint16(28, entry.nameBytes.length, true); view.setUint16(30, 0, true); view.setUint16(32, 0, true);
    view.setUint16(34, 0, true); view.setUint16(36, 0, true); view.setUint32(38, 0, true); view.setUint32(42, entry.offset, true);
    header.set(entry.nameBytes, 46); centralParts.push(header); centralSize += header.length;
  }
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(4, 0, true); endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true); endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true); endView.setUint16(20, 0, true);
  return concatenateBytes([...localParts, ...centralParts, end]);
}

function concatenateBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let position = 0;
  for (const part of parts) { output.set(part, position); position += part.length; }
  return output;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Capture failed")), "image/jpeg", quality);
  });
}

function maskFromSavedBackground(data, background, width, height, threshold, offsetX = 0, offsetY = 0) {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const i = p * 4;
      const bx = x + offsetX, by = y + offsetY;
      if (bx < 0 || bx >= width || by < 0 || by >= height) continue;
      const bi = (by * width + bx) * 4;
      const dr = data[i] - background[bi];
      const dg = data[i + 1] - background[bi + 1];
      const db = data[i + 2] - background[bi + 2];
      const colourDistance = Math.sqrt(dr * dr + dg * dg + db * db);
      const oldLuma = 0.299 * background[bi] + 0.587 * background[bi + 1] + 0.114 * background[bi + 2];
      const newLuma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const lumaRatio = Math.abs(newLuma - oldLuma) / Math.max(35, oldLuma);
      const oldSum = Math.max(30, background[bi] + background[bi + 1] + background[bi + 2]);
      const newSum = Math.max(30, data[i] + data[i + 1] + data[i + 2]);
      const chromaDistance = Math.sqrt(
        Math.pow(data[i] / newSum - background[bi] / oldSum, 2) +
        Math.pow(data[i + 1] / newSum - background[bi + 1] / oldSum, 2) +
        Math.pow(data[i + 2] / newSum - background[bi + 2] / oldSum, 2)
      ) * 255;
      const strongBrightnessChange = lumaRatio > 0.24;
      const realColourChange = chromaDistance > 9;
      mask[p] = colourDistance > threshold && (strongBrightnessChange || realColourChange) ? 1 : 0;
    }
  }
  return mask;
}

function estimateBackgroundOffset(data, background, width, height, maxShift) {
  const candidates = [];
  for (let dy = -maxShift; dy <= maxShift; dy++) {
    for (let dx = -maxShift; dx <= maxShift; dx++) {
      candidates.push({ dx, dy, distance: Math.abs(dx) + Math.abs(dy) });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);

  const bandX = Math.max(12, Math.round(width * 0.18));
  const bandY = Math.max(10, Math.round(height * 0.18));
  let best = { dx: 0, dy: 0, score: Infinity };
  for (const candidate of candidates) {
    let difference = 0;
    let checked = 0;
    for (let y = 8; y < height - 8; y += 7) {
      for (let x = 8; x < width - 8; x += 7) {
        if (x > bandX && x < width - bandX && y > bandY && y < height - bandY) continue;
        const bx = x + candidate.dx;
        const by = y + candidate.dy;
        if (bx < 0 || bx >= width || by < 0 || by >= height) continue;
        const i = (y * width + x) * 4;
        const bi = (by * width + bx) * 4;
        const currentLuma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const savedLuma = 0.299 * background[bi] + 0.587 * background[bi + 1] + 0.114 * background[bi + 2];
        difference += Math.min(50, Math.abs(currentLuma - savedLuma));
        checked++;
      }
    }
    const score = checked ? difference / checked + candidate.distance * 0.08 : Infinity;
    if (score < best.score) best = { dx: candidate.dx, dy: candidate.dy, score };
  }
  return best;
}

function majorityFilter(mask, width, height, rounds) {
  const source = new Uint8Array(mask.length);
  for (let round = 0; round < rounds; round++) {
    source.set(mask);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let count = 0;
        for (let yy = -1; yy <= 1; yy++) {
          for (let xx = -1; xx <= 1; xx++) count += source[(y + yy) * width + x + xx];
        }
        mask[y * width + x] = count >= 5 ? 1 : 0;
      }
    }
  }
}

function closeSmallGaps(mask, width, height, radius) {
  const source = new Uint8Array(mask);
  const dilated = new Uint8Array(mask.length);
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      let found = 0;
      for (let yy = -radius; yy <= radius && !found; yy++) {
        for (let xx = -radius; xx <= radius; xx++) {
          if (source[(y + yy) * width + x + xx]) { found = 1; break; }
        }
      }
      dilated[y * width + x] = found;
    }
  }
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      let all = 1;
      for (let yy = -radius; yy <= radius && all; yy++) {
        for (let xx = -radius; xx <= radius; xx++) {
          if (!dilated[(y + yy) * width + x + xx]) { all = 0; break; }
        }
      }
      mask[y * width + x] = all;
    }
  }
}

function largestCentralComponent(mask, width, height, minimumPixels) {
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  const cx = width / 2;
  const cy = height / 2;
  let best = null;

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let area = 0;
    let minX = width, minY = height, maxX = 0, maxY = 0;

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      area++;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const neighbours = [index - 1, index + 1, index - width, index + width];
      for (const next of neighbours) {
        if (next < 0 || next >= mask.length || visited[next] || !mask[next]) continue;
        const nx = next % width;
        if (Math.abs(nx - x) > 1) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }

    if (area < minimumPixels) continue;
    const boxCx = (minX + maxX) / 2;
    const boxCy = (minY + maxY) / 2;
    const centreDistance = Math.hypot((boxCx - cx) / width, (boxCy - cy) / height);
    const centralWeight = Math.max(0.25, 1 - centreDistance * 1.25);
    const score = area * centralWeight;
    const candidate = {
      x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1,
      area, score,
      touchesEdge: minX <= 2 || minY <= 2 || maxX >= width - 3 || maxY >= height - 3
    };
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best;
}

function expandBox(box, width, height, marginRatio) {
  const mx = Math.round(box.width * marginRatio + 2);
  const my = Math.round(box.height * marginRatio + 2);
  return {
    ...box,
    x: Math.max(0, box.x - mx),
    y: Math.max(0, box.y - my),
    width: Math.min(width, box.x + box.width + mx) - Math.max(0, box.x - mx),
    height: Math.min(height, box.y + box.height + my) - Math.max(0, box.y - my)
  };
}

function smoothBox(previous, current, alpha) {
  if (!previous) return current;
  const blend = (a, b) => a + (b - a) * alpha;
  return {
    ...current,
    x: blend(previous.x, current.x),
    y: blend(previous.y, current.y),
    width: blend(previous.width, current.width),
    height: blend(previous.height, current.height)
  };
}

function calculateConfidence(candidate, width, height) {
  const boxArea = Math.max(1, candidate.width * candidate.height);
  const fill = Math.min(1, candidate.area / boxArea);
  const size = Math.min(1, candidate.area / (width * height * 0.16));
  const edgePenalty = candidate.touchesEdge ? 0.45 : 1;
  return Math.max(0.1, Math.min(0.98, (0.42 + fill * 0.34 + size * 0.24) * edgePenalty));
}

function drawOverlay(box, marker = null) {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  const sx = overlay.width / workCanvas.width;
  const sy = overlay.height / workCanvas.height;
  if (marker) {
    overlayCtx.strokeStyle = "#42d7ff";
    overlayCtx.lineWidth = Math.max(3, overlay.width / 360);
    overlayCtx.setLineDash([12, 8]);
    overlayCtx.strokeRect(marker.x * sx, marker.y * sy, marker.width * sx, marker.height * sy);
    overlayCtx.setLineDash([]);
    overlayCtx.fillStyle = "#42d7ff";
    overlayCtx.font = `700 ${Math.max(16, overlay.width / 44)}px system-ui`;
    overlayCtx.fillText(`${markerSizeCm} CM REFERENCE`, marker.x * sx, Math.max(18, marker.y * sy - 7));
  }
  if (!box) return;
  const x = box.x * sx;
  const y = box.y * sy;
  const w = box.width * sx;
  const h = box.height * sy;

  overlayCtx.strokeStyle = box.touchesEdge ? "#ffba52" : "#54e38e";
  overlayCtx.lineWidth = Math.max(4, overlay.width / 280);
  overlayCtx.shadowColor = "rgba(0,0,0,.65)";
  overlayCtx.shadowBlur = 8;
  roundedRect(overlayCtx, x, y, w, h, Math.min(24, w * 0.08));
  overlayCtx.stroke();
  overlayCtx.shadowBlur = 0;

  const label = box.touchesEdge ? "ITEM MAY BE CUT OFF" : "OBJECT";
  overlayCtx.font = `700 ${Math.max(18, overlay.width / 38)}px system-ui`;
  const textWidth = overlayCtx.measureText(label).width;
  const labelH = Math.max(34, overlay.width / 23);
  overlayCtx.fillStyle = box.touchesEdge ? "#ffba52" : "#54e38e";
  overlayCtx.fillRect(x, Math.max(0, y - labelH), textWidth + 22, labelH);
  overlayCtx.fillStyle = "#07120c";
  overlayCtx.fillText(label, x + 11, Math.max(labelH * .72, y - labelH * .28));
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

window.addEventListener("resize", () => {
  if (running) resizeCanvases();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && running) stopCamera();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js?v=0.11.0")
      .then(registration => registration.update())
      .catch(() => {});
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sessionStorage.getItem("live-object-frame-reloaded") === "0.11.0") return;
      sessionStorage.setItem("live-object-frame-reloaded", "0.11.0");
      window.location.reload();
    });
  });
}

// Import a stored photo into the same review and measurement workflow as live capture.
const uploadImageButton = document.querySelector('#uploadImageButton');
const uploadImageInput = document.querySelector('#uploadImageInput');
uploadImageButton.addEventListener('click', () => uploadImageInput.click());
uploadImageInput.addEventListener('change', async () => {
  const file = uploadImageInput.files?.[0];
  if (!file) return;
  uploadImageButton.disabled = true;
  try {
    if (!file.type.startsWith('image/')) throw new Error('Please select an image file.');
    const bitmap = await createImageBitmap(file, {imageOrientation:'from-image'});
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    if (!canvas.width || !canvas.height) throw new Error('Image has no pixels.');
    canvas.getContext('2d').drawImage(bitmap,0,0);
    bitmap.close?.();
    await captureCurrentObject(canvas);
  } catch(error) {
    alert('Image upload failed: ' + error.message);
  } finally {
    uploadImageInput.value = '';
    uploadImageButton.disabled = false;
  }
});

// Display-only pan/zoom. Frame coordinates always remain in original image pixels.
const editorViewport = document.querySelector('#editorScroll');
let editorScale = 1, editorPanX = 0, editorPanY = 0;
const editorTouches = new Map();
let editorViewGesture = null;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function updateEditorView() {
  const w = editorViewport.clientWidth, h = frameEditor.width ? w * frameEditor.height / frameEditor.width : 0;
  const scaledWidth = w * editorScale, scaledHeight = h * editorScale;
  editorPanX = clamp(editorPanX, Math.min(0, w - scaledWidth), 0);
  editorPanY = clamp(editorPanY, Math.min(0, h - scaledHeight), 0);
  frameEditor.style.transform = `translate(${editorPanX}px, ${editorPanY}px) scale(${editorScale})`;
  editorViewport.style.height = `${h}px`;
}
function resetEditorView() {
  editorScale = 1; editorPanX = editorPanY = 0;
  frameEditor.style.transform = '';
  editorViewport.style.height = '';
  requestAnimationFrame(updateEditorView);
}
function zoomEditorAt(nextScale, x, y) {
  nextScale = clamp(nextScale, 1, 5);
  const ratio = nextScale / editorScale;
  editorPanX = x - (x - editorPanX) * ratio;
  editorPanY = y - (y - editorPanY) * ratio;
  editorScale = nextScale;
  updateEditorView();
}
function editorLocalPoint(e) {
  const r = editorViewport.getBoundingClientRect();
  return {x:e.clientX-r.left, y:e.clientY-r.top};
}
function viewGestureStart() {
  const pts=[...editorTouches.values()];
  if(pts.length===2) {
    frameGesture=null; markerGesture=null;
    const mid={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
    editorViewGesture={kind:'pinch',distance:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y),scale:editorScale,mid,panX:editorPanX,panY:editorPanY};
  }
}
editorViewport.addEventListener('pointerdown',e=>{
  if(frameEditorStage.hidden) return;
  const p=editorLocalPoint(e); editorTouches.set(e.pointerId,p);
  if(editorTouches.size===2) {
    viewGestureStart();
    e.preventDefault(); e.stopPropagation();
  } else if(editorTouches.size===1) {
    const pt=editorPoint(e);
    const editingMarker=markerPicking && editableMarker;
    const editingItem=manualFrameEnabled && editableFrame && !markerPicking;
    const hit=editingMarker ? markerHit(pt) : editingItem ? (frameHandles(editableFrame).some(h=>Math.hypot(pt.x-h.x,pt.y-h.y)<=32*frameEditor.width/Math.max(frameEditor.getBoundingClientRect().width,1)) || (pt.x>=editableFrame.x&&pt.x<=editableFrame.x+editableFrame.width&&pt.y>=editableFrame.y&&pt.y<=editableFrame.y+editableFrame.height)) : false;
    if(!hit && editorScale>1) editorViewGesture={kind:'pan',id:e.pointerId,point:p,panX:editorPanX,panY:editorPanY};
  }
}, {capture:true,passive:false});
editorViewport.addEventListener('pointermove',e=>{
  if(!editorTouches.has(e.pointerId)) return;
  const p=editorLocalPoint(e); editorTouches.set(e.pointerId,p);
  if(editorViewGesture?.kind==='pinch' && editorTouches.size>=2) {
    const pts=[...editorTouches.values()].slice(0,2);
    const mid={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
    const g=editorViewGesture, scale=clamp(g.scale*Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)/Math.max(g.distance,1),1,5);
    const ratio=scale/g.scale;
    editorScale=scale;
    editorPanX=mid.x-(g.mid.x-g.panX)*ratio;
    editorPanY=mid.y-(g.mid.y-g.panY)*ratio;
    updateEditorView(); e.preventDefault(); e.stopPropagation();
  } else if(editorViewGesture?.kind==='pan' && editorViewGesture.id===e.pointerId) {
    editorPanX=editorViewGesture.panX+p.x-editorViewGesture.point.x;
    editorPanY=editorViewGesture.panY+p.y-editorViewGesture.point.y;
    updateEditorView(); e.preventDefault(); e.stopPropagation();
  }
}, {capture:true,passive:false});
function endEditorTouch(e) {
  editorTouches.delete(e.pointerId);
  if(editorViewGesture) {
    editorViewGesture=null;
    if(editorTouches.size===2) viewGestureStart();
  }
}
editorViewport.addEventListener('pointerup',endEditorTouch,{capture:true});
editorViewport.addEventListener('pointercancel',endEditorTouch,{capture:true});
editorViewport.addEventListener('wheel',e=>{
  if(frameEditorStage.hidden) return;
  e.preventDefault();
  const p=editorLocalPoint(e);
  zoomEditorAt(editorScale*Math.exp(-e.deltaY*.002),p.x,p.y);
},{passive:false});
frameEditor.addEventListener('pointerdown',e=>{ if(manualFrameEnabled || markerPicking) e.preventDefault(); },{passive:false});
