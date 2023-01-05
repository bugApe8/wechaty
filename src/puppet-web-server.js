const Browser = require('./puppet-web-browser')

/****************************************
 *
 * Class Server
 *
 ***************************************/

const fs          = require('fs')
const io          = require('socket.io')
const path			  = require('path')
const https       = require('https')
const bodyParser  = require('body-parser')

/**
 * express是一个简约、快速、类似于Sinatra的Node.js后端框架，为开发可扩展的后端
 * 应用程序提供了强大的功能和工具。
 */
const Express       = require('express')
const EventEmitter  = require('events')
const log           = require('npmlog')

class Server extends EventEmitter {
  constructor(options) {
    super()
    options       = options || {}
    this.port     = options.port || 8788 // W(87) X(88), ascii char code ;-]
    
    this.logined  = false

    //注册登录，登出事件的处理方法
    this.on('login' , () => this.logined = true  )
    this.on('logout', () => this.logined = false )

  }

  init() {
    //三件套 express->httpsServer->socketio
    this.express  = this.createExpress()
    this.server   = this.createHttpsServer(this.express, this.port)
    this.socketio = this.createSocketIo(this.server)

    //创建一个浏览器
    this.browser  = this.createBrowser()

    return new Promise((resolve, reject) => {
      this.browser.init()
      .then(() => {
        log.verbose('Server',`browser init finished with port: ${this.port}`)
        resolve() // after init success
      })
    })
  }

  createBrowser() {
    const b = new Browser({port: this.port})

    /**
     * `unload` event is sent from js@browser to webserver via socketio
     * after received `unload`, we re-inject the Wechaty js code into browser.
     */
    this.on('unload', () => {
      log.verbose('Server', 'server received unload event')
      this.browser.inject()
      .then(() => log.verbose('Server', 're-injected'))
      .catch((e) => log.error('Server', 'inject err: ' + e))
    })

    return b
  }

  /**
   *
   * Https Server
   *
   */
  createHttpsServer(express) {
    return https.createServer({
      key   : require('./ssl-key-cert').key
      , cert: require('./ssl-key-cert').cert
    }, express).listen(this.port, () => {
      log.verbose('Server', `createHttpsServer port ${this.port}`)
    })
  }

  /**
   *
   * Express Middleware
   *
   */
  createExpress() {
    const app = new Express()

    app.use(bodyParser.json())
    app.use(function(req, res, next) {
      res.header("Access-Control-Allow-Origin", "*")
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
      next()
    })

    //定义了一个路由
    app.get('/ding', function (req, res) {
      log.silly('Server', '%s GET /ding', new Date())
      res.end('dong')
    })

    return app
  }

  /**
   *
   * Socket IO
   *
   */
  createSocketIo(server) {
    const socketServer = io.listen(server, {
      log: true
    })

    //注册连接事件处理函数
    socketServer.sockets.on('connection', (s) => {
      log.verbose('Server', 'got connection from browser')
      // save to instance: socketClient
      this.socketClient = s
      
      s.on('disconnect', function() {
        log.verbose('Server', 'socket.io disconnected')
        /**
         * Possible conditions:
         * 1. Browser reload
         * 2. Lost connection(Bad network
         * 3. 
         */
        this.socketClient = null
      })

      // Events from Wechaty@Broswer --to--> Server
      ;[
        'message'
        , 'login'
        , 'logout'
        , 'unload'
      ].map(e => { 
        s.on(e, data => { 
          log.silly('Server', `recv event[${e}] from browser`)
          this.emit(e, data) 
        })
      })

      s.on('error', e => log.error('Server', 'socket error: %s', e))
      /**
       * prevent lost event: buffer new event received when socket disconnected
       while (buff.length) {
       let e = buff.shift()
       socket.emit(e.event, e.data)
       }
       */
    })

    return socketServer
  }

  isLogined() {
    return this.logined
  }

  quit() {
    if (this.browser) {
      this.browser.quit()
      delete this.browser
    }
    if (this.socketServer) {
      socketServer.httpsServer.close()
      socketServer.close()
      delete this.socketServer
    }
    if (this.socketClient) {
      this.socketClient.disconnect()
      delete this.socketClient
    }
    if (this.server) {
      this.server.close()
      delete this.server
    }
  }

  /**
   *
   * Proxy Call to Wechaty in Browser
   *
   */
  browserExecute(script) {
    if (!this.browser) 
      throw new Error('no browser!')
    return this.browser.execute(script)
  }

  proxyWechaty(wechatyFunc, ...args) {
    //const args      = Array.prototype.slice.call(arguments, 1)
    const argsJson  = JSON.stringify(args)
    const wechatyScript = `return (Wechaty && Wechaty.${wechatyFunc}.apply(undefined, JSON.parse('${argsJson}')))`

    log.silly('Server', 'proxyWechaty: ' + wechatyScript)
    return this.browserExecute(wechatyScript)
  }
}

module.exports = Server
