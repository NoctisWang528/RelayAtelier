// Reversible removal of ONLY the official OpenCode plugin added for this task.
import {readFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(homedir(),'.config/opencode/plugins/bees-hive.js');
const expected='402deaeb6dd23bba2411ab778f4742051bdf6053739e0bc51c073cb0badc15c4';
let content;try{content=await readFile(source);}catch(e){if(e.code==='ENOENT'){console.log('CrommaCode hook is already absent.');process.exit(0);}throw e;}
if(createHash('sha256').update(content).digest('hex')!==expected)throw Error('Plugin has changed since installation. Left untouched; inspect manually before removing.');
const destination=path.join(root,'.runtime','hook-backup',`bees-hive.js.disabled-${Date.now()}`);
await mkdir(path.dirname(destination),{recursive:true});await rename(source,destination);
console.log(`Disabled only bees-hive.js. Original OpenCode configuration is unchanged.\nSaved at: ${destination}\nRestart OpenCode to unload the plugin. Starting it inside CrommaCode may reinstall its hook.`);
