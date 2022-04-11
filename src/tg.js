const Table = require('cli-table3')
const dayjs = require('dayjs')
const axios = require('@viegg/axios')
const HttpsProxyAgent = require('https-proxy-agent')

const { db } = require('../db')
const { gen_count_body, validate_fid, real_copy, get_name_by_id, get_info_by_id, copy_file } = require('./gd')
const { AUTH, DEFAULT_TARGET, USE_PERSONAL_AUTH } = require('../config')
const { tg_token } = AUTH
const gen_link = (fid, text) => `<a href="https://drive.google.com/drive/folders/${fid}">${text || fid}</a>`

if (!tg_token) throw new Error('请先在config.js里设置tg_token')
const { https_proxy } = process.env
const axins = axios.create(https_proxy ? { httpsAgent: new HttpsProxyAgent(https_proxy) } : {})

const FID_TO_NAME = {}

async function get_folder_name (fid) {
  let name = FID_TO_NAME[fid]
  if (name) return name
  name = await get_name_by_id(fid, !USE_PERSONAL_AUTH)
  return FID_TO_NAME[fid] = name
}

function send_help (chat_id) {
  const text = `<pre>©️PeiFeng.Li®️ 
  
 🔸🔸🔸[使用帮助]🔹🔹🔹
  
命令 ｜ 说明
=====================
🔸 /help | 返回本条使用说明
=====================
🔸 /count shareID [-u] | 返回sourceID的文件统计信息
sourceID可以是google drive分享网址本身，也可以是分享ID。如果命令最后加上 -u，则无视之前的记录强制从线上获取，适合一段时候后才更新完毕的分享链接。
=====================
🔸 /copy sourceID targetID [-u] | 将sourceID的文件复制到targetID里（会新建一个文件夹）
若不填targetID，则会复制到默认位置（在config.js里设置）。
如果设置了bookmark，那么targetID可以是bookmark的别名。
如果命令最后加上 -u，则无视本地缓存强制从线上获取源文件夹信息。
命令开始执行后会回复此次任务的taskID。
=====================
🔸 /task | 返回对应任务的进度信息
用例：
/task | 返回所有正在运行的任务详情
/task 7 | 返回编号为 7 的任务详情
/task all | 返回所有任务记录列表
/task clear | 清除所有状态为已完成的任务记录
/task rm 7 | 删除编号为 7 的任务记录
=====================
🔸 /bm [action] [alias] [target] | bookmark，添加常用目的文件夹ID
会在输入网址后返回的「文件统计」「开始复制」这两个按钮的下方出现，方便复制到常用位置。
用例：
/bm | 返回所有设置的收藏夹
/bm set movie folder-id | 将folder-id添加到收藏夹，别名设为movie
/bm unset movie | 删除此收藏夹
</pre>`
  return sm({ chat_id, text, parse_mode: 'HTML' })
}

function send_bm_help (chat_id) {
  const text = `<pre>/bm [action] [alias] [target] | bookmark，添加常用目的文件夹ID
会在输入网址后返回的「文件统计」「开始复制」这两个按钮的下方出现，方便复制到常用位置。
用例：
/bm | 返回所有设置的收藏夹
/bm set movie folder-id | 将folder-id添加到收藏夹，别名设为movie
/bm unset movie | 删除此收藏夹
</pre>`
  return sm({ chat_id, text, parse_mode: 'HTML' })
}

function send_task_help (chat_id) {
  const text = `<pre>/task [action/id] [id] | 查询或管理任务进度
用例：
/task | 返回所有正在运行的任务详情
/task 7 | 返回编号为 7 的任务详情
/task all | 返回所有任务记录列表
/task clear | 清除所有状态为已完成的任务记录
/task rm 7 | 删除编号为 7 的任务记录
</pre>`
  return sm({ chat_id, text, parse_mode: 'HTML' })
}

function clear_tasks (chat_id) {
  const finished_tasks = db.prepare('select id from task where status=?').all('finished')
  finished_tasks.forEach(task => rm_task({ task_id: task.id }))
  sm({ chat_id, text: '🔹 已清除所有已完成的任务记录' })
}

