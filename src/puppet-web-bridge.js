/**
*
* Wechaty - Wechat for Bot, and human who talk to bot.
*
* Inject this js code to browser,
* in order to interactive with wechat web program.
*
* Licenst: MIT
* https://github.com/zixia/wechaty-lib
*
*/
const retryPromise  = require('retry-promise').default

const log = require('./npmlog-env')

class Bridge {
  constructor(options) {
    if (!options || !options.browser) { throw new Error('Bridge need a browser')}
    log.verbose('Bridge', `new Bridge({browser: ${options.browser}, port: ${options.port}})`)

    this.browser  = options.browser
    this.port     = options.port || 8788 // W(87) X(88), ascii char code ;-]
  }
  toString() { return `Class Bridge({browser: ${this.options.browser}, port: ${this.options.port}})` }

  init() {
    log.verbose('Bridge', 'init()')
    return this.inject()
  }

  logout()                  {
    log.verbose('Bridge', 'quit()')
    return this.proxyWechaty('logout')
  }
  quit()                    {
    log.verbose('Bridge', 'quit()')
    return this.proxyWechaty('quit')
  }

  // @Deprecated: use `scan` event instead
  getLoginStatusCode()      { return this.proxyWechaty('getLoginStatusCode') }
  // @Deprecated: use `scan` event instead
  getLoginQrImgUrl()        { return this.proxyWechaty('getLoginQrImgUrl') }

  getUserName()             { return this.proxyWechaty('getUserName') }

  getContact(id) {
    const max = 30
    const backoff = 100

    // max = (2*totalTime/backoff) ^ (1/2)
    // timeout = 11250 for {max: 15, backoff: 100}
    // timeout = 45000 for {max: 30, backoff: 100}
    const timeout = max * (backoff * max) / 2

    return retryPromise({ max: max, backoff: backoff }, function (attempt) {
      log.silly('Bridge', 'getContact() retryPromise: attampt %s/%s time for timeout %s'
        , attempt, max, timeout)

      return this.proxyWechaty('getContact', id)
      .then(r => {
        if (!r) {
          throw ('got empty return')
        }
        return r
      })
    }.bind(this))
    .catch(e => {
      log.error('Bridge', 'getContact() retryPromise finally FAIL: %s', e)
      throw e
    })
    /////////////////////////////////
  }

  send(toUserName, content) { return this.proxyWechaty('send', toUserName, content) }

  getInjectio() {
    const fs = require('fs')
    const path = require('path')
    return fs.readFileSync(
      path.join(path.dirname(__filename), 'puppet-web-injectio.js')
      , 'utf8'
    )
  }
  //相当关键的一个东西，通过注入实现对浏览器的控制和事件监听
  inject() {
    log.verbose('Bridge', 'inject()')
    const injectio = this.getInjectio()
    try {
      return this.execute(injectio, this.port)
      .then(r => {
        log.verbose('Bridge', `injected, got [${r}]. now initing...`)
        return this.proxyWechaty('init')
      })
      .then(r => {
        if (true!==r) { throw new Error('Wechaty.init() failed： ' + r) }
        log.verbose('Bridge', 'Wechaty.init() successful')
        return r
      })
    } catch (e) {
      log.error('Bridge', 'inject() exception: %s', e)
      return Promise.reject('inject exception: ' + e)
    }
    throw new Error('should not run to here')
  }

  /**
   * Proxy Call to Wechaty in Bridge
   */
  proxyWechaty(wechatyFunc, ...args) {
    const argsEncoded = new Buffer(
      encodeURIComponent(
        JSON.stringify(args)
      )
    ).toString('base64')
    // see: http://blog.sqrtthree.com/2015/08/29/utf8-to-b64/
    const argsDecoded = `JSON.parse(decodeURIComponent(window.atob('${argsEncoded}')))`

    const wechatyScript   = `return (Wechaty && Wechaty.${wechatyFunc}.apply(undefined, ${argsDecoded}))`
    log.silly('Bridge', 'proxyWechaty: ' + wechatyScript)
    return this.execute(wechatyScript)
  }

  execute(script, ...args) { return this.browser.execute(script, ...args) }
}

module.exports = Bridge

/**
 *
 * some handy browser javascript snips
 *
ac = Wechaty.glue.contactFactory.getAllContacts();
Object.keys(ac).filter(function(k) { return /李/.test(ac[k].NickName) }).map(function(k) { var c = ac[k]; return {NickName: c.NickName, Alias: c.Alias, Uin: c.Uin, MMInChatRoom: c.MMInChatRoom} })

Object.keys(window._chatContent).filter(function (k) { return window._chatContent[k].length > 0 }).map(function (k) { return window._chatContent[k].map(function (v) {return v.MMDigestTime}) })

.web_wechat_tab_add
.web_wechat_tab_launch-chat
 *
 */