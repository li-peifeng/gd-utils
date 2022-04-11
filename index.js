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
      label: '📺 youtube',
      command: '/yd'
  },
  aria2: {
      label: '🗃 aria2',
      command: '/aria2'
  },
  restart: {
    label: '⚙️ 重启',
    command: '/restart'
  },
  runshell: {
    label: '⏳ runshell',
    command: '/runshell'
  },
  update: {
      label: '🛠 更新',
      command: '/update'
  },
  hello: {
      label: '👋 Hello',
      command: '/hello'
  },
  world: {
      label: '🌍 World',
      command: '/world'
  },
  hide: {
      label: '⌨️ 隐藏菜单',
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
      msg.reply.text('🔸 您的用户名或ID不在机器人的白名单中，如果是您配置的机器人，请先到config.js中配置自己的username');
      return console.warn('收到非白名单用户的请求')
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

bot.sendMessage(adminUsers[0],"🔸 谷歌转存机器人现在开始为您服务.") //填写你的chat id ,机器人上线时你第一时间里会收到通知

bot.on('/yd', (msg) =>{
  if(MSG.startsWith('http')){
    let ydurl = 'yd ' + MSG;
    console.log( ydurl )
    msg.reply.text('run yd ');
    exec(ydurl, msg);
    return bot.sendMessage(msg.from.id, '已执行！', {replyMarkup: 'hide'});
  }
  return bot.sendMessage(msg.from.id, '无地址 ！', {replyMarkup: 'hide'});
});

bot.on('/aria2', (msg) => exec('aria2 ' + MSG, msg));
bot.on('/hide', (msg) => msg.reply.text('🔸 再次打开系统菜单,请输入: /start .', {replyMarkup: 'hide'}));

bot.on('/taskall', msg => {
  exec('task all', msg);
});

bot.on('/taskclear', msg => {
  exec('task clear', msg);
});

bot.on('/runshell', msg => {
  if(MSG == "")return bot.sendMessage(msg.from.id, '无命令', {replyMarkup: 'hide'});
    msg.reply.text('run shell:' + MSG);
    exec(MSG, msg);
    return bot.sendMessage(msg.from.id, '已执行！', {replyMarkup: 'hide'});
});

bot.on('/start', (msg) => {
  let replyMarkup = bot.keyboard([
      [BUTTONS.update.label, BUTTONS.restart.label],
      [BUTTONS.hide.label]
  ], {resize: true});
  return bot.sendMessage(msg.from.id, '🔹 对话ID是:  ' + msg.chat.id + ',\n可用功能请查看键盘.', {replyMarkup});
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
        msg.reply.text('🔸 您的用户名或ID不在机器人的白名单中，如果是您配置的机器人，请先到config.js中配置自己的username');
        return console.warn('收到非白名单用户的请求')
    }
      const fid = extract_fid(text) || extract_from_text(text) || extract_from_text(message_str)
      const no_fid_commands = ['/task', '/help', '/bm']
      if (!no_fid_commands.some(cmd => text.startsWith(cmd)) && !validate_fid(fid)) {
        console.log(message_str);
        if (text.startsWith('/')||text.startsWith('👋')||text.startsWith('🌍')||text.startsWith('⌨️')||text.startsWith(' ')) return;
        sm({ chat_id, text: '🔸 未识别出有效的分享ID' })
        if(message_str.startsWith('http')){
          is_shell = true
          let replyMarkup = bot.keyboard([
            [BUTTONS.youtube.label, BUTTONS.aria2.label],
            [BUTTONS.hide.label]
          ], {resize: true});
          return bot.sendMessage(msg.from.id, '🔸 你可能要执行：', {replyMarkup});
          }
        let replyMarkup = bot.keyboard([
          [BUTTONS.update.label, BUTTONS.runshell.label],
          [BUTTONS.hide.label]
        ], {resize: true});
        return bot.sendMessage(msg.from.id, '🔸 你可能要执行：', {replyMarkup});
      }
      if (text.startsWith('/help')) return send_help(chat_id)
      if (text.startsWith('/bm')) {
        const [cmd, action, alias, target] = text.split(' ').map(v => v.trim()).filter(v => v)
        if (!action) return send_all_bookmarks(chat_id)
        if (action === 'set') {
          if (!alias || !target) return sm({ chat_id, text: '🔸 别名和目标ID不能为空' })
          if (alias.length > 24) return sm({ chat_id, text: '🔸 别名不要超过24个英文字符长度' })
          if (!validate_fid(target)) return sm({ chat_id, text: '🔸 目标ID格式有误' })
          set_bookmark({ chat_id, alias, target })
        } else if (action === 'unset') {
          if (!alias) return sm({ chat_id, text: '🔸 别名不能为空' })
          unset_bookmark({ chat_id, alias })
        } else {
          send_bm_help(chat_id)
        }
      } else if (text.startsWith('/count')) {
        if (counting[fid]) return sm({ chat_id, text: ' 🔹 ' + 'ID:  ' + fid + '\n🔹 正在统计，请稍候...' })
        try {
          counting[fid] = true
          const update = text.endsWith(' -u')
          send_count({ fid, chat_id, update })
        } catch (err) {
          console.error(err)
          sm({ chat_id, text: ' 🔸 统计失败!' + '\n🔹 ID:  ' + fid  + '\n🔸 失败原因:  ' + err.message })
        } finally {
          delete counting[fid]
        }
      } else if (text.startsWith('/copy')) {
        let target = text.replace('/copy', '').replace(' -u', '').trim().split(' ').map(v => v.trim()).filter(v => v)[1]
        target = get_target_by_alias(target) || target
        if (target && !validate_fid(target)) return sm({ chat_id, text: `🔸 目标ID ${target} 格式不正确` })
        const update = text.endsWith(' -u')
        tg_copy({ fid, target, chat_id, update }).then(task_id => {
          task_id && sm({ chat_id, text: `🔹 已开始复制，进度查询请输入:\n/task ${task_id}`})
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
          if (!running_tasks.length) return sm({ chat_id, text: '🔸 当前暂无运行中的任务' })
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
        msg.reply.text('🔸 您的用户名或ID不在机器人的白名单中，如果是您配置的机器人，请先到config.js中配置自己的username')
        return console.warn('收到非白名单用户的请求')
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
      if (counting[fid]) return sm({ chat_id, text: '🔸 ' + 'ID:  ' + fid + '\n🔹 正在统计，请稍候...' })
      counting[fid] = true
      send_count({ fid, chat_id }).catch(err => {
        console.error(err)
        sm({ chat_id, text: '🔸 统计失败!' + '\n🔹 ID:  ' + fid + '\n🔹 失败原因:  ' + err.message })
      }).finally(() => {
        delete counting[fid]
      })
    } else if (action === 'copy') {
      console.log("copy id:"+id);
      if (COPYING_FIDS[fid]) return sm({ chat_id, text: `🔹 正在处理 ${fid} 的复制命令` })
      COPYING_FIDS[fid] = true
      tg_copy({ fid, target: get_target_by_alias(target), chat_id }).then(task_id => {
        task_id && sm({ chat_id, text: `🔹 已开始复制，查询进度请输入:\n/task ${task_id}` })
      }).finally(() => COPYING_FIDS[fid] = false)
    } else if (action === 'update') {
      if (counting[fid]) return sm({ chat_id, text: '🔹 ' + 'ID: ' + fid + '\n🔹 正在统计，请稍候...' })
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
      msg.reply.text('🔸 您的用户名或ID不在机器人的白名单中，如果是您配置的机器人，请先到config.js中配置自己的username');
      return console.warn('收到非白名单用户的请求')
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
