const {app,BrowserWindow,ipcMain,Menu,session}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const dataDir=process.env.RELAY_DATA_DIR || (app.isPackaged?path.resolve(path.dirname(process.execPath),process.platform==='darwin'?'../../..':'.','RelayAtelierData'):path.join(root,'.runtime','desktop'));
fs.mkdirSync(dataDir,{recursive:true});app.setPath('userData',dataDir);app.setPath('sessionData',dataDir);
let win,hub;
if(!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
 app.whenReady().then(async()=>{
   const {SourceHub,defaultSourceRoots}=await import('../server/hub.mjs');
   const {createHookManager}=await import('../server/hooks.mjs');
   const {getPulseFile}=await import('../server/hook-signal.mjs');
   const fixtureHome=!app.isPackaged && process.env.RELAY_HOOK_TEST_HOME;
   const hooks=createHookManager(fixtureHome ? {home:fixtureHome,env:{}} : {});
   hub=fixtureHome ? new SourceHub({roots:defaultSourceRoots(fixtureHome,{}),pulseFile:getPulseFile(fixtureHome)}) : new SourceHub();
   const icon=path.join(root,'assets',process.platform==='darwin'?'Relay.iconset/icon_512x512@2x.png':'icon.png');
   if(!app.isPackaged)app.dock?.setIcon(icon);
   Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Relay Atelier',submenu:[{role:'about'},{type:'separator'},{role:'quit'}]},{label:'View',submenu:[{role:'reload'},{role:'togglefullscreen'},{role:'resetzoom'},{role:'zoomin'},{role:'zoomout'}]}]));
   // All renderer resources are bundled. Deny remote requests and permissions.
   session.defaultSession.webRequest.onBeforeRequest((details,cb)=>cb({cancel:!details.url.startsWith('file:')&&!details.url.startsWith('devtools:')}));
   session.defaultSession.setPermissionRequestHandler((_wc,_permission,cb)=>cb(false));
   function create(){
    win=new BrowserWindow({width:1440,height:940,minWidth:800,minHeight:620,show:false,backgroundColor:'#faf9f6',title:'Relay Atelier',icon,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:true}});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',e=>e.preventDefault());
    win.once('ready-to-show',()=>win.show());win.loadFile(path.join(root,'index.html'));
    win.on('closed',()=>{win=null;});
    const window=win;
    function syncVisibility(){
     if(!window.isDestroyed())window.webContents.send('relay:visibility',window.isVisible()&&!window.isMinimized());
    }
    // AppKit can deliver a hide notification while the unfocused window is still visible.
    for(const event of ['hide','show','minimize','restore','focus'])window.on(event,()=>setImmediate(syncVisibility));
   }
   ipcMain.handle('relay:snapshot',()=>hub.snapshot());
   ipcMain.handle('relay:pin',(_e,value)=>{if(win)win.setAlwaysOnTop(value===true);return win?.isAlwaysOnTop()||false;});
   ipcMain.handle('relay:window',()=>({desktop:true,pinned:win?.isAlwaysOnTop()||false,platform:process.platform}));
   const entryURL=pathToFileURL(path.join(root,'index.html')).href;
   for(const action of ['list','install','remove']){
     ipcMain.handle('relay:hooks:'+action,(event,id)=>{
       if(!win || event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame || event.senderFrame.url!==entryURL){
         throw new Error('仅支持在 Relay Atelier 的本地桌面窗口管理 Hook。');
       }
       return hooks[action](id);
     });
   }
   hub.on('event',event=>{if(win&&!win.isDestroyed())win.webContents.send('relay:event',event);});
   hub.on('status',status=>{if(win&&!win.isDestroyed())win.webContents.send('relay:status',status);});
   await hub.start();create();
   app.on('activate',()=>{if(!win)create();});
 }).catch(error=>{console.error(error);app.quit();});
 app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>hub?.stop());
}
