(()=>{
  const config=window.AGENDA_CLOUD_CONFIG||{};
  const tokenKey="fisio5AdminToken";
  const clientId=String(config.clientId||"").trim();
  const ready=()=>Boolean(config.apiUrl&&clientId&&!String(config.apiUrl).includes("PENDING"));
  const token=()=>sessionStorage.getItem(tokenKey)||"";

  async function parseResponse(response){
    const result=await response.json().catch(()=>null);
    if(!response.ok||result?.ok!==true)throw new Error(result?.error||"Error de conexión");
    return result;
  }

  async function get(action){
    const url=new URL(config.apiUrl);url.searchParams.set("action",action);url.searchParams.set("client",clientId);
    return parseResponse(await fetch(url.toString(),{redirect:"follow"}));
  }

  async function post(action,payload,useAdminToken=false){
    const body=new URLSearchParams({action,client:clientId,payload:JSON.stringify(payload??null)});
    if(useAdminToken&&token())body.set("key",token());
    return parseResponse(await fetch(config.apiUrl,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body,redirect:"follow"}));
  }

  async function listRecords(){if(!ready())return null;const result=await post("list",null,true);return Array.isArray(result.appointments)?result.appointments:[]}
  async function list(){const records=await listRecords();return Array.isArray(records)?records.filter(item=>item?.recordType!=="patient"):records}
  async function listPatients(){const records=await listRecords();return Array.isArray(records)?records.filter(item=>item?.recordType==="patient"):records}
  async function availability(){if(!ready())return[];const result=await get("availability");return Array.isArray(result.busy)?result.busy:[]}
  async function upsertAppointment(appointment){if(!ready())return false;await post("upsert",appointment,Boolean(token()));return true}
  async function removeRecord(id){if(!ready())return false;await post("delete",{id},true);return true}

  window.CloudAppointments={
    ready,isUnlocked:()=>Boolean(token()),
    async unlock(value){sessionStorage.setItem(tokenKey,String(value||"").trim());try{await list();return true}catch(error){sessionStorage.removeItem(tokenKey);throw error}},
    lock:()=>sessionStorage.removeItem(tokenKey),list,availability,upsert:upsertAppointment,remove:removeRecord,
    async hydrate(save){try{const appointments=await list();if(Array.isArray(appointments)){save(appointments);return appointments}}catch(error){console.warn("Se usará la copia local:",error.message)}return null},
    async hydrateAvailability(save){try{const busy=await availability();save(busy);return busy}catch(error){console.warn("No se pudo consultar la disponibilidad:",error.message);return[]}}
  };

  const patientPayload=patient=>({...patient,recordType:"patient",area:"Paciente",status:"Expediente",notes:[patient.diagnosis?`Diagnóstico: ${patient.diagnosis}`:"",patient.treatment?`Tratamiento: ${patient.treatment}`:"",Number(patient.packageSize)?`Paquete: ${patient.packageSize} sesiones · ${Number(patient.sessionsRemaining)||0} restantes`:"Sin paquete activo"].filter(Boolean).join("\n")});
  window.CloudPatients={ready,isUnlocked:()=>Boolean(token()),list:listPatients,upsert:async patient=>{if(!ready())return false;await post("upsert",patientPayload(patient),true);return true},remove:removeRecord};
})();


