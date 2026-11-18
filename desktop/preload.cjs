const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('relay',{
 snapshot:()=>ipcRenderer.invoke('relay:snapshot'),
 pin:value=>ipcRenderer.invoke('relay:pin',value===true),
 windowInfo:()=>ipcRenderer.invoke('relay:window'),
 hooks:{
  list:()=>ipcRenderer.invoke('relay:hooks:list'),
  install:id=>ipcRenderer.invoke('relay:hooks:install',id),
  remove:id=>ipcRenderer.invoke('relay:hooks:remove',id),
 },
 onVisibility:fn=>{const handler=(_event,value)=>fn(value);ipcRenderer.on('relay:visibility',handler);return()=>ipcRenderer.removeListener('relay:visibility',handler);},
 onEvent:fn=>{const handler=(_event,data)=>fn(data);ipcRenderer.on('relay:event',handler);return()=>ipcRenderer.removeListener('relay:event',handler);},
 onStatus:fn=>{const handler=(_event,data)=>fn(data);ipcRenderer.on('relay:status',handler);return()=>ipcRenderer.removeListener('relay:status',handler);}
});
