const CommonUtils = require('./CommonUtils')
const appSpecificErrors = require('./appSpecificErrors')
const [SpuriousUnsubscription, DuplicateSubscription] = [appSpecificErrors.SpuriousUnsubscription, appSpecificErrors.DuplicateSubscription]
const Event = CommonUtils.Event

class VirtualSubscriberUnit{
    constructor(subscriber,
                unsubscriber,
                staticInfo,
                logger,
                assetSideExchangeSymbol,
                currencySideExchangeSymbol,
                callback){
        this.logger = logger
        this.assetPrice = null
        this.currencyPrice = null
        this.staticInfo = staticInfo

        const onAssetSideUpdate = (update)=>{
            this.assetPrice = update.price
            if(null !== this.currencyPrice){
                this.raisePriceUpdateEvt((this.assetPrice/this.currencyPrice).toFixed(4))
            }
        }

        const onCurrencySideUpdate = (update)=>{
            this.currencyPrice = update.price
            if(null !== this.assetPrice){
                this.raisePriceUpdateEvt((this.assetPrice/this.currencyPrice).toFixed(4))
            }
        }

        this.unsubscribe = ()=>{
            unsubscriber(assetSideExchangeSymbol, onAssetSideUpdate)
            unsubscriber(currencySideExchangeSymbol, onCurrencySideUpdate)
        }

        this.evt = new Event()
        this.evt.registerCallback(callback)
        
        subscriber(assetSideExchangeSymbol, onAssetSideUpdate)
        subscriber(currencySideExchangeSymbol, onCurrencySideUpdate)
    }

    raisePriceUpdateEvt(virtualPrice){
        const dynamicInfo = this.staticInfo
        dynamicInfo.price = virtualPrice
        this.evt.raise(dynamicInfo)
    }

    addSubscriber(callback){
        this.evt.registerCallback(callback)
    }

    //Caution! after calling this function please check if it's empty and if it is, then
    //the reference of this object from the client code
    removeSubscriber(callback){
        this.evt.unregisterCallback(callback)
        if (this.evt.empty()){
            this.unsubscribe()
        }
    }

    empty(){
        return this.evt.empty()
    }
}

class VirtualSubscriptionHandler
{
    constructor(subscriber, 
                unsubscriber,
                logger){
        this.depthSubscriber = subscriber
        this.depthUnsubscriber = unsubscriber
        this.logger = logger
        this.subscriptionBook = new Map()
    }

    subscribe(asset, currency, bridge, exchange, callback, exchangeSymbolNameGenerator){
        const key = JSON.stringify([asset, currency, bridge, exchange])
        let virtualSubscriberUnit = this.subscriptionBook.get(key)
        if(undefined === virtualSubscriberUnit){
            //The cosnstructor start the external subscription sort RAII 
            const exchange_side_asset_symbol = exchangeSymbolNameGenerator(asset, bridge, exchange)
            const exchange_side_currency_symbol = exchangeSymbolNameGenerator(currency, bridge, exchange)
            virtualSubscriberUnit = new VirtualSubscriberUnit((symbol, callback)=>this.depthSubscriber(symbol, exchange, "trade", callback),
                                                              (symbol, callback)=>this.depthUnsubscriber(symbol, exchange, "trade", callback),
                                                              {asset : asset,
                                                               currency : currency,
                                                               bridge : bridge,
                                                               exchange : exchange,
                                                               key : JSON.stringify([asset, currency, bridge, exchange]),
                                                               exchange_side_asset_symbol : exchange_side_asset_symbol,
                                                               exchange_side_currency_symbol : exchange_side_currency_symbol},
                                                               this.logger,
                                                               exchange_side_asset_symbol,
                                                               exchange_side_currency_symbol,
                                                               callback)

            this.subscriptionBook.set(key, virtualSubscriberUnit)
            
        }else{
            virtualSubscriberUnit.addSubscriber(callback)
        }
    }

    unsubscribe(asset, currency, bridge, exchange, callback){
        const key = JSON.stringify([asset, currency, bridge, exchange])
        const virtualSubscriberUnit = this.subscriptionBook.get(key)
        if(undefined !== virtualSubscriberUnit){
            virtualSubscriberUnit.removeSubscriber(callback)
            if (virtualSubscriberUnit.empty()){
                this.subscriptionBook.delete(key)
            }
        }
        else
            throw new SpuriousUnsubscription(`The key ${JSON.stringify(key)} is not currently subscribed`)
    }
}

module.exports.VirtualSubscriptionHandler = VirtualSubscriptionHandler