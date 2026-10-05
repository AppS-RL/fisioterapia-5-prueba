(()=>{
  const CONFIG={
    business:"Fisioterapia 5",
    address:"La ubicación se confirma directamente con Fisioterapia 5.",
    mapUrl:"",
    bank:"Solicita a Fisioterapia 5 la cuenta y referencia vigentes antes de realizar tu transferencia.",
    appointmentStorage:"fisio5Appointments",
    patientStorage:"fisio5Patients",
    patientSyncStorage:"fisio5PatientSyncQueue"
  };
  const AGENDA_ROOT=window.__agendaRoot||document;
  const $=selector=>AGENDA_ROOT.querySelector(selector);
  const $$=selector=>[...AGENDA_ROOT.querySelectorAll(selector)];
  const AREAS={valuation:"Valoración",followup:"Seguimiento",valuation_treatment:"Valoración y tratamiento",revaluation:"Revaloración",hands:"Valoración",feet:"Tratamiento",both:"Valoración y tratamiento"};
  const SERVICES=[
    {id:"first_time",name:"Primera vez"},
    {id:"followup",name:"Seguimiento"},
    {id:"geriatric",name:"Geriátrica"},
    {id:"sports",name:"Deportiva"},
    {id:"neurological",name:"Neurológico"},
    {id:"home",name:"A domicilio"},
    {id:"discharge",name:"Descarga"}
  ];
  const RETENTION_MONTHS=12;
  let selectedDate=new Date();
  let activeMessageAppointmentId="";
  let activeSummaryPeriod="week";

  if(window.__agendaClose){
    AGENDA_ROOT.querySelectorAll(".brand,.back-site-link,.embedded-back").forEach(link=>link.onclick=event=>{event.preventDefault();window.__agendaClose()});
  }

  const pad=value=>String(value).padStart(2,"0");
  const toISO=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  const fromISO=value=>{const[y,m,d]=String(value).split("-").map(Number);return new Date(y,m-1,d)};
  const phone=value=>String(value||"").replace(/\D/g,"");
  const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
  const money=value=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:0}).format(Number(value)||0);
  const escapeHTML=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const readList=key=>{try{const value=JSON.parse(localStorage.getItem(key));return Array.isArray(value)?value:[]}catch{return[]}};
  const getAppointments=()=>readList(CONFIG.appointmentStorage);
  const getPatients=()=>readList(CONFIG.patientStorage);
  const getPatientSyncQueue=()=>readList(CONFIG.patientSyncStorage);
  let patientSyncPromise=null;
  function updatePatientSyncStatus(message=""){const element=$("#patientSyncStatus");if(!element)return;const pending=getPatientSyncQueue().length;element.textContent=message||(pending?`${pending} ${pending===1?"cambio pendiente":"cambios pendientes"} de sincronizar`:"Pacientes sincronizados")}
  function queuePatientChanges(changes){const pending=new Map(getPatientSyncQueue().map(change=>[change.id,change]));changes.forEach(change=>pending.set(change.id,{...change,queueId:uid(),queuedAt:new Date().toISOString()}));localStorage.setItem(CONFIG.patientSyncStorage,JSON.stringify([...pending.values()]));updatePatientSyncStatus()}
  async function flushPatientSyncQueue({notify=false}={}){if(patientSyncPromise)return patientSyncPromise;patientSyncPromise=(async()=>{const initial=getPatientSyncQueue();if(!initial.length){updatePatientSyncStatus();return true}if(!window.CloudPatients?.ready?.()||!window.CloudPatients?.isUnlocked?.()||navigator.onLine===false){updatePatientSyncStatus("Guardado en este dispositivo · pendiente de sincronizar");return false}let failed=false;for(const change of initial){try{if(change.type==="delete")await window.CloudPatients.remove(change.id);else await window.CloudPatients.upsert(change.patient);const current=getPatientSyncQueue();localStorage.setItem(CONFIG.patientSyncStorage,JSON.stringify(current.filter(item=>item.id!==change.id||item.queueId!==change.queueId)))}catch(error){failed=true;console.warn("No se pudo sincronizar el paciente:",error.message)}}const pending=getPatientSyncQueue().length;if(failed||pending){updatePatientSyncStatus("Guardado en este dispositivo · pendiente de sincronizar");if(notify)toast("Paciente guardado; falta sincronizarlo en la nube");return false}updatePatientSyncStatus("Pacientes sincronizados");if(notify)toast("Paciente guardado y sincronizado");return true})().finally(()=>{patientSyncPromise=null});return patientSyncPromise}
  const savePatients=items=>{
    const before=getPatients(),beforeById=new Map(before.map(item=>[item.id,item])),afterIds=new Set(items.map(item=>item.id));
    localStorage.setItem(CONFIG.patientStorage,JSON.stringify(items));
    const changes=[];items.forEach(item=>{const old=beforeById.get(item.id);if(!old||old.updatedAt!==item.updatedAt)changes.push({type:"upsert",id:item.id,patient:item})});before.forEach(item=>{if(!afterIds.has(item.id))changes.push({type:"delete",id:item.id})});if(changes.length)queuePatientChanges(changes);return flushPatientSyncQueue();
  };
  const getPatient=id=>getPatients().find(item=>item.id===id);
  const getService=id=>SERVICES.find(item=>item.id===id)||{id:id||"service",name:legacyServiceName(id)};

  function legacyServiceName(id){
    const labels={assessment_initial:"Primera vez",assessment_followup:"Seguimiento",assessment_functional:"Valoración",therapy_sports:"Deportiva",therapy_neurological:"Neurológico",therapy_geriatric:"Geriátrica",therapy_home:"A domicilio",therapy_massage:"Descarga",therapy_manual:"Descarga",therapy_musculoskeletal:"Seguimiento"};
    return labels[id]||"Servicio";
  }
  function normalizeArea(value){const legacy={hands:"valuation",feet:"valuation_treatment",both:"valuation_treatment"};return legacy[value]||(["valuation","followup","valuation_treatment","revaluation"].includes(value)?value:"valuation")}
  function normalizeServiceId(value){const legacy={assessment_initial:"first_time",assessment_followup:"followup",assessment_functional:"first_time",therapy_geriatric:"geriatric",therapy_sports:"sports",therapy_neurological:"neurological",therapy_home:"home",therapy_massage:"discharge",therapy_manual:"discharge",therapy_musculoskeletal:"followup",therapy_postoperative:"followup",therapy_dry_needling:"discharge"};return SERVICES.some(item=>item.id===value)?value:legacy[value]||"first_time"}
  function areaLabel(value){return AREAS[value]||"Valoración"}
  function serviceLabel(item){return getService(item.serviceId||(item.services&&item.services[0]?.id)).name}
  function formatDate(iso,options={weekday:"long",day:"numeric",month:"long"}){return fromISO(iso).toLocaleDateString("es-MX",options)}
  function formatTime(value){const[hours,minutes]=String(value).split(":").map(Number),period=hours<12?"a. m.":"p. m.",hour=hours%12||12;return `${hour}:${pad(minutes)} ${period}`}
  function hourlyTimes(start,end){return Array.from({length:end-start+1},(_,index)=>`${pad(start+index)}:00`)}
  function timesForDate(iso){
    const day=fromISO(iso).getDay();
    if(day===1||day===5)return hourlyTimes(9,20);
    if(day===3)return["19:00","20:00"];
    if(day===2||day===4)return hourlyTimes(7,20);
    return[];
  }
  function isWorkingDay(iso){return timesForDate(iso).length>0}
  function nextWorkingDate(date){const result=new Date(date);while(!timesForDate(toISO(result)).length)result.setDate(result.getDate()+1);return result}
  function appointmentsFor(date){return getAppointments().filter(item=>item.date===date).sort((a,b)=>a.time.localeCompare(b.time))}
  function availableTimes(date,ignoreId=""){const occupied=getAppointments().filter(item=>item.date===date&&item.id!==ignoreId).map(item=>item.time);return timesForDate(date).filter(time=>!occupied.includes(time))}
  function toast(message){const element=$("#toast");element.textContent=message;element.classList.add("show");setTimeout(()=>element.classList.remove("show"),2400)}
  function waLink(number,message){const digits=phone(number),international=digits.length===10?`52${digits}`:digits;return `https://wa.me/${international}?text=${encodeURIComponent(message)}`}
  function openWhatsApp(number,message){window.open(waLink(number,message),"_blank","noopener,noreferrer")}

  function saveAppointments(items){
    const before=getAppointments(),beforeById=new Map(before.map(item=>[item.id,item])),afterIds=new Set(items.map(item=>item.id));
    localStorage.setItem(CONFIG.appointmentStorage,JSON.stringify(items));
    items.forEach(item=>{const old=beforeById.get(item.id);if(!old||old.updatedAt!==item.updatedAt)window.CloudAppointments?.upsert(item).catch(()=>{})});
    before.forEach(item=>{if(!afterIds.has(item.id))window.CloudAppointments?.remove(item.id).catch(()=>{})});
  }
  function retentionCutoffISO(){const cutoff=new Date();cutoff.setMonth(cutoff.getMonth()-RETENTION_MONTHS);return toISO(cutoff)}
  function pruneLocalAppointments(){const current=getAppointments().filter(item=>!item?.date||item.date>=retentionCutoffISO());saveAppointments(current);return current}
  async function hydratePatients(){
    if(!window.CloudPatients?.list)return null;
    try{
      await flushPatientSyncQueue();const cloud=await window.CloudPatients.list();
      if(!Array.isArray(cloud))return null;
      const local=getPatients(),pendingDeletes=new Set(getPatientSyncQueue().filter(change=>change.type==="delete").map(change=>change.id)),cloudById=new Map(cloud.filter(item=>!pendingDeletes.has(item.id)).map(item=>[item.id,item])),merged=new Map(cloudById);
      local.forEach(item=>{
        const remote=cloudById.get(item.id),localIsNewer=!remote||String(item.updatedAt||"")>String(remote.updatedAt||"");
        if(localIsNewer){merged.set(item.id,item);queuePatientChanges([{type:"upsert",id:item.id,patient:item}])}
      });
      localStorage.setItem(CONFIG.patientStorage,JSON.stringify([...merged.values()]));
      await flushPatientSyncQueue();fillPatientOptions();render();updatePatientSyncStatus();
      return[...merged.values()];
    }catch(error){console.warn("Se usará la copia local de pacientes:",error.message);return null}
  }

  function patientPackageText(patient){
    const size=Number(patient?.packageSize)||0,remaining=Number(patient?.sessionsRemaining)||0;
    return size?`Paquete de ${size} sesiones · ${remaining} ${remaining===1?"cita restante":"citas restantes"}`:"Sin paquete activo";
  }
  function packageSnapshot(patient){return patient&&Number(patient.packageSize)>0?{packageSize:Number(patient.packageSize),sessionsRemaining:Number(patient.sessionsRemaining)||0}:null}
  function setPatientPackageRemaining(patientId,value){
    if(!patientId)return null;
    const patients=getPatients(),index=patients.findIndex(item=>item.id===patientId);
    if(index<0)return null;
    const patient=patients[index],limit=Number(patient.packageSize)||0;
    patients[index]={...patient,sessionsRemaining:Math.max(0,Math.min(limit,Number(value)||0)),updatedAt:new Date().toISOString()};
    savePatients(patients);
    return patients[index];
  }
  function consumePackage(patientId){const patient=getPatient(patientId);if(!patient||!Number(patient.packageSize)||Number(patient.sessionsRemaining)<=0)return null;return setPatientPackageRemaining(patientId,Number(patient.sessionsRemaining)-1)}
  function restorePackage(patientId){const patient=getPatient(patientId);if(!patient||!Number(patient.packageSize))return null;return setPatientPackageRemaining(patientId,Number(patient.sessionsRemaining)+1)}

  function fillPatientOptions(selected=""){
    const patients=getPatients().sort((a,b)=>a.name.localeCompare(b.name,"es"));
    $("#appointmentPatient").innerHTML=`<option value="">Paciente nuevo</option>${patients.map(item=>`<option value="${item.id}"${item.id===selected?" selected":""}>${escapeHTML(item.name)} · ${escapeHTML(item.phone)}</option>`).join("")}`;
  }
  function renderAppointmentPackage(){
    const patient=getPatient($("#appointmentPatient").value),banner=$("#appointmentPackage");
    if(!patient||!Number(patient.packageSize)){banner.hidden=true;banner.innerHTML="";return}
    const remaining=Number(patient.sessionsRemaining)||0;
    banner.hidden=false;
    banner.innerHTML=`<strong>Paquete activo</strong><span>${escapeHTML(patientPackageText(patient))}</span>${remaining?"<small>Al guardar una cita nueva se descontará una sesión.</small>":"<small>El paquete ya no tiene sesiones disponibles.</small>"}`;
  }
  function choosePatient(){
    const patient=getPatient($("#appointmentPatient").value),saveLabel=$("#savePatientLabel");
    if(!patient){saveLabel.hidden=false;renderAppointmentPackage();return}
    $("#clientName").value=patient.name||"";
    $("#clientPhone").value=patient.phone||"";
    $("#appointmentDiagnosis").value=patient.diagnosis||"";
    $("#appointmentTreatment").value=patient.treatment||"";
    saveLabel.hidden=true;
    renderAppointmentPackage();
  }
  function upsertPatientFromAppointment(existingId){
    const patients=getPatients(),existing=patients.find(item=>item.id===existingId),now=new Date().toISOString();
    if(!existing&&!$("#savePatientCheck").checked)return null;
    const record={
      ...existing,
      id:existing?.id||uid(),
      name:$("#clientName").value.trim(),
      phone:phone($("#clientPhone").value),
      diagnosis:$("#appointmentDiagnosis").value.trim(),
      treatment:$("#appointmentTreatment").value.trim(),
      packageSize:Number(existing?.packageSize)||0,
      sessionsRemaining:Number(existing?.sessionsRemaining)||0,
      createdAt:existing?.createdAt||now,
      updatedAt:now
    };
    savePatients(existing?patients.map(item=>item.id===record.id?record:item):[...patients,record]);
    return record;
  }

  function fillTimes(date,selected="",ignoreId=""){
    let times=availableTimes(date,ignoreId);
    if(selected&&!times.includes(selected))times=[...times,selected].sort();
    $("#appointmentTime").innerHTML=times.length?times.map(time=>`<option value="${time}"${time===selected?" selected":""}>${formatTime(time)}</option>`).join(""):`<option value="">${isWorkingDay(date)?"Sin horarios disponibles":"No hay atención este día"}</option>`;
  }
  function resetAppointmentForm(){
    $("#appointmentForm").reset();
    $("#appointmentId").value="";
    $("#formEyebrow").textContent="Nueva cita";
    $("#formTitle").textContent="Agendar cita";
    $("#deleteBtn").hidden=true;
    $("#formError").textContent="";
    $("#savePatientCheck").checked=true;
    $("#savePatientLabel").hidden=false;
    $("#areaSelect").value="valuation";
    fillPatientOptions();
    renderAppointmentPackage();
  }
  function openNewAppointment(){
    resetAppointmentForm();
    const date=nextWorkingDate(selectedDate),iso=toISO(date);
    $("#appointmentDate").value=iso;
    fillTimes(iso);
    $("#appointmentDialog").showModal();
  }
  function openEditAppointment(id){
    const item=getAppointments().find(entry=>entry.id===id);if(!item)return;
    resetAppointmentForm();
    $("#appointmentId").value=item.id;
    fillPatientOptions(item.patientId||"");
    $("#clientName").value=item.name||"";
    $("#clientPhone").value=item.phone||"";
    $("#areaSelect").value=normalizeArea(item.area);
    $("#serviceSelect").value=normalizeServiceId(item.serviceId||(item.services&&item.services[0]?.id));
    $("#appointmentDate").value=item.date;
    $("#appointmentPrice").value=item.price||"";
    $("#appointmentDiagnosis").value=item.diagnosis||getPatient(item.patientId)?.diagnosis||"";
    $("#appointmentTreatment").value=item.treatment||getPatient(item.patientId)?.treatment||"";
    $("#appointmentNotes").value=item.notes||"";
    $("#formEyebrow").textContent="Editar cita";
    $("#formTitle").textContent=item.name;
    $("#deleteBtn").hidden=false;
    $("#savePatientLabel").hidden=Boolean(item.patientId);
    fillTimes(item.date,item.time,item.id);
    renderAppointmentPackage();
    $("#appointmentDialog").showModal();
  }
  function saveAppointment(event){
    event.preventDefault();
    const id=$("#appointmentId").value,name=$("#clientName").value.trim(),number=phone($("#clientPhone").value),area=$("#areaSelect").value,serviceId=$("#serviceSelect").value,date=$("#appointmentDate").value,time=$("#appointmentTime").value,price=Math.max(0,Number($("#appointmentPrice").value)||0),error=$("#formError"),items=getAppointments(),current=items.find(item=>item.id===id);
    if(!name||number.length<10||!area||!serviceId||!date||!time){error.textContent="Completa el paciente, WhatsApp, área, servicio, fecha y hora.";return}
    if(!isWorkingDay(date)){error.textContent="Elige un día con horario de atención.";return}
    if(!availableTimes(date,id).includes(time)){error.textContent="Ese horario ya está ocupado. Elige otro, por favor.";fillTimes(date,"",id);return}
    const wasRescheduled=Boolean(current&&(current.date!==date||current.time!==time)),reschedules=(Number(current?.reschedules)||0)+(wasRescheduled?1:0);
    if(reschedules>2){error.textContent="Esta cita ya alcanzó el máximo de dos reprogramaciones.";return}

    let patient=upsertPatientFromAppointment($("#appointmentPatient").value);
    let packageUsed=Boolean(current?.packageUsed),packageSize=Number(current?.packageSize)||0,packageRemainingAfter=Number(current?.packageRemainingAfter)||0;
    if(current?.packageUsed&&current.patientId&&current.patientId!==patient?.id){restorePackage(current.patientId);packageUsed=false;packageSize=0;packageRemainingAfter=0}
    if(!current&&patient){const updated=consumePackage(patient.id);if(updated){patient=updated;packageUsed=true;packageSize=Number(updated.packageSize);packageRemainingAfter=Number(updated.sessionsRemaining)}}
    if(current&&!current.packageUsed&&current.patientId!==patient?.id&&patient){const updated=consumePackage(patient.id);if(updated){patient=updated;packageUsed=true;packageSize=Number(updated.packageSize);packageRemainingAfter=Number(updated.sessionsRemaining)}}

    const now=new Date().toISOString(),record={
      ...current,
      id:id||uid(),patientId:patient?.id||"",name,phone:number,area,serviceId,
      services:[{id:serviceId,area,minutes:60}],duration:60,date,time,price,
      diagnosis:$("#appointmentDiagnosis").value.trim(),treatment:$("#appointmentTreatment").value.trim(),notes:$("#appointmentNotes").value.trim(),
      packageUsed,packageSize,packageRemainingAfter,status:current?.status||"Programada",reschedules,
      createdAt:current?.createdAt||now,updatedAt:now
    };
    const updatedItems=id?items.map(item=>item.id===id?record:item):[...items,record];
    saveAppointments(updatedItems);
    selectedDate=fromISO(date);
    $("#appointmentDialog").close();
    render();
    toast(id?"Cita actualizada":"Cita guardada");
  }
  function deleteAppointment(){
    const id=$("#appointmentId").value,item=getAppointments().find(entry=>entry.id===id);
    if(!item||!confirm("¿Quieres cancelar y eliminar esta cita?"))return;
    if(item.packageUsed&&item.patientId)restorePackage(item.patientId);
    saveAppointments(getAppointments().filter(entry=>entry.id!==id));
    $("#appointmentDialog").close();render();toast("Cita cancelada");
  }

  function openPatients(){renderPatients();$("#patientsDialog").showModal()}
  function renderPatients(){
    const query=$("#patientSearch").value.trim().toLocaleLowerCase("es"),patients=getPatients().filter(item=>!query||`${item.name} ${item.phone}`.toLocaleLowerCase("es").includes(query)).sort((a,b)=>a.name.localeCompare(b.name,"es"));
    $("#patientList").innerHTML=patients.length?patients.map(item=>`<article class="patient-card"><div><strong>${escapeHTML(item.name)}</strong><span>${escapeHTML(item.phone)}</span><small class="${Number(item.packageSize)?"package-active":""}">${escapeHTML(patientPackageText(item))}</small></div><button class="secondary-btn" type="button" data-edit-patient="${item.id}">Ver y modificar</button></article>`).join(""):`<div class="summary-empty">${query?"No encontramos pacientes con esa búsqueda.":"Todavía no hay pacientes guardados."}</div>`;
  }
  function openPatientEditor(id=""){
    const patient=getPatient(id),form=$("#patientForm");form.reset();
    $("#patientId").value=patient?.id||"";
    $("#patientName").value=patient?.name||"";
    $("#patientPhone").value=patient?.phone||"";
    $("#patientDiagnosis").value=patient?.diagnosis||"";
    $("#patientTreatment").value=patient?.treatment||"";
    $("#patientPackage").value=String(Number(patient?.packageSize)||0);
    $("#patientSessions").value=String(Number(patient?.sessionsRemaining)||0);
    $("#patientFormEyebrow").textContent=patient?"Expediente del paciente":"Paciente";
    $("#patientFormTitle").textContent=patient?.name||"Nuevo paciente";
    $("#deletePatientBtn").hidden=!patient;
    $("#patientFormError").textContent="";
    $("#patientEditorDialog").showModal();
  }
  function savePatient(event){
    event.preventDefault();
    const id=$("#patientId").value,name=$("#patientName").value.trim(),number=phone($("#patientPhone").value),size=Number($("#patientPackage").value)||0,sessions=Number($("#patientSessions").value)||0,error=$("#patientFormError"),patients=getPatients(),current=patients.find(item=>item.id===id);
    if(!name||number.length<10){error.textContent="Completa el nombre y un WhatsApp válido.";return}
    if(sessions<0||sessions>size){error.textContent=size?`Las sesiones restantes deben estar entre 0 y ${size}.`:"Selecciona un paquete antes de agregar sesiones.";return}
    const now=new Date().toISOString(),record={...current,id:id||uid(),name,phone:number,diagnosis:$("#patientDiagnosis").value.trim(),treatment:$("#patientTreatment").value.trim(),packageSize:size,sessionsRemaining:size?sessions:0,createdAt:current?.createdAt||now,updatedAt:now};
    const sync=savePatients(current?patients.map(item=>item.id===record.id?record:item):[...patients,record]);
    $("#patientEditorDialog").close();renderPatients();fillPatientOptions();render();toast(id?"Paciente actualizado en este dispositivo":"Paciente guardado en este dispositivo");sync.then(synced=>toast(synced?"Paciente guardado y sincronizado":"Paciente guardado; pendiente de sincronizar"));
  }
  function deletePatient(){
    const id=$("#patientId").value,patient=getPatient(id);if(!patient||!confirm(`¿Quieres eliminar el expediente de ${patient.name}?`))return;
    const sync=savePatients(getPatients().filter(item=>item.id!==id));
    saveAppointments(getAppointments().map(item=>item.patientId===id?{...item,patientId:"",packageUsed:false,packageSize:0,packageRemainingAfter:0,updatedAt:new Date().toISOString()}:item));
    $("#patientEditorDialog").close();renderPatients();fillPatientOptions();render();toast("Paciente enviado a la papelera");sync.then(synced=>{if(!synced)toast("Eliminación pendiente de sincronizar")});
  }
  async function openPatientTrash(){
    const dialog=$("#patientTrashDialog"),list=$("#patientTrashList");dialog.showModal();list.innerHTML='<div class="summary-empty">Consultando papelera…</div>';
    try{
      await flushPatientSyncQueue();const records=await window.CloudPatients.trash();
      list.innerHTML=records.length?records.map(entry=>{const patient=entry.record||{},deletedAt=entry.deletedAt?new Date(entry.deletedAt).toLocaleString("es-MX"):"";return `<article class="patient-card"><div><strong>${escapeHTML(patient.name||"Paciente")}</strong><span>${escapeHTML(patient.phone||"")}</span><small>Eliminado: ${escapeHTML(deletedAt)}</small></div><button class="secondary-btn" type="button" data-restore-patient="${escapeHTML(patient.id||"")}">Restaurar</button></article>`}).join(""):'<div class="summary-empty">La papelera está vacía.</div>';
    }catch(error){console.warn("No se pudo consultar la papelera:",error.message);list.innerHTML='<div class="summary-empty">No se pudo consultar la papelera. Intenta nuevamente.</div>'}
  }
  async function restoreDeletedPatient(id){
    if(!id)return;try{const restored=await window.CloudPatients.restore(id);if(!restored)throw new Error("No se encontró el paciente");await hydratePatients();renderPatients();fillPatientOptions();$("#patientTrashDialog").close();toast("Paciente restaurado y sincronizado")}catch(error){console.warn("No se pudo restaurar el paciente:",error.message);toast("No se pudo restaurar el paciente")}
  }
  function syncPackageMaximum(){const size=Number($("#patientPackage").value)||0,input=$("#patientSessions");input.max=String(size);if(!size)input.value="0";else if(Number(input.value)>size||Number(input.value)===0)input.value=String(size)}

  function cardTemplate(item){
    const patient=getPatient(item.patientId),packageText=patient&&Number(patient.packageSize)?patientPackageText(patient):item.packageUsed?`Paquete de ${item.packageSize} sesiones · ${item.packageRemainingAfter} restantes`:"";
    return `<article class="appointment-item"><div class="appointment-time">${escapeHTML(formatTime(item.time))}<small>${item.time<"12:00"?"mañana":item.time<"18:00"?"tarde":"noche"}</small></div><span class="service-line"></span><div class="appointment-info"><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(areaLabel(item.area))} · ${escapeHTML(serviceLabel(item))} · ${escapeHTML(item.phone)}</p>${packageText?`<p class="package-inline">${escapeHTML(packageText)}</p>`:""}${item.diagnosis?`<p>Diagnóstico: ${escapeHTML(item.diagnosis)}</p>`:""}</div><div class="appointment-meta"><div class="appointment-amount"><span class="price">${money(item.price)}</span></div><button class="message-btn" data-message="${item.id}">WhatsApp</button><button class="more-btn" data-edit="${item.id}">Editar</button></div></article>`;
  }
  function render(){
    const iso=toISO(selectedDate),items=appointmentsFor(iso),todayISO=toISO(new Date()),income=items.reduce((total,item)=>total+(Number(item.price)||0),0);
    $("#datePicker").value=iso;$("#dateTitle").textContent=formatDate(iso,{weekday:"long",day:"numeric",month:"long",year:"numeric"});$("#appointmentCount").textContent=items.length;$("#dayIncome").textContent=money(income);
    const now=`${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`,upcoming=items.find(item=>iso!==todayISO||item.time>=now);$("#nextTime").textContent=upcoming?formatTime(upcoming.time):"—";
    $("#appointmentList").innerHTML=items.length?items.map(cardTemplate).join(""):`<div class="empty-state"><span>♡</span><strong>Tu día está libre</strong><p>No hay citas registradas para esta fecha.</p><button class="secondary-btn" data-new>Crea una cita</button></div>`;
  }

  function summaryDates(period){const start=new Date(selectedDate),end=new Date(selectedDate);if(period==="month"){start.setDate(1);end.setMonth(end.getMonth()+1,0)}else{const mondayOffset=(start.getDay()+6)%7;start.setDate(start.getDate()-mondayOffset);end.setTime(start.getTime());end.setDate(end.getDate()+6)}return{start,end}}
  function summaryItems(period){const{start,end}=summaryDates(period),startISO=toISO(start),endISO=toISO(end);return getAppointments().filter(item=>item.date>=startISO&&item.date<=endISO).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))}
  function renderSummary(period=activeSummaryPeriod){
    activeSummaryPeriod=period;const items=summaryItems(period),{start,end}=summaryDates(period),income=items.reduce((total,item)=>total+(Number(item.price)||0),0),uniquePatients=new Set(items.map(item=>item.patientId||phone(item.phone)).filter(Boolean));
    $$('[data-summary-period]').forEach(button=>button.classList.toggle("active",button.dataset.summaryPeriod===period));
    $("#summaryRange").textContent=period==="month"?start.toLocaleDateString("es-MX",{month:"long",year:"numeric"}):`${start.toLocaleDateString("es-MX",{day:"numeric",month:"long"})} — ${end.toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"})}`;
    $("#summaryAppointments").textContent=items.length;$("#summaryIncome").textContent=money(income);$("#summaryPatients").textContent=uniquePatients.size;
    $("#summaryList").innerHTML=items.length?items.map(item=>`<article class="summary-entry"><time>${escapeHTML(formatDate(item.date,{weekday:"short",day:"numeric",month:"short"}))}<small>${escapeHTML(formatTime(item.time))}</small></time><div><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(serviceLabel(item))}</small></div><strong>${money(item.price)}</strong></article>`).join(""):`<div class="summary-empty">No hay citas registradas en este periodo.</div>`;
  }

  function financialMessage(item){const price=Number(item.price)||0;return price?`\n💵 Precio acordado: ${money(price)}`:""}
  function packageMessage(item){const patient=getPatient(item.patientId);if(patient&&Number(patient.packageSize))return `\n🎟️ ${patientPackageText(patient)}`;if(item.packageUsed)return `\n🎟️ Paquete de ${item.packageSize} sesiones · ${item.packageRemainingAfter} restantes`;return""}
  function confirmationMessage(item){const location=CONFIG.mapUrl?`📍 ${CONFIG.address}\n🗺️ ${CONFIG.mapUrl}`:`📍 ${CONFIG.address}`;return `¡Hola, ${item.name}!\n\nTu cita en ${CONFIG.business} está confirmada:\n\n📅 ${formatDate(item.date,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}\n🕐 ${formatTime(item.time)}\n✨ ${areaLabel(item.area)} · ${serviceLabel(item)}${financialMessage(item)}${packageMessage(item)}\n\n${location}\n\nSi necesitas hacer algún cambio, avísanos con al menos 48 horas de anticipación. ¡Te esperamos!`}
  function reminderMessage(item){const location=CONFIG.mapUrl?`📍 ${CONFIG.address}\n🗺️ ${CONFIG.mapUrl}`:`📍 ${CONFIG.address}`;return `¡Hola, ${item.name}!\n\nTe recordamos tu próxima cita en ${CONFIG.business}:\n\n📅 ${formatDate(item.date,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}\n🕐 ${formatTime(item.time)}\n✨ ${serviceLabel(item)}${packageMessage(item)}\n\n${location}\n\n¡Te esperamos!`}
  function cancellationMessage(item){return `Hola, ${item.name}. Te informamos que tu cita en ${CONFIG.business} del ${formatDate(item.date,{weekday:"long",day:"numeric",month:"long",year:"numeric"})} a las ${formatTime(item.time)} ha sido cancelada.\n\nSi deseas elegir una nueva fecha, con gusto podemos ayudarte a reagendar.`}
  function openMessageDialog(item){activeMessageAppointmentId=item.id;$("#messageDialogTitle").textContent=`Mensaje para ${item.name}`;$("#messageDialog").showModal()}

  function backupCountText(){const appointments=getAppointments().length,patients=getPatients().length;return `${appointments} ${appointments===1?"cita":"citas"} y ${patients} ${patients===1?"paciente":"pacientes"}`}
  function downloadBackup(){const payload={app:"Fisioterapia 5",version:2,exportedAt:new Date().toISOString(),appointments:getAppointments(),patients:getPatients()},blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`fisio5-respaldo-${toISO(new Date())}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast("Respaldo descargado")}
  async function restoreBackup(file){
    const error=$("#backupError");error.textContent="";
    try{
      const parsed=JSON.parse(await file.text()),appointments=Array.isArray(parsed)?parsed:parsed.appointments,patients=Array.isArray(parsed?.patients)?parsed.patients:[];
      if(!Array.isArray(appointments))throw new Error("Formato inválido");
      const appointmentMap=new Map(getAppointments().map(item=>[item.id,item]));appointments.filter(item=>item&&item.id&&item.date&&item.time).forEach(item=>appointmentMap.set(item.id,item));
      const patientMap=new Map(getPatients().map(item=>[item.id,item]));patients.filter(item=>item&&item.id&&item.name).forEach(item=>patientMap.set(item.id,item));
      saveAppointments([...appointmentMap.values()]);savePatients([...patientMap.values()]);$("#backupAppointmentCount").textContent=backupCountText();render();fillPatientOptions();toast("Respaldo restaurado");
    }catch{error.textContent="No pudimos leer este respaldo. Selecciona un archivo generado por esta agenda."}finally{$("#importBackupInput").value=""}
  }

  $("#serviceSelect").innerHTML=SERVICES.map(item=>`<option value="${item.id}">${item.name}</option>`).join("");
  const patientTitle=$("#patientsDialog .dialog-title-row");if(patientTitle&&!$("#patientTrashBtn")){const trashButton=document.createElement("button");trashButton.id="patientTrashBtn";trashButton.type="button";trashButton.className="secondary-btn";trashButton.textContent="Papelera";patientTitle.append(trashButton)}if(patientTitle&&!$("#patientSyncStatus")){const status=document.createElement("small");status.id="patientSyncStatus";status.className="dialog-copy";patientTitle.insertAdjacentElement("afterend",status)}if(!$("#patientTrashDialog")){const trashDialog=document.createElement("dialog");trashDialog.id="patientTrashDialog";trashDialog.className="patients-dialog";trashDialog.innerHTML='<button class="dialog-close" data-close-dialog aria-label="Cerrar">×</button><p class="eyebrow">Recuperación</p><h2>Papelera de pacientes</h2><p class="dialog-copy">Los expedientes eliminados pueden restaurarse.</p><div class="patient-list" id="patientTrashList"></div>';$("#patientsDialog").insertAdjacentElement("afterend",trashDialog)}updatePatientSyncStatus();
  $("#todayText").textContent=new Date().toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  $("#newAppointmentBtn").onclick=openNewAppointment;
  $("#appointmentForm").onsubmit=saveAppointment;
  $("#deleteBtn").onclick=deleteAppointment;
  $("#appointmentPatient").onchange=choosePatient;
  $("#appointmentDate").onchange=()=>fillTimes($("#appointmentDate").value,"",$("#appointmentId").value);
  $("#appointmentList").onclick=event=>{const add=event.target.closest("[data-new]"),edit=event.target.closest("[data-edit]"),message=event.target.closest("[data-message]");if(add)openNewAppointment();if(edit)openEditAppointment(edit.dataset.edit);if(message){const item=getAppointments().find(entry=>entry.id===message.dataset.message);if(item)openMessageDialog(item)}};
  $("#previousDay").onclick=()=>{selectedDate.setDate(selectedDate.getDate()-1);render()};
  $("#nextDay").onclick=()=>{selectedDate.setDate(selectedDate.getDate()+1);render()};
  $("#todayBtn").onclick=()=>{selectedDate=new Date();render()};
  $("#datePicker").onchange=()=>{selectedDate=fromISO($("#datePicker").value);render()};

  $("#patientsBtn").onclick=openPatients;
  $("#newPatientBtn").onclick=()=>openPatientEditor();
  $("#patientSearch").oninput=renderPatients;
  $("#patientList").onclick=event=>{const button=event.target.closest("[data-edit-patient]");if(button)openPatientEditor(button.dataset.editPatient)};
  $("#patientForm").onsubmit=savePatient;
  $("#deletePatientBtn").onclick=deletePatient;
  $("#patientTrashBtn").onclick=openPatientTrash;
  $("#patientTrashList").onclick=event=>{const button=event.target.closest("[data-restore-patient]");if(button)restoreDeletedPatient(button.dataset.restorePatient)};
  $("#patientPackage").onchange=syncPackageMaximum;

  $("#paymentBtn").onclick=()=>{$("#paymentForm").reset();$("#paymentDialog").showModal()};
  $("#policiesBtn").onclick=()=>$("#policiesDialog").showModal();
  $("#summaryBtn").onclick=()=>{activeSummaryPeriod="week";renderSummary("week");$("#summaryDialog").showModal()};
  $("#summaryDialog").onclick=event=>{const button=event.target.closest("[data-summary-period]");if(button)renderSummary(button.dataset.summaryPeriod)};
  $("#backupBtn").onclick=()=>{$("#backupAppointmentCount").textContent=backupCountText();$("#backupError").textContent="";$("#importBackupInput").value="";$("#backupDialog").showModal()};
  $("#exportBackupBtn").onclick=downloadBackup;
  $("#importBackupInput").onchange=event=>{const[file]=event.target.files;if(file)restoreBackup(file)};
  $("#paymentForm").onsubmit=event=>{event.preventDefault();const number=phone($("#paymentPhone").value);if(number.length<10){toast("Escribe un WhatsApp válido");return}openWhatsApp(number,`Hola, buen día.\n\nTe compartimos la información de pago de ${CONFIG.business}:\n\n${CONFIG.bank}\n\nCuando realices tu transferencia, por favor envíanos tu comprobante. Gracias.`);$("#paymentDialog").close()};
  $("#messageDialog").onclick=event=>{const option=event.target.closest("[data-message-type]");if(!option)return;const item=getAppointments().find(entry=>entry.id===activeMessageAppointmentId);if(!item){$("#messageDialog").close();toast("No encontramos esa cita");return}const messages={confirmation:confirmationMessage,reminder:reminderMessage,cancellation:cancellationMessage},build=messages[option.dataset.messageType];if(build)openWhatsApp(item.phone,build(item));$("#messageDialog").close()};
  $$('[data-close-dialog]').forEach(button=>button.onclick=()=>button.closest("dialog").close());

  pruneLocalAppointments();fillPatientOptions();render();window.refreshAgenda=()=>{fillPatientOptions();render()};
  window.CloudAppointments?.hydrate(items=>localStorage.setItem(CONFIG.appointmentStorage,JSON.stringify(items))).then(()=>render());
  hydratePatients();
  window.addEventListener("online",()=>flushPatientSyncQueue({notify:true}));window.addEventListener("offline",()=>updatePatientSyncStatus("Sin conexión · los cambios se sincronizarán después"));
})();


