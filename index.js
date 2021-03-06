const TeleBot = require('telebot');
const { spawn } = require('child_process');

const { db } = require('./db');
const { validate_fid, gen_count_body, count } = require('./src/gd');
const { send_count, send_help, send_choice, send_task_info, sm, extract_fid, extract_from_text, reply_cb_query, tg_copy, send_all_tasks, send_bm_help, get_target_by_alias, gen_bookmark_choices, send_all_bookmarks, set_bookmark, unset_bookmark, clear_tasks, send_task_help, rm_task, clear_button } = require('./src/tg')

const { AUTH, ROUTER_PASSKEY, TG_IPLIST } = require('./config')
//const { tg_whitelist } = AUTH
const { tg_token } = AUTH
const { adminUsers } = AUTH

const BUTTONS = {
  youtube: {
      label: 'ðº youtube',
      command: '/yd'
  },
  aria2: {
      label: 'ð aria2',
      command: '/aria2'
  },
  restart: {
    label: 'âï¸ éå¯',
    command: '/restart'
  },
  runshell: {
    label: 'â³ runshell',
    command: '/runshell'
  },
  update: {
      label: 'ð  æ´æ°',
      command: '/update'
  },
  hello: {
      label: 'ð Hello',
      command: '/hello'
  },
  world: {
      label: 'ð World',
      command: '/world'
  },
  hide: {
      label: 'â¨ï¸ éèèå',
      command: '/hide'
  }
};
const bot = new TeleBot({
  token: tg_token,
  usePlugins: ['reporter'],
  pluginConfig: {
      reporter: {
          events: ['reconnect', 'reconnected', 'stop', 'error'],
          to: adminUsers
      }
  },
  usePlugins: ['namedButtons'],
  pluginConfig: {
      namedButtons: {
          buttons: BUTTONS
      }
  },
});

const COPYING_FIDS = {}
const counting = {}
let MSG = '';

function exec (cmd, msg) {
  const id = msg.from.id;
  if(adminUsers.indexOf(id) < 0){
      msg.reply.text('ð¸ æ¨çç¨æ·åæIDä¸å¨æºå¨äººçç½ååä¸­ï¼å¦ææ¯æ¨éç½®çæºå¨äººï¼è¯·åå°config.jsä¸­éç½®èªå·±çusername');
      return console.warn('æ¶å°éç½ååç¨æ·çè¯·æ±')
  }

  let words = String(cmd).split(" ");
  let len = words.length;
  let args = [];
  if (len > 1 ){
      args = words.slice(1, len);
  }
    console.log( len,args )
    console.log( words[0] )
    // msg.reply.text('$: '+words[0] + " " +  args);
    const shell = spawn(words[0],args).on('error', function( err ){
        msg.reply.text(err);
    });

    if(shell){
       shell.stdout.on('data', (data) => {
        msg.reply.text(`${data}`);
       });
       shell.stderr.on('data', (data) => {
        msg.reply.text(`stderr: ${data}`);
       });
    }
}

bot.sendMessage(adminUsers[0],"ð¸ è°·æ­è½¬å­æºå¨äººç°å¨å¼å§ä¸ºæ¨æå¡.") //å¡«åä½ çchat id ,æºå¨äººä¸çº¿æ¶ä½ ç¬¬ä¸æ¶é´éä¼æ¶å°éç¥

bot.on('/yd', (msg) =>{
  if(MSG.startsWith('http')){
    let ydurl = 'yd ' + MSG;
    console.log( ydurl )
    msg.reply.text('run yd ');
    exec(ydurl, msg);
    return bot.sendMessage(msg.from.id, 'å·²æ§è¡ï¼', {replyMarkup: 'hide'});
  }
  return bot.sendMessage(msg.from.id, 'æ å°å ï¼', {replyMarkup: 'hide'});
});

bot.on('/aria2', (msg) => exec('aria2 ' + MSG, msg));
bot.on('/hide', (msg) => msg.reply.text('ð¸ åæ¬¡æå¼ç³»ç»èå,è¯·è¾å¥: /start .', {replyMarkup: 'hide'}));

bot.on('/taskall', msg => {
  exec('task all', msg);
});

bot.on('/taskclear', msg => {
  exec('task clear', msg);
});

bot.on('/runshell', msg => {
  if(MSG == "")return bot.sendMessage(msg.from.id, 'æ å½ä»¤', {replyMarkup: 'hide'});
    msg.reply.text('run shell:' + MSG);
    exec(MSG, msg);
    return bot.sendMessage(msg.from.id, 'å·²æ§è¡ï¼', {replyMarkup: 'hide'});
});

bot.on('/start', (msg) => {
  let replyMarkup = bot.keyboard([
      [BUTTONS.update.label, BUTTONS.restart.label],
      [BUTTONS.hide.label]
  ], {resize: true});
  return bot.sendMessage(msg.from.id, 'ð¹ å¯¹è¯IDæ¯:  ' + msg.chat.id + ',\nå¯ç¨åè½è¯·æ¥çé®ç.', {replyMarkup});
});

bot.on('/error', (msg) => msg.MAKE_AN_ERROR);
bot.on('/stop', () => bot.stop('bye!'));

