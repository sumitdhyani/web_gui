const CommonUtils = require('./CommonUtils')
const Event = CommonUtils.Event

let m2 = new Map()
function subscribeList(symbols, exchange, vanillaSubscriptionFunction, callback) {
    const key = JSON.stringify(...symbols, exchange)
    let matter = m2.get(key)
    if (undefined === matter) {
        const symbolToIndex = new Map()
        symbols.forEach((symbol, index)=>{
            symbolToIndex.set(symbol, index)
        })

        const prices = new Array(symbols.length).fill(null)
        const priceEvt = new Event()
        let allUpdatesReceived = false;
        matter =
        {
            listUpdator : update=>{
                            prices[symbolToIndex.get(update.symbol)] = update.price
                            allUpdatesReceived =
                            allUpdatesReceived? true:
                                prices.reduce((prev, price)=> {
                                    return prev && (price !== null)
                                },true)
                            
                            if(allUpdatesReceived) {
                                priceEvt.raise(prices)
                            }
                          },
            evt         : priceEvt
        }

        symbols.forEach(symbol => {
            vanillaSubscriptionFunction(symbol, exchange, "trade", matter.listUpdator)
        })
        m2.set(key, matter)
    }
    
    matter.evt.registerCallback(callback)
}


function unsubscribeList(symbols, exchange, vanillaUnsubscriptionFunction, callback) {
    const key = JSON.stringify(...symbols, exchange)
    const matter = m2.get(key)
    if (undefined === matter) {
        throw new Error(`Spurious unsubscription for key: ${key}`)
    }

    matter.evt.unregisterCallback(callback)
    if (matter.evt.empty()) {
        symbols.forEach(symbol=>{
            vanillaUnsubscriptionFunction(symbol, exchange, "trade", matter.listUpdator)
        })
        m2.delete(key)
    }

    
}


const m1 = new Map()
function subscribeListwithCoefficients(symbols, coefficients, exchange, vanillaSubscriptionFunction, callback){
    const key = JSON.stringify([...symbols, ...coefficients, exchange])
    let matter = m1.get(key)
    if (undefined === matter) {
        const consolidatedPriceEvt = new Event()
        matter =
        {
            callback :  prices=>{
                            consolidatedPriceEvt.raise(prices.reduce((prev, price, index)=>{
                                return prev + coefficients[index] * price                  
                            }, 0))
                        },
            evt      :  consolidatedPriceEvt
        }

        subscribeList(symbols, exchange, vanillaSubscriptionFunction, matter.callback)
        m1.set(key, matter)
    }
    
    matter.evt.registerCallback(callback)
}

function unsubscribeListwithCoefficients(symbols, coefficients, exchange, vanillaUnsubscriptionFunction, callback){
    const key = JSON.stringify([...symbols, ...coefficients, exchange])
    const matter = m1.get(key)
    if (undefined === matter) {
        throw new Error(`Spurious unsubscription for key: ${key}`)
    }

    matter.evt.unregisterCallback(callback)
    if (matter.evt.empty()) {
        unsubscribeList(symbols, exchange, vanillaUnsubscriptionFunction, matter.callback)
        m1.delete(key)
    }
}


const m3 = new Map()
function subscribeBasket(symbols, coefficients, exchange, vanillaSubscriptionFunction, conversionSymbol, staticInfo ,callback){
    const key = JSON.stringify([...symbols, ...coefficients, exchange, conversionSymbol])
    let matter = m3.get(key)
    if (undefined === matter) {
        const priceConversionEvt = new Event()
        let conversionFactor = null
        matter = {
            conversionCallback  :   update => { conversionFactor = 1/update.price },
            conversionApplier   :   price =>{
                                        if (null != conversionFactor) {
                                            priceConversionEvt.raise({...staticInfo, price: price*conversionFactor})
                                        }
                                    },
            evt                 :   priceConversionEvt   
        }

        vanillaSubscriptionFunction(conversionSymbol, exchange, "trade", matter.conversionCallback)
        subscribeListwithCoefficients(symbols, coefficients, exchange, vanillaSubscriptionFunction, matter.conversionApplier)
        m3.set(key, matter)
    }

    try {
        matter.evt.registerCallback(callback)
    } catch(err) {
        throw new Error(`This callback is already registered for the key: ${key}`)
    }
}

function unsubscribeBasket(symbols, coefficients, exchange, vanillaUnsubscriptionFunction, conversionSymbol, callback){
    const key = JSON.stringify([...symbols, ...coefficients, exchange, conversionSymbol])
    const matter = m3.get(key)
    if (undefined === matter) {
        throw new Error(`Spurious unsubscription for key: ${key}`)
    } 

    try {
        matter.evt.unregisterCallback(callback)
    } catch(err) {
        throw new Error(`This callback is not registered for the key: ${key}`)
    }

    if (matter.evt.empty()) {
        vanillaUnsubscriptionFunction(conversionSymbol, exchange, "trade", matter.conversionCallback)
        unsubscribeListwithCoefficients(symbols, coefficients, exchange, vanillaUnsubscriptionFunction, matter.conversionApplier)
        m3.delete(key)
    }
}


module.exports.subscribeBasket = subscribeBasket
module.exports.unsubscribeBasket = unsubscribeBasket