function rm_task ({ task_id, chat_id }) {
  const exist = db.prepare('select id from task where id=?').get(task_id)
  if (!exist) return sm({ chat_id, text: `🔸 找不到编号为 ${task_id} 的任务记录` })
  db.prepare('delete from task where id=?').run(task_id)
  db.prepare('delete from copied where taskid=?').run(task_id)
  if (chat_id) sm({ chat_id, text: `🔸 已删除任务 ${task_id} 记录` })
}

function send_all_bookmarks (chat_id) {
  let records = db.prepare('select alias, target from bookmark').all()
  if (!records.length) return sm({ chat_id, text: '🔸 数据库中没有任何收藏记录' })
  const tb = new Table({ style: { head: [], border: [] } })
  const headers = ['名称', '目录']
  records = records.map(v => [v.alias, v.target])
  tb.push(headers, ...records)
  const text = tb.toString().replace(/─/g, '—')
  return sm({ chat_id, text: `<pre>🔹🔹🔹🔸🔸🔸\n${text}</pre>`, parse_mode: 'HTML' })
}

function set_bookmark ({ chat_id, alias, target }) {
  const record = db.prepare('select alias from bookmark where alias=?').get(alias)
  if (record) return sm({ chat_id, text: '🔸 数据库中已有同名的收藏' })
  db.prepare('INSERT INTO bookmark (alias, target) VALUES (?, ?)').run(alias, target)
  return sm({ chat_id, text: `🔹 成功设置收藏：${alias} | ${target}` })
}

function unset_bookmark ({ chat_id, alias }) {
  const record = db.prepare('select alias from bookmark where alias=?').get(alias)
  if (!record) return sm({ chat_id, text: '🔸 未找到此别名的收藏' })
  db.prepare('delete from bookmark where alias=?').run(alias)
  return sm({ chat_id, text: '🔹 成功删除收藏 ' + alias })
}

function get_target_by_alias (alias) {
  const record = db.prepare('select target from bookmark where alias=?').get(alias)
  return record && record.target
}

function get_alias_by_target (target) {
  const record = db.prepare('select alias from bookmark where target=?').get(target)
  return record && record.alias
}

function send_choice ({ fid, chat_id }) {
  return sm({
    chat_id,
    text: `🔸 识别出分享ID，请选择任务执行`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '文件统计', callback_data: `count ${fid}` },
          { text: '执行复制', callback_data: `copy ${fid}` }
        ],
        [
          { text: '数据刷新', callback_data: `update ${fid}` },
          { text: '清除按钮', callback_data: `clear_button` }
        ]
      ].concat(gen_bookmark_choices(fid))
    }
  })
}

// console.log(gen_bookmark_choices())
function gen_bookmark_choices (fid) {
  const gen_choice = v => ({ text: `♾ ${v.alias} ♾`, callback_data: `copy ${fid} ${v.alias}` })
  const records = db.prepare('select * from bookmark').all()
  const result = []
  for (let i = 0; i < records.length; i += 2) {
    const line = [gen_choice(records[i])]
    if (records[i + 1]) line.push(gen_choice(records[i + 1]))
    result.push(line)
  }
  return result
}

async function send_all_tasks (chat_id) {
  let records = db.prepare('select id, status, ctime from task').all()
  if (!records.length) return sm({ chat_id, text: '🔸 数据库中没有任务记录' })
  const tb = new Table({ style: { head: [], border: [] } })
  const headers = ['ID', 'Stato', 'Time']
  records = records.map(v => {
    const { id, status, ctime } = v
    return [id, status, dayjs(ctime).format('MM-DD HH:mm:ss')]
  })
  tb.push(headers, ...records)
  const text = tb.toString().replace(/─/g, '—')
  const url = `https://api.telegram.org/bot${tg_token}/sendMessage`
  return axins.post(url, {
    chat_id,
    parse_mode: 'HTML',
    text: `🔹 所有拷贝任务：\n<pre>${text}</pre>`
  }).catch(err => {
    // const description = err.response && err.response.data && err.response.data.description
    // if (description && description.includes('message is too long')) {
    if (true) {
      const text = [headers].concat(records.slice(-100)).map(v => v.join('\t')).join('\n')
      return sm({ chat_id, parse_mode: 'HTML', text: `🔹 所有拷贝任务(只显示最近100条)：\n<pre>${text}</pre>` })
    }
    console.error(err)
  })
}

