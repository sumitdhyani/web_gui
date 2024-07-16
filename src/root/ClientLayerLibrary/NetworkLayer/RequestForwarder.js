const { io } = require('socket.io-client')
const appSpecificErrors = require('../../IndependentCommonUtils/appSpecificErrors')
const { RequestSerializer } = require('./RequestSerializer')
const { ActionAntiAction } = require('./ActionAntiAction')
const {Event} = require('../../IndependentCommonUtils/CommonUtils')
let sock = null
let logger = null
const subscriptionBook = new Map()
let disconnectionHandler = null
let requestSerializer = null
let actionAntiAction = null
class RequestSerializers{
    constructor(){
        this.serializers = new Map()
    }

    requestToSend(key, sock, event, ack, ...data){
    let serializer = this.serializers.get(key)
        if(undefined === serializer) {
            serializer = new RequestSerializer()
            this.serializers.set(key, serializer)
        }
        serializer.requestToSend(sock, event, ack, ...data)
    }
}

function subscribe(symbol, exchange, type, callback){
    const key = JSON.stringify([symbol, exchange, type])

    let evt = subscriptionBook.get(key)
    if (undefined === evt) {
        evt = new Event()
        subscriptionBook.set(key, evt)
        actionAntiAction.antiAct(key, ()=>{
            requestSerializer.requestToSend(key, sock, 'subscribe', (result)=>{
                if(result.success) {            
                    logger.warn(`subscriptionSuccess for: ${key}`)
                } else {
                    logger.warn(`subscriptionFailure for: ${key}, reason: ${result.reason}`)
                }
            }, symbol, exchange, type)
        })
    }
    
    evt.registerCallback(callback)
}

function unsubscribe(symbol, exchange, type, callback){
    const key = JSON.stringify([symbol, exchange, type])
    let evt = subscriptionBook.get(key)
    if (undefined === evt) {
        throw new Error(`Spurious unsubscription for key: ${key}`)
    }

    evt.unregisterCallback(callback)
    if (evt.empty()) {
        subscriptionBook.delete(key)
        actionAntiAction.act(key, 10000, ()=>{
            requestSerializer.requestToSend(key,
                                            sock,
                                            'unsubscribe',
                                            (result)=>{
                                                if(result.success) {
                                                    logger.warn(`unsubscriptionSuccess for: ${key}`)
                                                }else {
                                                    logger.warn(`unsubscriptionFailure for: ${key}, reason: ${result.reason}`)
                                                }
                                            },
                                            symbol,
                                            exchange,
                                            type)
        })
    }
}

function forward(intent){
    const action = intent.action
    if(0 === action.localeCompare("subscribe")){
        forwardSubscription(intent)
    }
    else if(0 === action.localeCompare("unsubscribe")){
        forwardUnsubscription(intent)
    }else if(0 === action.localeCompare("disconnect")){
        sock.disconnect()
    }
}

function forwardSubscription(subscription){
    subscribe(subscription.symbol,
              subscription.exchange,
              subscription.type,
              subscription.callback)
}

function forwardUnsubscription(subscription){
    unsubscribe(subscription.symbol,
                subscription.exchange,
                subscription.type,
                subscription.callback)
}

function disconnect(){
}

function connect(serverAddress, libLogger){//Server address <ip>:<port>
    actionAntiAction = new ActionAntiAction(libLogger) 
    logger = libLogger
    requestSerializer = new RequestSerializers()
    logger.debug(`Connecting to the server ${serverAddress}`)
    sock = io(serverAddress, {reconnection: false})
    sock.on('connect', ()=>{
        logger.debug(`Connected by id: ${sock.id}, syncing subscriptions`)
        subscriptionBook.forEach((evt, key)=>{
            const [symbol, exchange, type]  = JSON.parse(key)
            requestSerializer.requestToSend(key, sock, 'subscribe', (result)=>{
                if(result.success) {
                    logger.warn(`subscriptionSuccess for: ${key}`)
                } else {
                    logger.warn(`subscriptionFailure for: ${key}, reason: ${result.reason}`)
                }
            }, symbol, exchange, type)
        })
    })

    sock.on('disconnect', (reason)=>{
        libLogger.error(`disconnect, description: ${JSON.stringify(reason)}`)
        setTimeout(()=>disconnectionHandler(reason), 0);
    })

    sock.on("depth", (depth)=>{
        const depthJSon = JSON.parse(depth)
        const key = JSON.stringify([depthJSon.symbol, depthJSon.exchange, "depth"])
        const evt = subscriptionBook.get(key);
        if (undefined !== evt) {
            evt.raise(depthJSon)
        }
    })

    sock.on("trade", (trade)=>{
        const tradeJSon = JSON.parse(trade)
        const key = JSON.stringify([tradeJSon.symbol, tradeJSon.exchange, "trade"])
        const evt = subscriptionBook.get(key);
        if (undefined !== evt) {
            evt.raise(tradeJSon)
        }
    })

    sock.on("connect_error", (reason) => {
        libLogger.error(`connect_error, description: ${JSON.stringify(reason)}`)
        setTimeout(()=>disconnectionHandler(reason), 0);
    });
}

function setDisconnectionHandler(callback){
    disconnectionHandler = callback
}

module.exports.connect = connect
module.exports.forward = forward
module.exports.disconnect = disconnect
module.exports.setDisconnectionHandler = setDisconnectionHandler
