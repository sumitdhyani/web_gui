const { SubscriptionHandler } = require('./root/IndependentCommonUtils/SubscriptionHandler')
const { VirtualSubscriptionHandler } = require('./root/IndependentCommonUtils/VirtualSubscriptionHandler')
const { BasketSubscriptionHandler } = require('./root/IndependentCommonUtils/BasketSubscriptionHandler')
const { launch, raise_request, download_instruments} = require('./root/ClientLayerLibrary/ClientInterface')
                                    
let subscriptionHandler = null
let virtualSubscriptionHandler = null
let basketSubscriptionHandler = null
let globalDict = null

let libLogger = null
function subscribe(symbol , exchange, callback){
    const key = JSON.stringify([symbol, exchange])
    const symbolRecord = globalDict.get(key)
    if (undefined === symbolRecord) {
        throw new Error("Invalid Symbol")
    } else if( 0 !== exchange.localeCompare(symbolRecord.exchange)) {
        throw new Error("Invalid Symbol, for this exchange")
    }
    libLogger.debug(`subscribe, arguments: ${JSON.stringify(arguments)}`)
    subscriptionHandler.subscribe(symbol , exchange, callback)
}

function unsubscribe(symbol , exchange, callback){
    const key = JSON.stringify([symbol, exchange])
    const symbolRecord = globalDict.get(key)
    if (undefined === symbolRecord) {
        throw new Error("Invalid Symbol")
    } else if( 0 !== exchange.localeCompare(symbolRecord.exchange)) {
        throw new Error("Invalid Symbol, for this exchange")
    }
    libLogger.debug(`unsubscribe, arguments: ${JSON.stringify(arguments)}`)
    subscriptionHandler.unsubscribe(symbol , exchange, callback)
}

let exchangeSymbolNameGenerators = {BINANCE : (asset, currency, exchange)=> asset.concat(currency),
                                    FAKEX : (asset, currency, exchange)=> asset.concat(currency)
                                    }


function subscribeVirtual(asset, currency, bridge, exchange, callback){
    libLogger.debug(`subscribeVirtual, arguments: ${JSON.stringify(arguments)}`)

    let exchangeSymbolNameGenerator = exchangeSymbolNameGenerators[exchange]

    if(undefined === exchangeSymbolNameGenerator) {
        throw new Error("Invalid exchange")
    }

    const assetSymbol = exchangeSymbolNameGenerator(asset, bridge, exchange)
    const currencySymbol = exchangeSymbolNameGenerator(currency, bridge, exchange)
    const assetSymbolRecord = globalDict.get(JSON.stringify([assetSymbol, exchange]))
    const currencySymbolRecord = globalDict.get(JSON.stringify([currencySymbol, exchange]))

    if (undefined === assetSymbolRecord) {
        throw new Error("Invalid asset for this bridge")
    } else if (undefined === currencySymbolRecord) {
        throw new Error("Invalid currency side for this bridge")
    }

    if(undefined !== exchangeSymbolNameGenerator){
        virtualSubscriptionHandler.subscribe(asset,
                                             currency,
                                             bridge,
                                             exchange,
                                             callback,
                                             exchangeSymbolNameGenerator)
    }else{
        libLogger.error(`Symbol name generation method for this exchange in not defined`)
    }
}

function unsubscribeVirtual(asset, currency, bridge, exchange, callback){
    libLogger.debug(`unsubscribeVirtual, arguments: ${JSON.stringify(arguments)}`)

    let exchangeSymbolNameGenerator = exchangeSymbolNameGenerators[exchange]

    if(undefined === exchangeSymbolNameGenerator) {
        throw new Error("Invalid exchange")
    }

    const assetSymbol = exchangeSymbolNameGenerator(asset, bridge, exchange)
    const currencySymbol = exchangeSymbolNameGenerator(currency, bridge, exchange)
    const assetSymbolRecord = globalDict.get(JSON.stringify([assetSymbol, exchange]))
    const currencySymbolRecord = globalDict.get(JSON.stringify([currencySymbol, exchange]))

    if (undefined === assetSymbolRecord) {
        throw new Error("Invalid asset for this bridge")
    } else if (undefined === currencySymbolRecord) {
        throw new Error("Invalid currency side for this bridge")
    }

    virtualSubscriptionHandler.unsubscribe(asset,
                                         currency,
                                         bridge,
                                         exchange,
                                         callback)
}

function subscribeBasket(reqId, symbols, coefficients, currency, priceConverters, exchange, callback){ 
    libLogger.debug(`subscribeBasket, arguments: ${JSON.stringify(arguments)}`)
    basketSubscriptionHandler.subscribe(reqId,
                                        symbols,
                                        coefficients,
                                        currency,
                                        priceConverters,
                                        exchange,
                                        callback)
}

function unsubscribeBasket(reqId){
    libLogger.debug(`unsubscribeBasket, arguments: ${JSON.stringify(arguments)}`)
    basketSubscriptionHandler.unsubscribe(reqId)
}

function onPriceUpdate(update){
    subscriptionHandler.onUpdate(update)
}

function init(auth_params, logger, staticDataCallback){
    download_instruments()
    .then((dict)=>{
        globalDict = dict
        libLogger = logger
        libLogger.debug(JSON.stringify(dict))
        subscriptionHandler = new SubscriptionHandler( (symbol, exchange)=>{
                                                        raise_request({
                                                                action : "subscribe",
                                                                symbol : symbol,
                                                                exchange : exchange})
                                                        },
                                                        (symbol, exchange)=>{
                                                            raise_request({
                                                                action : "unsubscribe",
                                                                symbol : symbol,
                                                                exchange : exchange})
                                                        },
                                                        libLogger)

        virtualSubscriptionHandler = new VirtualSubscriptionHandler(subscriptionHandler.subscribe.bind(subscriptionHandler),
                                                                    subscriptionHandler.unsubscribe.bind(subscriptionHandler),
                                                                    libLogger)

        basketSubscriptionHandler = new BasketSubscriptionHandler(
            subscriptionHandler.subscribe.bind(subscriptionHandler),
            subscriptionHandler.unsubscribe.bind(subscriptionHandler),
            libLogger)
            
        launch(auth_params, onPriceUpdate, libLogger)
        staticDataCallback({allowed_instruments : dict,
                            allowed_exchanges: ["BINANCE", "FAKEX"]})
    })
}

module.exports.init = init
module.exports.subscribe = subscribe
module.exports.unsubscribe = unsubscribe
module.exports.subscribeVirtual = subscribeVirtual
module.exports.unsubscribeVirtual = unsubscribeVirtual
module.exports.subscribeBasket = subscribeBasket
module.exports.unsubscribeBasket = unsubscribeBasket