async function get_task_info (task_id) {
  const record = db.prepare('select * from task where id=?').get(task_id)
  if (!record) return {}
  const { source, target, status, mapping, ctime, ftime } = record
  const { copied_files } = db.prepare('select count(fileid) as copied_files from copied where taskid=?').get(task_id)
  const folder_mapping = mapping && mapping.trim().split('\n')
  const new_folder = folder_mapping && folder_mapping[0].split(' ')[1]
  const { summary } = db.prepare('select summary from gd where fid=?').get(source) || {}
  const { file_count, folder_count, total_size } = summary ? JSON.parse(summary) : {}
  const total_count = (file_count || 0) + (folder_count || 0)
  const copied_folders = folder_mapping ? (folder_mapping.length - 1) : 0
  let text = '🔸 任务编号：' + task_id + '\n'
  const folder_name = await get_folder_name(source)
  text += '🔸 源文件夹：' + gen_link(source, folder_name) + '\n'
  text += '🔸 目标位置：' + gen_link(target, get_alias_by_target(target)) + '\n'
  text += '🔸 新文件夹：' + (new_folder ? gen_link(new_folder) : '暂未创建') + '\n'
  text += '🔸 任务状态：' + status + '\n'
  text += '🔸 创建时间：' + dayjs(ctime).format('YYYY-MM-DD HH:mm:ss') + '\n'
  text += '🔸 完成时间：' + (ftime ? dayjs(ftime).format('YYYY-MM-DD HH:mm:ss') : '未完成') + '\n'
  text += '🔸 目录进度：' + copied_folders + '/' + (folder_count === undefined ? '统计中...' : folder_count) + '\n'
  text += '🔸 文件进度：' + copied_files + '/' + (file_count === undefined ? '统计中...' : file_count) + '\n'
  text += '🔸 完成进度：' + ((copied_files + copied_folders) * 100 / total_count).toFixed(2) + '%\n'
  text += '🔸 合计大小：' + (total_size || '统计中...')
  return { text, status, folder_count }
}

async function send_task_info ({ task_id, chat_id }) {
  const { text, status, folder_count } = await get_task_info(task_id)
  if (!text) return sm({ chat_id, text: '🔸 查询不到此任务ID：' + task_id })
  const url = `https://api.telegram.org/bot${tg_token}/sendMessage`
  let message_id
  try {
    const { data } = await axins.post(url, { chat_id, text, parse_mode: 'HTML' })
    message_id = data && data.result && data.result.message_id
  } catch (e) {
    console.log('fail to send message to tg', e.message)
  }
  // get_task_info 在task目录数超大时比较吃cpu，以后如果最好把mapping也另存一张表
  if (!message_id || status !== 'copying') return
  const loop = setInterval(async () => {
    const { text, status } = await get_task_info(task_id)
    if (status !== 'copying') clearInterval(loop)
    sm({ chat_id, message_id, text, parse_mode: 'HTML' }, 'editMessageText')
  }, 1 * 1000)
}

async function tg_copy ({ fid, target, chat_id, update }) { // return task_id
  target = target || DEFAULT_TARGET
  if (!target) {
    sm({ chat_id, text: '🔸 请输入目的地ID' })
    return
  }
  const file = await get_info_by_id(fid, !USE_PERSONAL_AUTH)
  if (file && file.mimeType !== 'application/vnd.google-apps.folder') {
    return copy_file(fid, target, !USE_PERSONAL_AUTH).then(data => {
      sm({ chat_id, parse_mode: 'HTML', text: `🔹 单个文件复制成功，新文件位置：${gen_link(target)}` })
    }).catch(e => {
      sm({ chat_id, text: `🔸 单个文件复制失败，\n失败消息：${e.message}` })
    })
  }

  let record = db.prepare('select id, status from task where source=? and target=?').get(fid, target)
  if (record) {
    if (record.status === 'copying') {
      sm({ chat_id, text: '🔸 已有相同的任务正在进行，\n查询进度可输入 /task ' + record.id })
      return
    } else if (record.status === 'finished') {
      sm({ chat_id, text: `🔸 检测到已存在的任务 ${record.id}，\n开始继续拷贝` })
    }
  }

  real_copy({ source: fid, update, target, service_account: !USE_PERSONAL_AUTH, is_server: true })
    .then(async info => {
      if (!record) record = {} // 防止无限循环
      if (!info) return
      const { task_id } = info
      const { text } = await get_task_info(task_id)
      sm({ chat_id, text, parse_mode: 'HTML' })
    })
    .catch(err => {
      const task_id = record && record.id
      if (task_id) db.prepare('update task set status=? where id=?').run('error', task_id)
      if (!record) record = {}
      console.error('复制失败', fid, '-->', target)
      console.error(err)
      sm({ chat_id, text: (task_id || '') + '🔸 任务出错!\n🔸 错误消息：\n' + err.message })
    })

  while (!record) {
    record = db.prepare('select id from task where source=? and target=?').get(fid, target)
    await sleep(1000)
  }
  return record.id
}

