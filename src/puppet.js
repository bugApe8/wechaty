/**
 * Wechat for Bot. and for human who can talk with bot/robot
 *
 * Interface for puppet
 *
 * Licenst: ISC
 * https://github.com/zixia/wechaty
 *
 */

/**
 * events模块是nodejs中最重要的一个模块之一，对外只暴露了一个对象，
 * 就是EventEmitter,其作用只有两个，事件的发射和监听
 */
const EventEmitter = require('events')
const log = require('npmlog')

/**
 * 
 */
class Puppet extends EventEmitter {
  constructor() {
    super()
  }

  /**
   * Get current logined user
   * @return <Contact> 
   */
  currentUser() { throw new Error('To Be Implemented')  }

  /**
   * let puppet send message
   *
   * @param <Message> message - the message to be sent
   * @return <Promise> 
   */
  send(message) { throw new Error('To Be Implemented') }

  logout()      { throw new Error('To Be Implementsd') }
  alive()       { throw new Error('To Be Implementsd') }

  getContact(id)  { // for unit testing
    log.silly('Puppet', `Interface method getContact(${id})`)
    return Promise.resolve({UserName: 'WeChaty', NickName: 'Puppet'})
  }

  // () { throw new Error('To Be Implemented')  }

  /**
   *
   * Events .on(...)
   *
   * login   - 
   * logout  -  
   * 
   *
   */
  debug(cb) {
    // List of all events
    [ 'message'   // event data should carry a instance of Message
      , 'login'
      , 'logout'
    ].map(e => { this.on(e, cb) })
  }

}
/**
 * Object.assign()方法将所有可枚举（Object.propertyIsEnumerable()返回true）的自有(Object.hasOwnProperty()返回true)
 * 属性从一个或多个源对象复制到目标对象，返回修改后的对象
 * Object.assign(target, ...source)
 * 什么意思呢？就是经过下面的操作，Message,Contact,Group对象里面的自由属性会被复制给Puppet,相当于Puppet就是它们三个的结合
 */
Object.assign(Puppet, {
  Message:    require('./message')
  , Contact:  require('./contact')
  , Group:    require('./group')
})

module.exports = Puppet
