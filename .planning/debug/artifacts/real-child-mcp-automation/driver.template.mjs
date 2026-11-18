import {mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';

const root = '/tmp/pg1-live-fixed-local';
const home = path.join(root, 'home');
const agentDir = path.join(home, 'agent');
const cwd = path.join(root, 'project');
const harness = path.join(home, 'harness');
await Promise.all([mkdir(agentDir, {recursive:true}), mkdir(cwd,{recursive:true}), mkdir(harness,{recursive:true}), mkdir(path.join(home,'tmp'),{recursive:true})]);
const script = {
  'launch-runner': [{tool:'subagent',arguments:{agent:'demo:runner',task:'Call mcp__plugin_demo_stub__echo with text pg1-live-short',async:true}}],
  'pg1-live-short': [{tool:'mcp__plugin_demo_stub__echo',arguments:{text:'pg1-live-short'}}],
  'launch-control': [{tool:'subagent',arguments:{agent:'demo:control',task:'Call mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c with text pg1-live-long-control',async:true}}],
  'pg1-live-long-control': [
    {tool:'mcp',arguments:{connect:'plugin_demo_a-server-whose-name-runs-well-past-the-limit_'}},
    {tool:'mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c',arguments:{text:'pg1-live-long-control'}},
  ],
  'launch-restricted': [{tool:'subagent',arguments:{agent:'demo:restricted',task:'Call mcp__plugin_demo_stub__echo with text pg1-live-restricted',async:true}}],
  'pg1-live-restricted': [
    {tool:'mcp',arguments:{connect:'plugin_demo_stub_'}},
    {tool:'mcp__plugin_demo_stub__echo',arguments:{text:'pg1-live-restricted'}},
  ],
};
await writeFile(path.join(root,'stub-script.json'),JSON.stringify(script));
await writeFile(path.join(root,'stub-http.jsonl'),'');
const stub = spawn(process.execPath,[path.join(root,'openai-stub-server.mjs')],{env:{...process.env,STUB_PORT:'0',STUB_HTTP_LOG:path.join(root,'stub-http.jsonl'),STUB_SCRIPT:path.join(root,'stub-script.json')},stdio:['ignore','pipe','pipe']});
const stubPort = await new Promise((resolve,reject)=>{
  const deadline=setTimeout(()=>reject(new Error('stub did not start')),10000);
  createInterface({input:stub.stdout}).on('line',line=>{const m=line.match(/:(\d+)\/v1/);if(m){clearTimeout(deadline);resolve(Number(m[1]));}});
});
await writeFile(path.join(agentDir,'models.json'),JSON.stringify({providers:{stubllm:{baseUrl:`http://127.0.0.1:${stubPort}/v1`,api:'openai-completions',apiKey:'stub',models:[{id:'stub'}]}}}));
await writeFile(path.join(agentDir,'settings.json'),JSON.stringify({defaultProvider:'stubllm',defaultModel:'stub',extensions:['-builtin:mcp','/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/index.ts','/home/acolomba/src/pi-claude-marketplace-gaps/node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/index.ts']}));
const ambient = path.join(agentDir,'extensions');
await mkdir(ambient,{recursive:true});
for(const name of ['scripted-model.ts','pi-mcp-adapter.ts','pi-claude-marketplace.ts'])await rm(path.join(ambient,name),{force:true});
const args = [
  '/home/acolomba/src/pi-claude-marketplace-gaps/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js',
  '--mode','rpc','--offline','--no-session',
  ...[
    '/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/index.ts',
    '/tmp/pi-subagents-mcp-fix/dist-pkg/index.js',
    '/home/acolomba/src/pi-claude-marketplace-gaps/node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/index.ts',
  ].flatMap(extension=>['--extension',extension]),
];
const child = spawn(process.execPath,args,{cwd,env:{HOME:home,PI_CODING_AGENT_DIR:agentDir,PI_OFFLINE:'1',PATH:process.env.PATH,TMPDIR:path.join(home,'tmp')},stdio:['pipe','pipe','pipe'],detached:true});
let stderr='';
child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
const records=[];
const pending=new Map();
createInterface({input:child.stdout}).on('line',line=>{
  try {
    const record=JSON.parse(line);
    records.push(record);
    if(record.type==='response' && pending.has(record.id)){
      pending.get(record.id)(record);pending.delete(record.id);
    }
    if(record.type==='extension_ui_request' && ['confirm','input','select','editor'].includes(record.method))child.stdin.write(JSON.stringify({type:'extension_ui_response',id:record.id,cancelled:true})+'\n');
  }catch(e){process.stdout.write(`BAD_LINE ${line}\n`);}
});
let nextId=0;
const pi={
  request(request){return new Promise((resolve,reject)=>{const id=`r${nextId++}`;pending.set(id,response=>resolve({response,entries:records.filter(x=>x.type==='entry_appended'),extensionErrors:records.filter(x=>x.type==='extension_error'),dialogs:[]}));child.stdin.write(JSON.stringify({...request,id})+'\n');setTimeout(()=>{if(pending.delete(id))reject(new Error(`request ${id} timed out; stderr ${stderr}; records ${JSON.stringify(records.slice(-8))}`))},30000);});},
  recordCount(){return records.length;},
  recordsSince(from){return records.slice(from);},
  async waitForRecord(from, predicate, ms){const until=Date.now()+ms;while(Date.now()<until){const found=records.slice(from).find(predicate);if(found)return found;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error('no record: '+stderr);},
  async stop(){child.stdin.end();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);setTimeout(resolve,5000)});try{process.kill(-child.pid,'SIGKILL')}catch{}},
  get stderrText(){return stderr;},
};
const log = (label, value) => process.stdout.write(`${label} ${JSON.stringify(value)}\n`);
const lastUserText = call => JSON.stringify(call.messages?.filter(message=>message.role==='user').at(-1)?.content ?? '');
try {
  log('commands', (await pi.request({type:'get_commands'})).response);
  log('model', (await pi.request({type:'set_model',provider:'stubllm',modelId:'stub'})).response);
  for (const command of [
    `/claude:plugin marketplace add ${path.join(root,'marketplace')} --scope user`,
    '/claude:plugin install demo@fixtures --scope user',
  ]) {
    const ex = await pi.request({type:'prompt',message:command});
    log('command', {command,response:ex.response,entries:ex.entries,errors:ex.extensionErrors,dialogs:ex.dialogs});
  }
  const adapterFile=path.join(agentDir,'mcp-adapter.json');
  const adapterConfig=JSON.parse(await readFile(adapterFile,'utf8'));
  for(const server of Object.values(adapterConfig.mcpServers))server.directTools=true;
  await writeFile(adapterFile,JSON.stringify(adapterConfig));
  log('new', (await pi.request({type:'new_session'})).response);
  log('model2', (await pi.request({type:'set_model',provider:'stubllm',modelId:'stub'})).response);
  await new Promise(resolve=>setTimeout(resolve,1500));
  for (const [agent,tool,token] of [
    ['demo:runner','mcp__plugin_demo_stub__echo','pg1-live-short'],
    ['demo:control','mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c','pg1-live-long-control'],
    ['demo:restricted','mcp__plugin_demo_stub__echo','pg1-live-restricted'],
  ].filter(([agent])=>!process.env.PG_AGENT||agent===process.env.PG_AGENT)) {
    const from=pi.recordCount();
    const ex=await pi.request({type:'prompt',message:`launch-${agent.split(':')[1]}`});
    log('launch',{agent,response:ex.response,errors:ex.extensionErrors});
    try {log('settled',{agent,record:await pi.waitForRecord(from,r=>r.type==='agent_settled',30000)});} catch(e){log('settle_error',{agent,error:String(e)});}
    const launched=pi.recordsSince(from).find(r=>r.type==='tool_execution_end'&&r.toolName==='subagent');
    const asyncDir=launched?.result?.details?.asyncDir;
    let status;
    if(asyncDir){
      const until=Date.now()+30000;
      while(Date.now()<until){
        try{status=JSON.parse(await readFile(path.join(asyncDir,'status.json'),'utf8'));}catch{}
        if(['complete','failed','interrupted','timed_out'].includes(status?.state))break;
        await new Promise(resolve=>setTimeout(resolve,200));
      }
    }
    log('child_status',{agent,asyncDir,pid:status?.pid,state:status?.state,error:status?.error,transcriptPath:status?.steps?.[0]?.transcriptPath,output:status?.steps?.[0]?.recentOutput});
    const deadline=Date.now()+30000;
    let calls=[];
    while(Date.now()<deadline){
      try {calls=(await readFile(path.join(root,'stub-http.jsonl'),'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);}catch{}
      if(calls.some(c=>lastUserText(c).includes(token))) break;
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    log('calls',{agent,calls:calls.filter(c=>lastUserText(c).includes(token)).map(c=>({tools:c.tools,toolSchemas:c.toolSchemas,lastMessage:c.messages?.at(-1)}))});
    log('records',{agent,records:pi.recordsSince(from).filter(r=>['tool_execution_start','tool_execution_end','agent_settled','message_end','extension_error'].includes(r.type))});
  }
} finally {await pi.stop();stub.kill();log('stderr',pi.stderrText);}
