/**
 * Wechat for Bot. and for human who can talk with bot/robot
 *
 * Web Server for puppet
 *
 * Class PuppetWebServer
 *
 * Licenst: ISC
 * https://github.com/zixia/wechaty
 *
 */
const fs          = require('fs')
const io          = require('socket.io')
const path        = require('path')
const https       = require('https')
const bodyParser  = require('body-parser')

const log = require('./npmlog-env')

const Express       = require('express')
const EventEmitter  = require('events')

class Server extends EventEmitter {
  constructor(options) {
    super()
    options       = options || {}
    this.port     = options.port || 8788 // W(87) X(88), ascii char code ;-]
  }

  toString() { return `Class Wechaty.Puppet.Web.Server({port:${this.port}})` }

  init() {
    log.verbose('Server', 'init()')
    this.initEventsToClient()//心跳事件处理
    return new Promise((resolve, reject) => {
      //三件套
      this.express      = this.createExpress()
      this.httpsServer  = this.createHttpsServer(this.express
        , r => resolve(r), e => reject(e)
      )
      this.socketServer = this.createSocketIo(this.httpsServer)
    }).then(r => {
      log.verbose('Server', 'full init()-ed')
      return true
    })
  }

  /**
   * Https Server
   */
  createHttpsServer(express, resolve, reject) {
    return https.createServer({//创建https服务，端口默认8788
      key:    require('./ssl-pem').key
      , cert: require('./ssl-pem').cert
    }, express)
    .listen(this.port, () => {
      log.verbose('Server', `createHttpsServer listen on port ${this.port}`)
      if (typeof resolve === 'function') {
        resolve(this)
      }
    })
    .on('error', e => {
      log.error('Server', 'createHttpsServer:' + e)
      if (typeof reject === 'function') {
        reject(e)
      }
    })
  }

  /**
   * Express Middleware
   */
  createExpress() {
    const e = new Express()
    e.use(bodyParser.json())
    e.use(function(req, res, next) {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
      next()
    })
    //注册心跳路由
    e.get('/ding', function(req, res) {
      log.silly('Server', '%s GET /ding', new Date())
      res.end('dong')
    })
    return e
  }

  /**
   * Socket IO
   */
  createSocketIo(httpsServer) {
    //创建socket服务
    const socketServer = io.listen(httpsServer, {
      // log: true
    })
  //注册连接事件处理
    socketServer.sockets.on('connection', (s) => {
      log.verbose('Server', 'got connection from browser')
      if (this.socketClient) { this.socketClient = null } // close() ???
      this.socketClient = s
      this.initEventsFromClient(s)
    })
    return socketServer
  }

  //初始化端（浏览器）过来的事件处理
  initEventsFromClient(client) {
    log.verbose('Server', 'initEventFromClient()')

    this.emit('connection', client)//冒泡给上层，就是puppet-web

    client.on('disconnect', e => {
      log.verbose('Server', 'socket.io disconnect: %s', e)
      // 1. Browser reload / 2. Lost connection(Bad network)
      this.socketClient = null
      this.emit('disconnect', e)//冒泡给上层，就是puppet-web
    })

    client.on('error' , e => log.error('Server', 'socketio client error: %s', e))
    //这个事件其实是由下面的initEventsToClient注册的ding事件级联触发的
    client.on('ding'  , e => log.silly('Server', 'got ding: %s', e))

    // Events from Wechaty@Broswer --to--> Server
    ;[
      'message'
      , 'scan'
      , 'login'
      , 'logout'
      , 'log'
      , 'unload'
      , 'dong'
    ].map(e => {
      client.on(e, data => {
        log.silly('Server', `recv event[${e}](${data}) from browser`)
        this.emit(e, data)//冒泡给上层，puppet-web
      })
    })
  }

  initEventsToClient() {
    log.verbose('Server', 'initEventToClient()')
    this.on('ding', data => { //注册浏览器端的ding事件，心跳触发
      log.silly('Server', `recv event[ding](${data}), sending to client`)
      if (this.socketClient)  { this.socketClient.emit('ding', data) }//如果socket端是连接的，那么会继续冒泡给socket连接端
      else                    { log.warn('Server', 'this.socketClient not exist')}
    })
  }

  quit() {
    log.verbose('Server', 'quit()')
    if (this.socketServer) {
      log.verbose('Server', 'close socketServer')
      this.socketServer.close()
      this.socketServer = null
    }
    if (this.socketClient) {
      log.verbose('Server', 'close socketClient')
      this.socketClient = null
    }
    if (this.httpsServer) {
      log.verbose('Server', 'close httpsServer')
      this.httpsServer.close()
      this.httpsServer = null
    }
    return Promise.resolve(true)
  }
}

module.exports = Server
