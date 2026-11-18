const {app,BrowserWindow,ipcMain,Menu,session}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const dataDir=process.env.RELAY_DATA_DIR || (app.isPackaged?path.resolve(path.dirname(process.execPath),process.platform==='darwin'?'../../..':'.','RelayAtelierData'):path.join(root,'.runtime','desktop'));
fs.mkdirSync(dataDir,{recursive:true});app.setPath('userData',dataDir);app.setPath('sessionData',dataDir);
let win,hub;
if(!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
 app.whenReady().then(async()=>{
   const {SourceHub}=await import('../server/hub.mjs');
   hub=new SourceHub();
   Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Relay Atelier',submenu:[{role:'about'},{type:'separator'},{role:'quit'}]},{label:'View',submenu:[{role:'reload'},{role:'togglefullscreen'},{role:'resetzoom'},{role:'zoomin'},{role:'zoomout'}]}]));
   // All renderer resources are bundled. Deny remote requests and permissions.
   session.defaultSession.webRequest.onBeforeRequest((details,cb)=>cb({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('devtools:')}));
   session.defaultSession.setPermissionRequestHandler((_wc,_permission,cb)=>cb(false));
   function create(){
    win=new BrowserWindow({width:1440,height:940,minWidth:800,minHeight:620,show:false,backgroundColor:'#faf9f6',title:'Relay Atelier',icon:path.join(root,'assets','icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:true}});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',e=>e.preventDefault());
    win.once('ready-to-show',()=>win.show());win.loadFile(path.join(root,'index.html'));
    win.on('closed',()=>{win=null;});
    for(const event of ['minimize','hide'])win.on(event,()=>win?.webContents.send('relay:visibility',false));
    for(const event of ['restore','show'])win.on(event,()=>win?.webContents.send('relay:visibility',true));
   }
   ipcMain.handle('relay:snapshot',()=>hub.snapshot());
   ipcMain.handle('relay:pin',(_e,value)=>{if(win)win.setAlwaysOnTop(value===true);return win?.isAlwaysOnTop()||false;});
   ipcMain.handle('relay:window',()=>({desktop:true,pinned:win?.isAlwaysOnTop()||false,platform:process.platform}));
   hub.on('event',event=>{if(win&&!win.isDestroyed())win.webContents.send('relay:event',event);});
   hub.on('status',status=>{if(win&&!win.isDestroyed())win.webContents.send('relay:status',status);});
   await hub.start();create();
   app.on('activate',()=>{if(!win)create();});
 }).catch(error=>{console.error(error);app.quit();});
 app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>hub?.stop());
}
