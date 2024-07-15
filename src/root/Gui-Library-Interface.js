const { SubscriptionHandler } = require('./IndependentCommonUtils/SubscriptionHandler')
const virtualSubsccriptionFunctions = require('./IndependentCommonUtils/VirtualSubscriptionHandler')
const baskerSubscriptionFunctions = require('./IndependentCommonUtils/BasketSubscriptionHandler')
const { launch, raise_request, download_instruments} = require('./ClientLayerLibrary/ClientInterface')
                                    
let subscriptionHandler = null
let globalDict = null

let libLogger = null
function subscribe(symbol , exchange, type, callback){
    const key = JSON.stringify([symbol, exchange])
    const symbolRecord = globalDict.get(key)
    if (undefined === symbolRecord) {
        throw new Error("Invalid Symbol")
    } else if( 0 !== exchange.localeCompare(symbolRecord.exchange)) {
        throw new Error("Invalid Symbol, for this exchange")
    }
    libLogger.debug(`subscribe, arguments: ${JSON.stringify(arguments)}`)
    subscriptionHandler.subscribe(symbol , exchange, type, callback)
}

function unsubscribe(symbol , exchange, type, callback){
    const key = JSON.stringify([symbol, exchange])
    const symbolRecord = globalDict.get(key)
    if (undefined === symbolRecord) {
        throw new Error("Invalid Symbol")
    } else if( 0 !== exchange.localeCompare(symbolRecord.exchange)) {
        throw new Error("Invalid Symbol, for this exchange")
    }
    libLogger.debug(`unsubscribe, arguments: ${JSON.stringify(arguments)}`)
    subscriptionHandler.unsubscribe(symbol , exchange, type, callback)
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

    virtualSubsccriptionFunctions.subscribeVirtual(assetSymbol,
                     currencySymbol,
                     subscriptionHandler.subscribe.bind(subscriptionHandler),
                     exchange,
                     {asset: asset, currency : currency, bridge : bridge, exchange : exchange},
                     callback)
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

    virtualSubsccriptionFunctions.unsubscribeVirtual(assetSymbol,
                                         currencySymbol,
                                         subscriptionHandler.unsubscribe.bind(subscriptionHandler),
                                         exchange,
                                         callback)
}

function subscribeBasket(assets, coefficients, bridgeCurrency, targetAsset, exchange, callback){ 
    libLogger.debug(`subscribeBasket, arguments: ${JSON.stringify(arguments)}`)
    if (assets.length !== coefficients.length) {
        throw new Error("No. of assets should be equal to the no. of coefficients")
    }

    const symbolNameGenerator = exchangeSymbolNameGenerators[exchange]
    if (undefined === symbolNameGenerator) {
        throw new Error("Invalid exchange")
    }

    const bridgeSymbol = symbolNameGenerator(targetAsset, bridgeCurrency)
    const bridgeSymbolKey =  JSON.stringify([bridgeSymbol, exchange])
    const bridgeSymbolRecord = globalDict.get(bridgeSymbolKey)
    if (undefined === bridgeSymbolRecord) {
        throw new Error("There is no way to convert bridge currency intio the target asset")
    }
    
    const symbols = []
    assets.forEach(asset => {
        const symbol = symbolNameGenerator(asset, bridgeCurrency, exchange)
        const symbolKey = JSON.stringify([symbol, exchange])
        const symbolRecord = globalDict.get(symbolKey)
        if (symbolRecord === undefined) {
            throw new Error(`No corresponding symbol exists for asset: ${asset}, currency: ${bridgeCurrency} in the exchange: ${exchange}`)
        }

        symbols.push(symbol)
    })
    
    baskerSubscriptionFunctions.subscribeBasket(symbols,
                                                coefficients,
                                                exchange,
                                                subscriptionHandler.subscribe.bind(subscriptionHandler),
                                                bridgeSymbol,
                                                {assets : assets, coefficients : coefficients, targetAsset: targetAsset},
                                                callback)
}

function unsubscribeBasket(assets, coefficients, bridgeCurrency, targetAsset, exchange, callback){
    libLogger.debug(`unsubscribeBasket, arguments: ${JSON.stringify(arguments)}`)
    if (assets.length !== coefficients.length) {
        throw new Error("No. of assets should be equal to the no. of coefficients")
    }

    const symbolNameGenerator = exchangeSymbolNameGenerators[exchange]
    if (undefined === symbolNameGenerator) {
        throw new Error("Invalid exchange")
    }

    const bridgeSymbol = symbolNameGenerator(targetAsset, bridgeCurrency, exchange)
    const bridgeSymbolKey = JSON.stringify([bridgeSymbol, exchange])
    const bridgeSymbolRecord = globalDict.get(bridgeSymbolKey)
    if (undefined === bridgeSymbolRecord) {
        throw new Error("There is no way to convert bridge currency intio the target asset")
    }
    
    const symbols = []
    assets.forEach(asset => {
        const symbol = symbolNameGenerator(asset, bridgeCurrency, exchange)
        const symbolKey = JSON.stringify([symbol, exchange])
        const symbolRecord = globalDict.get(symbolKey)
        if (symbolRecord === undefined) {
            throw new Error(`No corresponding symbol exists for asset: ${asset}, currency: ${bridgeCurrency} in the exchange: ${exchange}`)
        }

        symbols.push(symbol)
    })

    baskerSubscriptionFunctions.unsubscribeBasket(symbols,
                                                   coefficients,
                                                   exchange,
                                                   subscriptionHandler.unsubscribe.bind(subscriptionHandler),
                                                   bridgeSymbol,
                                                   callback)
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
        subscriptionHandler = new SubscriptionHandler( (symbol, exchange, type)=>{
                                                        raise_request({
                                                                action : "subscribe",
                                                                symbol : symbol,
                                                                exchange : exchange,
                                                                type: type})
                                                        },
                                                        (symbol, exchange, type)=>{
                                                            raise_request({
                                                                action : "unsubscribe",
                                                                symbol : symbol,
                                                                exchange : exchange,
                                                                type: type})
                                                        },
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