bot.on('text', (msg) => {
    MSG = msg.text;
    const chat_id = msg && msg.chat && msg.chat.id
    // console.log(MSG);

    // console.log('chat_id:   '+ chat_id);
    // let prex = String(msg.text).substring(0,1);
    // console.log(prex);

    const text = msg && msg.text && msg.text.trim() || ''
    const message_str = text
    // let username = msg && msg.from && msg.from.username
    // msgs = username && String(username).toLowerCase()
    // let user_id = msgs && msgs.from && msgs.from.id
    // user_id = user_id && String(user_id).toLowerCase()
    const id = msg.from.id;
    if(adminUsers.indexOf(id) < 0){
        msg.reply.text('ð¸ æ¨çç¨æ·åæIDä¸å¨æºå¨äººçç½ååä¸­ï¼å¦ææ¯æ¨éç½®çæºå¨äººï¼è¯·åå°config.jsä¸­éç½®èªå·±çusername');
        return console.warn('æ¶å°éç½ååç¨æ·çè¯·æ±')
    }
      const fid = extract_fid(text) || extract_from_text(text) || extract_from_text(message_str)
      const no_fid_commands = ['/task', '/help', '/bm']
      if (!no_fid_commands.some(cmd => text.startsWith(cmd)) && !validate_fid(fid)) {
        console.log(message_str);
        if (text.startsWith('/')||text.startsWith('ð')||text.startsWith('ð')||text.startsWith('â¨ï¸')||text.startsWith(' ')) return;
        sm({ chat_id, text: 'ð¸ æªè¯å«åºææçåäº«ID' })
        if(message_str.startsWith('http')){
          is_shell = true
          let replyMarkup = bot.keyboard([
            [BUTTONS.youtube.label, BUTTONS.aria2.label],
            [BUTTONS.hide.label]
          ], {resize: true});
          return bot.sendMessage(msg.from.id, 'ð¸ ä½ å¯è½è¦æ§è¡ï¼', {replyMarkup});
          }
        let replyMarkup = bot.keyboard([
          [BUTTONS.update.label, BUTTONS.runshell.label],
          [BUTTONS.hide.label]
        ], {resize: true});
        return bot.sendMessage(msg.from.id, 'ð¸ ä½ å¯è½è¦æ§è¡ï¼', {replyMarkup});
      }
      if (text.startsWith('/help')) return send_help(chat_id)
      if (text.startsWith('/bm')) {
        const [cmd, action, alias, target] = text.split(' ').map(v => v.trim()).filter(v => v)
        if (!action) return send_all_bookmarks(chat_id)
        if (action === 'set') {
          if (!alias || !target) return sm({ chat_id, text: 'ð¸ å«ååç®æ IDä¸è½ä¸ºç©º' })
          if (alias.length > 24) return sm({ chat_id, text: 'ð¸ å«åä¸è¦è¶è¿24ä¸ªè±æå­ç¬¦é¿åº¦' })
          if (!validate_fid(target)) return sm({ chat_id, text: 'ð¸ ç®æ IDæ ¼å¼æè¯¯' })
          set_bookmark({ chat_id, alias, target })
        } else if (action === 'unset') {
          if (!alias) return sm({ chat_id, text: 'ð¸ å«åä¸è½ä¸ºç©º' })
          unset_bookmark({ chat_id, alias })
        } else {
          send_bm_help(chat_id)
        }
      } else if (text.startsWith('/count')) {
        if (counting[fid]) return sm({ chat_id, text: ' ð¹ ' + 'ID:  ' + fid + '\nð¹ æ­£å¨ç»è®¡ï¼è¯·ç¨å...' })
        try {
          counting[fid] = true
          const update = text.endsWith(' -u')
          send_count({ fid, chat_id, update })
        } catch (err) {
          console.error(err)
          sm({ chat_id, text: ' ð¸ ç»è®¡å¤±è´¥!' + '\nð¹ ID:  ' + fid  + '\nð¸ å¤±è´¥åå :  ' + err.message })
        } finally {
          delete counting[fid]
        }
      } else if (text.startsWith('/copy')) {
        let target = text.replace('/copy', '').replace(' -u', '').trim().split(' ').map(v => v.trim()).filter(v => v)[1]
        target = get_target_by_alias(target) || target
        if (target && !validate_fid(target)) return sm({ chat_id, text: `ð¸ ç®æ ID ${target} æ ¼å¼ä¸æ­£ç¡®` })
        const update = text.endsWith(' -u')
        tg_copy({ fid, target, chat_id, update }).then(task_id => {
          task_id && sm({ chat_id, text: `ð¹ å·²å¼å§å¤å¶ï¼è¿åº¦æ¥è¯¢è¯·è¾å¥:\n/task ${task_id}`})
        })
      } else if (text.startsWith('/task')) {
        let task_id = text.replace('/task', '').trim()
        if (task_id === 'all') {
          return send_all_tasks(chat_id)
        } else if (task_id === 'clear') {
          return clear_tasks(chat_id)
        } else if (task_id === '-h') {
          return send_task_help(chat_id)
        } else if (task_id.startsWith('rm')) {
          task_id = task_id.replace('rm', '')
          task_id = parseInt(task_id)
          if (!task_id) return send_task_help(chat_id)
          return rm_task({ task_id, chat_id })
        }
        task_id = parseInt(task_id)
        if (!task_id) {
          const running_tasks = db.prepare('select id from task where status=?').all('copying')
          if (!running_tasks.length) return sm({ chat_id, text: 'ð¸ å½åææ è¿è¡ä¸­çä»»å¡' })
          return running_tasks.forEach(v => send_task_info({ chat_id, task_id: v.id }).catch(console.error))
        }
        send_task_info({ task_id, chat_id }).catch(console.error)
      } else if (message_str.includes('drive.google.com/') || validate_fid(text)) {
        return send_choice({ fid: fid || text, chat_id })
      }
});

