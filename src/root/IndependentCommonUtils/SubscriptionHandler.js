const CommonUtils = require('./CommonUtils')
const appSpecificErrors = require('./appSpecificErrors')
const [SpuriousUnsubscription, DuplicateSubscription] = [appSpecificErrors.SpuriousUnsubscription, appSpecificErrors.DuplicateSubscription]
const Event = CommonUtils.Event

class SubscriptionHandler
{
    constructor(depthSubscriber, 
                depthUnsubscriber,
                logger){
        this.depthSubscriber = depthSubscriber
        this.depthUnsubscriber = depthUnsubscriber
        this.logger = logger
        this.subscriptionBook = new Map()
    }

    subscribe(symbol, exchange, type, callback){
        const key = JSON.stringify([symbol, exchange, type])
        let evt = this.subscriptionBook.get(key)

        if(undefined === evt){
            evt = new Event()
            this.subscriptionBook.set(key, evt)
            this.depthSubscriber(symbol, exchange, type)
        }

        evt.registerCallback(callback) 
    }

    unsubscribe(symbol, exchange, type, callback){
        const key = JSON.stringify([symbol, exchange, type])
        const evt = this.subscriptionBook.get(key)
        if(undefined !== evt){
            evt.unregisterCallback(callback)
            if(evt.empty()){
                this.subscriptionBook.delete(key)
                this.depthUnsubscriber(symbol, exchange, type)
            }
        }
        else
            throw new SpuriousUnsubscription(`The symbol ${symbol} is not currently subscribed`)
    }

    onUpdate(update){
        update = JSON.parse(update)
        const key = JSON.stringify([update.symbol, update.exchange])
        const evt = this.subscriptionBook.get(key)
        update.key = key
        if(undefined !== evt){
            evt.raise(update)
        }
    }
}

module.exports.SubscriptionHandler = SubscriptionHandler

