'use strict';
(function(root){
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
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
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
    view.setUint16(8, 0x0800, true); view.setUint16(10, 0, true); view.setUint16(12, dosTime, true); view.setUint16(14, dosDate, true);
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


function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function col(n){let s='';for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function worksheet(rows){return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="30" width="22" customWidth="1"/></cols><sheetData>${rows.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>{let ref=col(j)+(i+1);return typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v??'')}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${col(rows[0].length-1)}${rows.length}"/></worksheet>`;}
function workbook(records){let summary=[['Barcode','Length cm','Width cm','Height cm','Status','Reason','Measured At','Record ID']],views=[['Barcode','View','Horizontal Axis','Horizontal cm','Vertical Axis','Vertical cm','Lens to Desk cm','Maximum Thickness cm','Extra Clearance %','Depth Scale Budget %','Depth Target Met','Status','Method','Captured At','Record ID']];for(let r of records){summary.push([r.barcode,r.dimensions.L,r.dimensions.W,r.dimensions.H,r.status,r.reason,r.date,r.id]);for(let v of r.views)views.push([r.barcode,v.name,v.axes[0],v.result.horizontal,v.axes[1],v.result.vertical,v.distance,v.thickness,v.margin,v.result.depthBudget,v.result.targetMet?'Yes — not accuracy verification':'No','Review Required',v.result.model,v.capturedAt,r.id]);}let files={
'[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
'_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
'xl/workbook.xml':'<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Products" sheetId="1" r:id="rId1"/><sheet name="Views and Review" sheetId="2" r:id="rId2"/></sheets></workbook>',
'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>',
'xl/worksheets/sheet1.xml':worksheet(summary),'xl/worksheets/sheet2.xml':worksheet(views)};return new Blob([createStoredZip(files)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
const api={createStoredZip,workbook};if(typeof module!=='undefined')module.exports=api;else root.ExportTools=api;
})(typeof globalThis!=='undefined'?globalThis:this);