// Inline button callback
bot.on('callbackQuery', msg => {
    // User message alert
    const id = msg.from.id;
    if(adminUsers.indexOf(id) < 0){
        msg.reply.text('ð¸ æ¨çç¨æ·åæIDä¸å¨æºå¨äººçç½ååä¸­ï¼å¦ææ¯æ¨éç½®çæºå¨äººï¼è¯·åå°config.jsä¸­éç½®èªå·±çusername')
        return console.warn('æ¶å°éç½ååç¨æ·çè¯·æ±')
    }

    if (msg) {
    const { id, message, data } = msg
    const chat_id = msg.from.id
    //let [action, fid] = String(data).split(' ')
    const [action, fid, target] = data.split(' ').filter(v => v)
    //console.log("id:"+id);
    //console.log("chat_id:"+chat_id);
    //console.log("data:"+data);
    //console.log("action:"+action);console.log("fid:"+fid);
    if (action === 'count') {
      if (counting[fid]) return sm({ chat_id, text: 'ð¸ ' + 'ID:  ' + fid + '\nð¹ æ­£å¨ç»è®¡ï¼è¯·ç¨å...' })
      counting[fid] = true
      send_count({ fid, chat_id }).catch(err => {
        console.error(err)
        sm({ chat_id, text: 'ð¸ ç»è®¡å¤±è´¥!' + '\nð¹ ID:  ' + fid + '\nð¹ å¤±è´¥åå :  ' + err.message })
      }).finally(() => {
        delete counting[fid]
      })
    } else if (action === 'copy') {
      console.log("copy id:"+id);
      if (COPYING_FIDS[fid]) return sm({ chat_id, text: `ð¹ æ­£å¨å¤ç ${fid} çå¤å¶å½ä»¤` })
      COPYING_FIDS[fid] = true
      tg_copy({ fid, target: get_target_by_alias(target), chat_id }).then(task_id => {
        task_id && sm({ chat_id, text: `ð¹ å·²å¼å§å¤å¶ï¼æ¥è¯¢è¿åº¦è¯·è¾å¥:\n/task ${task_id}` })
      }).finally(() => COPYING_FIDS[fid] = false)
    } else if (action === 'update') {
      if (counting[fid]) return sm({ chat_id, text: 'ð¹ ' + 'ID: ' + fid + '\nð¹ æ­£å¨ç»è®¡ï¼è¯·ç¨å...' })
      counting[fid] = true
      send_count({ fid, chat_id, update: true }).finally(() => {
        delete counting[fid]
      })
    } else if (action === 'clear_button') {
      const { message_id, text } = message || {}
      if (message_id) clear_button({ message_id, text, chat_id })
    }
    return reply_cb_query({ id, data }).catch(console.error)
  }
    return bot.answerCallbackQuery(msg.id, `Inline button callback: ${ msg.data }`, true);
});

bot.on(/^!.*/, (msg, props) => {
  // let prex = String(msg.text).substring(0,1);
  // console.log(prex);
  const id = msg.from.id;
  if(adminUsers.indexOf(id) < 0){
      msg.reply.text('ð¸ æ¨çç¨æ·åæIDä¸å¨æºå¨äººçç½ååä¸­ï¼å¦ææ¯æ¨éç½®çæºå¨äººï¼è¯·åå°config.jsä¸­éç½®èªå·±çusername');
      return console.warn('æ¶å°éç½ååç¨æ·çè¯·æ±')
  }

  let words = String(msg.text).split(" ");
  let len = words.length;
  let args = [];
  if (len > 2 ){
      args = words.slice(2, len);

  }
    console.log('run shell2    ')
    msg.reply.text('$: '+words[1] + "  " + args);
    const shell = spawn(words[1],args).on('error', function( err ){
        msg.reply.text('error while executing:'+words[1]);
        msg.reply.text(err);
    });

    if(shell){

       shell.stdout.on('data', (data) => {
        msg.reply.text(`stdout:\n ${data}`);
       });

       shell.stderr.on('data', (data) => {
        msg.reply.text(`stderr: ${data}`);
       });

       shell.on('close', (code) => {
        msg.reply.text(`shell exited with code ${code}`);
       });
}

});
bot.on('/error', (msg) => msg.MAKE_AN_ERROR);
bot.on('/stop', () => bot.stop('bye!'));
bot.start();