function sleep (ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

function reply_cb_query ({ id, data }) {
  const url = `https://api.telegram.org/bot${tg_token}/answerCallbackQuery`
  return axins.post(url, {
    callback_query_id: id,
    text: '开始执行 ' + data
  })
}

async function send_count ({ fid, chat_id, update }) {
  sm({ chat_id, text: `🔹 正在获取文件信息，请稍候...` })
  const table = await gen_count_body({ fid, update, type: 'tg', service_account: !USE_PERSONAL_AUTH })
  if (!table) return sm({ chat_id, parse_mode: 'HTML', text: gen_link(fid) + '🔸 信息获取失败!' })
  const url = `https://api.telegram.org/bot${tg_token}/sendMessage`
  const gd_link = `https://drive.google.com/drive/folders/${fid}`
  const name = await get_folder_name(fid)
  return axins.post(url, {
    chat_id,
    parse_mode: 'HTML',
    text: `<pre>🔹 源文件夹名称：${name}
🔹 源链接：${gd_link}
${table}</pre>`
  }).catch(async err => {
    // const description = err.response && err.response.data && err.response.data.description
    // const too_long_msgs = ['request entity too large', 'message is too long']
    // if (description && too_long_msgs.some(v => description.toLowerCase().includes(v))) {
    if (true) {
      const smy = await gen_count_body({ fid, type: 'json', service_account: !USE_PERSONAL_AUTH })
      const { file_count, folder_count, total_size } = JSON.parse(smy)
      return sm({
        chat_id,
        parse_mode: 'HTML',
        text: `🔹 链接：<a href="https://drive.google.com/drive/folders/${fid}">${fid}</a>\n<pre>
表格太长超出消息限制，以下显示概要：
目录名称：${name}
文件总数：${file_count}
目录总数：${folder_count}
合计大小：${total_size}
</pre>`
      })
    }
    throw err
  })
}

function sm (data, endpoint) {
  endpoint = endpoint || 'sendMessage'
  const url = `https://api.telegram.org/bot${tg_token}/${endpoint}`
  return axins.post(url, data).catch(err => {
    // console.error('fail to post', url, data)
    console.error('fail to send message to tg:', err.message)
    const err_data = err.response && err.response.data
    err_data && console.error(err_data)
  })
}

function extract_fid (text) {
  text = text.replace(/^\/count/, '').replace(/^\/copy/, '').replace(/\\/g, '').trim()
  const [source, target] = text.split(' ').map(v => v.trim())
  if (validate_fid(source)) return source
  try {
    if (!text.startsWith('http')) text = 'https://' + text
    const u = new URL(text)
    if (u.pathname.includes('/folders/')) {
      return u.pathname.split('/').map(v => v.trim()).filter(v => v).pop()
    } else if (u.pathname.includes('/file/')) {
      const file_reg = /file\/d\/([a-zA-Z0-9_-]+)/
      const file_match = u.pathname.match(file_reg)
      return file_match && file_match[1]
    }
    return u.searchParams.get('id')
  } catch (e) {
    return ''
  }
}

function extract_from_text (text) {
  // const reg = /https?:\/\/drive.google.com\/[^\s]+/g
  const reg = /https?:\/\/drive.google.com\/[a-zA-Z0-9_\\/?=&-]+/g
  const m = text.match(reg)
  return m && extract_fid(m[0])
}

module.exports = { send_count, send_help, sm, extract_fid, reply_cb_query, send_choice, send_task_info, send_all_tasks, tg_copy, extract_from_text, get_target_by_alias, send_bm_help, send_all_bookmarks, set_bookmark, unset_bookmark, clear_tasks, send_task_help, rm_task }
